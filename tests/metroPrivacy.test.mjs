import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../metro.config.js';

test('LAN development server blocks private photos and credentials before asset/source routing',()=>{
 for(const url of ['/assets/.data/reconstruction/job/capture/0000.jpg','/assets/work/private-capture/front.jpg','/.env.local-reconstruction','/assets/%2edata/phone-tls/server-key.pem','/assets/%252edata/reconstruction/private.jpg','/src/.runtime/file']){
  let forwarded=false,ended=false;const headers={};const response={statusCode:200,setHeader:(key,value)=>headers[key]=value,end:()=>{ended=true;}};
  config.server.enhanceMiddleware(()=>{forwarded=true;},{})({url},response,()=>{});
  assert.equal(response.statusCode,403,url);assert.equal(forwarded,false,url);assert.equal(ended,true);assert.equal(headers['Cache-Control'],'no-store');
 }
 let forwarded=false;config.server.enhanceMiddleware(()=>{forwarded=true;},{})({url:'/assets/assets/avatar/thread-character.glb?platform=ios'},{},()=>{});assert.equal(forwarded,true);
});
