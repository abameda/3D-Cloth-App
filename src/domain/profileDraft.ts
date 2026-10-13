import type {Profile} from './types';
/** Merge external character changes while retaining fields the user is still editing. */
export function mergeProfileDraft(base:Profile,draft:Profile,next:Profile):Profile{
  const merged={...next};
  for(const key of Object.keys(draft) as (keyof Profile)[]){
    if(JSON.stringify(draft[key])!==JSON.stringify(base[key]))Object.assign(merged,{[key]:draft[key]});
  }
  return merged;
}
