// Original Thread sample geometry. No remote assets, textures, or model inference.
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mkdir, writeFile } from 'node:fs/promises';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result=result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const root=new T.Group(); root.name='ThreadCharacter';
const material=(name,color,roughness=.82)=>new T.MeshStandardMaterial({name,color,roughness});
const skin=material('skin','#A86D4D'), hair=material('hair','#24211F');
const base=material('base','#525C58'), shirt=material('top','#F4F1E9'), pants=material('bottom','#293A50');
const shoe=material('shoes','#F4F1E9'), layer=material('outerwear','#718569'), dress=material('onepiece','#8B6851');
const sole=material('sole','#CBC8BD'), dark=material('detail','#302722'), eyes=material('eye-white','#E5DCD1');
const groups=Object.fromEntries(['body','top','bottom','shoes','outerwear','onepiece','bag','eyewear','accessories','long-hair'].map(name=>{const g=new T.Group();g.name=name;root.add(g);return[name,g];}));
function mesh(group,name,geometry,mat,pos=[0,0,0],scale=[1,1,1]) {
  const m=new T.Mesh(geometry,mat);m.name=name;m.position.set(...pos);m.scale.set(...scale);group.add(m);return m;
}
function oval(group,name,pos,scale,mat) { return mesh(group,name,new T.SphereGeometry(1,24,16),mat,pos,scale); }
// Elliptical profile loft. Seam is welded by matching duplicated positions/normals.
function loft(group,name,rings,mat,{x=0,z=0,start=0,sweep=Math.PI*2,segments=40}={}) {
  const vertices=[],indices=[];
  for(const [y,rx,rz] of rings) for(let j=0;j<=segments;j++) {
    const a=start+j/segments*sweep; vertices.push(x+rx*Math.sin(a),y,z+rz*Math.cos(a));
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++) {
    const a=i*(segments+1)+j,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
  if(sweep===Math.PI*2){const n=g.attributes.normal;for(let i=0;i<rings.length;i++){const a=i*(segments+1),b=a+segments;const v=new T.Vector3().fromBufferAttribute(n,a).add(new T.Vector3().fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}}
  return mesh(group,name,g,mat);
}
function limb(group,name,a,b,r1,r2,mat){
  const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);
  const m=mesh(group,name,new T.CylinderGeometry(r2,r1,delta.length(),20,1),mat,av.clone().add(bv).multiplyScalar(.5).toArray());
  m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return m;
}
// Neutral A-pose, 1.86m high. Covered base remains when outfit slots are empty.
loft(groups.body,'base-torso',[[.86,.13,.086],[1.02,.15,.095],[1.18,.145,.085],[1.36,.205,.11],[1.47,.20,.095],[1.51,.10,.075]],base);
limb(groups.body,'neck',[0,1.47,0],[0,1.62,0],.061,.064,skin);
loft(groups.body,'head',[[1.58,.03,.033],[1.60,.057,.06],[1.65,.086,.084],[1.72,.106,.096],[1.79,.098,.093],[1.835,.063,.065],[1.85,.003,.003]],skin,{z:.007});
for(const s of [-1,1]) {
  oval(groups.body,`ear-${s}`,[s*.104,1.715,.005],[.019,.034,.015],skin);
  oval(groups.body,`eye-${s}`,[s*.041,1.741,.096],[.018,.009,.004],eyes);
  oval(groups.body,`iris-${s}`,[s*.041,1.741,.100],[.007,.007,.002],dark);
  const brow=oval(groups.body,`brow-${s}`,[s*.042,1.76,.094],[.025,.004,.006],hair);brow.rotation.z=s*-.1;
  oval(groups.body,`shoulder-${s}`,[s*.20,1.432,0],[.072,.077,.075],skin);
  limb(groups.body,`upper-arm-${s}`,[s*.22,1.44,0],[s*.36,1.17,0],.064,.048,skin);
  oval(groups.body,`elbow-${s}`,[s*.36,1.17,0],[.047,.05,.047],skin);
  limb(groups.body,`forearm-${s}`,[s*.36,1.17,0],[s*.46,.965,.015],.047,.03,skin);
  oval(groups.body,`hand-${s}`,[s*.478,.916,.015],[.035,.067,.025],skin);
  oval(groups.body,`thumb-${s}`,[s*.453,.93,.04],[.014,.032,.018],skin);
  loft(groups.body,`leg-${s}`,[[.08,.047,.057],[.30,.052,.06],[.48,.056,.065],[.57,.06,.07],[.80,.08,.085],[.99,.09,.09]],skin,{x:s*.093});
  oval(groups.body,`foot-${s}`,[s*.096,.064,.056],[.054,.054,.118],skin);
  loft(groups.body,`base-shorts-${s}`,[[.71,.082,.09],[.92,.097,.103],[1.04,.085,.101]],base,{x:s*.093});
}
oval(groups.body,'nose',[0,1.708,.101],[.018,.032,.025],skin);
oval(groups.body,'mouth',[0,1.669,.088],[.031,.0035,.006],material('lips','#744838'));
// Sculpted cap with short directional locks, keeping the face unobscured.
mesh(groups.body,'hair-cap',new T.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI*.52),hair,[0,1.778,-.006],[.108,.085,.103]);
for(let i=0;i<9;i++){const x=(i-4)*.021;const tuft=oval(groups.body,`hair-lock-${i}`,[x,1.824+(.01*Math.cos(i)),.047],[.025,.041,.052],hair);tuft.rotation.z=-.32;}
loft(groups.top,'tee',[[1.025,.157,.101],[1.055,.16,.104],[1.23,.173,.11],[1.40,.213,.12],[1.47,.21,.108],[1.505,.071,.068]],shirt);
loft(groups.top,'neck-rib',[[1.50,.074,.071],[1.51,.070,.067]],shirt);
for(const s of [-1,1]) {
  oval(groups.top,`tee-shoulder-${s}`,[s*.202,1.434,0],[.087,.088,.087],shirt);
  limb(groups.top,`tee-sleeve-${s}`,[s*.205,1.445,0],[s*.294,1.29,0],.082,.073,shirt);
  loft(groups.bottom,`trouser-leg-${s}`,[[.135,.064,.072],[.17,.065,.074],[.45,.071,.078],[.66,.079,.085],[.88,.095,.104],[1.04,.092,.109]],pants,{x:s*.093});
  oval(groups.shoes,`sneaker-${s}`,[s*.096,.079,.065],[.067,.071,.137],shoe);
  oval(groups.shoes,`sole-${s}`,[s*.096,.029,.065],[.069,.023,.139],sole);
  for(let i=0;i<4;i++)limb(groups.shoes,`lace-${s}-${i}`,[s*.096-.033,.14-i*.006,.05+i*.021],[s*.096+.033,.14-i*.006,.05+i*.021],.003,.003,sole);
  limb(groups.outerwear,`jacket-sleeve-${s}`,[s*.213,1.439,0],[s*.456,.99,.014],.093,.057,layer);
  oval(groups.outerwear,`shoulder-cap-${s}`,[s*.211,1.434,0],[.097,.096,.099],layer);
}
loft(groups.bottom,'waistband',[[1.013,.179,.113],[1.055,.177,.113]],pants);
// Open front: two visible edges frame the shirt, connected around the back.
loft(groups.outerwear,'open-jacket',[[.98,.225,.167],[1.03,.223,.165],[1.23,.208,.15],[1.42,.239,.15],[1.475,.226,.125],[1.51,.085,.089]],layer,{start:.38,sweep:Math.PI*2-.76});
layer.side=T.DoubleSide;
loft(groups.onepiece,'dress',[[.45,.27,.19],[.48,.267,.188],[.75,.235,.159],[1.01,.205,.14],[1.16,.161,.103],[1.35,.198,.12],[1.47,.21,.108],[1.505,.073,.071]],dress);
dress.side=T.DoubleSide;
for(const s of [-1,1]){
  oval(groups.onepiece,`dress-shoulder-${s}`,[s*.202,1.434,0],[.087,.088,.087],dress);
  limb(groups.onepiece,`dress-sleeve-${s}`,[s*.205,1.445,0],[s*.294,1.29,0],.082,.073,dress);
}
// Optional longer hair remains separate so changing styles does not alter the face.
oval(groups['long-hair'],'hair-back',[0,1.66,-.071],[.12,.19,.07],hair);
for(const s of [-1,1]) oval(groups['long-hair'],`hair-side-${s}`,[s*.112,1.64,.005],[.028,.16,.066],hair);
// Original category shapes: tote, glasses and a watch. Details keep their materials.
const bagMat=material('bag','#8B6851'), glassesMat=material('eyewear','#24211F'), watchMat=material('accessories','#293A50');
mesh(groups.bag,'tote-body',new T.BoxGeometry(.19,.22,.085),bagMat,[.32,.92,.08]);
mesh(groups.bag,'tote-handle',new T.TorusGeometry(.058,.009,8,32),bagMat,[.32,1.08,.08],[1,1.25,1]);
for(const s of [-1,1]) {
  mesh(groups.eyewear,`frame-${s}`,new T.TorusGeometry(.028,.004,8,32),glassesMat,[s*.044,1.742,.106],[1,.72,1]);
  limb(groups.eyewear,`temple-${s}`,[s*.073,1.744,.10],[s*.108,1.735,.0],.003,.003,glassesMat);
}
limb(groups.eyewear,'bridge',[-.016,1.744,.106],[.016,1.744,.106],.003,.003,glassesMat);
const band=mesh(groups.accessories,'watch-band',new T.TorusGeometry(.034,.009,8,24),watchMat,[-.448,.995,.014]);
band.rotation.x=Math.PI/2;
oval(groups.accessories,'watch-face',[-.448,1.003,.048],[.025,.028,.008],sole);
// Authored morph targets; presets change actual mesh vertices, not a portrait overlay.
function morph(object,name,transform){
  const position=object.geometry.attributes.position,attribute=position.clone();attribute.name=name;
  for(let i=0;i<attribute.count;i++){const value=transform(new T.Vector3().fromBufferAttribute(position,i));attribute.setXYZ(i,value.x,value.y,value.z);}
  (object.geometry.morphAttributes.position??=[]).push(attribute);object.updateMorphTargets();
}
morph(root.getObjectByName('head'),'Round',v=>new T.Vector3(v.x*1.14,1.715+(v.y-1.715)*.94,v.z*1.06));
morph(root.getObjectByName('head'),'Square',v=>new T.Vector3(v.x*(v.y<1.7?1.25:1.02),v.y,v.z));
morph(root.getObjectByName('nose'),'Strong',v=>new T.Vector3(v.x*1.08,v.y,v.z*1.45));
morph(root.getObjectByName('nose'),'Small',v=>v.multiplyScalar(.72));
morph(root.getObjectByName('mouth'),'Smile',v=>new T.Vector3(v.x,v.y+3*v.x*v.x,v.z));
for(const side of [-1,1]){
  morph(root.getObjectByName(`eye-${side}`),'Wide',v=>new T.Vector3(v.x*1.2,v.y*1.1,v.z));
  morph(root.getObjectByName(`eye-${side}`),'Blink',v=>new T.Vector3(v.x,v.y*.06,v.z));
  morph(root.getObjectByName(`iris-${side}`),'Blink',v=>new T.Vector3(v.x,v.y*.04,v.z));
  morph(root.getObjectByName(`brow-${side}`),'Bold',v=>new T.Vector3(v.x*1.08,v.y*1.7,v.z));
}
// Articulated shoulder/elbow bones preserve the authored neutral pose on export.
const armBones=[];
function armRig(group,side,names){
  const upper=new T.Bone();upper.name=`rig-${group.name}-upper-${side}`;upper.position.set(side*.21,1.44,0);group.add(upper);
  const lower=new T.Bone();lower.name=`rig-${group.name}-lower-${side}`;lower.position.set(side*.15,-.27,0);upper.add(lower);
  root.updateMatrixWorld(true);
  for(const name of names.upper){const object=root.getObjectByName(name);if(object)upper.attach(object);}
  for(const name of names.lower){const object=root.getObjectByName(name);if(object)lower.attach(object);}
  armBones.push({upper,lower,side});
}
for(const side of [-1,1]){
  armRig(groups.body,side,{upper:[`shoulder-${side}`,`upper-arm-${side}`],lower:[`elbow-${side}`,`forearm-${side}`,`hand-${side}`,`thumb-${side}`]});
  groups.body.getObjectByName(`rig-body-upper-${side}`).name=`rig-upper-arm-${side}`;
  armRig(groups.top,side,{upper:[`tee-shoulder-${side}`,`tee-sleeve-${side}`],lower:[]});
  armRig(groups.outerwear,side,{upper:[`shoulder-cap-${side}`,`jacket-sleeve-${side}`],lower:[]});
  armRig(groups.onepiece,side,{upper:[`dress-shoulder-${side}`,`dress-sleeve-${side}`],lower:[]});
}
const idleTracks=[],waveTracks=[],times=[0,.6,1.2,1.8,2.4];
for(const {upper,lower,side}of armBones){
  const rotations=times.map((_,i)=>new T.Quaternion().setFromEuler(new T.Euler(0,0,side*[0,.025,0,-.025,0][i])));
  idleTracks.push(new T.QuaternionKeyframeTrack(`${upper.name}.quaternion`,times,rotations.flatMap(q=>q.toArray())));
  if(side===1){
    const wave=times.map((_,i)=>new T.Quaternion().setFromEuler(new T.Euler([0,-.12,-.12,-.12,0][i],0,[0,1.15,1.1,1.15,0][i])));
    waveTracks.push(new T.QuaternionKeyframeTrack(`${upper.name}.quaternion`,times,wave.flatMap(q=>q.toArray())));
    const bend=times.map((_,i)=>new T.Quaternion().setFromEuler(new T.Euler(0,[0,-.7,-.3,-.7,0][i],0)));
    waveTracks.push(new T.QuaternionKeyframeTrack(`${lower.name}.quaternion`,times,bend.flatMap(q=>q.toArray())));
  }
}
for(const side of [-1,1])for(const part of ['eye','iris']){
  idleTracks.push(new T.NumberKeyframeTrack(`${part}-${side}.morphTargetInfluences[Blink]`,[0,2.7,2.8,2.9,4.4],[0,0,1,0,0]));
}
const clips=[new T.AnimationClip('Idle',4.4,idleTracks),new T.AnimationClip('Wave',2.4,waveTracks)];
// Export every garment. Runtime selects object groups without network requests.
const binary=await new GLTFExporter().parseAsync(root,{binary:true,animations:clips});
await mkdir('assets/avatar',{recursive:true});
await writeFile('assets/avatar/thread-character.glb',Buffer.from(binary));
console.log(`Wrote original character: ${binary.byteLength} bytes`);
