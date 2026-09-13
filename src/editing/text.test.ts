import { describe, expect, it } from 'vitest';
import { escapePattern, textChange, textChanges } from './text';

describe('paragraph text changes', () => {
  it.each([
    ['alpha alpha', 'alpha bravo'], ['word', 'new word'], ['word', 'word new'],
    ['repeat repeat', 'repeat'], ['abcdef', 'abXYef'], ['old', ''], ['', 'plain *text*'],
    ['a😀b', 'a😃b'], ['😀b', 'new😀b'], ['a😀', 'a😀x'], ['😀', ''], ['😀😀', '😀😃'],
  ])('reconstructs %j → %j without splitting a code point', (before, after) => {
    const change = textChange(before, after)!;
    expect(before.slice(0, change.start) + change.inserted + before.slice(change.start + change.removed.length)).toBe(after);
    expect(() => encodeURIComponent(change.removed)).not.toThrow();
    expect(() => encodeURIComponent(change.inserted)).not.toThrow();
    if (before.length) expect(change.removed.length).toBeGreaterThan(0);
    let reconstructed = before;
    for (const part of textChanges(before, after).reverse()) {
      expect(() => encodeURIComponent(part.removed)).not.toThrow();
      expect(() => encodeURIComponent(part.inserted)).not.toThrow();
      expect(reconstructed.slice(part.start, part.start + part.removed.length)).toBe(part.removed);
      reconstructed = reconstructed.slice(0, part.start) + part.inserted + reconstructed.slice(part.start + part.removed.length);
    }
    expect(reconstructed).toBe(after);
  });
  it('leaves unchanged paragraphs alone', () => {
    expect(textChange('unchanged', 'unchanged')).toBeNull();
    expect(textChange('', '')).toBeNull();
  });
  it.each([
    ['Before after', 'Before [Speed check 2] after'],
    ['A sentence. ', 'A sentence. [Typing several words.] '],
    ['A sentence.', ' [New text]A sentence.'],
    ['First second third', 'First third'],
  ])('keeps a contiguous insertion or deletion in one native write: %j → %j', (before, after) => {
    const changes = textChanges(before, after);
    expect(changes).toHaveLength(1);
    const [change] = changes;
    expect(before.slice(0, change.start) + change.inserted + before.slice(change.start + change.removed.length)).toBe(after);
  });
  it('preserves the words between independent changes', () => {
    const before = 'alpha alpha omega.';
    const after = 'alpha bravo omega. Added.';
    const parts = textChanges(before, after);
    expect(parts).toHaveLength(2);
    expect(parts.some(part => part.removed.includes('omega'))).toBe(false);
    let result = before;
    for (const part of parts.reverse()) result = result.slice(0, part.start) + part.inserted + result.slice(part.start + part.removed.length);
    expect(result).toBe(after);
  });
  it('targets a later repeated word and escapes literal regular expression characters', () => {
    expect(textChange('alpha alpha', 'alpha bravo')!.start).toBe(6);
    const literal = '.*+?^${}()|[]\\';
    expect(new RegExp(`^${escapePattern(literal)}$`).test(literal)).toBe(true);
  });
});
