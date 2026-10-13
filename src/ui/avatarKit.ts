import { toByteArray } from 'base64-js';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as THREE from 'three';
import type { AvatarOutfit } from '../domain/avatar';
import { readGlb } from '../domain/glb';
import { kitLayer, tucked, visibleTriangles, wornItems, type CoverageMask, type KitItem } from '../domain/kitDressing';
import { disposeAvatar } from './avatarScene';
import { parseNativeGlb } from './nativeGltf';

/**
 * A skinned personal body plus garments draped on that exact body by the Windows asset factory.
 * Garments share the body's skeleton, so they move with it; each declares which body triangles it
 * covers so hidden skin cannot poke through cloth.
 */
export type { KitCategory } from '../domain/kitDressing';
export interface KitGarment extends KitItem { uri: string }
export interface AvatarKit { source: 'demo' | 'personal'; body: string; garments: KitGarment[] }

interface LoadedGarment { asset: KitGarment; mesh: THREE.SkinnedMesh; covers?: CoverageMask; material: THREE.MeshStandardMaterial; textured: boolean; tuck?: number }
export interface LoadedKit {
  /** body: the skin primitive; faceParts: every body primitive (skin, eyes, brows, lashes) sharing the expressions. */
  root: THREE.Group; body: THREE.SkinnedMesh; faceParts: THREE.SkinnedMesh[]; bodyIndex: THREE.BufferAttribute;
  garments: LoadedGarment[]; idle: { bones: { bone: THREE.Bone; rest: THREE.Quaternion; amount: number }[]; blink: number[] };
  wearing: string; cleanup: () => void;
}

/** Cloth is double-sided: its inside (seen through necklines and hems) is shaded darker, like real fabric. */
export function shadeClothInside(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n\tif (!gl_FrontFacing) diffuseColor.rgb *= 0.45;');
  };
  material.customProgramCacheKey = () => 'thread-cloth-inside';
}

export async function demoKit(): Promise<AvatarKit> {
  const resolve = async (module: number) => {
    const asset = await Asset.fromModule(module).downloadAsync();
    if (!asset.localUri) throw Error('Missing bundled avatar asset.');
    return asset.localUri;
  };
  return {
    source: 'demo',
    body: await resolve(require('../../assets/avatar/kit/body.glb')),
    garments: [
      { id: 'demo-top', category: 'top', uri: await resolve(require('../../assets/avatar/kit/top.glb')) },
      { id: 'demo-bottom', category: 'bottom', uri: await resolve(require('../../assets/avatar/kit/bottom.glb')) },
      { id: 'demo-hair', category: 'hair', uri: await resolve(require('../../assets/avatar/kit/hair.glb')) },
      { id: 'demo-base-bottom', category: 'base_bottom', uri: await resolve(require('../../assets/avatar/kit/base-bottom.glb')) },
      { id: 'demo-shoes-white', category: 'shoes', colors: ['White', 'Beige', 'Unknown', 'Grey', 'Green', 'Pink'], uri: await resolve(require('../../assets/avatar/kit/shoes-white.glb')) },
      { id: 'demo-shoes-navy', category: 'shoes', colors: ['Navy', 'Blue', 'Purple'], uri: await resolve(require('../../assets/avatar/kit/shoes-navy.glb')) },
      { id: 'demo-shoes-black', category: 'shoes', colors: ['Black'], uri: await resolve(require('../../assets/avatar/kit/shoes-black.glb')) },
      { id: 'demo-shoes-brown', category: 'shoes', colors: ['Brown', 'Red', 'Yellow'], uri: await resolve(require('../../assets/avatar/kit/shoes-brown.glb')) },
    ],
  };
}

async function parse(uri: string) {
  const bytes = await new File(uri).arrayBuffer();
  return parseNativeGlb(bytes, readGlb(bytes));
}

function skinnedMeshes(scene: THREE.Object3D): THREE.SkinnedMesh[] {
  const found: THREE.SkinnedMesh[] = [];
  scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) found.push(object); });
  if (!found.length) throw Error('The avatar asset has no skinned mesh.');
  return found;
}
const materialOf = (mesh: THREE.Mesh) => (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;

export async function loadAvatarKit(kit: AvatarKit): Promise<LoadedKit> {
  const cleanups: (() => void)[] = [];
  const cleanup = () => cleanups.forEach(fn => fn());
  try {
    const bodyFile = await parse(kit.body); cleanups.push(bodyFile.cleanup);
    const root = bodyFile.gltf.scene; root.name = 'personal-avatar';
    const faceParts = skinnedMeshes(root);
    const body = faceParts.find(mesh => materialOf(mesh).name === 'skin') ?? faceParts[0];
    const names = body.skeleton.bones.map(bone => bone.name);
    const garments: LoadedGarment[] = [];
    for (const asset of kit.garments) {
      const file = await parse(asset.uri); cleanups.push(file.cleanup);
      const mesh = skinnedMeshes(file.gltf.scene)[0];
      if (mesh.skeleton.bones.length !== names.length || mesh.skeleton.bones.some((bone, i) => bone.name !== names[i]))
        throw Error('A garment was fitted to a different body. Refit it on the computer.');
      mesh.removeFromParent();
      mesh.bind(body.skeleton, mesh.bindMatrix);  // identical bind pose: drive the cloth with the body's bones
      root.add(mesh);
      disposeAvatar(file.gltf.scene);
      const material = materialOf(mesh), layer = kitLayer[asset.category] ?? 1;
      material.polygonOffset = true; material.polygonOffsetFactor = -layer; material.polygonOffsetUnits = -1;
      mesh.renderOrder = 2 + layer;
      if (material.side === THREE.DoubleSide) shadeClothInside(material);
      const thread = mesh.userData.thread as { coversBodyTriangles?: string; bodyTriangles?: number } | undefined;
      garments.push({ asset, mesh, material, textured: !!material.map, tuck: mesh.morphTargetDictionary?.tuck,
        covers: thread?.coversBodyTriangles ? { bits: toByteArray(thread.coversBodyTriangles), bodyTriangles: thread.bodyTriangles } : undefined });
    }
    const bone = (name: string) => body.skeleton.bones.find(b => b.name === name);
    const idleBones = [['spine03', 0.012], ['spine01', 0.008], ['neck01', 0.01], ['upperarm01_L', 0.015], ['upperarm01_R', 0.015]] as const;
    const blink = ['eyeBlinkLeft', 'eyeBlinkRight'].map(name => body.morphTargetDictionary?.[name]).filter((i): i is number => i !== undefined);
    return {
      root, body, faceParts, bodyIndex: body.geometry.index!.clone(), garments,
      idle: { bones: idleBones.flatMap(([name, amount]) => { const b = bone(name); return b ? [{ bone: b, rest: b.quaternion.clone(), amount }] : []; }), blink },
      wearing: '', cleanup,
    };
  } catch (e) { cleanup(); throw e; }
}

/** Shows one garment per outfit piece: the item's own fitted model, else a tinted category stand-in. */
export function dressKit(kit: LoadedKit, outfit: AvatarOutfit, palette: Record<string, string>, skin?: string) {
  const worn = wornItems(kit.garments.map(g => g.asset), outfit.pieces, palette);
  const categories = [...worn.keys()].map(asset => asset.category);
  for (const garment of kit.garments) {
    garment.mesh.visible = worn.has(garment.asset);
    const tint = worn.get(garment.asset);
    if (tint && !garment.textured) garment.material.color.set(tint);
    // An inner layer tucks snug to the body while anything is worn over it (precomputed morph).
    if (garment.tuck !== undefined && garment.mesh.morphTargetInfluences)
      garment.mesh.morphTargetInfluences[garment.tuck] = tucked(garment.asset.category, categories) ? 1 : 0;
  }
  const skinMaterial = materialOf(kit.body);
  if (skin && !skinMaterial.map) skinMaterial.color.set(skin);  // a personal body carries its own skin texture
  const signature = [...worn.keys()].map(asset => asset.id).sort().join('|');
  if (signature === kit.wearing) return;
  kit.wearing = signature;
  const masks = kit.garments.filter(g => worn.has(g.asset) && g.covers).map(g => g.covers!);
  const { kept, stale } = visibleTriangles(kit.bodyIndex.array, masks);
  if (stale) console.warn(`${stale} garment(s) were fitted to an older body; refit them on the computer.`);
  kit.body.geometry.setIndex(kept);
}
/** Subtle breathing, sway and blinking. Returns false when nothing needs continuous redraw. */
export function animateKit(kit: LoadedKit, seconds: number, reduced: boolean): boolean {
  const breath = reduced ? 0 : Math.sin(seconds * 1.7);
  for (const { bone, rest, amount } of kit.idle.bones)
    bone.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), breath * amount));
  const phase = seconds % 4.2, closed = !reduced && phase > 4.05 ? 1 - Math.abs(phase - 4.125) / 0.075 : 0;
  for (const part of kit.faceParts) if (part.morphTargetInfluences) for (const index of kit.idle.blink) part.morphTargetInfluences[index] = closed;
  return !reduced;
}
