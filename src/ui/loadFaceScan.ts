import { File } from 'expo-file-system';
import * as THREE from 'three';
import { validateFaceScan } from '../domain/faceScan';
import type { GlbJson } from '../domain/glb';
import { disposeAvatar } from './avatarScene';
import { parseNativeGlb } from './nativeGltf';

/** Native Expo image upload preserves embedded face textures without a browser loader. */
export async function loadFaceScan(uri:string) {
  const bytes=await new File(uri).arrayBuffer();
  const manifest=validateFaceScan(bytes) as GlbJson;
  const {gltf:result,cleanup}=await parseNativeGlb(bytes,manifest);
  let invalid=false;
  result.scene.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const positions=object.geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++)if(![positions.getX(i),positions.getY(i),positions.getZ(i)].every(Number.isFinite))invalid=true;
  });
  if(invalid){disposeAvatar(result.scene);cleanup();throw Error('The scan contains invalid facial geometry.');}
  return {scene:result.scene,cleanup};
}
