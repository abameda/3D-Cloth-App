import * as THREE from 'three';
import type { AvatarOutfit } from '../domain/avatar';
import { avatarCategories } from '../domain/avatar';
import { defaultAppearance, type AvatarAppearance } from '../domain/appearance';

export const skinTones = { warm:'#A86D4D', light:'#D9AC89', deep:'#694334',porcelain:'#E8C8B2',sand:'#C99B72',tan:'#9B633D',rich:'#462D23' } as const;
export type SkinTone = keyof typeof skinTones;
const hairColors = { black:'#24211F', brown:'#62452F', blonde:'#B7995F', grey:'#999A96' };
const headNames = /^(head|ear-|eye-|iris-|brow-|nose|mouth|hair-)/;

/** Uniform placement preserves scan vertices and textures; no facial feature morphing. */
export function attachFaceScan(root: THREE.Group, scan: THREE.Group) {
  const bounds = new THREE.Box3().setFromObject(scan);
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  if (![...size.toArray(), ...center.toArray()].every(Number.isFinite) || size.y <= 0 || size.x <= 0 || size.z <= 0 || size.x / size.y > 1.6 || size.z / size.y > 1.6) throw Error('Import a head-only scan with a valid 3D shape.');
  const placement = new THREE.Group(); placement.name='personal-face';
  const normalizer = new THREE.Group();
  scan.position.sub(center); normalizer.add(scan);
  normalizer.scale.setScalar(.27 / size.y); placement.add(normalizer);
  placement.position.set(0,1.715,.005); root.add(placement);
}

export function styleAvatar(root: THREE.Group, appearance: AvatarAppearance, useScan: boolean) {
  const width = { slim:.92, regular:1, broad:1.12 }[appearance.build];
  const height={short:.94,average:1,tall:1.06}[appearance.height??'average'];
  for (const name of ['body', ...avatarCategories]) root.getObjectByName(name)?.scale.set(width,height,width);
  const face=root.getObjectByName('personal-face');if(face)face.position.y=1.715*height;
  const morph=(name:string,target:string,value:number)=>{const object=root.getObjectByName(name);if(object instanceof THREE.Mesh&&object.morphTargetDictionary&&object.morphTargetInfluences){const index=object.morphTargetDictionary[target];if(index!==undefined)object.morphTargetInfluences[index]=value;}};
  morph('head','Round',appearance.faceShape==='round'?1:0);morph('head','Square',appearance.faceShape==='square'?1:0);
  morph('nose','Small',appearance.nose==='small'?1:0);morph('nose','Strong',appearance.nose==='strong'?1:0);
  morph('mouth','Smile',appearance.mouth==='smile'?1:0);
  for(const side of [-1,1]){morph(`eye-${side}`,'Wide',appearance.eyes==='wide'?1:0);morph(`brow-${side}`,'Bold',appearance.brows==='bold'?1:0);}
  root.getObjectByName('body')?.traverse(object => {
    if (headNames.test(object.name)) object.visible = !useScan && !(appearance.hairstyle === 'none' && object.name.startsWith('hair-'));
  });
  const longHair=root.getObjectByName('long-hair');
  if(longHair) { longHair.visible=!useScan && appearance.hairstyle==='long'; longHair.scale.set(width,height,width); }
  root.getObjectByName('personal-face')?.traverse(object => { if (object.name==='personal-face') object.visible=useScan; });
  for(const name of ['body','long-hair']) root.getObjectByName(name)?.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]) if(material instanceof THREE.MeshStandardMaterial&&material.name==='hair') material.color.set(hairColors[appearance.hair]);
  });
}

/** Each viewer owns a separately parsed scene, so changing materials is local to it. */
export function dressAvatar(root: THREE.Group, outfit: AvatarOutfit, tone: SkinTone, palette: Record<string,string>, appearance: AvatarAppearance = defaultAppearance, useScan = false) {
  styleAvatar(root, appearance, useScan);
  for (const category of avatarCategories) {
    const group = root.getObjectByName(category);
    const piece = outfit.pieces.find(p => p.category === category);
    if (group) group.visible = !!piece;
    if (group && piece && ['top','bottom','outerwear','onepiece'].includes(category)) {
      const fit = piece.fit === 'Relaxed' ? 1.06 : piece.fit === 'Slim' ? .97 : 1;
      group.scale.x *= fit; group.scale.z *= fit;
    }
    if (group && piece) group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material instanceof THREE.MeshStandardMaterial && material.name === category) {
        material.color.set(palette[piece.color] ?? palette.Unknown);
      }
    });
  }
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (let parent: THREE.Object3D | null = object; parent; parent=parent.parent) if (parent.name === 'personal-face') return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) if (material instanceof THREE.MeshStandardMaterial && material.name === 'skin') material.color.set(skinTones[tone]);
    if (object.name.startsWith('base-shorts')) object.visible = !outfit.pieces.some(p => p.category === 'onepiece' || p.category === 'bottom');
    if (object.name === 'base-torso') object.visible = !outfit.pieces.some(p => p.category === 'onepiece' || p.category === 'top');
  });
}

export function disposeAvatar(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
}
