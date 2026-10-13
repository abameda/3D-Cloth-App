import {z} from 'zod';
const recordSchema=z.object({uri:z.string().min(1),source:z.enum(['photo','external','legacy','tracked']),captureId:z.string().uuid().optional()}).strict();
export type FaceRecord=z.infer<typeof recordSchema>;
export function readFaceRecord(raw:string|null):FaceRecord|undefined{
  if(raw===null)return;
  if(raw.startsWith('file://'))return{uri:raw,source:'legacy'};
  return recordSchema.parse(JSON.parse(raw));
}
export function faceCaptureOwnsModel(record:FaceRecord|undefined,captureId:string,legacyUri?:string){
  if(!record||record.source==='external'||record.source==='tracked')return false;
  if(record.captureId)return record.captureId===captureId;
  return !!legacyUri&&record.uri.split('/').pop()===legacyUri.split('/').pop();
}
