const fs=require('node:fs'),https=require('node:https');
const config=Object.fromEntries(fs.readFileSync('.env.local-reconstruction','utf8').split(/\r?\n/).filter(line=>line.includes('=')).map(line=>[line.slice(0,line.indexOf('=')),line.slice(line.indexOf('=')+1)]));
const host=config.THREAD_RECONSTRUCTION_HOST;
if(!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\d+(\.\d+)*$/.test(host))throw Error('This check only connects to the configured private IPv4 address.');
const req=https.get(`https://${host}:${config.THREAD_RECONSTRUCTION_PORT||8790}/v1/reconstruction/capabilities`,{ca:fs.readFileSync('.data/phone-tls/root.pem'),headers:{Authorization:`Bearer ${config.THREAD_RECONSTRUCTION_TOKEN}`}},response=>{
 let body='';response.on('data',part=>body+=part);response.on('end',()=>{
  try{const value=JSON.parse(body);if(response.statusCode!==200||value.runtimeReady!==true||value.paidReconstructionServices!==false)throw Error('The configured computer did not pass its readiness check.');console.log('Running private Wi-Fi HTTPS worker: authenticated; local runtime ready; no paid reconstruction services.');}
  catch(error){console.error(error.message);process.exitCode=1;}
 });
});
req.setTimeout(10000,()=>req.destroy(Error('The private computer did not respond.')));
req.on('error',error=>{console.error(error.message);process.exitCode=1;});
