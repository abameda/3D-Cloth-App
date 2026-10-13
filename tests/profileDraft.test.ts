import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeProfileDraft} from '../src/domain/profileDraft';
import type {Profile} from '../src/domain/types';
test('character changes merge without discarding unsaved profile preferences',()=>{
  const base:Profile={name:'Old',styles:[],avatarMode:'real'},draft:Profile={...base,name:'New',styles:['Classic']},next:Profile={...base,avatarMode:'custom'};
  assert.deepEqual(mergeProfileDraft(base,draft,next),{...draft,avatarMode:'custom'});
});
test('external updates apply to clean fields while explicit removals stay dirty',()=>{
  const base:Profile={name:'Name',styles:[],imageUri:'file:///portrait'},draft={...base,imageUri:undefined};
  assert.equal(mergeProfileDraft(base,draft,{...base,name:'Updated'}).name,'Updated');assert.equal(mergeProfileDraft(base,draft,base).imageUri,undefined);
});
