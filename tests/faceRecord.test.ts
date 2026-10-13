import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFaceRecord,faceCaptureOwnsModel} from '../src/domain/faceRecord';
test('legacy face files keep their URI without being labelled verified photo reconstructions',()=>{
  assert.deepEqual(readFaceRecord('file:///old.glb'),{uri:'file:///old.glb',source:'legacy'});
  assert.equal(readFaceRecord(null),undefined);
});
test('external and photo provenance remain explicit and malformed metadata fails closed',()=>{
  assert.equal(readFaceRecord(JSON.stringify({uri:'file:///face.glb',source:'external'}))?.source,'external');
  assert.equal(readFaceRecord(JSON.stringify({uri:'file:///face.glb',source:'photo'}))?.source,'photo');
  assert.throws(()=>readFaceRecord(JSON.stringify({uri:'file:///face.glb',source:'verified_identity'})));
});
test('deleting or reviewing an old photo capture cannot replace or remove another character method',()=>{
  const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
  assert.ok(faceCaptureOwnsModel({uri:'file:///face.glb',source:'photo',captureId:id},id));
  assert.equal(faceCaptureOwnsModel({uri:'file:///face.glb',source:'photo',captureId:other},id),false);
  assert.equal(faceCaptureOwnsModel({uri:'file:///face.glb',source:'tracked'},id,'file:///face.glb'),false);
  assert.equal(faceCaptureOwnsModel({uri:'file:///face.glb',source:'external'},id,'file:///face.glb'),false);
  assert.ok(faceCaptureOwnsModel({uri:'file:///cache/scan-legacy.glb',source:'legacy'},id,'file:///old/scan-legacy.glb'));
});
