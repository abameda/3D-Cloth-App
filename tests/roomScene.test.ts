import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDressingRoom, roomView } from '../src/ui/roomScene';
import { disposeAvatar } from '../src/ui/avatarScene';

test('room uses real geometry and category hit targets, with no personal character', () => {
  const room=createDressingRoom(false);
  const mesh=room.getObjectByName('floor') as THREE.Mesh;
  assert.ok(mesh?.geometry instanceof THREE.BufferGeometry);
  const targets:string[]=[];room.traverse(o=>{if(o.userData.category)targets.push(o.userData.category);});
  assert.deepEqual([...new Set(targets)].sort(),['accessories','bottom','outerwear','shoes','top']);
  assert.equal(room.getObjectByName('body'),undefined);
  assert.ok(new THREE.Box3().setFromObject(room).getSize(new THREE.Vector3()).x>5);
  disposeAvatar(room);
});
test('home and closet are viewpoints of the same room; disposal releases materials', () => {
  assert.notDeepEqual(roomView('home',1),roomView('closet',1));
  const room=createDressingRoom(true);let disposed=0;
  const floor=room.getObjectByName('floor') as THREE.Mesh;
  floor.geometry.addEventListener('dispose',()=>disposed++);
  disposeAvatar(room);assert.equal(disposed,1);
});
