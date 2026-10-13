import{cloud}from './cloud';import{z}from 'zod';
import{features}from './features';
const origin=process.env.EXPO_PUBLIC_TRYON_URL;
export const tryOnConfigured=features.virtualTryOn&&!!cloud&&!!origin&&origin.startsWith('https://');
const jobSchema=z.object({id:z.string(),garmentId:z.string(),status:z.string(),createdAt:z.string(),error:z.string().nullable()});export type TryOnJob=z.infer<typeof jobSchema>;
async function request(path:string,method='GET',body?:unknown){if(!tryOnConfigured)throw Error('Try-on is not connected in this build.');const{data,error}=await cloud!.auth.getSession();if(error||!data.session)throw Error('Sign in under You → Account to use try-on.');const response=await fetch(`${origin!.replace(/\/$/,'')}${path}`,{method,headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(40000)});const result=await response.json();if(!response.ok)throw Error(typeof result.error==='string'?result.error:'Preview request failed.');return result;}
export async function listPreviews(){return z.object({jobs:z.array(jobSchema)}).parse(await request('/jobs')).jobs;}
export async function startPreview(body:{requestId:string;garmentId:string;category:'tops'|'bottoms'|'one-pieces';person:string;garment:string;consent:true}){return z.object({job:jobSchema}).parse(await request('/jobs','POST',body)).job;}
export async function getPreview(id:string){return z.object({job:jobSchema,image:z.string().optional()}).parse(await request(`/jobs/${encodeURIComponent(id)}`));}
export async function deletePreview(id:string){await request(`/jobs/${encodeURIComponent(id)}`,'DELETE');}
