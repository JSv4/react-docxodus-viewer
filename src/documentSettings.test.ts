import { describe, expect, it } from 'vitest';
import { documentTracksRevisions } from './documentSettings';

/** A minimal stored (uncompressed) ZIP; CRCs are not checked by the reader. */
function zip(entries: Record<string, string>) {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [], centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name), data = encoder.encode(content);
    const local = new Uint8Array(30 + nameBytes.length + data.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30); local.set(data, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local); centrals.push(central); offset += local.length;
  }
  const directory = centrals.reduce((size, part) => size + part.length, 0);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, centrals.length, true); ev.setUint16(10, centrals.length, true); ev.setUint32(12, directory, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + directory + 22);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, at); at += part.length; }
  return out;
}
const settings = (body: string) => zip({ 'word/document.xml': '<w:document/>', 'word/settings.xml': `<w:settings xmlns:w="w">${body}</w:settings>` });

describe('document settings', () => {
  it('detects Word Track Changes in word/settings.xml', async () => {
    expect(await documentTracksRevisions(settings('<w:zoom w:percent="100"/><w:trackRevisions/>'))).toBe(true);
    expect(await documentTracksRevisions(settings('<w:trackRevisions w:val="true"/>'))).toBe(true);
  });
  it('treats a missing or disabled setting and unreadable bytes as off', async () => {
    expect(await documentTracksRevisions(settings('<w:zoom w:percent="100"/>'))).toBe(false);
    expect(await documentTracksRevisions(settings('<w:trackRevisions w:val="0"/>'))).toBe(false);
    expect(await documentTracksRevisions(settings('<w:trackRevisions w:val="false"/>'))).toBe(false);
    expect(await documentTracksRevisions(new Uint8Array([1, 2, 3]))).toBe(false);
  });
});
