import {z} from 'zod';
import * as THREE from 'three';
import {validateFaceScan} from './faceScan';

export const faceObservationSchema=z.object({anchorId:z.string().uuid().optional(),tracked:z.boolean(),framed:z.boolean().optional(),yaw:z.number().finite(),pitch:z.number().finite(),jawOpen:z.number().min(0).max(1),blinkLeft:z.number().min(0).max(1),blinkRight:z.number().min(0).max(1)});
export type FaceObservation=z.infer<typeof faceObservationSchema>;
/** AR anchor continuity is a session check, never biometric identity verification. */
export function assertFaceCaptureAnchor(previous:string|undefined,incoming:string){
  const id=z.string().uuid().parse(incoming).toLowerCase();
  if(previous&&previous.toLowerCase()!==id)throw Error('Tracking changed during capture. Restart with one face.');
  return id;
}
export const faceScanViews=[
  {label:'Look straight ahead',yaw:0,pitch:0},
  {label:'Turn gently to your left',yaw:.35,pitch:0},
  {label:'A little further left',yaw:.6,pitch:0},
  {label:'Look straight ahead again',yaw:0,pitch:0},
  {label:'Turn gently to your right',yaw:-.35,pitch:0},
  {label:'A little further right',yaw:-.6,pitch:0},
  {label:'Raise your chin slightly',yaw:0,pitch:.2},
  {label:'Lower your chin slightly',yaw:0,pitch:-.2},
]as const;
export function canCaptureFaceView(face:FaceObservation,view:{yaw:number;pitch:number}){
  return face.tracked&&face.framed!==false&&Math.abs(face.yaw-view.yaw)<.13&&Math.abs(face.pitch-view.pitch)<.13&&face.jawOpen<.15&&face.blinkLeft<.5&&face.blinkRight<.5;
}
const packetSchema=z.object({positions:z.array(z.number().finite().min(-1).max(1)).min(9).max(15000),indices:z.array(z.number().int().min(0).max(65535)).min(3).max(30000),uvs:z.array(z.number().finite().min(0).max(1)).min(6).max(10000)}).strict();
export type TrackedFacePacket=z.infer<typeof packetSchema>;

/** Preserve the SDK's supplied face surface and projected photograph; invent no head/back geometry. */
export function packTrackedFace(packet:TrackedFacePacket,jpeg:Uint8Array):ArrayBuffer{
  const checked=packetSchema.parse(packet),count=checked.positions.length/3;
  if(!Number.isInteger(count)||checked.indices.length%3||checked.uvs.length!==count*2||checked.indices.some(index=>index>=count))throw Error('The tracked face has invalid geometry or texture coordinates. Capture again.');
  if(jpeg.length<4||jpeg.length>4*1024*1024||jpeg[0]!==255||jpeg[1]!==216||jpeg[2]!==255||jpeg[jpeg.length-2]!==255||jpeg[jpeg.length-1]!==217)throw Error('The face photograph is invalid or too large. Capture again.');
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(checked.positions,3));geometry.setIndex(checked.indices);geometry.computeVertexNormals();
  const normals=new Float32Array(geometry.attributes.normal.array);geometry.computeBoundingBox();const bounds=geometry.boundingBox!;
  const min=bounds.min.toArray(),max=bounds.max.toArray();geometry.dispose();
  if(max[0]-min[0]<.02||max[1]-min[1]<.02||max[2]-min[2]<.002)throw Error('The tracked face surface is incomplete. Capture again.');
  const chunks=[new Uint8Array(new Float32Array(checked.positions).buffer),new Uint8Array(normals.buffer),new Uint8Array(new Float32Array(checked.uvs).buffer),new Uint8Array(new Uint16Array(checked.indices).buffer),jpeg];
  let cursor=0;const views=chunks.map(chunk=>{const view={buffer:0,byteOffset:cursor,byteLength:chunk.length};cursor+=Math.ceil(chunk.length/4)*4;return view;});
  const manifest={asset:{version:'2.0',generator:'Thread native tracked face surface'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'tracked-face-surface',mesh:0}],
    meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3,material:0}]}],
    accessors:[{bufferView:0,componentType:5126,count,type:'VEC3',min,max},{bufferView:1,componentType:5126,count,type:'VEC3'},{bufferView:2,componentType:5126,count,type:'VEC2'},{bufferView:3,componentType:5123,count:checked.indices.length,type:'SCALAR'}],
    bufferViews:views,buffers:[{byteLength:cursor}],images:[{bufferView:4,mimeType:'image/jpeg'}],textures:[{source:0}],materials:[{name:'captured-face',doubleSided:true,pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.9}}]};
  const encoded=new TextEncoder().encode(JSON.stringify(manifest)),jsonLength=Math.ceil(encoded.length/4)*4;
  const bytes=new Uint8Array(28+jsonLength+cursor),header=new DataView(bytes.buffer);
  header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,bytes.length,true);header.setUint32(12,jsonLength,true);header.setUint32(16,0x4e4f534a,true);
  bytes.fill(32,20,20+jsonLength);bytes.set(encoded,20);header.setUint32(20+jsonLength,cursor,true);header.setUint32(24+jsonLength,0x004e4942,true);
  chunks.forEach((chunk,index)=>bytes.set(chunk,28+jsonLength+views[index].byteOffset));validateFaceScan(bytes.buffer);return bytes.buffer;
}
