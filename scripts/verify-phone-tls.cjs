const assert=require('node:assert/strict');
const https=require('node:https');
const {readFileSync}=require('node:fs');
const {ReconstructionStore,createReconstructionServer,personalEngineIdentity}=require('../.node-build/server/reconstruction.js');

(async()=>{
 const store=new ReconstructionStore(':memory:');
 const server=createReconstructionServer({root:'.data/phone-tls-check',store,runner:async()=>{},identity:personalEngineIdentity('local-tls-check-token-with-32-characters'),tls:{cert:readFileSync('.data/phone-tls/server.pem'),key:readFileSync('.data/phone-tls/server-key.pem')}});
 await new Promise((accept,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',accept);});
 const url=`https://127.0.0.1:${server.address().port}/v1/reconstruction/capabilities`;
 function request(ca,token){return new Promise((accept,reject)=>{const req=https.get(url,{ca,headers:{Authorization:`Bearer ${token}`}},response=>{let body='';response.on('data',part=>body+=part);response.on('end',()=>accept({status:response.statusCode,body}));});req.on('error',reject);});}
 try{
  const ca=readFileSync('.data/phone-tls/root.pem');
  const result=await request(ca,'local-tls-check-token-with-32-characters');assert.equal(result.status,200);
  const capabilities=JSON.parse(result.body);assert.equal(capabilities.paidReconstructionServices,false);assert.equal(capabilities.runtimeReady,true);
  assert.equal((await request(ca,'wrong-token')).status,401);
  await assert.rejects(request(undefined,'local-tls-check-token-with-32-characters'));
  console.log('Direct HTTPS: trusted local certificate accepted; unknown CA and wrong token rejected. Local runtime ready. No photos or paid services used.');
 }finally{server.closeAllConnections();await new Promise(accept=>server.close(accept));store.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
