import React from 'react';
import {Platform,type NativeSyntheticEvent,type StyleProp,type ViewStyle} from 'react-native';
import {requireNativeViewManager,requireOptionalNativeModule} from 'expo-modules-core';
import type {TrackedFacePacket} from '../domain/trackedFace';

const module=requireOptionalNativeModule<{isSupported:()=>boolean}>('ThreadFaceScanner');
export function supportsNativeFaceScan(){try{return Platform.OS==='ios'&&!!module?.isSupported();}catch{return false;}}
export type NativeFaceCapture=TrackedFacePacket&{anchorId:string;jpegBase64:string};
export type NativeFaceScannerRef={capture:(yaw:number,pitch:number)=>Promise<NativeFaceCapture>};
type Props={running:boolean;style?:StyleProp<ViewStyle>;onFaceUpdate:(event:NativeSyntheticEvent<Record<string,unknown>>)=>void;ref?:React.Ref<NativeFaceScannerRef>};
// Loading the custom view is conditional: Expo Go and unsupported platforms keep the real RGB path.
export const NativeFaceScanner=module?requireNativeViewManager<Props>('ThreadFaceScanner') as React.ComponentType<Props>:null;
