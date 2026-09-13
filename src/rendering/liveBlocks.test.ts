import { describe, expect, it } from 'vitest';
import { patchSourceBlocks } from './liveBlocks';

describe('native block source reconciliation', () => {
  const paragraph = '<p data-anchor="a" data-source-anchor-id="p:body:a" data-keep-next="true" class="docx-p">old<a class="footnote-ref" id="fn-ref-52" data-footnote-id="52">51</a></p>';
  const block = '<p data-anchor="a"><span style="font-weight: bold">new</span><a class="footnote-ref" id="fn-ref-52" data-footnote-id="52" href="#fn-52">1</a></p>';

  it('retains pagination metadata, note ordinals and navigation while replacing native text/formatting', () => {
    const result = patchSourceBlocks(paragraph, { 'p:body:a': block })!;
    const parsed = new DOMParser().parseFromString(result.html, 'text/html');
    const p = parsed.querySelector('p')!;
    expect(p.getAttribute('data-keep-next')).toBe('true');
    expect(p.className).toBe(''); // Native inline CSS replaces generated classes.
    expect(p.querySelector('span')?.style.fontWeight).toBe('bold');
    expect(p.querySelector('a')?.outerHTML).toBe('<a class="footnote-ref" id="fn-ref-52" data-footnote-id="52">51</a>');
    expect(p.textContent).toBe('new51');
  });

  it('updates hidden note source used in later reflow', () => {
    const source = '<div id="pagination-footnote-registry" style="display:none"><p data-anchor="b" data-source-anchor-id="p:fn:b">old note</p></div>';
    const result = patchSourceBlocks(source, { 'p:fn:b': '<p data-anchor="b">edited note</p>' })!;
    expect(result.html).toContain('edited note');
    expect(result.blocks['p:fn:b']).toContain('data-source-anchor-id="p:fn:b"');
  });

  it('requires the full converter for changed note inventory, missing/duplicate anchors, or nested identities', () => {
    expect(patchSourceBlocks(paragraph, { 'p:body:a': block.replace('data-footnote-id="52"', 'data-footnote-id="53"') })).toBeNull();
    expect(patchSourceBlocks(paragraph + paragraph, { 'p:body:a': block })).toBeNull();
    expect(patchSourceBlocks(paragraph, { 'p:body:missing': block })).toBeNull();
    expect(patchSourceBlocks(paragraph.replace('old', '<span data-source-anchor-id="r:body:b">old</span>'), { 'p:body:a': block })).toBeNull();
  });

  it('removes executable attributes from live block updates', () => {
    const result = patchSourceBlocks(paragraph, { 'p:body:a': block.replace('<span', '<span onclick="bad()"') })!;
    expect(result.blocks['p:body:a']).not.toContain('onclick');
  });

  it('keeps unsupported-content placeholders on the complete conversion path', () => {
    const source = paragraph.replace('old', '<span class="unsupported-placeholder">[FORM FIELD]</span>');
    expect(patchSourceBlocks(source, { 'p:body:a': block })).toBeNull();
  });

  it('updates paragraph CSS derived from run formatting while keeping pagination metadata', () => {
    const result = patchSourceBlocks(paragraph, { 'p:body:a': block.replace('<p data-anchor="a">', '<p data-anchor="a" style="font-size: 24pt; line-height: 115%">') })!;
    const p = new DOMParser().parseFromString(result.html, 'text/html').querySelector('p')!;
    expect(p.style.fontSize).toBe('24pt');
    expect(p.style.lineHeight).toBe('115%');
    expect(p.dataset.keepNext).toBe('true');
  });
});
