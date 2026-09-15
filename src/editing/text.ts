import type { DocxSession, EditResult, FormatOp, FormattingInspection } from 'docxodus/core';

/**
 * ExactVisibleText in Docxodus 12.6.0 is descendant w:t text plus native list
 * numbering for body paragraphs. Keep that contract without Markdown projection.
 * Requires a canonical anchor; unknown XML retains the native metadata fallback.
 */
export function visibleBlockText(session: DocxSession, anchorId: string): string | null {
  const xml = session.raw.getXml(anchorId);
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  if (parsed.querySelector('parsererror')) return session.getAnchorInfo(anchorId)?.visibleText ?? null;
  const text = Array.from(parsed.documentElement.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't')).map(node => node.textContent ?? '').join('');
  const prefix = /^(p|h|li):body:/.test(anchorId) ? session.getListMembership(anchorId)?.generatedLabel : undefined;
  return prefix ? text ? `${prefix} ${text}` : prefix : text;
}

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
  // A single insertion/deletion is already the smallest native edit. Running LCS
  // over its borrowed neighbour can match a space inside the pasted text instead,
  // splitting one keystroke burst into multiple writes and an expensive transaction.
  const exact = textChange(before, after, false)!;
  if (!exact.removed.length || !exact.inserted.length) return [changed];
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
export function paragraphTextSteps(session: DocxSession, anchorId: string, before: string, after: string, typingFormat?: FormatOp): Parameters<DocxSession['executeBatch']>[0] {
  const formatting = session.getFormatting(anchorId);
  if (!formatting || editableText(formatting) !== before) throw new Error('This paragraph changed. Reload its text before applying your draft.');
  const canonical = formatting.anchorId;
  const [kind, scope] = canonical.split(':');
  const changes = textChanges(before, after);
  if (!changes.length) return [];
  const exact = textChange(before, after, false)!;
  const boundary = exact.start === 0 || formatting.runs.some(run => run.span.start + run.span.length === exact.start);
  // 12.6.0 formats exactly the replacement in one undo/version unit. A pure
  // insertion must be at a native run boundary; borrowing a neighbouring
  // character here would incorrectly apply the typing format to existing text.
  const atomicFormat = typingFormat && exact.inserted.length && changes.length === 1 && (exact.removed.length || boundary)
    ? typingFormat : undefined;
  if (atomicFormat) changes.splice(0, changes.length, exact);
  if (!before.length && !atomicFormat) {
    const visible = visibleBlockText(session, canonical);
    if (visible === null) throw new Error('This paragraph changed. Reload its text before applying your draft.');
    // replaceText accepts Markdown. Escape literal typing into an empty paragraph.
    const literal = after.replace(/([\\`*_{}[\]()#+.!<>|~-])/g, '\\$1');
    return [{ tool: 'ParagraphEditor', action: 'insert text', mutation: () => session.replaceText(anchorId, literal, { expectedText: visible }) }];
  }
  const steps: Array<Parameters<DocxSession['executeBatch']>[0][number]> = changes.reverse().map(change => ({ tool: 'ParagraphEditor', action: 'replace text', mutation: () => {
    const current = editableText(session.getFormatting(anchorId));
    if (current.slice(change.start, change.start + change.removed.length) !== change.removed) throw new Error('This text changed before the edit could be applied.');
    // 12.6.0 replaceMatch addresses only enclosingAnchor.id + span (its
    // ReplaceTextAtSpan bridge). We already have those verified native offsets.
    // Searching the entire package for a borrowed space or period produces
    // thousands of irrelevant matches and stalls large-document typing.
    return session.replaceMatch({ text: change.removed,
      enclosingAnchor: { id: canonical, kind, scope, unid: canonical.split(':').at(-1)! },
      span: { start: change.start, length: change.removed.length }, fragments: [],
      contextBefore: current.slice(0, change.start), contextAfter: current.slice(change.start + change.removed.length), groups: [change.removed],
    }, change.inserted, atomicFormat);
  } }));
  // Interior insertions and disjoint drafts retain the public atomic batch path.
  // Format only the actual new span, excluding any borrowed boundary character.
  if (typingFormat && exact.inserted.length && !atomicFormat) steps.push({ tool: 'ParagraphEditor', action: 'typing format',
    mutation: () => session.applyFormat(canonical, { start: exact.start, length: exact.inserted.length }, typingFormat) });
  return steps;
}

export function replaceParagraphText(session: DocxSession, anchorId: string, before: string, after: string): EditResult | readonly EditResult[] | ReturnType<DocxSession['executeBatch']> | null {
  const steps = paragraphTextSteps(session, anchorId, before, after);
  return steps.length === 1 ? steps[0].mutation() : steps.length ? session.executeBatch(steps) : null;
}
