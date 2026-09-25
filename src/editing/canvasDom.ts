import { paragraphSelector, shadowSelection } from './selection';

export interface CanvasPoint { anchorId: string; offset: number }
export interface CanvasRange {
  start: CanvasPoint; end: CanvasPoint; backward: boolean;
  notes?: { kind: 'fn' | 'en'; id: string }[];
}
// Annotation labels are presentation injected into the highlighted run, not document text.
export const generatedContent = '[data-list-marker], a.footnote-ref, a.endnote-ref, a[class$="-backref"], a.comment-marker, .annot-label';
const ignored = `${generatedContent}, [data-rdv-empty], [data-rdv-presentation], [data-docx-tab], br, del, [data-revision-type="deleted"]`;

export function canvasParagraphs(root: HTMLElement, anchorId?: string) {
  const anchor = anchorId === undefined ? '' : `[data-source-anchor-id="${anchorId.replace(/["\\\n\r\f]/g, char => `\\${char.charCodeAt(0).toString(16)} `)}"]`;
  return Array.from(root.querySelectorAll<HTMLElement>(`#pagination-container :is(${paragraphSelector})${anchor}`))
    .filter(node =>
      !Array.from(node.querySelectorAll<HTMLElement>(paragraphSelector)).some(child => child.dataset.sourceAnchorId === node.dataset.sourceAnchorId));
}

/** Text in the native UTF-16 coordinate space; generated labels are not editable. */
export function canvasText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node instanceof Element) {
    if (node.matches(ignored)) return '';
  }
  return Array.from(node.childNodes).map(canvasText).join('');
}

/** The converter emits a directional sentinel after a Word break. Neither that
 * sentinel nor w:br / w:tab occupies a character in native formatting spans. */
export function prepareCanvasBreaks(block: HTMLElement) {
  for (const br of block.querySelectorAll('br:not([data-rdv-empty])')) {
    br.setAttribute('contenteditable', 'false');
    const next = br.nextSibling;
    if (next?.nodeType === Node.TEXT_NODE && /^[\u200e\u200f]/.test(next.textContent ?? '')) {
      const marker = block.ownerDocument.createElement('span');
      marker.dataset.rdvPresentation = 'true'; marker.contentEditable = 'false';
      marker.textContent = next.textContent![0];
      next.textContent = next.textContent!.slice(1);
      br.after(marker);
    }
  }
}

/** w:noBreakHyphen renders a glyph but, like tabs, has no native text offset.
 * Consult the source XML before excluding it so literal hyphens remain editable. */
export function prepareCanvasHyphens(blocks: HTMLElement[], xml: string, nativeText: string) {
  const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  const offsets: number[] = [];
  let text = '';
  for (const element of parsed.getElementsByTagNameNS(word, '*')) {
    if (element.localName === 't') text += element.textContent;
    else if (element.localName === 'noBreakHyphen') offsets.push(text.length);
  }
  if (text !== nativeText) return;
  for (const offset of offsets) {
    let remaining = offset;
    const nodes: Text[] = [];
    for (const block of blocks) {
      const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) if (!walker.currentNode.parentElement?.closest(ignored)) nodes.push(walker.currentNode as Text);
    }
    for (const node of nodes) {
      if (remaining >= node.length) { remaining -= node.length; continue; }
      if (node.data[remaining] !== '-') break;
      const glyph = node.splitText(remaining); glyph.splitText(1);
      const marker = node.ownerDocument.createElement('span');
      marker.dataset.rdvPresentation = 'true'; marker.contentEditable = 'false'; marker.textContent = '-';
      glyph.replaceWith(marker); break;
    }
  }
}
export const normalizedText = (text: string) => text.replace(/\u00a0/g, ' ');
export const samePoint = (a: CanvasPoint, b: CanvasPoint) => a.anchorId === b.anchorId && a.offset === b.offset;

export function canvasPoint(root: HTMLElement, node: Node, offset: number): CanvasPoint | null {
  const block = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(paragraphSelector);
  if (!block || !root.contains(block)) return null;
  const fragments = canvasParagraphs(root, block.dataset.sourceAnchorId);
  const index = fragments.indexOf(block);
  if (index < 0) return null;
  const prefix = root.ownerDocument.createRange();
  prefix.selectNodeContents(block); prefix.setEnd(node, offset);
  return { anchorId: block.dataset.sourceAnchorId!, offset: fragments.slice(0, index).reduce((length, part) => length + canvasText(part).length, 0) + canvasText(prefix.cloneContents()).length };
}

export function readCanvasRange(root: HTMLElement, target?: StaticRange): CanvasRange | null {
  const selection = shadowSelection(root);
  if (!selection?.rangeCount) return null;
  const tree = root.getRootNode() as ShadowRoot;
  const composed = (selection as Selection & { getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[] }).getComposedRanges?.({ shadowRoots: [tree] });
  const range = target ?? composed?.[0] ?? selection.getRangeAt(0);
  const start = canvasPoint(root, range.startContainer, range.startOffset);
  if (start && range.startContainer === range.endContainer && range.startOffset === range.endOffset) return { start, end: start, backward: false };
  const end = canvasPoint(root, range.endContainer, range.endOffset);
  if (!start || !end) return null;
  // Notes occupy no native text offsets, but remain selectable DOM content.
  const selected = root.ownerDocument.createRange();
  selected.setStart(range.startContainer, range.startOffset); selected.setEnd(range.endContainer, range.endOffset);
  const notes = Array.from(root.querySelectorAll<HTMLElement>('#pagination-container a.footnote-ref, #pagination-container a.endnote-ref'))
    .filter(ref => selected.intersectsNode(ref)).map(ref => ({
      kind: ref.matches('.footnote-ref') ? 'fn' as const : 'en' as const,
      id: ref.dataset.footnoteId ?? ref.dataset.endnoteId ?? ref.id.replace(/^(fn|en)-ref-/, ''),
    }));
  const anchor = selection.anchorNode && canvasPoint(root, selection.anchorNode, selection.anchorOffset);
  return { start, end, notes, backward: !!anchor && !samePoint(start, end) && samePoint(anchor, end) };
}

/** Older beforeinput implementations omit target ranges for collapsed deletion. */
export function readCanvasDeletion(root: HTMLElement, event: InputEvent): CanvasRange | null {
  const target = event.getTargetRanges?.()[0];
  if (target) return readCanvasRange(root, target);
  const selection = shadowSelection(root);
  const caret = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (caret?.collapsed && /^(deleteContentBackward|deleteContentForward)$/.test(event.inputType)) {
    const backward = event.inputType.endsWith('Backward');
    const block = (caret.startContainer instanceof Element ? caret.startContainer : caret.startContainer.parentElement)?.closest(paragraphSelector);
    for (const ref of block?.querySelectorAll('a.footnote-ref, a.endnote-ref') ?? []) {
      const note = root.ownerDocument.createRange(); note.selectNode(ref);
      const order = note.compareBoundaryPoints(backward ? Range.END_TO_END : Range.START_TO_START, caret);
      if (backward ? order > 0 : order < 0) continue;
      const gap = caret.cloneRange();
      if (backward) gap.setStartAfter(ref); else gap.setEndBefore(ref);
      if (!gap.toString() && !gap.cloneContents().querySelector('br, img, [data-docx-tab]')) return readCanvasRange(root, note);
    }
  }
  return readCanvasRange(root);
}

function pointInNode(node: Node, offset: number): [Node, number] | null {
  if (node.nodeType === Node.TEXT_NODE) return offset <= (node.textContent?.length ?? 0) ? [node, offset] : null;
  for (let index = 0; index < node.childNodes.length; index++) {
    const child = node.childNodes[index];
    const length = canvasText(child).length;
    if (!length) continue;
    if (offset <= length) {
      if (child instanceof Element && child.matches('br, [data-docx-tab]')) return [node, index + (offset ? 1 : 0)];
      return pointInNode(child, offset);
    }
    offset -= length;
  }
  return offset === 0 ? [node, node.childNodes.length] : null;
}

export function domPoint(root: HTMLElement, point: CanvasPoint): { block: HTMLElement; node: Node; offset: number } | null {
  const fragments = canvasParagraphs(root, point.anchorId);
  let offset = point.offset;
  for (let i = 0; i < fragments.length; i++) {
    const block = fragments[i], length = canvasText(block).length;
    if (offset < length || i === fragments.length - 1) {
      const found = pointInNode(block, Math.min(offset, length));
      return found ? { block, node: found[0], offset: found[1] } : null;
    }
    offset -= length;
  }
  return null;
}

export function restoreCanvasRange(root: HTMLElement, range: CanvasRange, focus: boolean) {
  const start = domPoint(root, range.start), end = domPoint(root, range.end);
  if (!start || !end) return false;
  if (focus) (range.backward ? start.block : end.block).focus({ preventScroll: true });
  const selection = shadowSelection(root);
  if (!selection) return false;
  if (range.backward) selection.setBaseAndExtent(end.node, end.offset, start.node, start.offset);
  else selection.setBaseAndExtent(start.node, start.offset, end.node, end.offset);
  return true;
}

export function caretAtPoint(root: HTMLElement, x: number, y: number) {
  const document = root.ownerDocument as Document & {
    caretPositionFromPoint?: (x: number, y: number, options?: { shadowRoots: ShadowRoot[] }) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = document.caretPositionFromPoint?.(x, y, { shadowRoots: [root.getRootNode() as ShadowRoot] });
  if (position) return canvasPoint(root, position.offsetNode, position.offset);
  const range = document.caretRangeFromPoint?.(x, y);
  return range ? canvasPoint(root, range.startContainer, range.startOffset) : null;
}
