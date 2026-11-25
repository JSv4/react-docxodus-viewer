import { describe, expect, it } from 'vitest';
import { canvasText, xmlVisibleText } from './textModel';

const dom = (html: string) => {
  const block = document.createElement('p');
  block.innerHTML = html;
  return canvasText(block);
};
const xml = (content: string) => xmlVisibleText(new DOMParser().parseFromString(
  `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${content}</w:p>`, 'application/xml').documentElement);

describe('native text coordinates', () => {
  it.each([
    ['tab', 'A<span><span data-docx-tab="left" data-docx-tab-width="0.5"></span></span>B', 'A\tB'],
    ['positional tab', 'A<span data-docx-tab="positional">\t</span>B', 'A\tB'],
    ['line break and its sentinel', 'A<span><br data-docx-break="true">‎</span>B', 'A\nB'],
    ['right-to-left sentinel', 'A<span><br data-docx-break="true">‏</span>B', 'A\nB'],
    ['compact sentinel', 'A<span><br data-docx-break="true"><span>‎</span></span>B', 'A\nB'],
    ['authored mark after a break', 'A<br data-docx-break="true">‎‎B', 'A\n‎B'],
    ['inline page break', 'A<span data-page-break="true"></span>B', 'A\nB'],
    ['consumed page break', 'A<span data-rdv-break="true"></span>B', 'A\nB'],
    ['symbol', 'A<span data-docx-glyph-ascent="0.9"></span><span data-docx-symbol-text="">☑</span>B', 'AB'],
    ['hyphens', 'A‑B­C', 'A‑B­C'],
    ['browser placeholder', 'A<br>', 'A'],
    ['list marker and suffix tab', '<span data-list-marker="true"><span><span data-list-marker="true">1.</span></span><span data-list-marker="true"><span data-docx-tab="left"></span></span></span>A', 'A'],
    ['note number', '<span class="footnote-number" data-note-run="true"><sup>1</sup></span> Note', ' Note'],
    ['note reference', 'A<a class="footnote-ref"><sup>1</sup></a>B', 'AB'],
    ['removed text and paragraph mark', 'A<del class="rev-del">x<span data-docx-tab="left"></span></del><del class="rev-move-from">y</del><span class="rev-para-mark-del">¶</span>', 'A'],
    ['line metrics', 'A<span data-docx-line-metric="auto" aria-hidden="true"></span>B', 'AB'],
  ])('counts a rendered %s', (_, html, expected) => expect(dom(html)).toBe(expected));

  it.each([
    ['tabs', '<w:r><w:t>A</w:t><w:tab/><w:ptab/><w:t>B</w:t></w:r>', 'A\t\tB'],
    ['breaks', '<w:r><w:t>A</w:t><w:br/><w:br w:type="page"/><w:cr/><w:t>B</w:t></w:r>', 'A\n\n\nB'],
    ['hyphens', '<w:r><w:noBreakHyphen/><w:softHyphen/></w:r>', '‑­'],
    ['symbols', '<w:r><w:sym w:font="Wingdings" w:char="F0FE"/><w:sym w:font="Arial" w:char="00A9"/></w:r>', '©'],
    ['invalid symbols', '<w:r><w:sym w:char="D800"/><w:sym w:char="FFFE"/><w:sym w:char="1F"/><w:sym w:char="zz"/><w:sym/></w:r>', ''],
    ['tab stop definitions', '<w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr><w:r><w:t>A</w:t></w:r>', 'A'],
    ['removed text', '<w:r><w:t>A</w:t></w:r><w:del><w:r><w:tab/><w:delText>x</w:delText></w:r></w:del><w:moveFrom><w:r><w:t>y</w:t></w:r></w:moveFrom><w:ins><w:r><w:t>B</w:t></w:r></w:ins>', 'AB'],
    ['removal nested in a hyperlink', '<w:hyperlink><w:r><w:t>A</w:t></w:r><w:del><w:r><w:t>x</w:t></w:r></w:del></w:hyperlink>', 'A'],
  ])('reads %s from source XML', (_, content, expected) => expect(xml(content)).toBe(expected));
});
