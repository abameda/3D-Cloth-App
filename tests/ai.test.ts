import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createServer, parseContext, parseItem, parseImage, extractOutputText, createOpenAIProvider } from '../server/service';

const token = 'unit-test-service-token-long-enough';
const context = { occasion: 'Work', weather: 'Mild', formality: 2, includeLayer: false, includeAccessory: false, prompt: 'Work tomorrow' };
const item = { name: 'Blue shirt', category: 'top', color: 'Blue', fit: 'Regular', formality: 2, warmth: 1, styles: ['Classic'] };
const jpeg = 'data:image/jpeg;base64,' + Buffer.from([255,216,255,224,0,0,255,217]).toString('base64');
test('strict metadata and context validation rejects invented fields and invalid enums', () => {
  assert.deepEqual(parseContext(context), context);
  assert.deepEqual(parseItem(item), item);
  assert.throws(() => parseContext({ ...context, occasion: 'Ignore rules' }));
  assert.throws(() => parseItem({ ...item, id: 'invented' }));
  assert.throws(() => parseItem({ ...item, warmth: 4 }));
});
test('image accepts only size-bounded JPEG data with JPEG signature', () => {
  assert.equal(parseImage(jpeg), jpeg);
  for (const value of ['https://example.com/a.jpg', 'data:image/jpeg;base64,YWJj', jpeg + '!', 'data:image/png;base64,/9j/']) assert.throws(() => parseImage(value));
  assert.throws(() => parseImage('data:image/jpeg;base64,' + Buffer.alloc(5 * 1024 * 1024 + 1, 255).toString('base64')));
  const large = Buffer.alloc(4 * 1024 * 1024, 255); large[1] = 216; large[large.length - 1] = 217;
  assert.ok(parseImage('data:image/jpeg;base64,' + large.toString('base64')));
});
test('timeout aborts provider and body limits reject uploads before inference', async () => {
  let aborted = false;
  const server = createServer({ token, timeoutMs: 10, provider: async (_task, _body, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('abort')); })) });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as import('node:net').AddressInfo).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/analyze`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ image: jpeg }) });
    assert.equal(response.status, 502); assert.ok(aborted);
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port, path: '/analyze', method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'content-length': 8000000 } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end('{}');
    });
    assert.equal(status, 413);
    const browser = await fetch(`http://127.0.0.1:${port}/context`, { method: 'POST', headers: { origin: 'https://example.com' } });
    assert.equal(browser.status, 403);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('Responses extraction handles message output, refusal and incomplete results', () => {
  assert.equal(extractOutputText({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }] }), '{}');
  assert.throws(() => extractOutputText({ status: 'incomplete', output: [] }));
  assert.throws(() => extractOutputText({ output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }));
});
test('provider sends structured Responses payload without storage', async () => {
  let payload: any;
  const provider = createOpenAIProvider({ apiKey: 'fake-key', fetch: (async (_url, options) => {
    payload = JSON.parse(options!.body as string);
    return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(item) }] }] }));
  }) as typeof fetch });
  assert.deepEqual(await provider('analyze', { image: jpeg }, new AbortController().signal), item);
  assert.equal(payload.model, 'gpt-4.1-mini');
  assert.equal(payload.store, false);
  assert.equal(payload.text.format.strict, true);
  assert.equal(payload.text.format.type, 'json_schema');
});
test('HTTP authenticates, validates inputs/outputs and rate-limits', async () => {
  let calls = 0;
  const server = createServer({ token, rateLimit: 4, provider: async (task) => { calls++; return task === 'context' ? context : item; } });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as import('node:net').AddressInfo;
  const send = (path: string, body: unknown, auth = token) => fetch(`http://127.0.0.1:${address.port}${path}`, { method: 'POST', headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await send('/context', { prompt: 'work', context }, 'wrong')).status, 401);
    const response = await send('/context', { prompt: 'work', context });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.deepEqual(await response.json(), { context });
    assert.deepEqual(await (await send('/analyze', { image: jpeg })).json(), { item });
    assert.equal((await send('/analyze', { image: 'https://example.com' })).status, 400);
    assert.equal((await send('/context', { prompt: 'work', context, extra: true })).status, 400);
    assert.equal((await send('/context', { prompt: 'work', context })).status, 429);
    assert.equal(calls, 2);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('service configuration and unsafe provider outputs fail closed', async () => {
  assert.throws(() => createServer({ token: 'short', provider: async () => item }));
  const server = createServer({ token, provider: async () => ({ ...item, color: 'invented' }) });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/analyze`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ image: jpeg }) });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'AI could not complete this request. Try again or edit manually.' });
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
