/** Minimal GLB 2.0 container reader: header checks plus the JSON chunk. No external resources allowed. */
export interface GlbJson {
  images?: { bufferView?: number; mimeType?: string; uri?: string }[];
  textures?: { source: number }[];
  nodes?: { name?: string; extras?: Record<string, unknown> }[];
  buffers?: { uri?: string; byteLength: number }[];
}

export function readGlb(bytes: ArrayBuffer, maxBytes = 24 * 1024 * 1024): GlbJson {
  if (bytes.byteLength < 28 || bytes.byteLength > maxBytes) throw Error('The 3D asset is empty or too large.');
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength
    || view.getUint32(16, true) !== 0x4e4f534a) throw Error('The 3D asset is not a valid GLB 2.0 file.');
  const length = view.getUint32(12, true);
  if (length % 4 || 20 + length > bytes.byteLength) throw Error('The 3D asset is incomplete.');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, length))) as GlbJson;
  if (json.buffers?.some(buffer => buffer.uri !== undefined) || json.images?.some(image => image.uri !== undefined))
    throw Error('The 3D asset must embed its own data.');
  return json;
}
