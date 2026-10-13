import test from 'node:test';
import assert from 'node:assert/strict';
import { captureGuide } from '../src/domain/captureGuide';
import { reconstructionInputSchema } from '../src/domain/reconstruction';
import { randomUUID } from 'node:crypto';

test('guides start at the front, cover both sides, and keep the subject still',()=>{
 for(const kind of ['face','body','garment'] as const){
  const guide=captureGuide(kind);
  assert.equal(guide.steps[0].yaw,0);assert.ok(guide.steps.length>=24&&guide.steps.length<=48);
  assert.ok(guide.steps.some(s=>s.yaw===Math.PI/2));assert.ok(guide.steps.some(s=>s.yaw===-Math.PI/2));
  assert.match(guide.setup.join(' '),/still/);assert.ok(guide.steps.every(s=>s.instruction.length>20));
 }
 assert.ok(captureGuide('garment').steps.some(s=>Math.abs(s.yaw)===Math.PI));
 assert.match(captureGuide('face').setup.join(' '),/neutral/);
});

test('view annotations cannot mislabel a different number of uploaded photos',()=>{
 const input={requestId:randomUUID(),kind:'face',consent:true,images:Array(8).fill('test')};
 assert.throws(()=>reconstructionInputSchema.parse({...input,views:[{label:'Front',yaw:0}]}));
 const views=Array(8).fill({label:'Front',yaw:0});
 assert.equal(reconstructionInputSchema.parse({...input,views}).views?.length,8);
 assert.throws(()=>reconstructionInputSchema.parse({...input,views:Array(8).fill({label:'Front',yaw:100})}));
});
