import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { makeId } from './domain/state';

export async function choosePhoto(camera: boolean): Promise<string | undefined> {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera access is off. Enable it in your device settings, or choose an existing photo.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: .85, allowsEditing: false };
  const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return;
  const asset=result.assets[0];const image = await manipulateAsync(asset.uri, [{ resize: asset.width>=asset.height?{width:Math.min(asset.width,1200)}:{height:Math.min(asset.height,1200)} }], { compress: .8, format: SaveFormat.JPEG });
  const directory = new Directory(Paths.document, 'wardrobe-photos');
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, `${makeId()}.jpg`);
  new File(image.uri).copy(destination);
  return destination.uri;
}
export async function photoDataUri(uri: string) { return `data:image/jpeg;base64,${await new File(uri).base64()}`; }
export async function chooseManyPhotos(){const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,selectionLimit:20,quality:.85});if(result.canceled)return[];const saved:string[]=[];try{for(const asset of result.assets){const image=await manipulateAsync(asset.uri,[{resize:asset.width>=asset.height?{width:Math.min(asset.width,1200)}:{height:Math.min(asset.height,1200)}}],{compress:.8,format:SaveFormat.JPEG});const directory=new Directory(Paths.document,'wardrobe-photos');directory.create({idempotent:true,intermediates:true});const destination=new File(directory,`${makeId()}.jpg`);new File(image.uri).copy(destination);saved.push(destination.uri);}return saved;}catch(e){saved.forEach(removeManagedPhoto);throw e;}}
export function removeManagedPhoto(uri?: string) {
  if (!uri) return;
  const prefix = new Directory(Paths.document, 'wardrobe-photos').uri;
  if (uri.startsWith(prefix + '/') || (prefix.endsWith('/') && uri.startsWith(prefix))) { try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Retried by startup pruning after the next successful load. */ } }
}
export function pruneManagedPhotos(referenced: Set<string>) {
  try { const directory = new Directory(Paths.document, 'wardrobe-photos'); if (!directory.exists) return; for (const entry of directory.list()) if (entry instanceof File && entry.name.endsWith('.jpg') && !referenced.has(entry.uri)) removeManagedPhoto(entry.uri); } catch { /* Storage read/write failures must not block opening a valid wardrobe. */ }
}
export function eraseManagedPhotos(){const directory=new Directory(Paths.document,'wardrobe-photos');if(!directory.exists)return;for(const entry of directory.list())if(entry instanceof File&&entry.name.endsWith('.jpg'))entry.delete();}
