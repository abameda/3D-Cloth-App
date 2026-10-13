import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachFaceScan, disposeAvatar, dressAvatar, skinTones } from '../src/ui/avatarScene';
import { defaultAppearance } from '../src/domain/appearance';
import { resolveAvatarOutfit } from '../src/domain/avatar';

test('switching outfits hides old meshes and shows base layers for empty supported slots',()=>{
  const root=new THREE.Group();
  for(const name of ['top','bottom','shoes','outerwear','onepiece','base-torso','base-shorts-1']){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({name}));mesh.name=name;root.add(mesh);
  }
  dressAvatar(root,resolveAvatarOutfit({},[],'owned'),'warm',{White:'#ffffff',Navy:'#000080',Unknown:'#aaaaaa'});
  assert.equal(root.getObjectByName('top')?.visible,true);
  assert.equal(root.getObjectByName('onepiece')?.visible,false);
  assert.equal(root.getObjectByName('base-torso')?.visible,false);
  dressAvatar(root,{sample:false,pieces:[],notices:[]},'warm',{Unknown:'#aaaaaa'});
  assert.equal(root.getObjectByName('top')?.visible,false);
  assert.equal(root.getObjectByName('base-torso')?.visible,true);
  assert.equal(root.getObjectByName('base-shorts-1')?.visible,true);
  disposeAvatar(root);
});

test('personal face placement is uniform and outfit changes preserve facial geometry and texture',()=>{
  const root=new THREE.Group(),body=new THREE.Group();body.name='body';root.add(body);
  const generic=new THREE.Mesh(new THREE.BoxGeometry(.1,.2,.1),new THREE.MeshStandardMaterial({name:'skin'}));generic.name='head';body.add(generic);
  const scan=new THREE.Group(),texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({name:'skin',color:'#cba987',map:texture});
  const face=new THREE.Mesh(new THREE.BoxGeometry(.18,.27,.19),material);scan.add(face);
  const before=face.geometry.attributes.position.array.slice();
  attachFaceScan(root,scan);
  dressAvatar(root,{sample:false,pieces:[],notices:[]},'deep',{Unknown:'#aaaaaa'},{...defaultAppearance,build:'broad'},true);
  assert.equal(generic.visible,false);
  assert.equal(material.color.getHexString(),'cba987');
  assert.equal(material.map,texture);
  assert.deepEqual(face.geometry.attributes.position.array,before);
  assert.equal(scan.parent!.scale.x,scan.parent!.scale.y);
  assert.equal(scan.parent!.scale.y,scan.parent!.scale.z);
  dressAvatar(root,{sample:false,pieces:[],notices:[]},'warm',{Unknown:'#aaaaaa'},defaultAppearance,false);
  assert.equal(generic.visible,true);
  assert.equal(root.getObjectByName('personal-face')!.visible,false);
  let disposed=0;texture.addEventListener('dispose',()=>disposed++);disposeAvatar(root);assert.equal(disposed,1);
});
test('appearance coloring preserves details and disposal releases shared resources once',()=>{
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry();
  const skin=new THREE.MeshStandardMaterial({name:'skin'}),detail=new THREE.MeshStandardMaterial({name:'sole',color:'#123456'});
  root.add(new THREE.Mesh(geometry,[skin,detail]),new THREE.Mesh(geometry,skin));
  dressAvatar(root,{sample:false,pieces:[],notices:[]},'deep',{Unknown:'#aaaaaa'});
  assert.equal(`#${skin.color.getHexString()}`,skinTones.deep.toLowerCase());
  assert.equal(detail.color.getHexString(),'123456');
  let geometryDisposals=0,skinDisposals=0,detailDisposals=0;
  geometry.addEventListener('dispose',()=>geometryDisposals++);skin.addEventListener('dispose',()=>skinDisposals++);detail.addEventListener('dispose',()=>detailDisposals++);
  disposeAvatar(root);
  assert.deepEqual([geometryDisposals,skinDisposals,detailDisposals],[1,1,1]);
});
