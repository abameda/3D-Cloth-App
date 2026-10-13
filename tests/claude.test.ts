import test from 'node:test';
import assert from 'node:assert/strict';
import { claudeRequest, listClaudeModels } from '../src/domain/claude';
import { readAiConnection, saveClaudeConnection } from '../src/domain/connection';

const config = { provider: 'anthropic' as const, apiKey: 'sk-ant-test-key-with-enough-characters', model: 'model-from-my-account' };
const context = { occasion: 'Work', weather: 'Mild', formality: 2, includeLayer: false, includeAccessory: false, prompt: 'Work tomorrow' };
const item = { name: 'Blue shirt', category: 'top', color: 'Blue', fit: 'Regular', formality: 2, warmth: 1, styles: ['Classic'] };
const signal = new AbortController().signal;
const reply = (input: unknown) => new Response(JSON.stringify({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'wardrobe_result', input }] }));

test('Claude wardrobe styling is metadata-only and uses a bounded outfit result',async()=>{
  const wire={garments:[{id:'shirt',name:'Shirt',category:'top',color:'White',fit:'Regular',formality:1,warmth:2,styles:[],favorite:false}],current:{},locks:{},context:{...context,outfitMode:'separates'},preferredStyles:[],preferredFits:[],avoidColors:[],recentOutfits:[],feedback:[]};
  let payload:any;
  const transport=(async(_url,options)=>{payload=JSON.parse(options!.body as string);return reply({outfit:{top:'shirt'},reason:'Matches your plans.'});})as typeof fetch;
  assert.deepEqual(await claudeRequest(config,'style',wire,signal,transport),{outfit:{top:'shirt'},reason:'Matches your plans.'});
  assert.equal(payload.messages[0].content.length,1);assert.equal(payload.messages[0].content[0].type,'text');
  assert.match(payload.system,/wardrobe IDs/);
  await assert.rejects(claudeRequest(config,'style',{...wire,facePhoto:'secret'},signal,transport));
});

test('Claude credentials stay atomic, survive reads, and never enter wardrobe state', async () => {
  let raw: string | null = null;
  let fail = false;
  const storage = { get: async () => raw, set: async (value: string) => { if (fail) throw Error('full'); raw = value; }, remove: async () => { raw = null; } };
  await saveClaudeConnection(storage, config.apiKey, config.model);
  assert.deepEqual(await readAiConnection(storage), config);
  fail = true;
  await assert.rejects(saveClaudeConnection(storage, 'a-different-api-key-long-enough', 'other-model'));
  assert.deepEqual(await readAiConnection(storage), config);
  await assert.rejects(saveClaudeConnection(storage, config.apiKey, ''));
  await storage.remove();
  assert.equal(await readAiConnection(storage), null);
});

test('Claude sends only selected data to the fixed provider origin and validates tool output', async () => {
  let payload: any, headers: any;
  const transport = (async (url, options) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    payload = JSON.parse(options!.body as string); headers = options!.headers;
    return reply(item);
  }) as typeof fetch;
  const image = 'data:image/jpeg;base64,/9j/4AAA/9k=';
  assert.deepEqual(await claudeRequest(config, 'analyze', { image }, signal, transport), item);
  assert.equal(headers['x-api-key'], config.apiKey);
  assert.equal(payload.model, config.model);
  assert.equal(payload.tool_choice.name, 'wardrobe_result');
  assert.equal(payload.messages[0].content[1].source.data, image.split(',')[1]);
  await assert.rejects(claudeRequest(config, 'analyze', { image: 'https://photo.example' }, signal, transport));
  await assert.rejects(claudeRequest(config, 'context', { prompt: '', context }, signal, transport));
  await assert.rejects(claudeRequest(config, 'context', { prompt: 'work', context }, signal, (async () => reply({ ...context, admin: true })) as typeof fetch));
});

test('Claude rejects refusal, truncation, extra tool calls, and reports safe provider errors', async () => {
  for (const body of [
    { stop_reason: 'max_tokens', content: [] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'refusal' }] },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'wardrobe_result', input: context }, { type: 'tool_use', name: 'wardrobe_result', input: context }] },
  ]) await assert.rejects(claudeRequest(config, 'context', { prompt: 'work', context }, signal, (async () => new Response(JSON.stringify(body))) as typeof fetch));
  for (const [status, message] of [[401, /API key/], [404, /model/], [429, /limit/]] as const) {
    await assert.rejects(claudeRequest(config, 'context', { prompt: 'work', context }, signal, (async () => new Response('secret provider details', { status })) as typeof fetch), message);
  }
});

test('model selection uses actual account model IDs, paginates, and sends no inference request', async () => {
  const urls: string[] = [];
  const result = await listClaudeModels(config.apiKey, signal, (async (url, options) => {
    urls.push(String(url)); assert.equal(options!.method, 'GET');
    return new Response(JSON.stringify(urls.length === 1
      ? { data: [{ id: 'haiku-id', display_name: 'Haiku' }], has_more: true, last_id: 'haiku-id' }
      : { data: [{ id: 'opus-id', display_name: 'Opus' }], has_more: false, last_id: 'opus-id' }));
  }) as typeof fetch);
  assert.deepEqual(result.map(m => m.id), ['haiku-id', 'opus-id']);
  assert.match(urls[1], /after_id=haiku-id/);
  assert.ok(urls.every(url => url.startsWith('https://api.anthropic.com/v1/models')));
});

test('Claude capture orchestration is bounded to quality guidance and the free local pipeline',async()=>{
  const plan={decision:'retake',guidance:['Add overlapping side views.'],missingAngles:['left'],pipeline:'local_multiview_photogrammetry'};
  const image='data:image/jpeg;base64,/9j/4AAA/9k=';
  let payload:any;
  const transport=(async(_url,options)=>{payload=JSON.parse(options!.body as string);return reply(plan);})as typeof fetch;
  assert.deepEqual(await claudeRequest(config,'capture',{kind:'face',images:[image,image]},signal,transport),plan);
  assert.equal(payload.messages[0].content.filter((value:any)=>value.type==='image').length,2);
  await assert.rejects(claudeRequest(config,'capture',{kind:'face',images:[image]},signal,(async()=>reply({...plan,pipeline:'paid_external_service',command:'execute arbitrary code'}))as typeof fetch));
});
