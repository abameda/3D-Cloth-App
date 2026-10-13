import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packTrackedFace,canCaptureFaceView,faceScanViews,assertFaceCaptureAnchor} from '../src/domain/trackedFace';
import {validateFaceScan} from '../src/domain/faceScan';
const packet={positions:[-.09,-.1,0,.09,-.1,0,0,.1,0,0,0,.04],indices:[0,1,3,1,2,3,2,0,3],uvs:[0,1,1,1,.5,0,.5,.5]};
const jpeg=new Uint8Array([255,216,255,224,0,0,255,217]);
test('tracked face packs real supplied geometry and embedded image as bounded static GLB',()=>{
  const bytes=packTrackedFace(packet,jpeg),manifest=validateFaceScan(bytes);assert.equal(manifest.meshes.length,1);assert.equal(manifest.images?.[0].mimeType,'image/jpeg');assert.equal(manifest.accessors[0].count,4);
  const view=new DataView(bytes),jsonLength=view.getUint32(12,true),position=manifest.bufferViews[manifest.accessors[0].bufferView];assert.equal(view.getFloat32(28+jsonLength+(position.byteOffset??0),true),Math.fround(-.09));
});
test('malformed vertices, indices, UVs and photographic data cannot be installed',()=>{
  assert.throws(()=>packTrackedFace({...packet,positions:[NaN,0,0]},jpeg));assert.throws(()=>packTrackedFace({...packet,indices:[0,1,50]},jpeg));assert.throws(()=>packTrackedFace({...packet,uvs:[0,1]},jpeg));assert.throws(()=>packTrackedFace(packet,new Uint8Array(100)));
});
test('scan progress is gated by actual tracking, pose and expression, not elapsed time',()=>{
  const neutral={tracked:true,yaw:0,pitch:0,jawOpen:0,blinkLeft:0,blinkRight:0};assert.ok(canCaptureFaceView(neutral,faceScanViews[0]));
  assert.equal(canCaptureFaceView({...neutral,tracked:false},faceScanViews[0]),false);assert.equal(canCaptureFaceView({...neutral,yaw:.8},faceScanViews[0]),false);assert.equal(canCaptureFaceView({...neutral,jawOpen:.6},faceScanViews[0]),false);assert.equal(canCaptureFaceView({...neutral,blinkLeft:1},faceScanViews[0]),false);
  assert.ok(canCaptureFaceView({...neutral,yaw:faceScanViews[1].yaw},faceScanViews[1]));
});
test('canonical topology is not identity: a changed native anchor invalidates capture continuity',()=>{
  const first='00000000-0000-4000-8000-000000000001',next='00000000-0000-4000-8000-000000000002';
  assert.equal(assertFaceCaptureAnchor(undefined,first),first);assert.equal(assertFaceCaptureAnchor(first,first.toUpperCase()),first);
  assert.throws(()=>assertFaceCaptureAnchor(first,next),/Tracking changed/);assert.throws(()=>assertFaceCaptureAnchor(undefined,'invalid'));
});
