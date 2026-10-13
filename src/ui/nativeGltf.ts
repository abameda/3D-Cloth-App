import { Image } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GlbJson } from '../domain/glb';
import { makeId } from '../domain/state';

/**
 * Parses a self-contained GLB on React Native. Expo GL cannot decode image blobs, so each embedded
 * texture is written to a private cache file and uploaded from its local URI.
 */
export async function parseNativeGlb(bytes: ArrayBuffer, manifest: GlbJson, maxTexture = 2048): Promise<{ gltf: GLTF; cleanup: () => void }> {
  const folder = new Directory(Paths.cache, `thread-gltf-${makeId()}`); folder.create();
  const textures = new Set<THREE.Texture>();
  const cleanup = () => { textures.forEach(texture => texture.dispose()); if (folder.exists) try { folder.delete(); } catch {} };
  const loader = new GLTFLoader();
  loader.register(parser => ({ name: 'THREAD_native_textures', loadTexture: async (textureIndex: number) => {
    const definition = manifest.textures?.[textureIndex];
    const source = definition ? manifest.images?.[definition.source] : undefined;
    if (!source || source.bufferView === undefined) throw Error('Missing embedded texture.');
    const data = await parser.getDependency('bufferView', source.bufferView) as ArrayBuffer;
    const file = new File(folder, `${textureIndex}.${source.mimeType === 'image/png' ? 'png' : 'jpg'}`); file.create(); file.write(new Uint8Array(data));
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => Image.getSize(file.uri, (width, height) => resolve({ width, height }), reject));
    if (width > maxTexture || height > maxTexture || width < 1 || height < 1) throw Error(`Use embedded textures up to ${maxTexture} × ${maxTexture}.`);
    const texture = new THREE.Texture({ localUri: file.uri, width, height } as unknown as HTMLImageElement);
    texture.flipY = false; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false; texture.needsUpdate = true; textures.add(texture);
    return texture;
  } }));
  try { return { gltf: await loader.parseAsync(bytes, ''), cleanup }; }
  catch (e) { cleanup(); throw e; }
}
