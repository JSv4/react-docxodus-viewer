/**
 * The native text coordinate space, shared by every offset this library reports
 * or edits. Docxodus counts w:t text plus one character for each visible run
 * atom: "\t" for w:tab/w:ptab, "\n" for every w:br/w:cr (including page and
 * column breaks), the Unicode hyphens, and a w:sym's stored character.
 */
const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** The number the paginated view draws inside a note's first paragraph. */
export const noteNumber = '.footnote-number, .endnote-number';
// Annotation labels are presentation injected into the highlighted run, not document text.
export const generatedContent = `[data-list-marker], a.footnote-ref, a.endnote-ref, a[class$="-backref"], a.comment-marker, ${noteNumber}, .annot-label`;
// Removed text is outside the native coordinates, as is the pilcrow drawn for a deleted paragraph mark.
const removed = 'del, [data-revision-type="deleted"], span[class*="para-mark-del"]';
const ignored = `${generatedContent}, ${removed}, [data-rdv-empty], [data-rdv-presentation]`;
const breaks = 'br[data-docx-break], [data-page-break], [data-column-break], [data-rdv-break]';
/** Rendered run atoms: the caret sits on either side, never inside. */
export const inlineAtoms = `[data-docx-tab], ${breaks}, [data-docx-symbol-text]`;

function atomText(element: Element): string | null {
  // A mapped glyph displays a Unicode substitute for the character the run stores.
  const symbol = element.getAttribute('data-docx-symbol-text');
  if (symbol !== null) return symbol;
  if (element.matches('[data-docx-tab]')) return '\t';
  // A br without the converter's stamp is the browser's placeholder for an empty line.
  return element.matches(breaks) ? '\n' : element.localName === 'br' ? '' : null;
}

/** The mark the converter adds after a Word break to resume the paragraph's direction. */
export const directionMark = /^[\u200e\u200f]/;
function followsBreak(node: Node | null): boolean {
  return node?.previousSibling instanceof Element && node.previousSibling.matches('br[data-docx-break]');
}

/** Text in the native UTF-16 coordinate space; generated labels are not editable. */
export function canvasText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    // Exact-height paragraphs wrap the mark alone in a span.
    const marked = followsBreak(node) || (text.length === 1 && !node.previousSibling && !node.nextSibling && followsBreak(node.parentNode));
    return marked ? text.replace(directionMark, '') : text;
  }
  if (node instanceof Element) {
    if (node.matches(ignored)) return '';
    const atom = atomText(node);
    if (atom !== null) return atom;
  }
  return Array.from(node.childNodes).map(canvasText).join('');
}

function runAtomText(element: Element): string {
  if (element.namespaceURI !== word) return '';
  if (element.localName === 't') return element.textContent ?? '';
  const parent = element.parentElement;
  if (parent?.namespaceURI !== word || parent.localName !== 'r') return '';
  switch (element.localName) {
    case 'tab': case 'ptab': return '\t';
    case 'br': case 'cr': return '\n';
    case 'noBreakHyphen': return '‑';
    case 'softHyphen': return '­';
    case 'sym': {
      const value = element.getAttributeNS(word, 'char') ?? '';
      const code = /^[\da-f]{1,4}$/i.test(value) ? parseInt(value, 16) : 0;
      // XML characters only: no controls, surrogates or noncharacters.
      return code >= 0x20 && !(code >= 0xd800 && code <= 0xdfff) && code < 0xfffe ? String.fromCharCode(code) : '';
    }
    default: return '';
  }
}

/** A block's visible text from its source XML; tracked deletions and move sources are excluded. */
export function xmlVisibleText(block: Element): string {
  const read = (element: Element): string => {
    let text = runAtomText(element);
    if (element.localName === 't' && element.namespaceURI === word) return text;
    for (const child of element.children) {
      if (child.namespaceURI === word && (child.localName === 'del' || child.localName === 'moveFrom')) continue;
      text += read(child);
    }
    return text;
  };
  return read(block);
}

/** Text a run atom may carry. Rewriting it as plain text would discard the atom's own XML. */
export const isAtomCharacter = (value: string) => /^[\t\n‑­-]$/.test(value);
