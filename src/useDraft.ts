import{useEffect,useId}from 'react';import{useWardrobe}from './store';
export function useDraft(dirty:boolean){const id=useId();const{setDraft}=useWardrobe();useEffect(()=>{setDraft(id,dirty);return()=>setDraft(id,false);},[id,dirty,setDraft]);}
