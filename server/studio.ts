import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { parseImage } from './service';
import { accessoryCategories, accessoryNameSchema, bodyRequestSchema, garmentRequestSchema, presetForCategory, type BodyProfile, type GarmentRequest, type KitManifest, type StudioJob } from '../src/domain/studio';

/** Runs the Windows asset factory (pipeline/). Each call resolves when its output file exists. */
export interface StudioRunner {
  body(profileFile: string, outDir: string, signal: AbortSignal): Promise<void>;
  garment(input: { specFile: string; colorHex?: string; category: string; bodyDir: string; workDir: string; outFile: string; frontPhoto?: string; backPhoto?: string }, stage: (name: string) => void, signal: AbortSignal): Promise<void>;
}

/** Photos are stored as files beside the state, never inside state.json. */
interface GarmentEntry { request: Omit<GarmentRequest, 'photos'>; photos?: { front: boolean; back: boolean }; sha256?: string; bytes?: number; bodySha256?: string }
interface Accessory { name: string; category: typeof accessoryCategories[number]; colors: string[]; sha256: string; bytes: number }
interface OwnerState { profile?: BodyProfile; body?: { sha256: string; bytes: number }; accessories?: Accessory[]; garments: Record<string, GarmentEntry>; jobs: StudioJob[] }
interface Queued { owner: string; job: StudioJob }

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const fileKey = (garmentId: string) => createHash('sha256').update(garmentId).digest('hex').slice(0, 32);

export function pipelineRunner(projectRoot: string): StudioRunner {
  const pipeline = resolve(projectRoot, 'pipeline');
  const bodyPython = join(pipeline, 'envs', 'body', 'Scripts', 'python.exe');
  const env = { ...process.env, PYTHONPATH: pipeline, ANNY_CACHE_DIR: join(pipeline, 'tools', 'anny-cache') };
  function run(command: string, args: string[], signal: AbortSignal, log: string) {
    return new Promise<void>((done, fail) => {
      const child = spawn(command, args, { cwd: pipeline, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], shell: command.endsWith('.cmd') });
      const output: Buffer[] = [];
      child.stdout.on('data', chunk => output.push(chunk)); child.stderr.on('data', chunk => output.push(chunk));
      const stop = () => { if (child.pid) spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); };
      signal.addEventListener('abort', stop, { once: true });
      child.on('error', fail);
      child.on('close', code => {
        signal.removeEventListener('abort', stop);
        void writeFile(log, Buffer.concat(output)).catch(() => {});
        code === 0 ? done() : fail(Error(signal.aborted ? 'Cancelled.' : 'The asset factory stopped. Its log is on your computer.'));
      });
    });
  }
  return {
    async body(profileFile, outDir, signal) {
      await run(bodyPython, ['-m', 'thread_factory.body', '--profile', profileFile, '--out', outDir], signal, join(outDir, 'factory.log'));
    },
    async garment({ specFile, colorHex, category, bodyDir, workDir, outFile, frontPhoto, backPhoto }, stage, signal) {
      const design = join(workDir, 'design.yaml');
      stage('sewing');
      await run(bodyPython, ['-m', 'thread_factory.design', '--spec', specFile, '--out', design], signal, join(workDir, 'design.log'));
      stage('draping');
      await run(join(pipeline, 'scripts', 'garment-python.cmd'), ['-m', 'thread_factory.drape', '--design', design, '--body', bodyDir, '--out', join(workDir, 'drape'), '--name', 'garment'], signal, join(workDir, 'drape.log'));
      stage('rigging');
      await run(bodyPython, ['-m', 'thread_factory.garment_glb', '--sim', join(workDir, 'drape', 'garment', 'garment_sim.obj'), '--body', bodyDir,
        '--out', outFile, '--category', category, ...(colorHex ? ['--colour', colorHex] : []),
        ...(frontPhoto ? ['--front-photo', frontPhoto] : []), ...(backPhoto ? ['--back-photo', backPhoto] : [])], signal, join(workDir, 'rig.log'));
    },
  };
}

/** thread extras of the first node that has them (category, colours) from a GLB's JSON chunk. */
function glbExtras(data: Buffer): { category?: string; colors?: string[] } {
  try {
    const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString()) as { nodes?: { extras?: { thread?: { category?: string; colors?: string[] } } }[] };
    return json.nodes?.find(node => node.extras?.thread)?.extras?.thread ?? {};
  } catch { return {}; }
}

export function createStudio(options: { root: string; runner: StudioRunner }) {
  const states = new Map<string, OwnerState>();
  const queue: Queued[] = [];
  let active: { owner: string; job: StudioJob; controller: AbortController } | undefined;
  let closed = false;
  const ownerDir = (owner: string) => join(options.root, owner);

  async function load(owner: string): Promise<OwnerState> {
    let state = states.get(owner);
    if (!state) {
      try { state = JSON.parse(await readFile(join(ownerDir(owner), 'state.json'), 'utf8')) as OwnerState; }
      catch { state = { garments: {}, jobs: [] }; }
      // Interrupted work restarts from the beginning (outputs are written atomically at the end).
      for (const job of state.jobs) if (job.status === 'running' || job.status === 'queued') { job.status = 'queued'; job.stage = 'queued'; queue.push({ owner, job }); }
      states.set(owner, state);
    }
    return state;
  }
  const saving = new Map<string, Promise<void>>();
  function save(owner: string): Promise<void> {
    // Serialised per owner: concurrent writers would race on the temp file.
    const write = async () => {
      const state = states.get(owner); if (!state) return;
      await mkdir(ownerDir(owner), { recursive: true });
      const temp = join(ownerDir(owner), 'state.json.tmp');
      await writeFile(temp, JSON.stringify(state)); await rename(temp, join(ownerDir(owner), 'state.json'));
    };
    // Never rejects: a failed write is logged and retried by the next save, instead of surfacing as an
    // unhandled rejection from fire-and-forget callers (which would stop the local engine).
    const safe = () => write().catch(error => console.error('Studio state could not be saved:', error instanceof Error ? error.message : error));
    const next = (saving.get(owner) ?? Promise.resolve()).then(safe, safe);
    saving.set(owner, next);
    return next;
  }
  function enqueue(owner: string, state: OwnerState, kind: StudioJob['kind'], garmentId?: string) {
    // A newer request for the same target replaces any queued one.
    for (const job of state.jobs) if (job.status === 'queued' && job.kind === kind && job.garmentId === garmentId) {
      job.status = 'failed'; job.error = 'Replaced by a newer request.';
    }
    const job: StudioJob = { id: randomUUID(), kind, garmentId, status: 'queued', stage: 'queued', error: null, updated: Date.now() };
    state.jobs = [job, ...state.jobs.filter(old => old.status === 'queued' || old.status === 'running' || Date.now() - old.updated < 86400000)].slice(0, 40);
    queue.push({ owner, job });
    return job;
  }

  async function work() {
    if (active || closed) return;
    const next = queue.shift(); if (!next) return;
    const { owner, job } = next;
    if (job.status !== 'queued') return void setImmediate(() => void work());
    const state = await load(owner), controller = new AbortController();
    active = { owner, job, controller };
    const stage = (name: string) => { job.stage = name; job.updated = Date.now(); void save(owner); };
    job.status = 'running';
    try {
      const dir = ownerDir(owner), bodyDir = join(dir, 'body');
      if (job.kind === 'body') {
        if (!state.profile) throw Error('Enter your measurements first.');
        stage('fitting_body');
        const work = join(dir, 'body-next'); await rm(work, { recursive: true, force: true }); await mkdir(work, { recursive: true });
        const selfie = join(dir, 'face.jpg');
        await writeFile(join(work, 'profile.json'), JSON.stringify({ ...state.profile, ...(existsSync(selfie) ? { face_photo: selfie } : {}) }));
        await options.runner.body(join(work, 'profile.json'), work, controller.signal);
        await rm(bodyDir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
        await rename(work, bodyDir);
        const bytes = await readFile(join(bodyDir, 'body.glb'));
        state.body = { sha256: sha(bytes), bytes: bytes.length };
        state.accessories = [];
        for (const file of (await readdir(bodyDir)).filter(name => name.endsWith('.glb') && name !== 'body.glb').sort()) {
          const name = file.slice(0, -4);
          if (!accessoryNameSchema.safeParse(name).success) continue;
          const data = await readFile(join(bodyDir, file));
          const extras = glbExtras(data);
          const category = accessoryCategories.find(c => c === extras.category) ?? (name === 'hair' ? 'hair' : 'shoes');
          state.accessories.push({ name, category, colors: extras.colors ?? [], sha256: sha(data), bytes: data.length });
        }
        // Garments are fitted to one exact body: re-drape everything on the new shape.
        for (const garmentId of Object.keys(state.garments)) enqueue(owner, state, 'garment', garmentId);
      } else {
        const entry = state.garments[job.garmentId!];
        if (!entry) throw Error('This piece was removed.');
        if (!state.body || !existsSync(join(bodyDir, 'skeleton.npz'))) throw Error('Create your body from your measurements first.');
        const key = fileKey(job.garmentId!), workDir = join(dir, 'work', key);
        await rm(workDir, { recursive: true, force: true }); await mkdir(workDir, { recursive: true });
        const spec = entry.request.spec ?? { preset: presetForCategory[entry.request.category]! };
        await writeFile(join(workDir, 'spec.json'), JSON.stringify(spec));
        await mkdir(join(dir, 'garments'), { recursive: true });
        const outFile = join(dir, 'garments', `${key}.glb`);
        const photo = (side: 'front' | 'back') => entry.photos?.[side] ? join(dir, 'photos', `${key}-${side}.jpg`) : undefined;
        await options.runner.garment({ specFile: join(workDir, 'spec.json'), colorHex: entry.request.colorHex, category: entry.request.category,
          bodyDir, workDir, outFile, frontPhoto: photo('front'), backPhoto: photo('back') }, stage, controller.signal);
        const bytes = await readFile(outFile);
        Object.assign(entry, { sha256: sha(bytes), bytes: bytes.length, bodySha256: state.body.sha256 });
      }
      job.status = 'done'; job.stage = 'done';
    } catch (e) {
      job.status = 'failed'; job.stage = 'failed'; job.error = e instanceof Error ? e.message.slice(0, 300) : 'Processing failed.';
    } finally {
      job.updated = Date.now(); active = undefined; await save(owner);
      setImmediate(() => void work());
    }
  }

  async function json(req: IncomingMessage) {
    if (!req.headers['content-type']?.startsWith('application/json')) throw Error('Send JSON.');
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 9 * 1024 * 1024) throw Error('Request too large.'); chunks.push(Buffer.from(chunk)); }
    return JSON.parse(Buffer.concat(chunks).toString()) as unknown;
  }

  function manifest(state: OwnerState): KitManifest {
    return {
      body: state.body && state.profile ? { ...state.body, profile: state.profile } : null,
      accessories: state.body ? state.accessories ?? [] : [],
      garments: Object.entries(state.garments).filter(([, g]) => g.sha256 && g.bodySha256 === state.body?.sha256)
        .map(([garmentId, g]) => ({ garmentId, category: g.request.category, sha256: g.sha256!, bytes: g.bytes!, bodySha256: g.bodySha256! })),
      jobs: state.jobs.slice(0, 20),
    };
  }

  /** Returns true when the request belonged to the studio API. */
  async function handle(req: IncomingMessage, res: ServerResponse, owner: string, path: string): Promise<boolean> {
    if (!path.startsWith('/v1/studio')) return false;
    const reply = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    const sendGlb = async (file: string) => {
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(bytes);
    };
    const state = await load(owner);
    const garmentPath = /^\/v1\/studio\/(garments|assets\/garments)\/([^/]{1,600})$/.exec(path);
    const garmentId = garmentPath ? decodeURIComponent(garmentPath[2]) : undefined;
    if (path === '/v1/studio/kit' && req.method === 'GET') { reply(200, manifest(state)); return true; }
    if (path === '/v1/studio/body' && req.method === 'PUT') {
      let request: ReturnType<typeof bodyRequestSchema.parse>;
      try { request = bodyRequestSchema.parse(await json(req)); } catch { reply(400, { error: 'Check your measurements.' }); return true; }
      const { facePhoto, keepFace, ...profile } = request;
      const selfie = join(ownerDir(owner), 'face.jpg');
      try {
        await mkdir(ownerDir(owner), { recursive: true });
        if (facePhoto) await writeFile(selfie, Buffer.from(parseImage(facePhoto).split(',')[1], 'base64'));
        else if (!keepFace) await rm(selfie, { force: true });
      } catch { reply(400, { error: 'Use a clear JPEG selfie under 3 MB.' }); return true; }
      state.profile = profile; const job = enqueue(owner, state, 'body'); await save(owner); reply(202, { job }); void work(); return true;
    }
    if (garmentPath?.[1] === 'garments' && req.method === 'PUT') {
      let request: GarmentRequest; try { request = garmentRequestSchema.parse(await json(req)); } catch { reply(400, { error: 'This piece cannot be fitted yet.' }); return true; }
      if (request.garmentId !== garmentId) { reply(400, { error: 'Mismatched piece.' }); return true; }
      const { photos, ...rest } = request;
      const key = fileKey(request.garmentId), photoDir = join(ownerDir(owner), 'photos');
      try {
        await mkdir(photoDir, { recursive: true });
        for (const side of ['front', 'back'] as const) {
          const file = join(photoDir, `${key}-${side}.jpg`);
          if (photos?.[side]) await writeFile(file, Buffer.from(parseImage(photos[side]).split(',')[1], 'base64'));
          else await rm(file, { force: true });
        }
      } catch { reply(400, { error: 'Send clear JPEG photos under 3 MB.' }); return true; }
      state.garments[request.garmentId] = { request: rest, photos: { front: !!photos?.front, back: !!photos?.back } };
      const job = enqueue(owner, state, 'garment', request.garmentId);
      await save(owner); reply(202, { job }); void work(); return true;
    }
    if (garmentPath?.[1] === 'garments' && req.method === 'DELETE') {
      if (active?.owner === owner && active.job.garmentId === garmentId) active.controller.abort();
      delete state.garments[garmentId!];
      await rm(join(ownerDir(owner), 'garments', `${fileKey(garmentId!)}.glb`), { force: true });
      await rm(join(ownerDir(owner), 'work', fileKey(garmentId!)), { recursive: true, force: true });
      for (const side of ['front', 'back']) await rm(join(ownerDir(owner), 'photos', `${fileKey(garmentId!)}-${side}.jpg`), { force: true });
      await save(owner); reply(200, { deleted: true }); return true;
    }
    if (path === '/v1/studio/assets/body' && req.method === 'GET') {
      if (!state.body) { reply(404, { error: 'No body yet.' }); return true; }
      await sendGlb(join(ownerDir(owner), 'body', 'body.glb')); return true;
    }
    const accessory = /^\/v1\/studio\/assets\/accessories\/([a-z0-9_]{1,40})$/.exec(path);
    if (accessory && req.method === 'GET') {
      if (!state.accessories?.some(a => a.name === accessory[1])) { reply(404, { error: 'Not available.' }); return true; }
      await sendGlb(join(ownerDir(owner), 'body', `${accessory[1]}.glb`)); return true;
    }
    if (garmentPath?.[1] === 'assets/garments' && req.method === 'GET') {
      if (!state.garments[garmentId!]?.sha256) { reply(404, { error: 'Not fitted yet.' }); return true; }
      await sendGlb(join(ownerDir(owner), 'garments', `${fileKey(garmentId!)}.glb`)); return true;
    }
    if (path === '/v1/studio' && req.method === 'DELETE') {
      if (active?.owner === owner) active.controller.abort();
      for (const item of queue) if (item.owner === owner) item.job.status = 'failed';
      states.delete(owner); await rm(ownerDir(owner), { recursive: true, force: true }); reply(200, { deleted: true }); return true;
    }
    reply(404, { error: 'Endpoint not found.' }); return true;
  }

  return { handle, close() { closed = true; active?.controller.abort(); }, work };
}
export type Studio = ReturnType<typeof createStudio>;
