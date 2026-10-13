import * as THREE from 'three';
import type { Category } from '../domain/types';

export type RoomView = 'home' | 'closet';
export function roomView(view: RoomView, aspect: number) {
  return view==='closet'
    ? {position:[1.35,1.8,Math.max(3.2,1.6/aspect)],target:[-.2,1.25,-1.5]}
    : {position:[0,1.25,Math.max(3.8,1.9/aspect)],target:[0,1.02,0]};
}

/** Authored native room geometry. Wardrobe targets represent categories, never fit. */
export function createDressingRoom(dark: boolean) {
  const room=new THREE.Group();room.name='dressing-room';
  const plaster=new THREE.MeshStandardMaterial({color:dark?'#34312D':'#E9E1D4',roughness:1});
  const wood=new THREE.MeshStandardMaterial({color:dark?'#72604C':'#BA9B76',roughness:.86});
  const floorMaterial=new THREE.MeshStandardMaterial({color:dark?'#262420':'#D7C7AF',roughness:.85});
  const metal=new THREE.MeshStandardMaterial({color:'#A7A49B',metalness:.8,roughness:.28});
  const shelfMaterial=new THREE.MeshStandardMaterial({color:dark?'#4C4337':'#CFB490',roughness:.8});
  function box(name:string,size:number[],at:number[],material:THREE.Material,category?:Category) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),material);
    mesh.name=name;mesh.position.set(...at as [number,number,number]);if(category)mesh.userData.category=category;room.add(mesh);return mesh;
  }
  function bar(name:string,at:number[],length:number,vertical=false){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,length,12),metal);
    mesh.name=name;mesh.position.set(...at as [number,number,number]);if(!vertical)mesh.rotation.z=Math.PI/2;room.add(mesh);
  }
  box('floor',[6,.08,7],[0,-.08,-.8],floorMaterial);
  box('back-wall',[6,3.5,.08],[0,1.65,-2.65],plaster);
  box('left-wall',[.08,3.5,6],[-3,1.65,-.1],plaster);
  box('right-wall',[.08,3.5,6],[3,1.65,-.1],plaster);
  box('wardrobe-back',[3.8,2.65,.09],[-.65,1.27,-2.45],wood);
  for(const x of [-2.55,-.65,1.25]) box(`cabinet-${x}`,[.07,2.7,.65],[x,1.3,-2.15],wood);
  box('cabinet-top',[3.85,.07,.68],[-.65,2.65,-2.15],shelfMaterial);
  box('cabinet-bottom',[3.85,.07,.68],[-.65,.02,-2.15],shelfMaterial);
  bar('top-rail',[-1.62,2.26,-2.07],1.65);
  bar('layer-rail',[.3,2.26,-2.07],1.65);
  const tones=['#C6C0B4','#5C6661','#E2D6C4','#89745F'];
  for(let index=0;index<4;index++){
    const fabric=new THREE.MeshStandardMaterial({color:tones[index],roughness:.94});
    const x=-2.2+index*.37;
    bar(`hanger-${index}`,[x,2.03,-2.07],.29);
    bar(`hanger-hook-${index}`,[x,2.14,-2.07],.12,true);
    box(`top-${index}`,[.27,.52,.14],[x,1.7,-2.07],fabric,'top');
    const left=box(`sleeve-left-${index}`,[.15,.29,.14],[x-.17,1.82,-2.07],fabric,'top');left.rotation.z=-.35;
    const right=box(`sleeve-right-${index}`,[.15,.29,.14],[x+.17,1.82,-2.07],fabric,'top');right.rotation.z=.35;
    const coat=box(`layer-${index}`,[.3,.85,.17],[index*.35-.25,1.56,-2.07],fabric,'outerwear');coat.userData.category='outerwear';
  }
  box('trouser-shelf',[1.8,.06,.6],[-1.6,.91,-2.15],shelfMaterial,'bottom');
  for(let i=0;i<3;i++)box(`folded-bottom-${i}`,[.5,.09,.38],[-2.18+i*.55,1,-2.05],new THREE.MeshStandardMaterial({color:tones[i+1],roughness:1}),'bottom');
  box('shoe-shelf',[3.7,.06,.6],[-.65,.38,-2.15],shelfMaterial,'shoes');
  for(let i=0;i<6;i++)box(`shoe-${i}`,[.14,.12,.34],[-2.12+i*.55,.47,-2.03],new THREE.MeshStandardMaterial({color:i<2?'#EFE9DE':'#56504B',roughness:.8}),'shoes');
  box('accessory-shelf',[1.75,.06,.6],[.3,.98,-2.15],shelfMaterial,'accessories');
  for(let i=0;i<3;i++)box(`accessory-${i}`,[.25,.16,.22],[-.2+i*.4,1.09,-2.1],wood,'accessories');
  box('mirror-frame',[1.08,2.28,.13],[2.02,1.26,-2.48],wood);
  // A reflective material, without pretending to have a live character reflection.
  box('mirror',[.94,2.14,.04],[2.02,1.26,-2.38],new THREE.MeshStandardMaterial({color:dark?'#788583':'#C9D4CF',metalness:.92,roughness:.15}));
  const mat=new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,.02,64),new THREE.MeshStandardMaterial({color:dark?'#645B4D':'#C2B49D',roughness:1}));
  mat.name='standing-mat';mat.position.set(0,-.025,0);room.add(mat);
  return room;
}
