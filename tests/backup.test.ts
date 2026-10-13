import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sealArchive,openArchive,validateArchive } from '../src/domain/portable';
import { initialState } from '../src/domain/state';
const archive={format:1 as const,createdAt:'2026-09-18T12:00:00.000Z',state:initialState,photos:{}};
test('encrypted archive roundtrip, incorrect password and tampering',async()=>{const envelope=await sealArchive(archive,'long-enough-password',randomBytes);assert.deepEqual(await openArchive(envelope,'long-enough-password'),archive);await assert.rejects(openArchive(envelope,'wrong-password'));const bad=JSON.parse(envelope);bad.ciphertext=(bad.ciphertext[0]==='A'?'B':'A')+bad.ciphertext.slice(1);await assert.rejects(openArchive(JSON.stringify(bad),'long-enough-password'));});
test('portable photos reject external URLs, missing images and traversal keys',()=>{assert.throws(()=>validateArchive({...archive,state:{...initialState,profile:{...initialState.profile,imageUri:'file:///private/test'}}}));assert.throws(()=>validateArchive({...archive,state:{...initialState,profile:{...initialState.profile,imageUri:'photo:p1'}}}));assert.throws(()=>validateArchive({...archive,photos:{'../p1':'/9j/2Q=='}}));});
