import { z } from 'zod';

export const MAX_SCAN_BYTES = 16 * 1024 * 1024;
const index = z.number().int().nonnegative();
const manifestSchema = z.object({
  asset: z.object({ version: z.literal('2.0') }),
  buffers: z.array(z.object({ byteLength: index })).length(1),
  bufferViews: z.array(z.object({ buffer: z.literal(0), byteOffset: index.optional(), byteLength: index, byteStride: z.number().int().min(4).max(252).optional() })).min(1).max(1000),
  accessors: z.array(z.object({ bufferView: index, byteOffset: index.optional(), count: z.number().int().positive().max(180000), componentType: z.union([z.literal(5120),z.literal(5121),z.literal(5122),z.literal(5123),z.literal(5125),z.literal(5126)]), type: z.enum(['SCALAR','VEC2','VEC3','VEC4','MAT2','MAT3','MAT4']), sparse: z.never().optional() })).max(1000),
  meshes: z.array(z.object({ primitives: z.array(z.object({ attributes: z.record(z.string(), index), indices: index.optional(), mode: z.literal(4).optional() })).min(1).max(32) })).min(1).max(100),
  nodes: z.array(z.object({ mesh:index.optional(), children:z.array(index).max(500).optional(), translation:z.array(z.number().finite()).length(3).optional(), rotation:z.array(z.number().finite()).length(4).optional(), scale:z.array(z.number().finite()).length(3).optional(), matrix:z.array(z.number().finite()).length(16).optional() })).max(500).optional(),
  skins: z.never().optional(), animations: z.never().optional(),
  images: z.array(z.object({ bufferView: index, mimeType: z.enum(['image/png','image/jpeg']) })).max(16).optional(),
  textures: z.array(z.object({ source: index })).max(16).optional(),
  extensionsRequired: z.array(z.string()).optional(),
});

/** Validate before GLTFLoader can allocate geometry or fetch any outside resource. */
export function validateFaceScan(bytes: ArrayBuffer) {
  if (bytes.byteLength < 32 || bytes.byteLength > MAX_SCAN_BYTES) throw Error('Choose a self-contained head scan (.glb) under 16 MB.');
  const view = new DataView(bytes);
  if (view.getUint32(0,true) !== 0x46546c67 || view.getUint32(4,true) !== 2 || view.getUint32(8,true) !== bytes.byteLength || view.getUint32(16,true) !== 0x4e4f534a) throw Error('This file is not a valid GLB 2.0 head scan.');
  const length=view.getUint32(12,true), binaryHeader=20+length;
  if (length > 2*1024*1024 || length%4 || binaryHeader+8>bytes.byteLength || view.getUint32(binaryHeader+4,true)!==0x004e4942) throw Error('The scan must contain its own geometry and textures.');
  const binaryLength=view.getUint32(binaryHeader,true);
  if(binaryHeader+8+binaryLength!==bytes.byteLength)throw Error('Incomplete scan data.');
  const raw: unknown=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
  function noExternal(value: unknown) {
    if (!value || typeof value!=='object') return;
    for(const [key,child] of Object.entries(value)) { if(key==='uri')throw Error('External files are not supported. Export one GLB with embedded textures.'); noExternal(child); }
  }
  noExternal(raw);
  const manifest=manifestSchema.parse(raw);
  if(manifest.buffers[0].byteLength>binaryLength)throw Error('Incomplete scan buffer.');
  if(manifest.extensionsRequired?.some(name=>!['KHR_materials_unlit','KHR_texture_transform','KHR_materials_emissive_strength'].includes(name)))throw Error('Export an uncompressed GLB with standard PNG or JPEG textures.');
  for(const buffer of manifest.bufferViews) if((buffer.byteOffset??0)+buffer.byteLength>manifest.buffers[0].byteLength)throw Error('Invalid scan buffer bounds.');
  const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
  const componentBytes:Record<number,number>={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
  for(const accessor of manifest.accessors) {
    const buffer=manifest.bufferViews[accessor.bufferView],width=components[accessor.type]*componentBytes[accessor.componentType];
    if(!buffer||(buffer.byteStride??width)<width||(accessor.byteOffset??0)+(accessor.count-1)*(buffer.byteStride??width)+width>buffer.byteLength)throw Error('Invalid scan geometry bounds.');
  }
  let triangles=0;
  for(const mesh of manifest.meshes) for(const primitive of mesh.primitives) {
    const position=manifest.accessors[primitive.attributes.POSITION],indices=primitive.indices===undefined?undefined:manifest.accessors[primitive.indices];
    if(!position||position.type!=='VEC3'||position.componentType!==5126||Object.values(primitive.attributes).some(id=>!manifest.accessors[id])||(primitive.indices!==undefined&&(!indices||indices.type!=='SCALAR'||![5121,5123,5125].includes(indices.componentType))))throw Error('The scan contains invalid meshes.');
    triangles+=(indices??position).count/3;
    const buffer=manifest.bufferViews[position.bufferView],offset=binaryHeader+8+(buffer.byteOffset??0)+(position.byteOffset??0),stride=buffer.byteStride??12;
    for(let i=0;i<position.count;i++)for(let component=0;component<3;component++)if(!Number.isFinite(view.getFloat32(offset+i*stride+component*4,true)))throw Error('The scan contains invalid facial geometry.');
    if(indices){
      const indexedBuffer=manifest.bufferViews[indices.bufferView],indexOffset=binaryHeader+8+(indexedBuffer.byteOffset??0)+(indices.byteOffset??0),width=componentBytes[indices.componentType];
      for(let i=0;i<indices.count;i++){
        const offset=indexOffset+i*(indexedBuffer.byteStride??width);
        const value=width===1?view.getUint8(offset):width===2?view.getUint16(offset,true):view.getUint32(offset,true);
        if(value>=position.count)throw Error('The scan has invalid triangle indices.');
      }
    }
  }
  if(triangles>80000)throw Error('Use a mobile head scan with fewer than 80,000 triangles.');
  for(const image of manifest.images??[]) if(!manifest.bufferViews[image.bufferView]||manifest.bufferViews[image.bufferView].byteLength>4*1024*1024)throw Error('Use embedded textures under 4 MB each.');
  for(const texture of manifest.textures??[]) if(!manifest.images?.[texture.source])throw Error('Missing scan texture.');
  const parents=new Map<number,number>(),visited=new Set<number>(),visiting=new Set<number>();
  let renderedTriangles=0;
  function visit(id:number){
    if(visiting.has(id))throw Error('The scan has a cyclic scene.');
    if(visited.has(id))return;
    const node=manifest.nodes?.[id];if(!node)throw Error('Invalid scan node.');
    visiting.add(id);
    if(node.mesh!==undefined){const mesh=manifest.meshes[node.mesh];if(!mesh)throw Error('Missing scan mesh.');for(const p of mesh.primitives)renderedTriangles+=(manifest.accessors[p.indices??p.attributes.POSITION].count/3);}
    for(const child of node.children??[]){if(parents.has(child))throw Error('The scan has repeated child nodes.');parents.set(child,id);visit(child);}
    visiting.delete(id);visited.add(id);
  }
  for(let i=0;i<(manifest.nodes?.length??0);i++)visit(i);
  if(renderedTriangles>80000)throw Error('Use a scan with fewer than 80,000 rendered triangles.');
  return manifest;
}
