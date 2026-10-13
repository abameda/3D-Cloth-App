import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
Deno.serve(async(req:Request)=>{
 const json=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST')return json(405,{error:'Method not allowed'});
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const token=req.headers.get('Authorization')??'';
 const client=createClient(url,anon,{global:{headers:{Authorization:token}},auth:{persistSession:false}});
 const {data,error}=await client.auth.getUser(token.replace(/^Bearer /,''));if(error||!data.user?.email)return json(401,{error:'Sign in again.'});
 let password:string;try{const raw=await req.text();if(raw.length>5000)throw Error();password=JSON.parse(raw).password;if(typeof password!=='string'||password.length<1||password.length>1024)throw Error();}catch{return json(400,{error:'Confirm your account password.'});}
 const fresh=createClient(url,anon,{auth:{persistSession:false}});const verified=await fresh.auth.signInWithPassword({email:data.user.email,password});password='';
 if(verified.error||verified.data.user?.id!==data.user.id||!verified.data.session)return json(401,{error:'Account password could not be verified.'});
 const admin=createClient(url,service,{auth:{persistSession:false}});const uid=data.user.id;
 try{
  const {error:revokeError}=await admin.auth.admin.signOut(verified.data.session.access_token,'global');if(revokeError)throw revokeError;
  let calls=0;async function clear(prefix:string){while(true){if(++calls>300)throw Error('Cleanup limit reached');const{data:files,error}=await admin.storage.from('thread-vaults').list(prefix,{limit:100});if(error)throw error;if(!files?.length)return;const objects:string[]=[];for(const file of files){if(file.id)objects.push(prefix+'/'+file.name);else await clear(prefix+'/'+file.name);}if(objects.length){const{error:removeError}=await admin.storage.from('thread-vaults').remove(objects);if(removeError)throw removeError;}}}
  await clear(uid);const {error:deleteError}=await admin.auth.admin.deleteUser(uid);if(deleteError)throw deleteError;return json(200,{deleted:true});
 }catch{return json(503,{error:'Cleanup could not finish. Sign in again and retry. Your remaining backups are still private.'});}
});
