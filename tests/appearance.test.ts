import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {appearanceSchema,defaultAppearance} from '../src/domain/appearance';
import {styleAvatar} from '../src/ui/avatarScene';
test('old avatar choices migrate to neutral facial presets',()=>{
  const old=appearanceSchema.parse({skin:'warm',hair:'black',hairstyle:'short',build:'regular'});
  assert.equal(old.faceShape,'oval');assert.equal(old.nose,'medium');assert.equal(old.height,'average');
});
test('manual facial choices apply actual morph weights and body proportions',()=>{
  const root=new THREE.Group(),body=new THREE.Group();body.name='body';root.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());head.name='head';head.morphTargetDictionary={Round:0,Square:1};head.morphTargetInfluences=[0,0];body.add(head);
  styleAvatar(root,{...defaultAppearance,faceShape:'round',height:'tall'},false);assert.deepEqual(head.morphTargetInfluences,[1,0]);assert.ok(body.scale.y>1);
  styleAvatar(root,defaultAppearance,false);assert.deepEqual(head.morphTargetInfluences,[0,0]);assert.equal(body.scale.y,1);
});
