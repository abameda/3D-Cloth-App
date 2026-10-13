import { LiveFaceScreen } from './src/screens/LiveFaceScreen';
import { ComputerScreen } from './src/screens/ComputerScreen';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { AvatarScreen } from './src/screens/AvatarScreen';
import React from 'react';
import{PrivacyScreen}from './src/screens/PrivacyScreen';
import{BatchScreen}from './src/screens/BatchScreen';
import{AutoSync}from './src/autoSync';
import { Platform, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { RootStackParamList, TabParamList } from './src/navigation';
import { WardrobeProvider, SaveStatus } from './src/store';
import { useTheme } from './src/ui/theme';
import { Icon, type IconName } from './src/ui/Icon';
import { StudioScreen } from './src/screens/StudioScreen';
import { WardrobeScreen } from './src/screens/WardrobeScreen';
import { LooksScreen } from './src/screens/LooksScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ItemScreen } from './src/screens/ItemScreen';
import { PickScreen } from './src/screens/PickScreen';
import { ContextScreen } from './src/screens/ContextScreen';
import { SaveLookScreen } from './src/screens/SaveLookScreen';
import { ConnectionScreen } from './src/screens/ConnectionScreen';
import { BackupScreen } from './src/screens/BackupScreen';
import {TryOnScreen}from './src/screens/TryOnScreen';
import {BodyScreen}from './src/screens/BodyScreen';
import{AppBoundary}from './src/ui/AppBoundary';
import { AccountScreen } from './src/screens/AccountScreen';

const Root = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();
const SectionStack = createNativeStackNavigator();
function NativeSection({ title, component }: { title: string; component: React.ComponentType }) {
  const t = useTheme();
  return <SectionStack.Navigator screenOptions={{ headerLargeTitle: false, headerStyle: { backgroundColor: t.background }, headerLargeStyle: { backgroundColor: t.background }, headerTintColor: t.text, headerShadowVisible: false, contentStyle: { backgroundColor: t.background } }}><SectionStack.Screen name={`${title}Home`} component={component} options={{ title }} /></SectionStack.Navigator>;
}
function Studio() { return <NativeSection title="Thread" component={StudioScreen} />; }
function Wardrobe() { return <NativeSection title="Dressing Room" component={WardrobeScreen} />; }
function You() { return <NativeSection title="Profile" component={ProfileScreen} />; }
const tabIcons: Record<keyof TabParamList, IconName> = { Home: 'person', DressingRoom: 'wardrobe', Profile: 'settings' };
function MainTabs() {
  const t = useTheme();
  return <Tabs.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: t.primary, tabBarInactiveTintColor: t.muted, tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line }, tabBarLabelStyle: { fontSize: 12, fontWeight: '500' }, tabBarIcon: ({ color, size }) => <Icon name={tabIcons[route.name]} color={color} size={size} /> })}><Tabs.Screen name="Home" component={Studio} /><Tabs.Screen name="DressingRoom" component={Wardrobe} options={{title:'Dressing Room'}} /><Tabs.Screen name="Profile" component={You} /></Tabs.Navigator>;
}
function AppNavigation() {
  const t = useTheme(); const theme = t.isDark ? DarkTheme : DefaultTheme;
  return <NavigationContainer theme={{ ...theme, colors: { ...theme.colors, primary: t.primary, background: t.background, card: t.surface, text: t.text, border: t.line } }}><View style={{ flex: 1, backgroundColor: t.background }}><StatusBar style={t.isDark ? 'light' : 'dark'} /><SaveStatus /><Root.Navigator screenOptions={{ headerTintColor: t.primary, headerStyle: { backgroundColor: t.background }, contentStyle: { backgroundColor: t.background }, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}><Root.Screen name="Main" component={MainTabs} options={{ headerShown: false }} /><Root.Screen name="LiveFace" component={LiveFaceScreen} options={{title:"Live face scan"}}/><Root.Screen name="Computer" component={ComputerScreen} options={{title:"Reconstruction computer"}}/><Root.Screen name="Body" component={BodyScreen} options={{title:"My body"}}/><Root.Screen name="Looks" component={LooksScreen} options={{title:"My looks"}}/><Root.Screen name="Capture" component={CaptureScreen} options={{title:"Photo to 3D"}}/><Root.Screen name="Avatar" component={AvatarScreen} options={{title:"Your character"}}/><Root.Screen name="TryOn" component={TryOnScreen} options={{title:"Try on a piece"}}/><Root.Screen name="Batch" component={BatchScreen} options={{title:"Add several pieces"}}/><Root.Screen name="Privacy" component={PrivacyScreen} options={{title:"Privacy and data"}}/><Root.Screen name="Backup" component={BackupScreen} options={{title:"Backup and restore"}}/><Root.Screen name="Account" component={AccountScreen} options={{title:"Account and cloud backup"}}/><Root.Screen name="Pick" component={PickScreen} options={{ title: 'Choose a piece' }} /><Root.Screen name="Connection" component={ConnectionScreen} options={{ title: 'AI settings' }} /><Root.Group screenOptions={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card' }}><Root.Screen name="Item" component={ItemScreen} options={({ route }) => ({ title: route.params?.id ? 'Edit piece' : 'Add a piece' })} /><Root.Screen name="Context" component={ContextScreen} options={{ title: 'Style my day' }} /><Root.Screen name="SaveLook" component={SaveLookScreen} options={{ title: 'Save look' }} /></Root.Group></Root.Navigator></View></NavigationContainer>;
}
export default function App() { return <SafeAreaProvider><AppBoundary><WardrobeProvider><AutoSync/><AppNavigation /></WardrobeProvider></AppBoundary></SafeAreaProvider>; }
