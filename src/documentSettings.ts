/** Read one stored or deflated entry from a ZIP package without a ZIP dependency. */
async function readZipEntry(bytes: Uint8Array, name: string): Promise<string | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) return null;
  const count = view.getUint16(end + 10, true);
  let entry = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < count && entry + 46 <= bytes.length; n++) {
    if (view.getUint32(entry, true) !== 0x02014b50) return null;
    const method = view.getUint16(entry + 10, true), size = view.getUint32(entry + 20, true);
    const nameLength = view.getUint16(entry + 28, true), extra = view.getUint16(entry + 30, true), comment = view.getUint16(entry + 32, true);
    const local = view.getUint32(entry + 42, true);
    if (decoder.decode(bytes.subarray(entry + 46, entry + 46 + nameLength)) === name) {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.slice(start, start + size);
      if (method === 0) return decoder.decode(data);
      if (method !== 8 || typeof DecompressionStream === 'undefined') return null;
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    }
    entry += 46 + nameLength + extra + comment;
  }
  return null;
}

/** Whether Word's "Track Changes" is switched on in the package's document settings. */
export async function documentTracksRevisions(bytes: Uint8Array): Promise<boolean> {
  try {
    const settings = await readZipEntry(bytes, 'word/settings.xml');
    const setting = settings?.match(/<w:trackRevisions\b[^>]*>/)?.[0];
    return !!setting && !/w:val="(?:0|false|off)"/.test(setting);
  } catch { return false; }
}
