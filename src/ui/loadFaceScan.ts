import { Image } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { validateFaceScan } from '../domain/faceScan';
import { makeId } from '../domain/state';
import { disposeAvatar } from './avatarScene';

/** Native Expo image upload preserves embedded face textures without a browser loader. */
export async function loadFaceScan(uri:string) {
  const bytes=await new File(uri).arrayBuffer();
  const manifest=validateFaceScan(bytes);
  const folder=new Directory(Paths.cache,`thread-face-${makeId()}`);folder.create();
  const textures=new Set<THREE.Texture>();
  const cleanup=()=>{textures.forEach(texture=>texture.dispose());if(folder.exists)try{folder.delete();}catch{}};
  const loader=new GLTFLoader();
  loader.register(parser=>({ name:'THREAD_native_face_textures', loadTexture: async (textureIndex:number)=>{
    const definition=manifest.textures?.[textureIndex];
    if(!definition)throw Error('Missing embedded scan texture.');
    const source=manifest.images![definition.source];
    const data=await parser.getDependency('bufferView',source.bufferView) as ArrayBuffer;
    const file=new File(folder,`${textureIndex}.${source.mimeType==='image/png'?'png':'jpg'}`);file.create();file.write(new Uint8Array(data));
    const {width,height}=await new Promise<{width:number;height:number}>((resolve,reject)=>Image.getSize(file.uri,(width,height)=>resolve({width,height}),reject));
    if(width>2048||height>2048||width<1||height<1)throw Error('Use embedded face textures up to 2048 × 2048.');
    const texture=new THREE.Texture({localUri:file.uri,width,height} as unknown as HTMLImageElement);
    texture.flipY=false;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
    texture.generateMipmaps=false;texture.needsUpdate=true;textures.add(texture);
    return texture;
  }}));
  try {
    const result=await loader.parseAsync(bytes,'');
    let invalid=false;
    result.scene.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const positions=object.geometry.getAttribute('position');
      for(let i=0;i<positions.count;i++)if(![positions.getX(i),positions.getY(i),positions.getZ(i)].every(Number.isFinite))invalid=true;
    });
    if(invalid){disposeAvatar(result.scene);throw Error('The scan contains invalid facial geometry.');}
    return {scene:result.scene,cleanup};
  }catch(e){cleanup();throw e;}
}
