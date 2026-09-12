import { paragraphSelector, shadowSelection } from './selection';

export interface CanvasPoint { anchorId: string; offset: number }
export interface CanvasRange { start: CanvasPoint; end: CanvasPoint; backward: boolean }
const ignored = '[data-list-marker="true"], [data-rdv-empty], del, [data-revision-type="deleted"]';

export function canvasParagraphs(root: HTMLElement, anchorId?: string) {
  return Array.from(root.querySelectorAll<HTMLElement>(`#pagination-container :is(${paragraphSelector})`))
    .filter(node => (!anchorId || node.dataset.sourceAnchorId === anchorId) &&
      !Array.from(node.querySelectorAll<HTMLElement>(paragraphSelector)).some(child => child.dataset.sourceAnchorId === node.dataset.sourceAnchorId));
}

/** Text in the native UTF-16 coordinate space; generated labels are not editable. */
export function canvasText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node instanceof Element) {
    if (node.matches(ignored)) return '';
    if (node.matches('[data-docx-tab]')) return '\t';
    if (node.tagName === 'BR') return node.hasAttribute('data-rdv-break') ? '\n' : '';
  }
  return Array.from(node.childNodes).map(canvasText).join('');
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

export function readCanvasRange(root: HTMLElement): CanvasRange | null {
  const selection = shadowSelection(root);
  if (!selection?.rangeCount) return null;
  const tree = root.getRootNode() as ShadowRoot;
  const composed = (selection as Selection & { getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[] }).getComposedRanges?.({ shadowRoots: [tree] });
  const range = composed?.[0] ?? selection.getRangeAt(0);
  const start = canvasPoint(root, range.startContainer, range.startOffset);
  const end = canvasPoint(root, range.endContainer, range.endOffset);
  if (!start || !end) return null;
  const anchor = selection.anchorNode && canvasPoint(root, selection.anchorNode, selection.anchorOffset);
  return { start, end, backward: !!anchor && !samePoint(start, end) && samePoint(anchor, end) };
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
