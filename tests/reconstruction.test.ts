import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {ReconstructionStore,createReconstructionServer,personalEngineIdentity,type LocalRunner} from '../server/reconstruction';
import {reconstructionInputSchema} from '../src/domain/reconstruction';

const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,0,255,217]).toString('base64');
const input=()=>({requestId:randomUUID(),kind:'face' as const,images:Array(8).fill(image),consent:true as const});
test('reconstruction input needs consent, bounded views and a clothing reference',()=>{
 assert.throws(()=>reconstructionInputSchema.parse({...input(),consent:false}));
 assert.throws(()=>reconstructionInputSchema.parse({...input(),images:[image]}));
 assert.throws(()=>reconstructionInputSchema.parse({...input(),kind:'garment'}));
});
test('queue reservations are owner scoped, reject changed payloads, and wait for durable uploads',()=>{
 const store=new ReconstructionStore(':memory:');try{
  const capture=input(),reserved=store.reserve('first',capture);assert.equal(store.next(),undefined);
  assert.equal(store.reserve('first',capture).row.id,reserved.row.id);
  assert.throws(()=>store.reserve('first',{...capture,kind:'body'}));
  assert.notEqual(store.reserve('second',capture).row.id,reserved.row.id);
  assert.equal(store.get('second',reserved.row.id),undefined);
  store.update(reserved.row.id,'queued','queued');assert.equal(store.next()?.id,reserved.row.id);
  store.update(reserved.row.id,'processing','texturing');store.recover();assert.equal(store.get('first',reserved.row.id)?.status,'queued');
  store.update(reserved.row.id,'failed','failed','bad capture');store.retry('first',reserved.row.id);assert.equal(store.get('first',reserved.row.id)?.attempt,1);
  store.cancel('first',reserved.row.id);store.update(reserved.row.id,'reconstructed','reconstructed');assert.equal(store.get('first',reserved.row.id)?.status,'cancelled');
 }finally{store.close();}
});
test('HTTP uses actual measured textured artifact fixtures and protects ownership, retries, deletion and malformed photos',async()=>{
 const root=await mkdtemp(join(tmpdir(),'thread-reconstruction-test-')),store=new ReconstructionStore(join(root,'jobs.sqlite'));
 const artifact=await readFile(resolve('tests/fixtures/measured-castle.glb'));
 let runs=0;
 const runner:LocalRunner=async(folder,kind,_signal,onStage)=>{
  runs++;onStage('texturing');await writeFile(join(folder,'result.glb'),artifact);
  await writeFile(join(folder,'quality.json'),JSON.stringify({kind,photos:8,triangles:37332,textures:1,bytes:artifact.length,geometry:'measured_multi_view',texture:'photographed_atlas',identity_verified:false,fit_status:'not_applicable',body_reconstructed:false,sha256:createHash('sha256').update(artifact).digest('hex')}));
 };
 const server=createReconstructionServer({root,store,runner,identity:async token=>{if(!['first','second'].includes(token))throw Error('unauthorized');return token;}});
 await new Promise<void>(accept=>server.listen(0,'127.0.0.1',accept));
 const port=(server.address()as import('node:net').AddressInfo).port;
 const call=(path:string,method='GET',body?:unknown,token='first')=>fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
  assert.equal((await call('/v1/reconstruction/capabilities','GET',undefined,'wrong')).status,401);
  assert.equal((await call('/v1/reconstruction/jobs','POST',{...input(),images:Array(8).fill('https://images.example/photo.jpg')})).status,400);
  const capture=input(),response=await call('/v1/reconstruction/jobs','POST',capture);assert.equal(response.status,202);
  const first=(await response.json()).job;let job=first;
  for(let i=0;i<20&&job.status!=='reconstructed';i++){await new Promise(accept=>setTimeout(accept,20));job=(await(await call(`/v1/reconstruction/jobs/${first.id}`)).json()).job;}
  assert.equal(job.status,'reconstructed');assert.equal(job.quality.identity_verified,false);
  assert.equal(job.photoCount,8);
  const reference=await call(`/v1/reconstruction/jobs/${first.id}/photos/0`);
  assert.equal(reference.status,200);assert.equal(reference.headers.get('cache-control'),'no-store');
  assert.deepEqual(Buffer.from(await reference.arrayBuffer()),Buffer.from(image.split(',')[1],'base64'));
  assert.equal((await call(`/v1/reconstruction/jobs/${first.id}/photos/0`,'GET',undefined,'second')).status,404);
  assert.equal((await call(`/v1/reconstruction/jobs/${first.id}/photos/8`)).status,404);
  assert.equal((await call(`/v1/reconstruction/jobs/${first.id}/artifact`,'GET',undefined,'second')).status,404);
  assert.deepEqual(Buffer.from(await(await call(`/v1/reconstruction/jobs/${first.id}/artifact`)).arrayBuffer()),artifact);
  assert.equal((await call('/v1/reconstruction/jobs','POST',capture)).status,202);assert.equal(runs,1);
  assert.equal((await call('/v1/reconstruction/jobs','POST',{...capture,kind:'body'})).status,409);
  assert.equal((await call(`/v1/reconstruction/jobs/${first.id}`,'DELETE')).status,200);
  assert.equal((await call(`/v1/reconstruction/jobs/${first.id}`)).status,404);
  assert.equal((await call(`/v1/reconstruction/jobs/${first.id}/photos/0`)).status,404);
 }finally{server.closeAllConnections();await new Promise<void>(accept=>server.close(()=>accept()));store.close();await rm(root,{recursive:true,force:true});}
});

test('delete all captures removes only the requesting owner and waits for the active worker',async()=>{
 const root=await mkdtemp(join(tmpdir(),'thread-reconstruction-delete-')),store=new ReconstructionStore(join(root,'jobs.sqlite'));
 let stopped=false;
 const server=createReconstructionServer({root,store,identity:async token=>token,runner:async(folder,_kind,signal)=>{
  await new Promise<void>(accept=>signal.addEventListener('abort',()=>{setTimeout(()=>{stopped=true;accept();},15);},{once:true}));
  await writeFile(join(folder,'late-output.txt'),'must also be removed');
 }});
 await new Promise<void>(accept=>server.listen(0,'127.0.0.1',accept));const port=(server.address() as import('node:net').AddressInfo).port;
 const call=(method:string,token:string,body?:unknown)=>fetch(`http://127.0.0.1:${port}/v1/reconstruction/jobs`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
  const first=(await(await call('POST','first',input())).json()).job;
  await call('POST','second',input());
  assert.equal((await call('DELETE','first')).status,200);assert.equal(stopped,true);
  assert.equal((await(await call('GET','first')).json()).jobs.length,0);
  assert.equal((await(await call('GET','second')).json()).jobs.length,1);
  await assert.rejects(readFile(join(root,first.id,'late-output.txt')));
  await call('DELETE','second');
 }finally{server.closeAllConnections();await new Promise<void>(accept=>server.close(()=>accept()));store.close();await rm(root,{recursive:true,force:true});}
});
test('private pairing token comparison rejects bad credentials',async()=>{
 const identity=personalEngineIdentity('private-local-token-with-32-characters');
 assert.ok(await identity('private-local-token-with-32-characters'));
 await assert.rejects(identity('wrong'));assert.throws(()=>personalEngineIdentity('short'));
});

test('a generic untextured model cannot be promoted to a reconstructed photo result',async()=>{
 const root=await mkdtemp(join(tmpdir(),'thread-reconstruction-invalid-')),store=new ReconstructionStore(join(root,'jobs.sqlite'));
 const generic=await readFile('tests/fixtures/static-scan.glb');
 const server=createReconstructionServer({root,store,identity:async()=> 'owner',runner:async folder=>{
  await writeFile(join(folder,'result.glb'),generic);await writeFile(join(folder,'quality.json'),JSON.stringify({geometry:'measured_multi_view',textures:1,sha256:createHash('sha256').update(generic).digest('hex')}));
 }});
 await new Promise<void>(accept=>server.listen(0,'127.0.0.1',accept));const port=(server.address()as import('node:net').AddressInfo).port;
 try{
  const response=await fetch(`http://127.0.0.1:${port}/v1/reconstruction/jobs`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test'},body:JSON.stringify(input())});
  const id=(await response.json()).job.id;let job:any;
  for(let i=0;i<20;i++){job=(await(await fetch(`http://127.0.0.1:${port}/v1/reconstruction/jobs/${id}`,{headers:{Authorization:'Bearer test'}})).json()).job;if(job.status==='failed')break;await new Promise(accept=>setTimeout(accept,10));}
  assert.equal(job.status,'failed');assert.match(job.error,/photographed surface textures/);
 }finally{server.closeAllConnections();await new Promise<void>(accept=>server.close(()=>accept()));store.close();await rm(root,{recursive:true,force:true});}
});
