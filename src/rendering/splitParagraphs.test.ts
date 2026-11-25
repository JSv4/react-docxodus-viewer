import { describe, expect, it } from 'vitest';
import { canvasText } from '../editing/textModel';
import { markSplitBreaks, restoreSplitBreaks } from './splitParagraphs';

const part = (text: string, attributes = '') => `<p data-source-anchor-id="p:body:a" ${attributes}>${text}</p>`;
const marker = '<div data-page-break="true"></div>';
function flow(html: string, finish: (blocks: HTMLElement[]) => HTMLElement[] = blocks => blocks) {
  const staging = document.createElement('div');
  staging.innerHTML = html;
  markSplitBreaks(staging);
  // Marking adds no layout content before flow.
  expect(staging.textContent).toBe(new DOMParser().parseFromString(html, 'text/html').body.textContent);
  const container = document.createElement('div');
  // Pagination consumes the markers and clones each part onto a page.
  container.append(...finish(Array.from(staging.querySelectorAll('p'), p => p.cloneNode(true) as HTMLElement)));
  restoreSplitBreaks(container);
  return Array.from(container.querySelectorAll('p'), canvasText);
}
const owner = (content: string) => `<div data-docx-break-paragraph="a">${content}</div>`;

describe('paragraphs split by page and column breaks', () => {
  it.each([
    ['between parts', owner(part('A') + marker + part('B')), ['A', '\nB']],
    ['repeated', owner(part('A') + marker + marker + part('B')), ['A', '\n\nB']],
    ['leading', owner(part('') + marker + part('B')), ['', '\nB']],
    ['trailing', owner(part('A') + marker), ['A\n']],
    ['column', owner(part('A') + part('B', 'data-column-break-before="true"')), ['A', '\nB']],
    ['leading column', part('B', 'data-column-break-before="true"'), ['\nB']],
    ['after a list label', owner(part('<span data-list-marker="true">1.</span>A', 'data-column-break-before="true"')), ['\nA']],
  ])('restores a %s break as one native character', (_, html, expected) => expect(flow(html)).toEqual(expected));

  it('counts one break when the following part itself continues on another page', () => {
    expect(flow(owner(part('A') + marker + part('Bcd')), ([a, b]) => {
      const rest = b.cloneNode(true) as HTMLElement;
      b.textContent = 'B'; rest.textContent = 'cd';
      return [a, b, rest];
    })).toEqual(['A', '\nB', 'cd']);
  });

  it('leaves an unfamiliar structure unmarked so its text cannot be addressed', () => {
    expect(flow(owner(`<section>${part('A')}</section>${marker}${part('B')}`))).toEqual(['A', 'B']);
  });

  it('restores a direction mark the converter spelled out as text', () => {
    const staging = document.createElement('div');
    staging.innerHTML = owner(part('A<br data-docx-break="true">#x200e') + marker + part('<br data-docx-break="true">#x200fB')) +
      part('<br data-docx-break="true">#x200e') + owner(part('#x200e') + marker + part('C'));
    markSplitBreaks(staging);
    // Only directly after a break, in a split paragraph; authored text is never touched.
    expect(Array.from(staging.querySelectorAll('p'), p => p.textContent)).toEqual(['A\u200e', '\u200fB', '#x200e', '#x200e', 'C']);
  });
});
