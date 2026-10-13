import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateFaceScan } from '../src/domain/faceScan';
import { decodeState } from '../src/domain/state';
import { defaultAppearance } from '../src/domain/appearance';

const bytes=readFileSync('tests/fixtures/static-scan.glb');
const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
function changeJson(change:(json:any)=>void) {
  const view=new DataView(buffer),length=view.getUint32(12,true);
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));change(json);
  const text=JSON.stringify(json),encoded=new TextEncoder().encode(text+' '.repeat((4-text.length%4)%4));
  const bin=new Uint8Array(buffer,20+length),result=new Uint8Array(20+encoded.length+bin.length),header=new DataView(result.buffer);
  result.set(new Uint8Array(buffer,0,20));header.setUint32(8,result.length,true);header.setUint32(12,encoded.length,true);result.set(encoded,20);result.set(bin,20+encoded.length);
  return result.buffer;
}

test('GLB import validates self-contained mobile geometry before loading',()=>{
  assert.ok(validateFaceScan(buffer).meshes.length);
  assert.throws(()=>validateFaceScan(new ArrayBuffer(20)));
  assert.throws(()=>validateFaceScan(changeJson(json=>json.buffers[0].uri='https://tracker.example/model.bin')),/External/);
  assert.throws(()=>validateFaceScan(changeJson(json=>json.bufferViews[0].byteLength=100000000)),/bounds/);
  assert.throws(()=>validateFaceScan(changeJson(json=>json.extensionsRequired=['KHR_draco_mesh_compression'])),/uncompressed/);
  assert.throws(()=>validateFaceScan(changeJson(json=>json.nodes[0].children=[0])),/cyclic/);
});
test('scan import rejects nonfinite face vertices and invalid indices',()=>{
  const raw=buffer.slice(0),view=new DataView(raw),length=view.getUint32(12,true);
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(raw,20,length)));
  const accessor=json.accessors[json.meshes[0].primitives[0].attributes.POSITION],vertex=json.bufferViews[accessor.bufferView];
  view.setFloat32(20+length+8+(vertex.byteOffset??0)+(accessor.byteOffset??0),NaN,true);
  assert.throws(()=>validateFaceScan(raw),/facial geometry/);
});
test('avatar appearance survives restart decoding and rejects corrupted choices',()=>{
  const state=decodeState(null);state.profile.avatar={...defaultAppearance,hairstyle:'long',hair:'brown',build:'broad'};state.profile.avatarMode='custom';
  assert.deepEqual(decodeState(JSON.stringify(state)).profile.avatar,state.profile.avatar);
  assert.equal(decodeState(JSON.stringify(state)).profile.avatarMode,'custom');
  assert.equal(decodeState(null).profile.avatar,undefined);
  assert.throws(()=>decodeState(JSON.stringify({...state,profile:{...state.profile,avatar:{...defaultAppearance,build:'invalid'}}})));
});
