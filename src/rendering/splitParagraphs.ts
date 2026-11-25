import { paragraphSelector } from '../editing/selection';
import { generatedContent } from '../editing/textModel';

/**
 * A paragraph holding a Word page or column break renders as separate parts, and
 * pagination consumes the marker between them. The break is still one native
 * character. Record its position before flow without adding layout content.
 */
export function markSplitBreaks(staging: HTMLElement) {
  for (const owner of staging.querySelectorAll('[data-docx-break-paragraph]')) {
    // Splitting in 17.0.0 writes the direction mark after a line break as its entity name.
    for (const br of owner.querySelectorAll('br[data-docx-break]')) {
      const mark = br.nextSibling;
      if (mark?.nodeType === Node.TEXT_NODE) mark.textContent = mark.textContent!.replace(/^#x(200[ef])/, (_, code: string) => String.fromCharCode(parseInt(code, 16)));
    }
    const children = Array.from(owner.children);
    // An unfamiliar structure has no known text order; its paragraph stays read-only.
    if (!children.every(child => child.matches(`[data-page-break], [data-column-break], ${paragraphSelector}`))) continue;
    let part: HTMLElement | undefined, index = 0, breaks = 0;
    for (const child of children as HTMLElement[]) {
      if (!child.matches(paragraphSelector)) { breaks++; continue; }
      part = child;
      part.dataset.rdvPart = String(index++);
      // Column breaks have no marker; the part they begin carries the break.
      if (part.dataset.columnBreakBefore) breaks++;
      if (breaks) part.dataset.rdvBreaksBefore = String(breaks);
      breaks = 0;
    }
    if (part && breaks) part.dataset.rdvBreaksAfter = String(breaks);
  }
  // A leading column break leaves one part, without an owner.
  for (const part of staging.querySelectorAll<HTMLElement>('[data-column-break-before]:not([data-rdv-part])')) {
    if (part.matches(paragraphSelector) && !part.closest('[data-docx-break-paragraph]')) Object.assign(part.dataset, { rdvPart: '0', rdvBreaksBefore: '1' });
  }
}

/** Represent each consumed break in the finished pages. A part may itself span several pages. */
export function restoreSplitBreaks(container: HTMLElement) {
  const parts = new Map<string, HTMLElement[]>();
  for (const block of container.querySelectorAll<HTMLElement>('[data-rdv-part]')) {
    const key = `${block.dataset.sourceAnchorId}/${block.dataset.rdvPart}`;
    parts.set(key, [...parts.get(key) ?? [], block]);
  }
  const atoms = (count?: string) => Array.from({ length: Number(count ?? 0) }, () => {
    const atom = container.ownerDocument.createElement('span');
    atom.dataset.rdvBreak = 'true'; atom.contentEditable = 'false'; atom.ariaHidden = 'true';
    return atom;
  });
  for (const fragments of parts.values()) {
    const first = fragments[0], last = fragments.at(-1)!;
    const before = atoms(first.dataset.rdvBreaksBefore);
    const marker = first.firstElementChild?.matches(generatedContent) && first.firstChild === first.firstElementChild ? first.firstElementChild : null;
    if (marker) marker.after(...before); else first.prepend(...before);
    last.append(...atoms(last.dataset.rdvBreaksAfter));
  }
}
