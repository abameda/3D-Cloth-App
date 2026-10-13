import Constants from 'expo-constants';
import {Directory,Paths} from 'expo-file-system';
import {captureStoragePolicy} from './domain/captureStorage';

export const temporaryCaptureStorage=captureStoragePolicy(Constants.executionEnvironment)==='cache';
export const captureStorageRoot=temporaryCaptureStorage?Paths.cache:Paths.document;
export const captureFolder=(name:string)=>new Directory(captureStorageRoot,name);
export const captureFolders=(name:string)=>[new Directory(Paths.document,name),new Directory(Paths.cache,name)];
