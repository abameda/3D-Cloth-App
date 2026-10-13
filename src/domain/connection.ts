import { z } from 'zod';
export interface ConnectionStorage { get(): Promise<string | null>; set(value: string): Promise<void>; remove(): Promise<void>; }
const schema = z.object({ url: z.string().url(), token: z.string().min(24).max(512).regex(/^\S+$/) }).strict();
const claudeSchema = z.object({ provider: z.literal('anthropic'), apiKey: z.string().min(24).max(512).regex(/^\S+$/), model: z.string().min(1).max(160).regex(/^[a-zA-Z0-9._-]+$/) }).strict();
export type ClaudeConnection = z.infer<typeof claudeSchema>;
export async function readAiConnection(storage: ConnectionStorage): Promise<ClaudeConnection | z.infer<typeof schema> | null> {
  const raw = await storage.get();
  if (raw === null) return null;
  const value = JSON.parse(raw);
  return value.provider === 'anthropic' ? claudeSchema.parse(value) : schema.parse(value);
}
export async function saveClaudeConnection(storage: ConnectionStorage, apiKey: string, model: string) {
  if (apiKey.trim().length < 24 || apiKey.trim().length > 512 || /\s/.test(apiKey.trim())) throw Error('Enter your Anthropic API key without spaces.');
  if (!model.trim() || !/^[a-zA-Z0-9._-]{1,160}$/.test(model.trim())) throw Error('Choose a model from your account, or enter its exact API model ID.');
  await storage.set(JSON.stringify(claudeSchema.parse({ provider: 'anthropic', apiKey: apiKey.trim(), model: model.trim() })));
}
export async function readConnection(storage: ConnectionStorage) {
  const raw = await storage.get(); return raw === null ? { url: '', token: '' } : schema.parse(JSON.parse(raw));
}
export async function saveConnection(storage: ConnectionStorage, url: string, token: string, allowLocalHttp = false) {
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean && !token) { await storage.remove(); return; }
  const parsed = new URL(clean);
  const local = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(allowLocalHttp && parsed.protocol === 'http:' && local)) throw new Error('Use an HTTPS service address. Local HTTP is only allowed in development.');
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '')) throw new Error('Use only the service origin, such as https://stylist.example.com.');
  if (token.trim().length < 24 || token.trim().length > 512 || /\s/.test(token.trim())) throw new Error('Use a connection token of 24–512 characters without spaces.');
  // URL and credential move together; a failed write leaves the previous pair intact.
  await storage.set(JSON.stringify(schema.parse({ url: parsed.origin, token: token.trim() })));
}
