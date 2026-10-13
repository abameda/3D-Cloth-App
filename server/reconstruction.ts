import { createServer, type IncomingMessage } from 'node:http';
import { createServer as createHttpsServer, type ServerOptions as HttpsOptions } from 'node:https';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { reconstructionInputSchema, type ReconstructionInput, type ReconstructionJob } from '../src/domain/reconstruction';
import { validateFaceScan } from '../src/domain/faceScan';
import { parseImage } from './service';
import type { Studio } from './studio';

type Row={id:string;owner:string;request_id:string;digest:string;kind:'face'|'body'|'garment';garment_id:string|null;status:ReconstructionJob['status'];stage:string;error:string|null;attempt:number;created:number;updated:number};
export class ReconstructionStore {
  private db:DatabaseSync;
  constructor(path:string){this.db=new DatabaseSync(path);this.db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS reconstructions(id TEXT PRIMARY KEY,owner TEXT NOT NULL,request_id TEXT NOT NULL,digest TEXT NOT NULL,kind TEXT NOT NULL,garment_id TEXT,status TEXT NOT NULL,stage TEXT NOT NULL,error TEXT,attempt INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,updated INTEGER NOT NULL,UNIQUE(owner,request_id));`);
  }
  reserve(owner:string,input:ReconstructionInput):{row:Row;created:boolean}{
    const digest=createHash('sha256').update(JSON.stringify({...input,requestId:''})).digest('hex');
    const old=this.db.prepare('SELECT * FROM reconstructions WHERE owner=? AND request_id=?').get(owner,input.requestId) as Row|undefined;
    if(old){if(old.digest!==digest)throw Error('This request ID belongs to a different capture.');return{row:old,created:false};}
    const active=this.db.prepare("SELECT count(*) AS n FROM reconstructions WHERE status IN ('queued','processing')").get() as{n:number};
    if(active.n>=4)throw Error('Your computer’s queue is full. Wait for a capture to finish.');
    const id=randomUUID(),now=Date.now();
    this.db.prepare("INSERT INTO reconstructions(id,owner,request_id,digest,kind,garment_id,status,stage,created,updated) VALUES(?,?,?,?,?,?,'queued','receiving',?,?)").run(id,owner,input.requestId,digest,input.kind,input.garmentId??null,now,now);
    return{row:this.get(owner,id)!,created:true};
  }
  get(owner:string,id:string){return this.db.prepare('SELECT * FROM reconstructions WHERE owner=? AND id=?').get(owner,id) as Row|undefined;}
  next(){return this.db.prepare("SELECT * FROM reconstructions WHERE status='queued' AND stage='queued' ORDER BY created LIMIT 1").get() as Row|undefined;}
  list(owner:string){return this.db.prepare('SELECT * FROM reconstructions WHERE owner=? ORDER BY created DESC').all(owner) as Row[];}
  update(id:string,status:Row['status'],stage:string,error:string|null=null){this.db.prepare("UPDATE reconstructions SET status=?,stage=?,error=?,updated=? WHERE id=? AND status<>'cancelled'").run(status,stage,error,Date.now(),id);}
  cancel(owner:string,id:string){this.db.prepare("UPDATE reconstructions SET status='cancelled',stage='cancelled',error=NULL,updated=? WHERE owner=? AND id=?").run(Date.now(),owner,id);}
  retry(owner:string,id:string){const row=this.get(owner,id);if(!row||row.status!=='failed'||row.attempt>=2)throw Error('Retake your photos to start a new capture.');this.db.prepare("UPDATE reconstructions SET status='queued',stage='queued',error=NULL,attempt=attempt+1,updated=? WHERE owner=? AND id=?").run(Date.now(),owner,id);}
  recover(){this.db.prepare("UPDATE reconstructions SET status='queued',stage='queued' WHERE status='processing'").run();this.db.prepare("UPDATE reconstructions SET status='failed',stage='failed',error='Capture upload was interrupted. Retake or select the photos again.' WHERE stage='receiving'").run();}
  remove(owner:string,id:string){this.db.prepare('DELETE FROM reconstructions WHERE owner=? AND id=?').run(owner,id);}
  expired(){return this.db.prepare("SELECT * FROM reconstructions WHERE updated<? AND status NOT IN ('queued','processing')").all(Date.now()-86400000) as Row[];}
  close(){this.db.close();}
}

export type LocalRunner=(directory:string,kind:Row['kind'],signal:AbortSignal,onStage:(stage:string)=>void)=>Promise<void>;
export function pythonReconstructionRunner(root:string):LocalRunner {
  const python=resolve(root,'.runtime/reconstruction-python/Scripts/python.exe'),script=resolve(root,'local-engine/reconstruct.py');
  return(directory,kind,signal,onStage)=>new Promise((accept,reject)=>{
    const child=spawn(python,[script,'--job',directory,'--photos',join(directory,'capture'),'--kind',kind],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let buffer='',failure='Local reconstruction did not finish. Check capture quality and the local computer.',settled=false;
    const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timeout);signal.removeEventListener('abort',abort);error?reject(error):accept();};
    function stop(childProcess:ChildProcess){if(childProcess.pid&&process.platform==='win32')spawn('taskkill',['/PID',String(childProcess.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else childProcess.kill('SIGTERM');}
    const abort=()=>stop(child);
    const timeout=setTimeout(()=>{failure='Processing took too long. Reduce the capture size or try sharper overlapping views.';stop(child);},45*60000);
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    child.stdout.on('data',chunk=>{
      buffer+=chunk.toString();if(buffer.length>65536){failure='Invalid local worker response.';stop(child);return;}
      let index:number;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);try{const event=JSON.parse(line);if(typeof event.stage==='string'){onStage(event.stage);if(event.stage==='failed'&&typeof event.error==='string')failure=event.error.slice(0,500);}}catch{}}
    });
    // Diagnostic stderr is consumed but never reflected as paths/secrets in the client.
    child.stderr.on('data',()=>{});child.on('error',()=>finish(Error('The local reconstruction runtime is unavailable. Run the local setup first.')));
    child.on('exit',code=>finish(signal.aborted?Error('Cancelled.'):code===0?undefined:Error(failure)));
  });
}

async function requestBody(req:IncomingMessage){
  if(!req.headers['content-type']?.startsWith('application/json'))throw Error('Send a JSON capture.');
  const limit=96*1024*1024;if(Number(req.headers['content-length'])>limit)throw Error('This capture is too large.');
  const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw Error('This capture is too large.');chunks.push(Buffer.from(chunk));}
  const input=reconstructionInputSchema.parse(JSON.parse(Buffer.concat(chunks).toString()));
  for(const photo of input.images)parseImage(photo);
  return input;
}

export function createReconstructionServer(options:{root:string;store:ReconstructionStore;runner:LocalRunner;identity:(token:string)=>Promise<string>;tls?:HttpsOptions;studio?:Studio}){
  const root=resolve(options.root);let active:{id:string;controller:AbortController;done:Promise<void>}|undefined;
  const uploads=new Map<string,Promise<void>>(),erasing=new Set<string>();
  let closing=false;
  const directory=(id:string)=>{if(!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid job ID');return join(root,id);};
  async function publicJob(row:Row):Promise<ReconstructionJob>{
    let quality:ReconstructionJob['quality'];if(row.status==='reconstructed'){try{quality=JSON.parse(await readFile(join(directory(row.id),'quality.json'),'utf8'));}catch{}}
    let capture:{count?:number;views?:ReconstructionInput['views']}={};try{capture=JSON.parse(await readFile(join(directory(row.id),'input.json'),'utf8'));}catch{}
    return{id:row.id,kind:row.kind,garmentId:row.garment_id??undefined,status:row.status,stage:row.stage,error:row.error,attempt:row.attempt,quality,photoCount:capture.count??0,views:capture.views};
  }
  async function removeCapture(row:Row){
    options.store.cancel(row.owner,row.id);
    await uploads.get(row.id)?.catch(()=>{});
    if(active?.id===row.id){const pending=active;pending.controller.abort();await pending.done;}
    await rm(directory(row.id),{recursive:true,force:true});options.store.remove(row.owner,row.id);
  }
  async function work(){
    if(active||closing)return;
    const row=options.store.next();if(!row)return;
    const controller=new AbortController();
    const done=(async()=>{
      try{
        const folder=directory(row.id);await stat(join(folder,'capture'));options.store.update(row.id,'processing','checking_photos');
        await options.runner(folder,row.kind,controller.signal,stage=>options.store.update(row.id,'processing',stage));
        if(controller.signal.aborted)return;
        const data=await readFile(join(folder,'result.glb'));const manifest=validateFaceScan(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer);
        if(!manifest.images?.length||!manifest.textures?.length)throw Error('No photographed surface textures were produced. Retake well-lit overlapping views.');
        const quality=JSON.parse(await readFile(join(folder,'quality.json'),'utf8'));
        if(quality.sha256!==createHash('sha256').update(data).digest('hex')||quality.geometry!=='measured_multi_view'||!quality.textures)throw Error('The output did not pass reconstruction quality checks.');
        options.store.update(row.id,'reconstructed','reconstructed');
      }catch(e){if(!controller.signal.aborted)options.store.update(row.id,'failed','failed',e instanceof Error?e.message.slice(0,500):'Processing failed. Retake overlapping photos.');}
      finally{active=undefined;setImmediate(()=>void work());}
    })();active={id:row.id,controller,done};
  }
  const rates=new Map<string,{n:number;until:number}>();
  const transport=options.tls?createHttpsServer.bind(null,options.tls):createServer;
  const server=transport(async(req,res)=>{
    const reply=(status:number,value:unknown)=>{if(!res.destroyed&&!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}};
    let owner:string;try{if(req.headers.origin)throw Error('Native client required');owner=await options.identity((req.headers.authorization??'').replace(/^Bearer /,''));if(!owner||owner.length>200)throw Error('Invalid identity');}catch{reply(401,{error:'Connect your private reconstruction computer first.'});return;}
    const now=Date.now();for(const[key,value]of rates)if(value.until<now)rates.delete(key);
    if(!rates.has(owner)&&rates.size>=1000){reply(503,{error:'The local engine is busy.'});return;}
    const rate=rates.get(owner)??{n:0,until:now+60000};rates.set(owner,rate);if(++rate.n>120){reply(429,{error:'Wait before refreshing again.'});return;}
    const path=(req.url??'').split('?')[0],match=/^\/v1\/reconstruction\/jobs\/([0-9a-f-]{36})(\/artifact|\/retry|\/photos\/([0-9]{1,2}))?$/.exec(path);
    try{
      if(options.studio&&await options.studio.handle(req,res,owner,path))return;
      if(path==='/v1/reconstruction/capabilities'&&req.method==='GET'){reply(200,{engine:'local-colmap-openmvs',paidReconstructionServices:false,photoReconstruction:true,runtimeReady:['.runtime/colmap/bin/bin/colmap.exe','.runtime/openmvs/bin/vc17/x64/Release/TextureMesh.exe','.runtime/reconstruction-python/Scripts/python.exe','.runtime/reconstruction-models/models/u2net/u2net.onnx'].every(path=>existsSync(resolve(path))),depthFusion:false,clothFitting:false,clothSimulation:false});return;}
      if(path==='/v1/reconstruction/jobs'&&req.method==='GET'){reply(200,{jobs:await Promise.all(options.store.list(owner).map(publicJob))});return;}
      if(path==='/v1/reconstruction/jobs'&&req.method==='DELETE'){
        if(erasing.has(owner)){reply(409,{error:'Capture deletion is already running.'});return;}
        erasing.add(owner);try{const rows=options.store.list(owner);for(const row of rows)options.store.cancel(owner,row.id);for(const row of rows)await removeCapture(row);reply(200,{deleted:true});}finally{erasing.delete(owner);}return;
      }
      if(path==='/v1/reconstruction/jobs'&&req.method==='POST'){
        let input:ReconstructionInput;try{input=await requestBody(req);}catch{reply(400,{error:'Provide 8–48 JPEG photos under 3 MB each and confirm local processing consent.'});return;}
        if(erasing.has(owner)){reply(409,{error:'Wait for capture deletion to finish.'});return;}
        let reserved:ReturnType<ReconstructionStore['reserve']>;try{reserved=options.store.reserve(owner,input);}catch(e){reply(409,{error:e instanceof Error?e.message:'Capture already submitted.'});return;}
        if(reserved.created){
          const upload=(async()=>{const capture=join(directory(reserved.row.id),'capture');await mkdir(capture,{recursive:true});for(let i=0;i<input.images.length;i++)await writeFile(join(capture,`${String(i).padStart(4,'0')}.jpg`),Buffer.from(input.images[i].split(',')[1],'base64'));await writeFile(join(directory(reserved.row.id),'input.json'),JSON.stringify({kind:input.kind,garmentId:input.garmentId,count:input.images.length,views:input.views,consent:true}));})();
          uploads.set(reserved.row.id,upload);
          try{await upload;}catch{options.store.update(reserved.row.id,'failed','failed','The computer could not save this capture.');reply(507,{error:'Local storage is full or unavailable.'});return;}finally{uploads.delete(reserved.row.id);}
        }
        if(reserved.created)options.store.update(reserved.row.id,'queued','queued');
        reply(202,{job:await publicJob(options.store.get(owner,reserved.row.id)!)});void work();return;
      }
      if(match){
        const row=options.store.get(owner,match[1]);if(!row){reply(404,{error:'Capture not found.'});return;}
        if(req.method==='GET'&&match[3]!==undefined){
          const capture=await publicJob(row),index=Number(match[3]);
          if(row.status==='cancelled'||index>=(capture.photoCount??0)){reply(404,{error:'Photo not found.'});return;}
          const bytes=await readFile(join(directory(row.id),'capture',`${String(index).padStart(4,'0')}.jpg`));
          res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);return;
        }
        if(req.method==='GET'&&!match[2]){reply(200,{job:await publicJob(row)});return;}
        if(req.method==='GET'&&match[2]==='/artifact'){
          if(row.status!=='reconstructed'){reply(409,{error:'Reconstruction is not ready.'});return;}
          const bytes=await readFile(join(directory(row.id),'result.glb'));if(bytes.length>16*1024*1024)throw Error('Invalid artifact size');
          res.writeHead(200,{'Content-Type':'model/gltf-binary','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);return;
        }
        if(req.method==='POST'&&match[2]==='/retry'){try{await stat(join(directory(row.id),'input.json'));await rm(join(directory(row.id),'cancel'),{force:true});options.store.retry(owner,row.id);reply(202,{job:await publicJob(options.store.get(owner,row.id)!)});void work();}catch{reply(409,{error:'Retake your photos for a new capture, or retry a failed job up to twice.'});}return;}
        if(req.method==='DELETE'&&!match[2]){
          await removeCapture(row);reply(200,{deleted:true});return;
        }
      }
      reply(404,{error:'Endpoint not found.'});
    }catch{reply(500,{error:'The local engine could not complete this operation. Your wardrobe was kept.'});}
  });
  server.requestTimeout=120000;server.headersTimeout=10000;server.timeout=130000;
  options.store.recover();
  const cleanup=setInterval(()=>{if(closing)return;for(const row of options.store.expired()){options.store.cancel(row.owner,row.id);void rm(directory(row.id),{recursive:true,force:true}).then(()=>options.store.remove(row.owner,row.id)).catch(()=>{});}void work();},60000);
  cleanup.unref();server.on('listening',()=>void work());
  server.on('close',()=>{closing=true;clearInterval(cleanup);active?.controller.abort();options.studio?.close();});
  return server;
}

export function personalEngineIdentity(token:string){
  if(token.length<32||token.length>512||/\s/.test(token))throw Error('Set a private engine token of 32–512 characters.');
  const expected=createHash('sha256').update(token).digest();
  return async(received:string)=>{const actual=createHash('sha256').update(received).digest();if(!timingSafeEqual(expected,actual))throw Error('Unauthorized');return expected.toString('hex');};
}
