import { mkdirSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReconstructionStore, createReconstructionServer, personalEngineIdentity, pythonReconstructionRunner } from './reconstruction';
import { createStudio, pipelineRunner } from './studio';

try {
  const port=Number(process.env.THREAD_RECONSTRUCTION_PORT??8790);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
  const root=resolve('.data/reconstruction');mkdirSync(root,{recursive:true});
  const store=new ReconstructionStore(resolve(root,'jobs.sqlite'));
  const cert=process.env.THREAD_RECONSTRUCTION_TLS_CERT,key=process.env.THREAD_RECONSTRUCTION_TLS_KEY;
  if(!!cert!==!!key)throw Error('Configure both the local TLS certificate and key');
  const tls=cert&&key?{cert:readFileSync(resolve(cert)),key:readFileSync(resolve(key)),minVersion:'TLSv1.2' as const}:undefined;
  const host=process.env.THREAD_RECONSTRUCTION_HOST??'127.0.0.1';
  // Plain HTTP may only bind loopback. LAN phone traffic must be encrypted.
  if(!tls&&!['127.0.0.1','localhost','::1'].includes(host))throw Error('LAN access needs a private TLS certificate');
  const studioRoot=resolve('.data/studio');mkdirSync(studioRoot,{recursive:true});
  const studio=createStudio({root:studioRoot,runner:pipelineRunner(process.cwd())});
  const server=createReconstructionServer({root,store,runner:pythonReconstructionRunner(process.cwd()),identity:personalEngineIdentity(process.env.THREAD_RECONSTRUCTION_TOKEN??''),tls,studio});
  server.listen(port,host,()=>console.log(`Thread local reconstruction engine ready over ${tls?'HTTPS':'loopback HTTP'} on port ${port}. Reconstruction service cost: $0.`));
  server.on('error',error=>{const code=(error as NodeJS.ErrnoException).code;console.error(code==='EADDRNOTAVAIL'?'The configured Wi-Fi address is no longer on this computer. Update the local certificate and HTTPS address.':code==='EADDRINUSE'?'The reconstruction port is already in use. Keep the existing worker or choose an unused port.':'The local engine could not listen. Check the port and local setup.');process.exitCode=1;});
}catch {console.error('Check the private token, port and local runtime. LAN access requires both TLS certificate/key paths.');process.exitCode=1;}
