import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const file=await readFile(new URL('../assets/avatar/thread-character.glb',import.meta.url));
const buffer=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
const {scene,animations}=await new GLTFLoader().parseAsync(buffer,'');
test('character has real articulated motion and authored face morph targets',()=>{
  assert.ok(animations.some(clip=>clip.name==='Idle'));
  assert.ok(animations.some(clip=>clip.name==='Wave'));
  const upperArm=scene.getObjectByName('rig-upper-arm-1');assert.ok(upperArm);
  const before=upperArm.quaternion.clone();const mixer=new THREE.AnimationMixer(scene);mixer.clipAction(animations.find(clip=>clip.name==='Wave')).play();mixer.update(.6);
  assert.ok(before.angleTo(upperArm.quaternion)>.05);
  const head=scene.getObjectByName('head');assert.ok(head.morphTargetDictionary?.Round!==undefined);
  const nose=scene.getObjectByName('nose');assert.ok(nose.morphTargetDictionary?.Strong!==undefined);
  mixer.stopAllAction();mixer.uncacheRoot(scene);
});
test('bundled GLB is self contained and within a modest mobile asset budget',()=>{
  assert.ok(file.length<2*1024*1024);
  const length=file.readUInt32LE(12),json=JSON.parse(file.subarray(20,20+length).toString());
  assert.equal(json.asset.version,'2.0');
  assert.ok(json.buffers.every(b=>!b.uri));
  assert.equal(json.images?.length??0,0);
});
test('character and garments have independent named groups and appropriate bounds',()=>{
  for(const name of ['body','top','bottom','shoes','outerwear','onepiece','bag','eyewear','accessories','long-hair'])assert.ok(scene.getObjectByName(name),name);
  const box=new THREE.Box3().setFromObject(scene),size=box.getSize(new THREE.Vector3());
  assert.ok(size.y>1.7&&size.y<2.0);
  assert.ok(size.x>.8&&size.x<1.2);
  assert.ok(box.min.y>-.01);
});
test('every mesh has finite geometry and renderable normals',()=>{
  let triangles=0;
  scene.traverse(object=>{
    if(!object.isMesh)return;
    assert.ok(object.geometry.attributes.normal,object.name);
    for(const value of object.geometry.attributes.position.array)assert.ok(Number.isFinite(value),object.name);
    triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
  });
  assert.ok(triangles<60000,`Triangle count: ${triangles}`);
});
test('front-facing torso surface points outward rather than disappearing under culling',()=>{
  const tee=scene.getObjectByName('tee');
  assert.ok(tee.geometry.attributes.normal.getZ(0)>.3);
});
