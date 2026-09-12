import type { DocumentTextSelection } from '../types';

export const paragraphSelector = 'p[data-source-anchor-id], h1[data-source-anchor-id], h2[data-source-anchor-id], h3[data-source-anchor-id], h4[data-source-anchor-id], h5[data-source-anchor-id], h6[data-source-anchor-id], li[data-source-anchor-id]';
export function shadowSelection(root: HTMLElement) {
  const tree = root.getRootNode() as ShadowRoot & { getSelection?: () => Selection | null };
  return tree.getSelection?.() ?? root.ownerDocument.getSelection();
}

/** Map a single paragraph selection across its page fragments using UTF-16 offsets. */
export function readTextSelection(root: HTMLElement, documentVersion?: number): DocumentTextSelection | null {
  const selection = shadowSelection(root);
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const blockFor = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(paragraphSelector);
  const first = blockFor(range.startContainer);
  const last = blockFor(range.endContainer);
  if (!first || !last || !root.contains(first) || !root.contains(last) || first.dataset.sourceAnchorId !== last.dataset.sourceAnchorId) return null;
  const anchorId = first.dataset.sourceAnchorId!;
  const textWithoutMarkers = (node: Node) => {
    const copy = node.cloneNode(true) as ParentNode & Node;
    copy.querySelectorAll?.('[data-list-marker="true"]').forEach(marker => marker.remove());
    return copy.textContent ?? '';
  };
  const fragments = Array.from(root.querySelectorAll<HTMLElement>(`#pagination-container :is(${paragraphSelector})`))
    .filter(node => node.dataset.sourceAnchorId === anchorId && !Array.from(node.querySelectorAll<HTMLElement>(paragraphSelector)).some(child => child.dataset.sourceAnchorId === anchorId));
  const offset = (block: HTMLElement, node: Node, offset: number) => {
    const index = fragments.indexOf(block);
    if (index < 0) return -1;
    const prefix = root.ownerDocument.createRange();
    prefix.selectNodeContents(block); prefix.setEnd(node, offset);
    return fragments.slice(0, index).reduce((length, fragment) => length + textWithoutMarkers(fragment).length, 0) + textWithoutMarkers(prefix.cloneContents()).length;
  };
  const start = offset(first, range.startContainer, range.startOffset);
  const end = offset(last, range.endContainer, range.endOffset);
  if (start < 0 || end <= start) return null;
  const blockText = fragments.map(textWithoutMarkers).join('');
  return { anchorId, blockText, span: { start, length: end - start }, text: blockText.slice(start, end), documentVersion };
}
