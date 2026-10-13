import type { Category } from './domain/types';
import type { NavigatorScreenParams } from '@react-navigation/native';
export type TabParamList = { Home: undefined; DressingRoom: undefined; Profile: undefined };
export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined; Item: { id?: string; photoSource?:'camera'|'library' } | undefined; Pick: { category: Category };
  Context: undefined; SaveLook: undefined; Connection: undefined; Backup:undefined; Privacy:undefined; Batch:undefined; Account:undefined; TryOn:undefined; Avatar:undefined;
  Looks: {view?:'saved'|'history'} | undefined;
  Computer: undefined;
  Body: undefined;
  LiveFace: undefined;
  Capture: {kind:'face'|'body'|'garment';garmentId?:string};
};
