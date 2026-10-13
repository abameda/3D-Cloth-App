import { toByteArray } from 'base64-js';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as THREE from 'three';
import type { AvatarOutfit } from '../domain/avatar';
import { readGlb } from '../domain/glb';
import type { Category } from '../domain/types';
import { disposeAvatar } from './avatarScene';
import { parseNativeGlb } from './nativeGltf';

/**
 * A skinned personal body plus garments draped on that exact body by the Windows asset factory.
 * Garments share the body's skeleton, so they move with it; each declares which body triangles it
 * covers so hidden skin cannot poke through cloth.
 */
export type KitCategory = Category | 'hair';
export interface KitGarment { id: string; category: KitCategory; uri: string; garmentId?: string }
export interface AvatarKit { source: 'demo' | 'personal'; body: string; garments: KitGarment[] }

interface LoadedGarment { asset: KitGarment; mesh: THREE.SkinnedMesh; covers?: Uint8Array; material: THREE.MeshStandardMaterial; textured: boolean; tuck?: number }
export interface LoadedKit {
  /** body: the skin primitive; faceParts: every body primitive (skin, eyes, brows, lashes) sharing the expressions. */
  root: THREE.Group; body: THREE.SkinnedMesh; faceParts: THREE.SkinnedMesh[]; bodyIndex: THREE.BufferAttribute;
  garments: LoadedGarment[]; idle: { bones: { bone: THREE.Bone; rest: THREE.Quaternion; amount: number }[]; blink: number[] };
  wearing: string; cleanup: () => void;
}

// Layer order for overlapping cloth: inner layers render first and are slightly pushed back.
const LAYER: Partial<Record<KitCategory, number>> = { bottom: 0, onepiece: 0, top: 1, outerwear: 2 };

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
      const material = materialOf(mesh);
      material.polygonOffset = true; material.polygonOffsetFactor = -(LAYER[asset.category] ?? 1); material.polygonOffsetUnits = -1;
      mesh.renderOrder = 1 + (LAYER[asset.category] ?? 1);
      const encoded = (mesh.userData.thread as { coversBodyTriangles?: string } | undefined)?.coversBodyTriangles;
      garments.push({ asset, mesh, material, textured: !!material.map, tuck: mesh.morphTargetDictionary?.tuck,
        covers: encoded ? toByteArray(encoded) : undefined });
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
  const worn = new Map<LoadedGarment, string | undefined>();
  for (const piece of outfit.pieces) {
    const own = kit.garments.find(g => g.asset.garmentId && g.asset.garmentId === piece.garmentId);
    const standIn = kit.garments.find(g => !g.asset.garmentId && g.asset.category === piece.category);
    const chosen = own ?? standIn;
    if (chosen) worn.set(chosen, own ? undefined : palette[piece.color] ?? palette.Unknown);
  }
  for (const garment of kit.garments) if (garment.asset.category === 'hair') worn.set(garment, undefined);
  const layers = [...worn.keys()].map(g => LAYER[g.asset.category] ?? -1);
  for (const garment of kit.garments) {
    garment.mesh.visible = worn.has(garment);
    const tint = worn.get(garment);
    if (tint && !garment.textured) garment.material.color.set(tint);
    // An inner layer tucks snug to the body while anything is worn over it (precomputed morph).
    if (garment.tuck !== undefined && garment.mesh.morphTargetInfluences)
      garment.mesh.morphTargetInfluences[garment.tuck] = layers.some(layer => layer > (LAYER[garment.asset.category] ?? 1)) ? 1 : 0;
  }
  if (skin) materialOf(kit.body).color.set(skin);
  const signature = [...worn.keys()].map(g => g.asset.id).sort().join('|');
  if (signature === kit.wearing) return;
  kit.wearing = signature;
  const source = kit.bodyIndex.array, kept: number[] = [];
  const masks = [...worn.keys()].map(g => g.covers).filter((m): m is Uint8Array => !!m);
  for (let t = 0; t < source.length / 3; t++) {
    if (masks.some(mask => mask[t >> 3] & (0x80 >> (t & 7)))) continue;
    kept.push(source[3 * t], source[3 * t + 1], source[3 * t + 2]);
  }
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
