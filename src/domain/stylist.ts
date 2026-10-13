import { categories, type Category, type Outfit, type StylistInput, type Suggestion, type StyleContext, type Garment } from './types';
export const outfitSignature=(outfit:Outfit):string=>categories.filter(c=>outfit[c]).map(c=>`${c}:${outfit[c]}`).join('|');
export function contextForOccasion(context:StyleContext,occasion:StyleContext['occasion']):StyleContext {
 const formality:StyleContext['formality']=occasion==='Event'?3:['Work','Dinner','Date'].includes(occasion)?2:1;
 return {...context,occasion,formality};
}
export function inferContext(prompt:string,base:StyleContext):StyleContext {
 const p=prompt.toLowerCase(); let c={...base,prompt};
 const occasions=[['university','University'],['work','Work'],['office','Work'],['dinner','Dinner'],['date','Date'],['event','Event'],['travel','Travel'],['friends','Friends']] as const;
 for(const [word,occasion] of occasions) if(new RegExp(`\\b${word}\\b`).test(p)) {c=contextForOccasion(c,occasion);break;}
 if(/\b(cold|winter|freezing)\b/.test(p)) c.weather='Cold'; else if(/\b(hot|warm|summer)\b/.test(p)) c.weather='Warm';
 if(/\bnot\s+formal\b/.test(p)) c.formality=1;
 else if(/\bsmart[ -]+casual\b/.test(p)) c.formality=2;
 else if(/\b(formal|wedding|dressed[ -]+up)\b/.test(p)) c.formality=3;
 else if(/\b(casual|relaxed)\b/.test(p)) c.formality=1;
 else if(/\b(smart|put[ -]+together)\b/.test(p)) c.formality=2;
 if(/\b(jacket|coat|layer)\b/.test(p)) c.includeLayer=true;
 if(/\b(no|without) (a )?(jacket|coat|layer)\b/.test(p)) c.includeLayer=false;
 if(/\b(accessory|accessories|watch|bag)\b/.test(p)) c.includeAccessory=true;
 if(c.weather!==base.weather){c.weatherMode='manual';c.forecast=undefined;}
 return c;
}
function score(outfit:Outfit,i:StylistInput):number {
 let score=0; const items=Object.values(outfit).map(id=>i.garments.find(g=>g.id===id)).filter((g):g is Garment=>!!g);
 const warmth={Warm:1,Mild:2,Cold:3}[i.context.weather];
 const now=(i.now??new Date()).getTime();
 for(const g of items) {
  score+=8-Math.abs(g.formality-i.context.formality)*3-Math.abs(g.warmth-warmth)*2;
  score+=g.styles.some(s=>i.preferredStyles.includes(s))?1:0;
  score+=g.favorite?0.4:0;
  score+=(i.preferredFits??[]).includes(g.fit)?1.5:0;
  score-=(i.avoidColors??[]).includes(g.color)?4:0;
  score+=Math.min(1.5,i.feedback.filter(f=>f.vote==='like'&&Object.values(f.outfit).includes(g.id)).reduce((n,f)=>n+.3*Math.exp(-Math.max(0,now-Date.parse(f.createdAt))/15552000000),0));
  score-=Math.min(4,i.history.filter(w=>Object.values(w.outfit).includes(g.id)).reduce((n,w)=>{const age=(now-Date.parse(w.wornAt))/86400000;return n+(age>=0&&age<7?3*(1-age/7):0);},0));
 }
 const vivid=items.filter(g=>!['White','Black','Grey','Navy','Beige','Brown'].includes(g.color));
 score-=Math.max(0,new Set(vivid.map(g=>g.color)).size-1)*0.8;
 const sig=outfitSignature(outfit); const votes=i.feedback.filter(f=>f.signature===sig); const last=votes[votes.length-1];
 if(last?.vote==='dislike') score-=12;
 if(last?.vote==='like') score+=1;
 for(const w of i.history) {const age=(now-Date.parse(w.wornAt))/86400000;if(age>=0&&age<14&&outfitSignature(w.outfit)===sig) score-=20*(1-age/14);}
 return score;
}
function generate(i:StylistInput,only?:Category):Suggestion {
 const now=i.now??new Date();i={...i,now,history:i.history.filter(w=>{const age=(now.getTime()-Date.parse(w.wornAt))/86400000;return age>=0&&age<14;})};
 const notices:string[]=[]; const available=i.garments.filter(g=>g.available); const base:Outfit={...i.current};
 if(only&&((only==='onepiece'&&(base.top||base.bottom))||(['top','bottom'].includes(only)&&base.onepiece)))return{outfit:base,reasons:[],notices:['Change outfit shape first. Shuffling one slot will not remove other pieces.'],changed:false};
 let onepiece=i.context.outfitMode==='onepiece';
 if(i.locks.onepiece&&base.onepiece)onepiece=true;
 if((i.locks.top&&base.top)||(i.locks.bottom&&base.bottom)){if(onepiece)notices.push('Kept your locked separates. Unlock them to switch to a one-piece look.');onepiece=false;}
 if(!only){if(onepiece){delete base.top;delete base.bottom;}else delete base.onepiece;}
 // A slot shuffle must preserve every non-target slot, even when the caller has stale inventory.
 for(const c of categories) if((!only||only===c)&&base[c]&&!available.some(g=>g.id===base[c]&&g.category===c)) {delete base[c];notices.push(`The ${c} item is unavailable or missing${i.locks[c]?'; its locked slot stays empty':''}.`);}
 let candidates:Outfit[]=[base];
 for(const c of categories) {
  if(only&&c!==only) continue;
  if(!only&&((onepiece&&['top','bottom'].includes(c))||(!onepiece&&c==='onepiece')))continue;
  if(i.locks[c]) continue;
  const enabled=!!only||!['outerwear','accessories','bag','eyewear'].includes(c)||!!base[c]||(c==='outerwear'&&i.context.includeLayer)||(c==='accessories'&&i.context.includeAccessory);
  if(!enabled) {candidates=candidates.map(o=>{const next={...o};delete next[c];return next;});continue;}
  const options=available.filter(g=>g.category===c);
  if(!options.length) {notices.push(`Add an available ${c} to complete this slot.`);continue;}
  // Bound the candidate beam while retaining diverse complete combinations.
  const expanded=candidates.flatMap(o=>options.map(g=>({...o,[c]:g.id})));
  candidates=expanded.map(outfit=>({outfit,score:score(outfit,i)+(i.random??Math.random)()*0.15})).sort((a,b)=>b.score-a.score).slice(0,256).map(x=>x.outfit);
 }
 const currentSig=outfitSignature(i.current);
 const alternatives=candidates.filter(o=>outfitSignature(o)!==currentSig);
 const pool=alternatives.length?alternatives:candidates;
 const ranked=pool.map(outfit=>({outfit,score:score(outfit,i)})).sort((a,b)=>b.score-a.score);
 const suitable=ranked.filter(x=>x.score>=(ranked[0]?.score??0)-.25).slice(0,12);
 const outfit=suitable[Math.min(suitable.length-1,Math.floor(Math.max(0,Math.min(.999999,(i.random??Math.random)()))*suitable.length))]?.outfit??base;
 const changed=outfitSignature(outfit)!==currentSig;
 if(!changed) notices.push(only&&i.locks[only]?'Unlock this slot to shuffle it.':'No different combination is available with these locks and items.');
 if(!available.length) notices.unshift('Your active wardrobe has no available items. Add clothes or turn on the example wardrobe.');
 const chosen=Object.values(outfit).map(id=>available.find(g=>g.id===id)).filter((g):g is Garment=>!!g);
 const reasons:string[]=[];
 if(chosen.length&&chosen.every(g=>g.formality===i.context.formality))reasons.push('Each piece matches your selected dress level.');
 if(chosen.some(g=>g.styles.some(s=>i.preferredStyles.includes(s))))reasons.push('Includes a style you selected.');
 if(chosen.some(g=>(i.preferredFits??[]).includes(g.fit)))reasons.push('Includes a fit you prefer.');
 if(i.history.length)reasons.push('Recent pieces and combinations were considered to reduce repetition.');
 if(!reasons.length&&chosen.length)reasons.push('Chosen from your available pieces. Adjust the details if the combination is not right.');
 if(i.feedback.length) reasons.push('Your feedback gently shapes these suggestions.');
 return {outfit,reasons,notices:[...new Set(notices)],changed};
}
export const suggestOutfit=(input:StylistInput):Suggestion=>generate(input);
export const shuffleSlot=(input:StylistInput,category:Category):Suggestion=>generate(input,category);
export function styleInsights(garments:Garment[],feedback:StylistInput['feedback'],history:StylistInput['history']):{label:string;detail:string}[]{
 const worn=new Set(history.flatMap(w=>Object.values(w.outfit)));const ready=garments.filter(g=>g.available).length;
 return[{label:'Ready to wear',detail:`${ready} of ${garments.length} pieces are available.`},{label:'Wardrobe rotation',detail:`${garments.filter(g=>worn.has(g.id)).length} pieces appear in your recorded wears.`},{label:'Your feedback',detail:`${feedback.filter(f=>f.vote==='like').length} liked combinations and ${feedback.filter(f=>f.vote==='dislike').length} passed over.`}];
}

