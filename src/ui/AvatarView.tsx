import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, PanResponder, StyleSheet, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AvatarOutfit } from '../domain/avatar';
import { disposeAvatar, dressAvatar, attachFaceScan, skinTones } from './avatarScene';
import { animateKit, dressKit, loadAvatarKit, type AvatarKit, type LoadedKit } from './avatarKit';
import type { AvatarAppearance } from '../domain/appearance';
import { loadFaceScan } from './loadFaceScan';
import { Button, Label, Notice } from './primitives';
import { colorHex, useTheme } from './theme';
import { createDressingRoom, roomView, type RoomView } from './roomScene';
import type { Category } from '../domain/types';

interface Props { kit?: AvatarKit; outfit: AvatarOutfit; angle: number; zoom: number; appearance: AvatarAppearance; scanUri?: string; assetUri?: string; height?:number; portrait?:boolean; greeting?:number; room?:RoomView; showCharacter?:boolean; onCategorySelect?:(category:Category)=>void; onRotate: (angle:number) => void }
interface Session { renderer: THREE.WebGLRenderer; scene: THREE.Scene; model: THREE.Group; camera: THREE.PerspectiveCamera; gl: ExpoWebGLRenderingContext; cleanup?: () => void; transitionStart:number; dark:boolean; mixer?:THREE.AnimationMixer; idle?:THREE.AnimationAction; wave?:THREE.AnimationAction; greeting:number; lastFrame:number; kit?:LoadedKit; started:number }

/** Native GL only. Active character clips animate; room/surface views render on changes. */
export function AvatarView(props: Props) {
  const t=useTheme();
  const latest=useRef({...props,background:t.board,dark:t.isDark});latest.current={...props,background:t.board,dark:t.isDark};
  const reduced=useRef(true),size=useRef({width:1,height:1});
  const session=useRef<Session|null>(null), generation=useRef(0), frame=useRef<number|null>(null);
  const mounted=useRef(true);
  const [attempt,setAttempt]=useState(0), [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [error,setError]=useState('');
  const dragStart=useRef(0);
  const pan=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderGrant:()=>{dragStart.current=latest.current.angle;},
    onPanResponderMove:(_,gesture)=>{if(latest.current.room!=='closet')latest.current.onRotate(dragStart.current+gesture.dx*.012);},
    onPanResponderRelease:(event,gesture)=>{
      const current=session.current;if(!current||latest.current.room!=='closet'||Math.abs(gesture.dx)+Math.abs(gesture.dy)>10)return;
      const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(event.nativeEvent.locationX/size.current.width*2-1,1-event.nativeEvent.locationY/size.current.height*2),current.camera);
      const room=current.scene.getObjectByName('dressing-room');if(!room)return;
      const hit=ray.intersectObject(room,true).find(value=>value.object.userData.category);
      if(hit)latest.current.onCategorySelect?.(hit.object.userData.category as Category);
    },
    onPanResponderTerminationRequest:()=>true,
  })).current;

  function release() {
    generation.current++;
    if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}
    const current=session.current;session.current=null;
    if(current){current.mixer?.stopAllAction();current.mixer?.uncacheRoot(current.model);disposeAvatar(current.scene);current.renderer.dispose();current.cleanup?.();}
  }
  const fail=(message:string)=>{release();setError(message);setStatus('error');};
  const draw=()=>{
    if(frame.current!==null)return;
    frame.current=requestAnimationFrame(()=>{
      frame.current=null;const current=session.current;if(!current)return;
      try {
        const p=latest.current;
        const now=Date.now(),delta=Math.min(.05,(now-current.lastFrame)/1000);current.lastFrame=now;
        let kitMoving=false;
        if(current.kit){dressKit(current.kit,p.outfit,colorHex,skinTones[p.appearance.skin]);kitMoving=animateKit(current.kit,(now-current.started)/1000,reduced.current);}
        else if(!p.assetUri)dressAvatar(current.model,p.outfit,p.appearance.skin,colorHex,p.appearance,!!p.scanUri);
        const animated=(!!current.mixer&&!reduced.current||kitMoving)&&p.showCharacter!==false;
        if(current.mixer){
          if(reduced.current){current.mixer.setTime(0);}else{
            if(p.greeting!==undefined&&p.greeting!==current.greeting&&current.wave){current.greeting=p.greeting;current.wave.reset().setLoop(THREE.LoopOnce,1).play();current.wave.clampWhenFinished=true;current.wave.crossFadeFrom(current.idle!,.18,false);}
            current.mixer.update(delta);
          }
        }
        current.model.rotation.y=p.angle;
        current.model.visible=p.showCharacter!==false;
        current.scene.background=new THREE.Color(p.background);
        const width=current.gl.drawingBufferWidth,height=current.gl.drawingBufferHeight;
        // Narrow screens need more distance to keep the hands inside the frame.
        const aspect=width/Math.max(1,height);
        current.camera.aspect=aspect;
        let animating=false;
        if(p.room){
          if(current.dark!==p.dark){const old=current.scene.getObjectByName('dressing-room');if(old){current.scene.remove(old);disposeAvatar(old);}current.scene.add(createDressingRoom(p.dark));current.dark=p.dark;}
          const view=p.portrait&&p.showCharacter!==false?{position:[0,1.64,1.45],target:[0,1.62,0]}:roomView(p.room,aspect),home=roomView('home',aspect);
          const progress=reduced.current?1:Math.min(1,(Date.now()-current.transitionStart)/520);
          const ease=1-Math.pow(1-progress,3);
          const position=new THREE.Vector3(...view.position as [number,number,number]),target=new THREE.Vector3(...view.target as [number,number,number]);
          if(p.room==='closet'){position.lerp(new THREE.Vector3(...home.position as [number,number,number]),1-ease);target.lerp(new THREE.Vector3(...home.target as [number,number,number]),1-ease);}
          position.z/=p.zoom;current.camera.position.copy(position);current.camera.lookAt(target);animating=p.room==='closet'&&progress<1;
        }else{current.camera.position.set(0,1.02,Math.max(3.15,1.8/aspect)/p.zoom);current.camera.lookAt(0,.96,0);}
        current.camera.updateProjectionMatrix();
        current.renderer.setSize(width,height,false);
        current.renderer.render(current.scene,current.camera);current.gl.endFrameEXP();
        if(animating||animated)draw();
      }catch{fail('This device could not render the 3D view. Your wardrobe is still available.');}
    });
  };
  useEffect(()=>{draw();},[props.outfit,props.angle,props.zoom,props.appearance,props.room,props.showCharacter,props.portrait,props.greeting,t.board]);
  useEffect(()=>{let active=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active){reduced.current=value;draw();}});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{reduced.current=value;draw();});return()=>{active=false;sub.remove();};},[]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;release();};},[]);
  useEffect(()=>{
    if(status!=='loading')return;
    const timer=setTimeout(()=>fail('The 3D view took too long to open. Try again or return to your wardrobe.'),20000);
    return()=>clearTimeout(timer);
  },[status,attempt]);

  async function create(gl:ExpoWebGLRenderingContext) {
    if(!mounted.current)return;
    const token=++generation.current;
    let renderer:THREE.WebGLRenderer|undefined, scene:THREE.Scene|undefined;
    let cleanup: (()=>void)|undefined;
    let transferred=false;
    try {
      let loaded:{scene:THREE.Group;animations?:THREE.AnimationClip[]};
      let kit:LoadedKit|undefined;
      if(latest.current.kit&&!latest.current.assetUri){
        kit=await loadAvatarKit(latest.current.kit);cleanup=kit.cleanup;loaded={scene:kit.root};
      }else if(latest.current.assetUri){
        const artifact=await loadFaceScan(latest.current.assetUri);cleanup=artifact.cleanup;loaded=artifact;
        const bounds=new THREE.Box3().setFromObject(loaded.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
        const scale=1.6/Math.max(size.x,size.y,size.z);loaded.scene.position.sub(center);loaded.scene.scale.setScalar(scale);loaded.scene.position.multiplyScalar(scale);loaded.scene.position.y+=.96;
      }else{
        const asset=await Asset.fromModule(require('../../assets/avatar/thread-character.glb')).downloadAsync();
        if(token!==generation.current)return;
        if(!asset.localUri)throw Error('Missing local asset');
        const bytes=await new File(asset.localUri).arrayBuffer();loaded=await new GLTFLoader().parseAsync(bytes,'');
      }
      scene=new THREE.Scene();scene.add(loaded.scene);
      if(latest.current.scanUri&&!latest.current.assetUri&&!kit) {
        const face=await loadFaceScan(latest.current.scanUri);cleanup=face.cleanup;
        try { attachFaceScan(loaded.scene,face.scene); } catch(e) { disposeAvatar(face.scene);throw e; }
      }
      if(token!==generation.current)return;
      // Three expects a canvas interface; Expo supplies its native WebGL2 context.
      // No DOM, HTML or WebView is created.
      const canvas={width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,style:{},
        addEventListener:()=>{},removeEventListener:()=>{},getContext:()=>gl};
      renderer=new THREE.WebGLRenderer({canvas:canvas as unknown as HTMLCanvasElement,context:gl as unknown as WebGL2RenderingContext,antialias:true});
      renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
      scene.add(new THREE.HemisphereLight('#FFF4E5','#758A80',2.5));
      const key=new THREE.DirectionalLight('#FFF8EE',3);key.position.set(-2,4,4);scene.add(key);
      const fill=new THREE.DirectionalLight('#D6E8FF',1.5);fill.position.set(3,2,-3);scene.add(fill);
      if(latest.current.room)scene.add(createDressingRoom(latest.current.dark));
      else {const platform=new THREE.Mesh(new THREE.CylinderGeometry(.52,.54,.028,64),new THREE.MeshStandardMaterial({color:'#9EAEA4',roughness:1}));platform.position.y=-.025;scene.add(platform);}
      const camera=new THREE.PerspectiveCamera(38,1,.05,30);
      const mixer=loaded.animations?.length?new THREE.AnimationMixer(loaded.scene):undefined;
      const idleClip=loaded.animations?.find(clip=>clip.name==='Idle'),waveClip=loaded.animations?.find(clip=>clip.name==='Wave');
      const idle=idleClip&&mixer?mixer.clipAction(idleClip).play():undefined,wave=waveClip&&mixer?mixer.clipAction(waveClip):undefined;
      if(mixer&&idle&&wave)mixer.addEventListener('finished',()=>{wave.fadeOut(.2);idle.reset().fadeIn(.2).play();});
      session.current={renderer,scene,model:loaded.scene,camera,gl,cleanup,transitionStart:Date.now(),dark:latest.current.dark,mixer,idle,wave,greeting:latest.current.greeting??0,lastFrame:Date.now(),kit,started:Date.now()};transferred=true;
      setStatus('ready');draw();
    }catch(e){
      if(token===generation.current)fail(latest.current.scanUri&&e instanceof Error ? `Couldn’t open this face scan. ${e.message}` : 'Couldn’t open the 3D character. Try again; your saved clothes are safe.');
    }finally{
      if(!transferred){if(scene)disposeAvatar(scene);renderer?.dispose();cleanup?.();}
    }
  }

  return <View style={{height:props.height??430,borderRadius:16,overflow:'hidden',backgroundColor:t.board}} onLayout={event=>{size.current=event.nativeEvent.layout;draw();}}>
    {status!=='error'&&<GLView key={attempt} style={StyleSheet.absoluteFill} msaaSamples={4} onContextCreate={gl=>{void create(gl);}} />}
    {status==='ready'&&<View {...pan.panHandlers} accessible accessibilityRole="image" accessibilityLabel={props.room==='closet'?'3D dressing room. Tap a rail or use the category buttons below.':props.showCharacter===false?'Your 3D dressing room. Create your character using the button below.':props.assetUri?'Reconstructed 3D surface from your photos. Drag to turn.':props.scanUri?'Your reconstructed face on the standard preview body. Use the view buttons below to turn.':'Customizable 3D avatar. Use the view buttons below to turn.'} style={StyleSheet.absoluteFill}/>}
    {status==='loading'&&<View style={[StyleSheet.absoluteFill,{justifyContent:'center',alignItems:'center',gap:12}]}><ActivityIndicator color={t.primary}/><Label>Opening your 3D character…</Label></View>}
    {status==='error'&&<View style={{flex:1,justifyContent:'center',padding:20,gap:16}}><Notice error>{error}</Notice><Button title="Retry 3D preview" secondary onPress={()=>{release();setError('');setStatus('loading');setAttempt(a=>a+1);}}/></View>}
  </View>;
}
