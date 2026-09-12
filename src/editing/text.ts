import { ProjectionScopes } from 'docxodus/core';
import type { DocxSession, EditResult, FormattingInspection } from 'docxodus/core';

export function escapePattern(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Native run offsets exclude generated numbering; AnchorInfo.visibleText includes it. */
export function editableText(formatting: FormattingInspection | null) {
  if (!formatting) throw new Error('This paragraph has no editable text runs.');
  let text = '';
  for (const run of formatting.runs) {
    if (run.span.start !== text.length || run.span.length !== run.text.length) throw new Error('This paragraph needs a custom text editor for its generated content.');
    text += run.text;
  }
  return text;
}

/** One changed span, expanded to a neighbouring character for pure insertions. */
export function textChange(before: string, after: string, expandInsertion = true) {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  if (start === before.length && start === after.length) return null;
  if (start > 0 && /[\uD800-\uDBFF]/.test(before[start - 1])) start--;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  if (oldEnd < before.length && /[\uDC00-\uDFFF]/.test(before[oldEnd])) { oldEnd++; newEnd++; }
  if (expandInsertion && oldEnd === start && before.length) {
    if (start > 0) { start--; if (/[\uDC00-\uDFFF]/.test(before[start])) start--; }
    else { oldEnd += before.codePointAt(0)! > 0xffff ? 2 : 1; newEnd += oldEnd; }
  }
  return { start, removed: before.slice(start, oldEnd), inserted: after.slice(start, newEnd) };
}

/** Keep unchanged words between separate edits intact, including their run formatting. */
export function textChanges(before: string, after: string) {
  const changed = textChange(before, after);
  if (!changed) return [];
  const tokenize = (value: string) => value.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
  const old = tokenize(changed.removed), next = tokenize(changed.inserted);
  // Bound work for unusually large pasted paragraphs.
  if (old.length * next.length > 1_000_000) return [changed];
  const width = next.length + 1;
  const common = new Uint32Array((old.length + 1) * width);
  for (let i = old.length - 1; i >= 0; i--) for (let j = next.length - 1; j >= 0; j--) {
    common[i * width + j] = old[i] === next[j] ? 1 + common[(i + 1) * width + j + 1] : Math.max(common[(i + 1) * width + j], common[i * width + j + 1]);
  }
  const changes: NonNullable<ReturnType<typeof textChange>>[] = [];
  let i = 0, j = 0, offset = changed.start;
  while (i < old.length || j < next.length) {
    if (i < old.length && j < next.length && old[i] === next[j]) { offset += old[i++].length; j++; continue; }
    const start = offset;
    let removed = '', inserted = '';
    while ((i < old.length || j < next.length) && !(i < old.length && j < next.length && old[i] === next[j])) {
      if (i < old.length && (j === next.length || common[(i + 1) * width + j] >= common[i * width + j + 1])) { removed += old[i]; offset += old[i++].length; }
      else inserted += next[j++];
    }
    const local = textChange(removed, inserted)!;
    let change = { ...local, start: start + local.start };
    if (!change.removed.length && before.length) {
      // Native text matches need a nonempty range. Borrow one adjacent code point.
      if (change.start) {
        const neighbour = Array.from(before.slice(0, change.start)).at(-1)!;
        change = { start: change.start - neighbour.length, removed: neighbour, inserted: neighbour + change.inserted };
      } else {
        const neighbour = String.fromCodePoint(before.codePointAt(0)!);
        change = { start: 0, removed: neighbour, inserted: change.inserted + neighbour };
      }
    }
    changes.push(change);
  }
  return changes;
}

/** Preserve surrounding runs, links and paragraph formatting instead of rewriting a block. */
export function paragraphTextSteps(session: DocxSession, anchorId: string, before: string, after: string): Parameters<DocxSession['executeBatch']>[0] {
  const live = session.getAnchorInfo(anchorId);
  if (!live || editableText(session.getFormatting(anchorId)) !== before) throw new Error('This paragraph changed. Reload its text before applying your draft.');
  const changes = textChanges(before, after);
  if (!changes.length) return [];
  if (!before.length) {
    // replaceText accepts Markdown. Escape literal typing into an empty paragraph.
    const literal = after.replace(/([\\`*_{}[\]()#+.!<>|~-])/g, '\\$1');
    return [{ tool: 'ParagraphEditor', action: 'insert text', mutation: () => session.replaceText(anchorId, literal, { expectedText: live.visibleText }) }];
  }
  return changes.reverse().map(change => ({ tool: 'ParagraphEditor', action: 'replace text', mutation: () => {
    const match = session.grep(escapePattern(change.removed), { scope: ProjectionScopes.All })
      .find(match => match.enclosingAnchor.id === anchorId && match.span.start === change.start && match.span.length === change.removed.length);
    if (!match) throw new Error('This text cannot be mapped to an editable run. The document has not been changed.');
    return session.replaceMatch(match, change.inserted);
  } }));
}

export function replaceParagraphText(session: DocxSession, anchorId: string, before: string, after: string): EditResult | ReturnType<DocxSession['executeBatch']> | null {
  const steps = paragraphTextSteps(session, anchorId, before, after);
  return steps.length ? session.executeBatch(steps) : null;
}
