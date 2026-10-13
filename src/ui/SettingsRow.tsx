import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Label } from './primitives';
import { useTheme } from './theme';
export function SettingsRow({title,detail,icon,onPress}:{title:string;detail?:string;icon:IconName;onPress:()=>void}){
  const t=useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>({minHeight:60,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:14,borderBottomWidth:1,borderBottomColor:t.line,opacity:pressed ? .7 : 1})}>
    <Icon name={icon} size={22}/><View style={{flex:1,gap:2}}><Label weight="500">{title}</Label>{detail&&<Label muted size={13}>{detail}</Label>}</View><Icon name="next" size={17}/>
  </Pressable>;
}
