// Thread Studio for Windows: inspect the personal avatar kit exactly as the phone receives it, and drive the
// local asset factory. Dressing decisions come from the phone's own rules (src/domain/kitDressing.ts).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { tucked, visibleTriangles, wornItems, kitLayer } from '/studio/lib/kitDressing.js';

const $ = selector => document.querySelector(selector);
const SLOTS = [['top', 'Tops'], ['bottom', 'Bottoms'], ['outerwear', 'Outerwear'], ['onepiece', 'One-pieces'], ['shoes', 'Shoes']];
const STAGES = { queued: 'Waiting', fitting_body: 'Fitting the body to your measurements', sewing: 'Sewing the pattern',
  draping: 'Draping on your body', rigging: 'Rigging for the phone', done: 'Ready', failed: 'Stopped' };

// ---------- engine API ----------
let token = '';
function readToken() {
  const fromLink = new URLSearchParams(location.hash.slice(1)).get('token');
  if (fromLink) {
    try { sessionStorage.setItem('thread-engine-token', fromLink); } catch { /* private mode: keep it in memory */ }
    history.replaceState(null, '', location.pathname);  // the token never stays in the address bar
    return fromLink;
  }
  try { return sessionStorage.getItem('thread-engine-token') ?? ''; } catch { return ''; }
}
function askToken() {
  const dialog = $('#tokenDialog');
  if (!dialog.open) dialog.showModal();
}
$('#tokenForm').addEventListener('submit', () => {
  token = $('#tokenInput').value.trim();
  try { sessionStorage.setItem('thread-engine-token', token); } catch { /* memory only */ }
  void start();
});
async function api(path, init = {}) {
  const response = await fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (response.status === 401) { askToken(); throw Error('Not connected to the local engine.'); }
  if (!response.ok) {
    let message = `Engine error ${response.status}`;
    try { message = (await response.json()).error ?? message; } catch { /* not JSON */ }
    throw Error(message);
  }
  return response;
}
function setStatus(text, busy = false) { const el = $('#status'); el.textContent = text; el.classList.toggle('busy', busy); }

// ---------- scene ----------
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;  // keeps garment colours faithful
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(26, 1, 0.03, 60);
camera.position.set(0, 1.0, 4.8);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.minDistance = 0.25; controls.maxDistance = 9; controls.target.set(0, 0.95, 0);

const key = new THREE.DirectionalLight('#fff', 2);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
Object.assign(key.shadow.camera, { left: -1.2, right: 1.2, top: 2.2, bottom: -0.2, near: 0.5, far: 12 });
const fill = new THREE.DirectionalLight('#fff', 0.5), rim = new THREE.DirectionalLight('#fff', 1);
scene.add(key, key.target, fill, rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.ShadowMaterial({ opacity: 0.22 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const LIGHTS = {
  studio: { bg: '#e8e3db', env: 0.85, key: ['#fff4e8', 2.3, [1.6, 3.0, 2.4]], fill: ['#e8efff', 0.55, [-2.2, 1.6, 1.6]], rim: ['#ffffff', 1.3, [0.3, 2.6, -3]], shadow: 0.22 },
  daylight: { bg: '#dde4ea', env: 1.0, key: ['#fffaf0', 3.0, [2.2, 4.0, 1.2]], fill: ['#dbe7ff', 0.45, [-2, 1.5, 2]], rim: ['#ffffff', 0.6, [0, 2.5, -3]], shadow: 0.28 },
  evening: { bg: '#2a2421', env: 0.3, key: ['#ffb070', 2.4, [-2.0, 1.8, 1.6]], fill: ['#7f8fbf', 0.25, [2, 1.2, 1.5]], rim: ['#9fc4ff', 1.8, [0.5, 2.4, -3]], shadow: 0.35 },
  flat: { bg: '#d8d8d8', env: 1.25, key: ['#fff', 0, [0, 3, 3]], fill: ['#fff', 0, [0, 1, 1]], rim: ['#fff', 0, [0, 1, -1]], shadow: 0 },
};
function setLight(name) {
  const preset = LIGHTS[name];
  scene.background = new THREE.Color(preset.bg);
  scene.environmentIntensity = preset.env;
  for (const [light, [colour, intensity, position]] of [[key, preset.key], [fill, preset.fill], [rim, preset.rim]]) {
    light.color.set(colour); light.intensity = intensity; light.position.set(...position);
  }
  floor.material.opacity = preset.shadow;
  document.body.style.setProperty('--bg', preset.bg);
}
$('#light').addEventListener('change', event => setLight(event.target.value));
setLight('studio');

function resize() {
  const { clientWidth: w, clientHeight: h } = stage;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

// ---------- kit ----------
const loader = new GLTFLoader();
const state = { sources: [], source: '', manifest: null, kit: null, selection: {}, tints: {}, helper: null };
const materialOf = mesh => (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material);
const label = text => text.replace(/^desktop-/, '').replace(/^shoes_/, '').replace(/[-_]+/g, ' ');

/** Same treatment as the phone (src/ui/avatarKit.ts shadeClothInside): the inside of cloth is shaded darker. */
function shadeClothInside(material) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tif (!gl_FrontFacing) diffuseColor.rgb *= 0.62;');
  };
  material.customProgramCacheKey = () => 'thread-cloth-inside';
}

async function listSources() {
  const sources = [];
  try {
    state.manifest = await (await api('/v1/studio/kit')).json();
    if (state.manifest.body) sources.push({ value: 'studio', label: 'My kit (what the phone gets)' });
    renderJobs(state.manifest.jobs);
    prefillBody(state.manifest.body?.profile);
  } catch (error) { if (!token) throw error; state.manifest = null; }
  const { samples } = await (await api('/v1/desktop/samples')).json();
  for (const sample of samples) sources.push({ value: `sample:${sample.name}`, label: `Factory output · ${sample.name}`, files: sample.files });
  state.sources = sources;
  const select = $('#source');
  select.replaceChildren(...sources.map(s => new Option(s.label, s.value)));
  if (sources.some(s => s.value === state.source)) select.value = state.source;
  return sources;
}

function describe(value) {
  if (value === 'studio') {
    const m = state.manifest;
    return { body: '/v1/studio/assets/body', items: [
      ...m.accessories.map(a => ({ id: a.name, path: `/v1/studio/assets/accessories/${a.name}`, category: a.category, colors: a.colors, label: label(a.name) })),
      ...m.garments.map(g => ({ id: g.garmentId, path: `/v1/studio/assets/garments/${encodeURIComponent(g.garmentId)}`, category: g.category, garmentId: g.garmentId, label: label(g.garmentId), removable: true })),
    ] };
  }
  const source = state.sources.find(s => s.value === value), name = value.slice('sample:'.length);
  return { body: `/v1/desktop/samples/${name}/body.glb`, items: source.files.filter(f => f !== 'body.glb').map(file => ({
    id: file.slice(0, -4), path: `/v1/desktop/samples/${name}/${file}`, label: label(file.slice(0, -4)) })) };
}

async function parse(path) {
  const bytes = await (await api(path)).arrayBuffer();
  return loader.parseAsync(bytes, '');
}
function skinnedMeshes(root) { const found = []; root.traverse(o => { if (o.isSkinnedMesh) found.push(o); }); return found; }

async function loadKit(value) {
  setStatus('Loading kit…', true);
  const description = describe(value);
  const bodyFile = await parse(description.body);
  const root = bodyFile.scene;
  const faceParts = skinnedMeshes(root);
  const body = faceParts.find(m => materialOf(m).name === 'skin') ?? faceParts[0];
  const names = body.skeleton.bones.map(b => b.name);
  const items = [], problems = [];
  for (const entry of description.items) {
    try {
      const file = await parse(entry.path);
      const mesh = skinnedMeshes(file.scene)[0];
      if (mesh.skeleton.bones.length !== names.length || mesh.skeleton.bones.some((b, i) => b.name !== names[i])) {
        problems.push(`${entry.label} was fitted to a different body.`); continue;
      }
      const thread = mesh.userData.thread ?? {};
      const category = entry.category ?? thread.category;
      if (!category) continue;
      mesh.removeFromParent(); mesh.bind(body.skeleton, mesh.bindMatrix); root.add(mesh);
      const material = materialOf(mesh), layer = kitLayer[category] ?? 1;
      material.polygonOffset = true; material.polygonOffsetFactor = -layer; material.polygonOffsetUnits = -1;
      mesh.renderOrder = 2 + layer;
      if (material.side === THREE.DoubleSide && category !== 'hair') shadeClothInside(material);
      const bits = thread.coversBodyTriangles ? Uint8Array.from(atob(thread.coversBodyTriangles), c => c.charCodeAt(0)) : null;
      items.push({ ...entry, category, mesh, material, textured: !!material.map, tuck: mesh.morphTargetDictionary?.tuck,
        covers: bits ? { bits, bodyTriangles: thread.bodyTriangles } : undefined,
        coverCount: bits ? bits.reduce((n, byte) => n + popcount(byte), 0) : 0, triangles: mesh.geometry.index.count / 3 });
    } catch (error) { problems.push(`${entry.label}: ${error.message}`); }
  }
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;  // skinned bounds lag behind poses
    const m = materialOf(o);
    if (m.alphaTest > 0) m.alphaToCoverage = true;  // smoother cut-out hair and lashes with MSAA
  });
  if (state.kit) { scene.remove(state.kit.root); dispose(state.kit.root); }
  if (state.helper) { scene.remove(state.helper); state.helper = null; }
  const bones = new Map(body.skeleton.bones.map(b => [b.name, b]));
  const rest = new Map(body.skeleton.bones.map(b => [b, b.quaternion.clone()]));
  const box = new THREE.Box3().setFromObject(body);
  state.kit = { root, body, faceParts, items, bones, rest, bodyIndex: body.geometry.index.array.slice(), height: box.max.y - box.min.y, problems, wearing: '' };
  scene.add(root);
  defaultSelection();
  fillExpressions(body);
  renderSlots(); dress(); setView(currentView, false);
  setStatus(problems.length ? `Loaded with ${problems.length} problem(s)` : `Loaded ${items.length} pieces`);
}
const popcount = byte => { let n = 0; for (; byte; byte &= byte - 1) n++; return n; };
function dispose(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of [o.material].flat()) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); }
  });
}

// ---------- outfit ----------
function defaultSelection() {
  // Reloading the same kit keeps the outfit; another kit starts from its first top, bottom and shoes.
  const items = state.kit.items, previous = state.selectionSource === state.source ? state.selection : {};
  state.selectionSource = state.source;
  state.selection = {};
  for (const [slot] of SLOTS) {
    const options = items.filter(i => i.category === slot);
    if (previous[slot] === null) state.selection[slot] = null;
    else state.selection[slot] = options.find(i => i.id === previous[slot])?.id ?? (slot === 'outerwear' || slot === 'onepiece' ? null : options[0]?.id ?? null);
  }
  if (state.selection.onepiece) state.selection.top = state.selection.bottom = null;
}

function renderSlots() {
  const container = $('#slots');
  container.replaceChildren();
  for (const [slot, title] of SLOTS) {
    const options = state.kit.items.filter(i => i.category === slot);
    if (!options.length) continue;
    const section = document.createElement('section'); section.className = 'slot';
    const heading = document.createElement('h3'); heading.textContent = title;
    const chips = document.createElement('div'); chips.className = 'chips';
    const chip = (text, id, item) => {
      const button = document.createElement('button');
      button.className = 'chip'; button.setAttribute('aria-pressed', String(state.selection[slot] === id));
      if (item) {
        const dot = document.createElement('span'); dot.className = 'dot';
        dot.style.background = item.textured ? 'linear-gradient(135deg,#fff,#7d8aa3)' : `#${item.material.color.getHexString()}`;
        button.append(dot);
      }
      button.append(text);
      button.addEventListener('click', () => select(slot, id));
      if (item?.removable) {
        const del = document.createElement('span'); del.className = 'del'; del.textContent = '×'; del.title = 'Remove from the studio';
        del.addEventListener('click', event => { event.stopPropagation(); void removeGarment(item); });
        button.append(del);
      }
      return button;
    };
    chips.append(chip('None', null), ...options.map(item => chip(item.label, item.id, item)));
    section.append(heading, chips);
    const chosen = options.find(i => i.id === state.selection[slot]);
    if (chosen && !chosen.textured) {  // stand-ins take the wardrobe colour on the phone: preview any colour here
      const picker = document.createElement('input'); picker.type = 'color'; picker.title = 'Preview another wardrobe colour';
      picker.value = `#${chosen.material.color.getHexString()}`;
      picker.addEventListener('input', () => { chosen.material.color.set(picker.value); renderSlots(); });
      section.append(picker);
    }
    container.append(section);
  }
}

function select(slot, id) {
  state.selection[slot] = id;
  if (slot === 'onepiece' && id) state.selection.top = state.selection.bottom = null;
  if ((slot === 'top' || slot === 'bottom') && id) state.selection.onepiece = null;
  renderSlots(); dress();
}

function dress() {
  const kit = state.kit; if (!kit) return;
  // Every selectable piece is matched exactly by id; hair and the base layer follow the phone's rules.
  const kitItems = kit.items.map(item => ({ id: item.id, category: item.category, colors: item.colors, item,
    garmentId: ['hair', 'base_top', 'base_bottom'].includes(item.category) ? undefined : item.id }));
  const pieces = Object.entries(state.selection).filter(([, id]) => id).map(([category, id]) => ({ category, color: 'Unknown', garmentId: id }));
  const worn = [...wornItems(kitItems, pieces, {}).keys()]
    .filter(k => ($('#base').checked || !k.category.startsWith('base_')) && ($('#hair').checked || k.category !== 'hair'));
  const categories = worn.map(k => k.category);
  for (const item of kit.items) {
    item.mesh.visible = worn.some(k => k.item === item);
    if (item.tuck !== undefined) item.mesh.morphTargetInfluences[item.tuck] = tucked(item.category, categories) ? 1 : 0;
  }
  const masks = $('#masks').checked ? worn.map(k => k.item.covers).filter(Boolean) : [];
  const { kept, stale } = visibleTriangles(kit.bodyIndex, masks);
  kit.body.geometry.setIndex(kept);
  const warnings = [...kit.problems];
  if (stale) warnings.push(`${stale} worn piece(s) were fitted to an older body build: their skin masks are ignored. Refit them.`);
  $('#warnings').replaceChildren(...warnings.map(text => Object.assign(document.createElement('div'), { className: 'warning', textContent: text })));
  const rows = [['Body triangles', `${kept.length / 3} shown / ${kit.bodyIndex.length / 3}`], ['Body height', `${(kit.height * 100).toFixed(1)} cm`]];
  for (const k of worn) {
    const map = k.item.material.map?.image;
    rows.push([k.item.label, `${k.item.triangles.toLocaleString()} tris${map ? ` · ${map.width}px` : ''}${k.item.coverCount ? ` · hides ${k.item.coverCount}` : ''}`]);
  }
  $('#details').replaceChildren(...rows.flatMap(([dt, dd]) => [Object.assign(document.createElement('dt'), { textContent: dt }), Object.assign(document.createElement('dd'), { textContent: dd })]));
}
for (const id of ['#base', '#hair', '#masks']) $(id).addEventListener('change', dress);
$('#wire').addEventListener('change', event => state.kit?.root.traverse(o => { if (o.isMesh) materialOf(o).wireframe = event.target.checked; }));
$('#bones').addEventListener('change', event => {
  if (state.helper) { scene.remove(state.helper); state.helper = null; }
  if (event.target.checked && state.kit) { state.helper = new THREE.SkeletonHelper(state.kit.root); scene.add(state.helper); }
});

// ---------- poses and faces ----------
const AXIS = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const parentQ = new THREE.Quaternion(), rootQ = new THREE.Quaternion(), turn = new THREE.Quaternion(), axisWorld = new THREE.Vector3();
/** Rotate a bone about a body-space axis (x: the body's left, y: up, z: forward) through its joint; parents first. */
function rotateWorld(bone, axis, angle) {
  bone.parent.updateWorldMatrix(true, false);
  bone.parent.getWorldQuaternion(parentQ);
  state.kit.root.getWorldQuaternion(rootQ);
  turn.setFromAxisAngle(axisWorld.copy(AXIS[axis]).applyQuaternion(rootQ), angle);
  bone.quaternion.premultiply(parentQ).premultiply(turn).premultiply(parentQ.invert());
}
// The bind pose holds the arms 49° below horizontal with the forearms angled ~45° forward (measured on the rig).
const RELAXED = [['upperarm01_L', 'z', -0.6], ['upperarm01_R', 'z', 0.6], ['lowerarm01_L', 'x', 0.45], ['lowerarm01_R', 'x', 0.45]];
function posed(name, t) {
  if (name === 'bind') return [];
  const breathe = Math.sin(t * 1.6);
  if (name === 'relaxed') return [['spine03', 'x', 0.012 * breathe], ['neck01', 'y', 0.05 * Math.sin(t * 0.35)], ...RELAXED];
  if (name === 'walk') {
    const s = Math.sin(t * 4.4), c = Math.cos(t * 4.4);
    return [['spine04', 'y', 0.06 * s], ['upperleg01_L', 'x', -0.38 * s], ['upperleg01_R', 'x', 0.38 * s],
      ['lowerleg01_L', 'x', 0.55 * Math.max(0, c)], ['lowerleg01_R', 'x', 0.55 * Math.max(0, -c)],
      ...RELAXED, ['upperarm01_L', 'x', 0.3 * s], ['upperarm01_R', 'x', -0.3 * s]];
  }
  if (name === 'reach') return [['upperarm01_L', 'z', 0.95], ['upperarm01_R', 'z', -0.95], ['lowerarm01_L', 'z', 0.3], ['lowerarm01_R', 'z', -0.3]];
  if (name === 'sit') return [['upperleg01_L', 'x', -0.75], ['upperleg01_R', 'x', -0.75], ['lowerleg01_L', 'x', 1.2], ['lowerleg01_R', 'x', 1.2], ['spine05', 'x', 0.25], ...RELAXED];
  return [];
}
function applyPose(t) {
  const kit = state.kit; if (!kit) return;
  for (const [bone, q] of kit.rest) bone.quaternion.copy(q);
  for (const [name, axis, angle] of posed($('#pose').value, t)) { const bone = kit.bones.get(name); if (bone) rotateWorld(bone, axis, angle); }
}
function fillExpressions(body) {
  const select = $('#expression'), current = select.value;
  select.replaceChildren(new Option('Neutral (blinks)', ''), ...Object.keys(body.morphTargetDictionary ?? {}).sort().map(n => new Option(n, n)));
  if ([...select.options].some(o => o.value === current)) select.value = current;
}
function applyFace(t) {
  const kit = state.kit; if (!kit) return;
  const chosen = $('#expression').value;
  const phase = t % 4.2, blink = !chosen && phase > 4.05 ? 1 - Math.abs(phase - 4.125) / 0.075 : 0;
  for (const part of kit.faceParts) {
    if (!part.morphTargetInfluences) continue;
    part.morphTargetInfluences.fill(0);
    const dict = part.morphTargetDictionary;
    if (chosen && dict[chosen] !== undefined) part.morphTargetInfluences[dict[chosen]] = 1;
    for (const name of ['eyeBlinkLeft', 'eyeBlinkRight']) if (blink && dict[name] !== undefined) part.morphTargetInfluences[dict[name]] = blink;
  }
}

// ---------- camera ----------
let currentView = 'front', tween = null, spinning = false;
function viewFor(name) {
  const h = state.kit?.height ?? 1.75;
  return {
    front: [[0, 0.55 * h, 4.8], [0, 0.53 * h, 0]], three: [[2.7, 0.62 * h, 3.9], [0, 0.53 * h, 0]], side: [[4.8, 0.55 * h, 0], [0, 0.53 * h, 0]],
    back: [[0, 0.55 * h, -4.8], [0, 0.53 * h, 0]], face: [[0.12, 0.935 * h, 0.72], [0, 0.925 * h, 0]], torso: [[0.5, 0.7 * h, 1.9], [0, 0.66 * h, 0]],
    feet: [[0.55, 0.22, 1.35], [0, 0.08, 0]],
  }[name];
}
function setView(name, animate = true) {
  currentView = name;
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === name));
  const [position, target] = viewFor(name);
  if (!animate) { camera.position.set(...position); controls.target.set(...target); controls.update(); return; }
  tween = { from: [camera.position.clone(), controls.target.clone()], to: [new THREE.Vector3(...position), new THREE.Vector3(...target)], start: performance.now() };
}
for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => setView(b.dataset.view));
$('#spin').addEventListener('click', () => { spinning = !spinning; $('#spin').setAttribute('aria-pressed', String(spinning)); if (!spinning && state.kit) state.kit.root.rotation.y = 0; });
$('#shot').addEventListener('click', () => renderer.domElement.toBlob(blob => {
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `thread-${(state.source || 'kit').replace(/[^a-z0-9-]+/gi, '-')}-${currentView}.png` });
  link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}));

// ---------- render loop ----------
const clock = new THREE.Clock();
let frames = 0, fpsTime = 0, fps = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
  if (tween) {
    const k = Math.min(1, (performance.now() - tween.start) / 650), e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
    camera.position.lerpVectors(tween.from[0], tween.to[0], e); controls.target.lerpVectors(tween.from[1], tween.to[1], e);
    if (k === 1) tween = null;
  }
  if (spinning && state.kit) state.kit.root.rotation.y += dt * 0.5;
  applyPose(t); applyFace(t);
  controls.update();
  renderer.render(scene, camera);
  frames++; fpsTime += dt;
  if (fpsTime > 0.5) { fps = frames / fpsTime; frames = 0; fpsTime = 0;
    const info = renderer.info.render;
    $('#hud').textContent = `${fps.toFixed(0)} fps\n${info.triangles.toLocaleString()} triangles\n${info.calls} draw calls\n${renderer.info.memory.textures} textures`; }
});

// ---------- factory ----------
function prefillBody(profile) {
  if (!profile) return;
  const form = $('#bodyForm');
  for (const [name, value] of Object.entries(profile)) if (form.elements[name] && form.elements[name].type !== 'file') form.elements[name].value = value;
}
/** Any photo as a JPEG data URI under the engine's 3 MB limit, longest side at most `max` pixels. */
async function jpeg(file, max = 1600) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  for (let size = max, quality = 0.9; ; size *= 0.8, quality -= 0.05) {
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const uri = canvas.toDataURL('image/jpeg', quality);
    if (uri.length < 4_000_000 || size < 500) return uri;
  }
}
async function submitting(form, work) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try { await work(); } catch (error) { setStatus(error.message); } finally { button.disabled = false; }
}
$('#bodyForm').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  void submitting(form, async () => {
    const data = new FormData(form), profile = { sex: data.get('sex'), age: Number(data.get('age')), height_cm: Number(data.get('height_cm')) };
    for (const name of ['weight_kg', 'chest_cm', 'waist_cm', 'hips_cm']) if (data.get(name)) profile[name] = Number(data.get(name));
    const selfie = data.get('selfie');
    if (selfie?.size) profile.facePhoto = await jpeg(selfie);
    else if (data.get('keepFace')) profile.keepFace = true;
    await api('/v1/studio/body', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
    setStatus('Body queued on this computer', true); void poll();
  });
});
const UPPER = ['tshirt', 'longsleeve', 'overshirt'], LOWER = ['trousers', 'shorts', 'skirt'];
$('#garmentForm').elements.category.addEventListener('change', event => {
  const allowed = event.target.value === 'bottom' ? LOWER : UPPER, preset = $('#garmentForm').elements.preset;
  for (const option of preset.options) option.hidden = !allowed.includes(option.value);
  preset.value = allowed[event.target.value === 'outerwear' ? 2 : 0];  // each slot starts from its usual pattern
});
$('#garmentForm').elements.category.dispatchEvent(new Event('change'));
$('#garmentForm').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  void submitting(form, async () => {
    const data = new FormData(form);
    const slug = String(data.get('name')).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'piece';
    const garmentId = `desktop-${slug}`;
    const request = { garmentId, category: data.get('category'), ...(data.get('quality') ? { quality: data.get('quality') } : {}), spec: { preset: data.get('preset') }, colorHex: data.get('color') };
    const front = data.get('front'), back = data.get('back');
    if (front?.size) request.photos = { front: await jpeg(front), ...(back?.size ? { back: await jpeg(back) } : {}) };
    await api(`/v1/studio/garments/${encodeURIComponent(garmentId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    setStatus(`${label(garmentId)} queued: sewing and draping take a few minutes on the CPU`, true); form.reset();
    form.elements.category.dispatchEvent(new Event('change')); void poll();
  });
});
async function removeGarment(item) {
  if (!confirm(`Remove “${item.label}” and its photos from this computer?`)) return;
  await api(`/v1/studio/garments/${encodeURIComponent(item.garmentId)}`, { method: 'DELETE' });
  state.selection[item.category] = undefined;
  await refresh();
}
function renderJobs(jobs = []) {
  $('#jobs').replaceChildren(...jobs.slice(0, 12).map(job => {
    const li = document.createElement('li'); li.className = job.status;
    const what = Object.assign(document.createElement('div'), { className: 'what', textContent: job.kind === 'body' ? 'Body' : label(job.garmentId ?? 'garment') });
    const when = new Date(job.updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const stage = Object.assign(document.createElement('div'), { className: 'stage', textContent: `${job.status === 'failed' ? STAGES.failed : STAGES[job.stage] ?? job.stage} · ${when}${job.error ? ` — ${job.error}` : ''}` });
    li.append(what, stage);
    if (job.device || job.seconds) li.append(Object.assign(document.createElement('div'), { className: 'meta', textContent: [shortDevice(job.device), duration(job.seconds)].filter(Boolean).join(' · ') }));
    return li;
  }));
  if (!jobs.length) $('#jobs').append(Object.assign(document.createElement('li'), { textContent: 'No factory jobs yet.' }));
}
const shortDevice = name => !name ? '' : name === 'cpu' ? 'CPU' : name.replace(/^NVIDIA (GeForce )?/, '').replace(/ Laptop GPU$/, '');
const duration = s => s === undefined ? '' : s < 90 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;

/** Header indicator: which graphics card the factory uses and how much of its memory is in use. */
async function showGpu() {
  const el = $('#gpu');
  try {
    const { gpu } = await (await api('/v1/desktop/system')).json();
    el.classList.toggle('cpu', !gpu);
    if (!gpu) { el.textContent = 'CPU only (no NVIDIA GPU)'; return; }
    const meter = Object.assign(document.createElement('span'), { className: 'meter' });
    meter.append(Object.assign(document.createElement('span'), { style: `width:${Math.round(100 * gpu.memoryUsedMb / gpu.memoryTotalMb)}%` }));
    el.replaceChildren(`GPU ${shortDevice(gpu.name)}`, meter, `${(gpu.memoryUsedMb / 1024).toFixed(1)} / ${(gpu.memoryTotalMb / 1024).toFixed(1)} GB · ${gpu.temperatureC}°C`);
  } catch { el.textContent = ''; }
}
setInterval(() => { if (token && !document.hidden) void showGpu(); }, 5000);

let polling = false, lastSignature = '';
async function poll() {
  if (polling) return; polling = true;
  try {
    for (;;) {
      const manifest = await (await api('/v1/studio/kit')).json();
      renderJobs(manifest.jobs);
      const active = manifest.jobs.filter(j => j.status === 'queued' || j.status === 'running');
      const signature = JSON.stringify([manifest.body?.sha256, manifest.garments.map(g => g.sha256), manifest.accessories.map(a => a.sha256)]);
      if (signature !== lastSignature) {
        const first = !lastSignature, hadKit = !!state.manifest?.body; lastSignature = signature; state.manifest = manifest;
        if (!first) {
          if (manifest.body && !hadKit) state.source = 'studio';  // a first body was just built: show it
          if (state.source === 'studio' || !state.source) await refresh(); else await listSources();
        }
      }
      if (!active.length) { setStatus(manifest.jobs[0]?.status === 'failed' ? `Last job stopped: ${manifest.jobs[0].error}` : 'Factory idle'); break; }
      const current = active.find(j => j.status === 'running') ?? active[0];
      setStatus(`${active.length} factory job(s) · ${current.kind === 'body' ? 'body' : label(current.garmentId ?? '')}: ${STAGES[current.stage] ?? current.stage}`, true);
      await new Promise(r => setTimeout(r, 3000));
    }
  } catch (error) { setStatus(error.message); } finally { polling = false; }
}

async function refresh() {
  const sources = await listSources();
  const empty = $('#empty');
  if (!sources.length) {
    empty.hidden = false;
    empty.textContent = 'No kit yet. Enter your measurements under “Your body” to build one on this computer.';
    return;
  }
  empty.hidden = true;
  state.source = sources.some(s => s.value === state.source) ? state.source : sources[0].value;
  $('#source').value = state.source;
  await loadKit(state.source);
}
$('#source').addEventListener('change', event => { state.source = event.target.value; void loadKit(state.source).catch(error => setStatus(error.message)); });
$('#reload').addEventListener('click', () => void refresh().catch(error => setStatus(error.message)));

async function start() {
  token = token || readToken();
  if (!token) { askToken(); setStatus('Not connected'); return; }
  void showGpu();
  try { await refresh(); await poll(); } catch (error) { setStatus(error.message); }
}
resize();
void start();
window.threadStudio = { state, camera, controls, scene, setView };
