import type { CharSpan, DocxSession, EditResult, FormatOp } from 'docxodus/core';
import type { DocxSessionController } from '../session';
import { editableText, paragraphTextSteps, replaceParagraphText, textChange, textChangeAtSelection } from './text';
import { shadowSelection } from './selection';
import { canvasParagraphs, canvasText, caretAtPoint, domPoint, generatedContent, normalizedText, prepareCanvasBreaks, prepareCanvasHyphens, readCanvasDeletion, readCanvasRange, restoreCanvasRange, samePoint } from './canvasDom';
import type { CanvasPoint, CanvasRange } from './canvasDom';

export interface CanvasEditorSnapshot { suspended: boolean; pending: boolean; composing: boolean; conflict: boolean; format: FormatOp | null }
interface CanvasCallbacks {
  readOnly: boolean;
  onSelect: (anchorId: string, span: { start: number; length: number }) => void;
  onError: (error: Error) => void;
  onHistory: (direction: 'undo' | 'redo') => boolean;
  onFormat: (key: 'bold' | 'italic' | 'underline') => boolean;
}
interface Draft { owner: DocxSession; anchorId: string; before: string; format: FormatOp | null; selection?: CharSpan }
const empty: CanvasEditorSnapshot = { suspended: false, pending: false, composing: false, conflict: false, format: null };
const collapsed = (point: CanvasPoint): CanvasRange => ({ start: point, end: point, backward: false });
function check<T>(result: T): T {
  for (const item of Array.isArray(result) ? result : [result]) {
    if (item && typeof item === 'object' && 'success' in item && !item.success) {
      const failure = item as EditResult & { failure?: { error: { message: string } } };
      throw new Error(failure.error?.message ?? failure.failure?.error.message ?? 'The document could not apply this edit.');
    }
  }
  return result;
}

/** Bridges browser text editing to native DOCX operations. It does not own the session. */
export class CanvasEditor {
  private controller: DocxSessionController;
  private callbacks: CanvasCallbacks | null = null;
  private state = empty;
  private listeners = new Set<() => void>();
  private selectionGuards = new Set<() => boolean>();
  private baselines = new Map<string, string>();
  private root: HTMLElement | null = null;
  private renderedOwner: DocxSession | null = null;
  private renderedVersion = 0;
  private range: CanvasRange | null = null;
  private fallback: CanvasPoint | null = null;
  private restoreFocus = false;
  private draft: Draft | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private applying = false;
  private detach: (() => void) | null = null;
  private scroll = { top: 0, left: 0 };
  private preparedLayouts = new WeakMap<HTMLElement, { owner: DocxSession | null; version: number; readOnly?: boolean; baselines: Map<string, string> }>();

  constructor(controller: DocxSessionController) { this.controller = controller; }
  getSnapshot = () => this.state;
  acceptsLayout = (owner: DocxSession | null, version?: number) => {
    const current = this.controller.getSnapshot();
    return current.session === owner && (version === undefined || current.version === version);
  };
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  /** Coordinate optional paragraph drafts before returning to on-page editing. */
  guardSelection = (guard: () => boolean) => { this.selectionGuards.add(guard); return () => { this.selectionGuards.delete(guard); }; };
  private canSelect() { return [...this.selectionGuards].every(guard => guard()); }
  private publish(update: Partial<CanvasEditorSnapshot>) {
    this.state = { ...this.state, ...update };
    for (const listener of this.listeners) listener();
  }
  configure(callbacks: CanvasCallbacks) {
    if (callbacks.readOnly && !this.callbacks?.readOnly) this.commit();
    const changed = callbacks.readOnly !== this.callbacks?.readOnly;
    this.callbacks = callbacks;
    if (changed && this.root) this.prepareParagraphs();
  }
  dispose = () => { this.commit(); this.detach?.(); this.clearTimer(); this.publish({ suspended: false, composing: false }); };
  private clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  private fail(cause: unknown, conflict = false) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    if (conflict) this.publish({ conflict: true, suspended: true });
    this.callbacks?.onError(error); return false;
  }
  private text(anchorId: string) { return editableText(this.controller.getFormatting(anchorId)); }
  private canonical(anchorId: string) {
    // The formatting read needed to prepare/edit a paragraph already resolves its
    // canonical ID. Avoid rebuilding the document-wide anchor inventory on Enter.
    const canonical = this.controller.getFormatting(anchorId)?.anchorId;
    const identity = anchorId.slice(anchorId.indexOf(':'));
    // Native formatting can resolve an ID across stories by UNID. The canvas
    // must retain its stronger story identity check, including for stale kinds.
    return canonical && /^(p|h|li):/.test(canonical) && canonical.slice(canonical.indexOf(':')) === identity ? canonical : undefined;
  }
  private ownsFocus() {
    if (!this.root) return false;
    const active = (this.root.getRootNode() as ShadowRoot).activeElement;
    return !!active && this.root.contains(active) && active.matches('[data-rdv-editable="true"]');
  }
  private capture() {
    if (!this.root) return;
    const selection = readCanvasRange(this.root);
    if (selection) this.range = selection;
    this.restoreFocus = this.ownsFocus();
  }
  private notifySelection() {
    if (this.draft || !this.range) return;
    if (!this.canSelect()) return;
    const first = this.selectedSpans()[0];
    if (first) this.callbacks?.onSelect(first.anchorId, first.span);
  }
  private storyBlocks(anchorId: string) {
    if (!this.root) return [];
    const blocks = canvasParagraphs(this.root);
    const story = (block: HTMLElement) => {
      const scope = block.dataset.sourceAnchorId!.split(':')[1];
      const note = block.closest<HTMLElement>('[data-footnote-id], [data-endnote-id]');
      return note ? `${scope}:${note.dataset.footnoteId ?? note.dataset.endnoteId}` : scope;
    };
    const target = blocks.find(block => block.dataset.sourceAnchorId === anchorId);
    return target ? blocks.filter(block => story(block) === story(target)) : [];
  }
  /** Native spans for the current selection, including selections across paragraphs. */
  selectedSpans = () => {
    if (!this.root || !this.range || this.renderedOwner !== this.controller.getSnapshot().session) return [];
    const { start, end } = this.range;
    // Undo can remove a paragraph before the old page DOM has been replaced.
    if (!this.canonical(start.anchorId) || !this.canonical(end.anchorId)) return [];
    if (start.anchorId === end.anchorId) return [{ anchorId: this.canonical(start.anchorId)!, span: { start: start.offset, length: Math.max(0, end.offset - start.offset) } }];
    const ids = [...new Set(this.storyBlocks(start.anchorId).map(block => block.dataset.sourceAnchorId!))];
    const identity = (id: string) => id.slice(id.indexOf(':'));
    const first = ids.findIndex(id => identity(id) === identity(start.anchorId)), last = ids.findIndex(id => identity(id) === identity(end.anchorId));
    if (first < 0 || last < first) return [];
    return ids.slice(first, last + 1).map(id => {
      const anchorId = this.canonical(id) ?? id;
      const from = anchorId === start.anchorId ? start.offset : 0;
      const to = anchorId === end.anchorId ? end.offset : this.text(anchorId).length;
      return { anchorId, span: { start: from, length: Math.max(0, to - from) } };
    });
  };
  private *prepareGroups(root: HTMLElement, owner: DocxSession | null, baselines: Map<string, string>, anchorId?: string) {
    if (!this.controller.getSnapshot().session) return;
    const paragraphs = canvasParagraphs(root, anchorId);
    const groups = new Map<string, HTMLElement[]>();
    for (const block of paragraphs) {
      const id = block.dataset.sourceAnchorId!;
      const group = groups.get(id) ?? []; group.push(block); groups.set(id, group);
    }
    const ids = [...groups.keys()].map(id => this.canonical(id)).filter((id): id is string => !!id);
    if (!anchorId) {
      const live = new Set(ids);
      for (const id of baselines.keys()) if (!live.has(id)) baselines.delete(id);
    }
    for (const [id, fragments] of groups) {
      try {
        const canonical = this.canonical(id);
        if (!canonical) continue;
        const text = this.text(canonical);
        for (const block of fragments) {
          block.dataset.sourceAnchorId = canonical;
          prepareCanvasBreaks(block);
          block.querySelectorAll(`${generatedContent}, [data-docx-tab], del, img`).forEach(node => node.setAttribute('contenteditable', 'false'));
          if (!text && !canvasText(block).trim() && !block.querySelector('img, br:not([data-rdv-empty]), [data-docx-tab]')) {
            const markers = block.querySelectorAll('[data-list-marker="true"], a.footnote-ref, a.endnote-ref');
            block.replaceChildren(...markers, Object.assign(document.createElement('br'), { ariaHidden: 'true' }));
            block.lastElementChild?.setAttribute('data-rdv-empty', 'true');
          }
        }
        if (normalizedText(fragments.map(canvasText).join('')) !== normalizedText(text)) {
          prepareCanvasHyphens(fragments, this.controller.read(session => session.raw.getXml(canonical)), text);
        }
        const supported = normalizedText(fragments.map(canvasText).join('')) === normalizedText(text);
        if (supported) baselines.set(canonical, text);
        for (const block of fragments) {
          const editable = supported && owner === this.controller.getSnapshot().session && !this.callbacks?.readOnly;
          block.contentEditable = editable ? 'true' : 'false';
          block.dataset.rdvEditable = String(editable);
          if (editable) { block.setAttribute('role', 'textbox'); block.setAttribute('aria-label', 'Document paragraph'); block.setAttribute('aria-multiline', 'true'); block.spellcheck = true; }
          else { block.removeAttribute('role'); block.removeAttribute('aria-label'); block.removeAttribute('aria-multiline'); }
        }
      } catch { /* Generated or unsupported blocks stay read-only. */ }
      yield;
    }
  }
  private prepareParagraphs(anchorId?: string) {
    if (this.root) for (const _ of this.prepareGroups(this.root, this.renderedOwner, this.baselines, anchorId)) { void _; }
  }
  /** Prepare only the incoming DOM; active drafts and baselines remain untouched. */
  async prepareLayout(root: HTMLElement, owner: DocxSession | null, version: number | undefined, pause: () => Promise<void>) {
    this.addEditingStyle(root);
    const baselines = new Map<string, string>();
    const readOnly = this.callbacks?.readOnly;
    let deadline = performance.now() + 8;
    for (const _ of this.prepareGroups(root, owner, baselines)) {
      void _;
      if (performance.now() >= deadline) { await pause(); deadline = performance.now() + 8; }
    }
    if (this.acceptsLayout(owner, version) && readOnly === this.callbacks?.readOnly) {
      this.preparedLayouts.set(root, { owner, version: this.controller.getSnapshot().version, readOnly, baselines });
    }
  }
  private addEditingStyle(root: HTMLElement) {
    const existing = root.querySelector<HTMLStyleElement>('style[data-rdv-canvas-style]');
    if (existing) return existing;
    const style = document.createElement('style');
    style.dataset.rdvCanvasStyle = 'true';
    style.textContent = '[data-rdv-editable="true"] { cursor: text; caret-color: #3c5636; outline: none; min-height: 1em; } [data-rdv-editable="true"]:focus { outline: none; } [data-list-marker="true"] { user-select: none; }';
    root.append(style);
    return style;
  }
  private scheduleCommit() {
    this.clearTimer();
    if (!this.state.composing) this.timer = setTimeout(() => { this.timer = null; this.commit(); }, 350);
  }
  private beginDraft(anchorId: string, afterInput = false) {
    if (this.draft?.anchorId === anchorId) return true;
    if (!this.commit()) return false;
    const owner = this.controller.getSnapshot().session;
    if (!owner || owner !== this.renderedOwner || this.callbacks?.readOnly) return false;
    const before = this.text(anchorId);
    const shown = this.root && canvasParagraphs(this.root, anchorId).map(canvasText).join('');
    if (shown === null || (afterInput ? this.baselines.get(anchorId) !== before : normalizedText(shown) !== normalizedText(before))) return this.fail('The paragraph changed. Wait for the page to refresh before typing.', afterInput);
    this.baselines.set(anchorId, before);
    const selection = !afterInput && this.range?.start.anchorId === anchorId && this.range.end.anchorId === anchorId
      ? { start: this.range.start.offset, length: this.range.end.offset - this.range.start.offset } : undefined;
    this.draft = { owner, anchorId, before, format: this.state.format, selection };
    this.publish({ pending: true, suspended: true });
    return true;
  }
  commit = (): boolean => {
    this.clearTimer();
    if (this.state.composing) return false;
    const draft = this.draft;
    if (!draft) return !this.state.conflict;
    if (!this.root) return false;
    this.capture();
    try {
      if (this.controller.getSnapshot().session !== draft.owner) throw new Error('The document was replaced before this edit could be saved.');
      if (this.text(draft.anchorId) !== draft.before) throw new Error('This paragraph changed elsewhere. Copy your typing, then reload the document text.');
      const shown = canvasParagraphs(this.root, draft.anchorId).map(canvasText).join('');
      // The converter uses NBSP to preserve spaces between runs; retain native text
      // outside the actual typed span so those presentation spaces never leak into DOCX.
      const selected = draft.format && draft.selection ? textChangeAtSelection(normalizedText(draft.before), normalizedText(shown), draft.selection) : null;
      const delta = selected ?? textChange(normalizedText(draft.before), normalizedText(shown), false);
      if (delta) {
        const after = draft.before.slice(0, delta.start) + delta.inserted + draft.before.slice(delta.start + delta.removed.length);
        this.applying = true;
        check(this.controller.run(session => replaceParagraphText(session, draft.anchorId, draft.before, after, draft.format ?? undefined, draft.selection)));
      }
      this.draft = null;
      this.baselines.set(draft.anchorId, this.text(draft.anchorId));
      this.publish({ pending: false, suspended: false, conflict: false });
      this.notifySelection();
      return true;
    } catch (cause) { return this.fail(cause, true); }
    finally { this.applying = false; }
  };
  discard = () => {
    const anchor = this.draft?.anchorId;
    this.draft = null; this.clearTimer();
    this.publish({ ...empty });
    if (anchor && this.root) this.patch(anchor);
    this.notifySelection();
  };
  whenIdle = (signal: AbortSignal) => this.state.suspended && !signal.aborted ? new Promise<void>(resolve => {
    const done = () => { unsubscribe(); signal.removeEventListener('abort', done); resolve(); };
    const unsubscribe = this.subscribe(() => { if (!this.state.suspended) done(); });
    signal.addEventListener('abort', done, { once: true });
  }) : Promise.resolve();

  beforeCommand = () => { this.capture(); return this.commit(); };
  /** Reconcile committed block DOM without detaching the editing surface. */
  updateLayout = (anchors: string[], update: () => void) => {
    this.capture();
    this.applying = true;
    try {
      update();
      for (const anchor of anchors) this.prepareParagraphs(anchor);
      this.renderedVersion = this.controller.getSnapshot().version;
      this.restore();
    } finally { this.applying = false; }
  };
  afterCommand = () => {
    if (!this.root || !this.range || this.state.composing) return;
    this.restoreFocus = true;
    const update = (point: CanvasPoint) => { const anchorId = this.canonical(point.anchorId); return anchorId ? { ...point, anchorId, offset: Math.min(point.offset, this.text(anchorId).length) } : point; };
    this.range = { ...this.range, start: update(this.range.start), end: update(this.range.end) };
    // The viewer batches ordinary formatting with its live source update. A
    // structural/global command still needs immediate caret reconciliation.
    if (!this.renderedOwner || !this.controller.getRenderChanges(this.renderedOwner, this.renderedVersion)) {
      for (const { anchorId } of this.selectedSpans()) this.patch(anchorId);
    }
    this.restore(); this.notifySelection();
  };
  focus = () => {
    if (!this.range && this.root) {
      const anchorId = canvasParagraphs(this.root).find(block => block.dataset.rdvEditable === 'true')?.dataset.sourceAnchorId;
      if (anchorId) this.range = collapsed({ anchorId, offset: 0 });
    }
    this.restoreFocus = true; this.restore(); this.notifySelection();
  };
  selectCreated = (anchorId: string, after: string) => {
    this.fallback = this.range?.start ?? null;
    this.range = collapsed({ anchorId, offset: 0 });
    this.patch(anchorId, after);
    this.focus();
  };
  setTypingFormat = (format: FormatOp) => {
    if (this.callbacks?.readOnly || !this.beforeCommand()) return false;
    this.publish({ format: { ...this.state.format, ...format } });
    this.focus();
    return true;
  };
  private restore() {
    if (!this.root || !this.range || !this.restoreFocus) return;
    if (!this.canonical(this.range.start.anchorId) || !domPoint(this.root, this.range.start)) {
      const fallback = this.fallback && this.canonical(this.fallback.anchorId);
      const block = fallback ?? canvasParagraphs(this.root)[0]?.dataset.sourceAnchorId;
      if (block) this.range = collapsed({ anchorId: block, offset: Math.min(this.fallback?.offset ?? 0, this.text(block).length) });
    }
    if (!restoreCanvasRange(this.root, this.range, this.restoreFocus)) return;
    const selection = shadowSelection(this.root);
    const viewport = (this.root.getRootNode() as ShadowRoot).host.closest<HTMLElement>('.rdv-pages');
    if (selection?.focusNode && viewport) {
      const caret = document.createRange(); caret.setStart(selection.focusNode, selection.focusOffset); caret.collapse(true);
      let rect = caret.getBoundingClientRect();
      if (!rect.height) rect = domPoint(this.root, this.range.backward ? this.range.start : this.range.end)?.block.getBoundingClientRect() ?? rect;
      const visible = viewport.getBoundingClientRect();
      if (rect.height) {
        if (rect.bottom > visible.bottom - 20) viewport.scrollTop += rect.bottom - visible.bottom + 20;
        else if (rect.top < visible.top + 20) viewport.scrollTop -= visible.top + 20 - rect.top;
      }
    }
  }
  private patch(anchorId: string, after?: string) {
    this.patchMany([anchorId], after);
  }
  private patchMany(anchorIds: string[], after?: string) {
    if (!this.root) return;
    const ids = [...new Set(anchorIds.map(id => this.canonical(id)).filter((id): id is string => !!id))];
    // Enter and multiline paste change several paragraphs together. The native
    // batch renderer shares its converter setup and keeps the single-block
    // presentation profile; missing results retain the per-block fallback.
    const rendered = ids.length > 1 ? this.controller.renderBlocks(ids, {
      cssPrefix: 'docx-', fabricateClasses: false, comments: false, renderTrackedChanges: false,
    }) : null;
    const paragraphs = canvasParagraphs(this.root);
    for (const canonical of ids) {
      const identity = canonical.slice(canonical.indexOf(':'));
      const old = paragraphs.filter(block => block.dataset.sourceAnchorId!.slice(block.dataset.sourceAnchorId!.indexOf(':')) === identity);
      const html = rendered?.[canonical] ?? this.controller.read(session => session.renderBlock(canonical, { fabricateClasses: false }));
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const block = parsed.body.firstElementChild as HTMLElement | null;
      if (!block) throw new Error('The edited paragraph could not be rendered.');
      block.dataset.sourceAnchorId = canonical;
      if (old[0]) { old[0].replaceWith(block); old.slice(1).forEach(fragment => fragment.remove()); }
      else if (after) canvasParagraphs(this.root, after).at(-1)?.after(block);
      this.prepareParagraphs(canonical);
      after = canonical;
    }
  }

  private refreshListMarkers() {
    if (!this.root) return;
    const grouped = new Map<string, Element[]>();
    for (const block of canvasParagraphs(this.root)) {
      const markers = Array.from(block.querySelectorAll('[data-list-marker]')).filter(marker => !marker.querySelector('[data-list-marker]'));
      if (!markers.length) continue;
      const id = block.dataset.sourceAnchorId!;
      if (!grouped.has(id) && this.controller.read(session => session.getListMembership(id)?.format) === 'bullet') continue;
      grouped.set(id, [...grouped.get(id) ?? [], ...markers]);
    }
    const labels = this.controller.getListLabels([...grouped.keys()]);
    for (const [id, markers] of grouped) {
      const label = labels[id];
      // Keep marker wrappers, tab spacing, run styling, and page fragments intact.
      if (label !== undefined) for (const marker of markers) if (marker.textContent !== label) marker.textContent = label;
    }
  }

  /** Execute structural edits as one undo step, then restore the editing caret. */
  private mutate(action: string, operation: (session: DocxSession) => { results: EditResult[]; point: CanvasPoint; changed: string[]; removed?: string[] }, atomic = true) {
    if (this.callbacks?.readOnly || !this.beforeCommand()) return false;
    const before = this.range;
    try {
      this.applying = true;
      let outcome: ReturnType<typeof operation> | undefined;
      check(this.controller.run(session => {
        const mutation = () => { outcome = operation(session); return outcome.results; };
        return atomic ? session.executeBatch([{ tool: 'CanvasEditor', action, mutation }]) : mutation();
      }));
      if (!outcome) return false;
      this.fallback = before?.start ?? null;
      this.range = collapsed(outcome.point); this.restoreFocus = true;
      outcome.removed?.forEach(id => this.root && canvasParagraphs(this.root, id).forEach(block => block.remove()));
      this.patchMany(outcome.changed);
      if (outcome.results.some(result => result.created.length || result.removed.length)) this.refreshListMarkers();
      this.restore(); this.notifySelection();
      return true;
    } catch (cause) { return this.fail(cause); }
    finally { this.applying = false; }
  }
  private replace(session: DocxSession, anchor: string, start: number, end: number, value: string) {
    const before = editableText(session.getFormatting(anchor));
    const steps = paragraphTextSteps(session, anchor, before, before.slice(0, start) + value + before.slice(end));
    const results = steps.flatMap(step => { const result = check(step.mutation()); return Array.isArray(result) ? result : [result]; });
    if (this.state.format && value.length) results.push(check(session.applyFormat(anchor, { start, length: value.length }, this.state.format)));
    return results;
  }
  private join(session: DocxSession, first: string, second: string) {
    const left = editableText(session.getFormatting(first)), right = editableText(session.getFormatting(second));
    const results = [check(session.mergeParagraphs(first, second))];
    const joined = editableText(session.getFormatting(first));
    // Native merge separates non-whitespace endings with a space. Keyboard
    // deletion removes only the paragraph boundary, including inside a word.
    if (joined !== left + right) {
      const separator = joined.slice(left.length, joined.length - right.length);
      if (!joined.startsWith(left) || !joined.endsWith(right) || !/^\s+$/.test(separator)) throw new Error('The paragraphs could not be joined without changing their text.');
      results.push(...this.replace(session, first, left.length, left.length + separator.length, ''));
    }
    return results;
  }
  private removeRange(session: DocxSession, range: CanvasRange) {
    const { start, end } = range;
    const results: EditResult[] = [];
    for (const note of range.notes ?? []) {
      const anchor = Object.keys(this.controller.getAnchorIndex()).find(id => id.startsWith(`${note.kind}:`) &&
        new DOMParser().parseFromString(session.raw.getXml(id), 'application/xml').documentElement
          .getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'id') === note.id);
      if (!anchor) throw new Error('This note changed. Wait for the page to refresh before deleting it.');
      results.push(check(session.deleteBlock(anchor)));
    }
    // A caret has no text to remove. The following native split/insertion
    // validates its own anchor/span without two redundant formatting reads.
    if (samePoint(start, end)) return { results, removed: [] as string[] };
    if (start.anchorId === end.anchorId) return { results: [...results, ...this.replace(session, start.anchorId, start.offset, end.offset, '')], removed: [] as string[] };
    const blocks = [...new Set(this.storyBlocks(start.anchorId).map(block => block.dataset.sourceAnchorId!))];
    const first = blocks.indexOf(start.anchorId), last = blocks.indexOf(end.anchorId);
    if (first < 0 || last <= first) throw new Error('Select text within one document story, in document order.');
    const firstElement = canvasParagraphs(this.root!, start.anchorId)[0], lastElement = canvasParagraphs(this.root!, end.anchorId)[0];
    const cell = firstElement.closest('td, th');
    if (cell !== lastElement.closest('td, th') || blocks.slice(first, last + 1).some(id => canvasParagraphs(this.root!, id)[0].closest('td, th') !== cell)) throw new Error('Edit table cells individually.');
    results.push(...this.replace(session, end.anchorId, 0, end.offset, ''));
    results.push(...this.replace(session, start.anchorId, start.offset, editableText(session.getFormatting(start.anchorId)).length, ''));
    const removed = blocks.slice(first + 1, last + 1);
    for (const anchor of blocks.slice(first + 1, last)) results.push(check(session.deleteBlock(anchor)));
    results.push(...this.join(session, start.anchorId, end.anchorId));
    return { results, removed };
  }
  insertText = (value: string, paragraphBreak = false, target?: CanvasRange) => {
    const range = target ?? (this.root && readCanvasRange(this.root) || this.range);
    if (!range) return false;
    // A collapsed Enter is exactly one native split, which already owns an
    // undo/version unit. Selections and pasted text still need atomic rollback.
    const atomic = !(paragraphBreak && samePoint(range.start, range.end) && !range.notes?.length);
    return this.mutate(paragraphBreak ? 'split paragraph' : 'insert text', session => {
      const { results, removed } = this.removeRange(session, range);
      const lines = paragraphBreak ? ['', ''] : value.replace(/\r\n?/g, '\n').split('\n');
      let anchor = range.start.anchorId, offset = range.start.offset;
      const changed = [anchor];
      for (let index = 0; index < lines.length; index++) {
        if (lines[index]) results.push(...this.replace(session, anchor, offset, offset, lines[index]));
        offset += lines[index].length;
        if (index < lines.length - 1) {
          const split = check(session.splitParagraph(anchor, offset)); results.push(split);
          anchor = split.created.find(ref => /^(p|h|li):/.test(ref.id))!.id;
          changed.push(anchor); offset = 0;
        }
      }
      return { results, point: { anchorId: anchor, offset }, changed, removed };
    }, atomic);
  };
  private merge(direction: -1 | 1) {
    const range = this.range;
    if (!range || !this.root) return false;
    const ids = [...new Set(this.storyBlocks(range.start.anchorId).map(block => block.dataset.sourceAnchorId!))];
    const neighbor = ids[ids.indexOf(range.start.anchorId) + direction];
    if (!neighbor) return true;
    const first = direction < 0 ? neighbor : range.start.anchorId, second = direction < 0 ? range.start.anchorId : neighbor;
    const before = canvasParagraphs(this.root, first)[0], after = canvasParagraphs(this.root, second)[0];
    if (before.closest('td, th') !== after.closest('td, th')) return true;
    return this.mutate('join paragraphs', session => {
      const offset = editableText(session.getFormatting(first)).length;
      return { results: this.join(session, first, second), point: { anchorId: first, offset }, changed: [first], removed: [second] };
    });
  }
  private insertStyledText(text: string) {
    if (!this.root || !this.range || !this.beginDraft(this.range.start.anchorId)) return;
    const selection = shadowSelection(this.root);
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement('span'), format = this.state.format!;
    Object.assign(span.style, {
      fontWeight: format.bold === undefined ? '' : format.bold ? 'bold' : 'normal', fontStyle: format.italic === undefined ? '' : format.italic ? 'italic' : 'normal',
      textDecoration: [format.underline ? 'underline' : '', format.strike ? 'line-through' : ''].filter(Boolean).join(' '),
      fontFamily: format.fontFamily ?? '', fontSize: format.fontSizePts ? `${format.fontSizePts}pt` : '',
      color: format.color && format.color !== 'auto' ? `#${format.color.replace(/^#/, '')}` : '',
    });
    span.textContent = text; range.deleteContents(); range.insertNode(span);
    range.setStart(span.firstChild!, text.length); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range);
    this.capture(); this.scheduleCommit();
  }

  private navigate(event: KeyboardEvent) {
    if (!this.root || !this.range || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || !samePoint(this.range.start, this.range.end)) return;
    const blocks = this.storyBlocks(this.range.start.anchorId).filter(block => block.dataset.rdvEditable === 'true');
    const active = (this.root.getRootNode() as ShadowRoot).activeElement as HTMLElement;
    const index = blocks.indexOf(active);
    if (index < 0) return;
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const next = blocks[index + direction];
    if (!next) return;
    const offset = this.range.start.offset - blocks.slice(0, index).filter(block => block.dataset.sourceAnchorId === active.dataset.sourceAnchorId).reduce((length, block) => length + canvasText(block).length, 0);
    const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
    let point: CanvasPoint | null = null;
    if (vertical) {
      const selection = shadowSelection(this.root);
      const rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
      const box = active.getBoundingClientRect(), target = next.getBoundingClientRect();
      if (!rect?.height || (direction < 0 ? rect.top - box.top > rect.height : box.bottom - rect.bottom > rect.height)) return;
      point = caretAtPoint(this.root, Math.max(target.left + 1, Math.min(rect.left, target.right - 1)), direction < 0 ? target.bottom - 2 : target.top + 2);
    } else if (direction < 0 ? offset !== 0 : offset !== canvasText(active).length) return;
    event.preventDefault();
    const nextId = next.dataset.sourceAnchorId!;
    const fragments = canvasParagraphs(this.root, nextId), nextIndex = fragments.indexOf(next);
    const start = fragments.slice(0, nextIndex).reduce((length, block) => length + canvasText(block).length, 0);
    this.range = collapsed(point ?? { anchorId: nextId, offset: start + (direction < 0 ? canvasText(next).length : 0) });
    this.restoreFocus = true; this.restore(); this.notifySelection();
  }

  attach(root: HTMLElement, owner: DocxSession | null) {
    this.detach?.();
    this.root = root;
    if (owner !== this.renderedOwner) { this.range = null; this.fallback = null; this.draft = null; this.baselines.clear(); this.restoreFocus = false; this.publish({ ...empty }); }
    this.renderedOwner = owner;
    this.renderedVersion = this.controller.getSnapshot().version;
    const prepared = this.preparedLayouts.get(root);
    this.preparedLayouts.delete(root);
    if (prepared && prepared.owner === owner && prepared.version === this.renderedVersion && prepared.readOnly === this.callbacks?.readOnly) this.baselines = prepared.baselines;
    else this.prepareParagraphs();
    const style = this.addEditingStyle(root);
    const viewport = (root.getRootNode() as ShadowRoot).host.closest<HTMLElement>('.rdv-pages');
    if (viewport) { viewport.scrollTop = this.scroll.top; viewport.scrollLeft = this.scroll.left; }
    this.restore();

    const selection = () => {
      if (this.applying || !this.ownsFocus() || this.state.composing) return;
      const next = readCanvasRange(root);
      if (!next) return;
      if (this.range && this.state.format && !this.draft && (!samePoint(next.start, this.range.start) || !samePoint(next.end, this.range.end))) this.publish({ format: null });
      this.range = next; this.restoreFocus = true; this.notifySelection();
    };
    const pointerDown = (event: PointerEvent) => { if (!this.state.composing && (!this.commit() || !this.canSelect())) { event.preventDefault(); event.stopPropagation(); } };
    const click = (event: MouseEvent) => {
      if (this.callbacks?.readOnly) return;
      const target = event.target as Element;
      if (target.closest('a')) event.preventDefault();
      const block = target.closest<HTMLElement>('[data-rdv-editable="true"]') ?? target.closest('td, th')?.querySelector<HTMLElement>('[data-rdv-editable="true"]');
      if (block && !this.ownsFocus()) {
        const point = caretAtPoint(root, event.clientX, event.clientY) ?? { anchorId: block.dataset.sourceAnchorId!, offset: this.text(block.dataset.sourceAnchorId!).length };
        this.range = collapsed(point); this.restoreFocus = true; this.restore();
      }
      selection();
    };
    const beforeInput = (event: InputEvent) => {
      if (this.callbacks?.readOnly) { event.preventDefault(); return; }
      if (!this.canSelect()) { event.preventDefault(); return; }
      this.capture();
      const range = this.range;
      if (!range) { event.preventDefault(); return; }
      if (event.isComposing || this.state.composing) { this.beginDraft(range.start.anchorId); return; }
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') { event.preventDefault(); if (this.commit()) this.callbacks?.onHistory(event.inputType === 'historyUndo' ? 'undo' : 'redo'); return; }
      if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') { event.preventDefault(); this.insertText('', true); return; }
      if (event.inputType.startsWith('delete')) {
        const deletion = readCanvasDeletion(root, event);
        if (deletion?.notes?.length) { event.preventDefault(); this.insertText('', false, deletion); return; }
      }
      if (range.start.anchorId !== range.end.anchorId || range.notes?.length) { event.preventDefault(); this.insertText(event.data ?? ''); return; }
      if (event.inputType.startsWith('delete') && samePoint(range.start, range.end)) {
        const text = this.draft ? canvasParagraphs(root, range.start.anchorId).map(canvasText).join('') : this.text(range.start.anchorId);
        if (!range.start.offset && /Backward$/.test(event.inputType)) { event.preventDefault(); this.merge(-1); return; }
        if (range.start.offset === text.length && /Forward$/.test(event.inputType)) { event.preventDefault(); this.merge(1); return; }
      }
      if (event.inputType === 'insertText' && event.data && this.state.format) { event.preventDefault(); this.insertStyledText(event.data); return; }
      if (!this.beginDraft(range.start.anchorId)) event.preventDefault();
    };
    const input = () => { this.capture(); if (!this.draft && this.range) this.beginDraft(this.range.start.anchorId, true); this.scheduleCommit(); };
    const compositionStart = () => { this.capture(); if (this.range) this.beginDraft(this.range.start.anchorId); this.clearTimer(); this.publish({ composing: true, suspended: true }); };
    const compositionEnd = () => { this.publish({ composing: false }); this.capture(); this.scheduleCommit(); };
    const paste = (event: ClipboardEvent) => { if (!this.callbacks?.readOnly) { event.preventDefault(); this.insertText(event.clipboardData?.getData('text/plain') ?? ''); } };
    const cut = (event: ClipboardEvent) => {
      if (this.callbacks?.readOnly) return;
      this.capture();
      if (!this.range || (samePoint(this.range.start, this.range.end) && !this.range.notes?.length)) return;
      event.preventDefault(); event.clipboardData?.setData('text/plain', shadowSelection(root)?.toString() ?? ''); this.insertText('');
    };
    const keydown = (event: KeyboardEvent) => {
      if (this.callbacks?.readOnly || event.isComposing) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (key === 'a') {
          event.preventDefault(); event.stopPropagation();
          if (!this.commit()) return;
          const blocks = this.range ? this.storyBlocks(this.range.start.anchorId).filter(block => block.dataset.rdvEditable === 'true') : [];
          const first = blocks[0]?.dataset.sourceAnchorId, last = blocks.at(-1)?.dataset.sourceAnchorId;
          if (first && last) { this.range = { start: { anchorId: first, offset: 0 }, end: { anchorId: last, offset: this.text(last).length }, backward: false }; this.restoreFocus = true; this.restore(); this.notifySelection(); }
        } else if (['b', 'i', 'u', 'z', 'y'].includes(key)) {
          event.preventDefault(); event.stopPropagation();
          if (!this.commit()) return;
          if (key === 'z' || key === 'y') this.callbacks?.onHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo');
          else this.callbacks?.onFormat(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline');
        } else if (key === 's') this.commit();
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'].includes(event.key)) {
        this.capture();
        if (this.commit() && event.key.startsWith('Arrow')) this.navigate(event);
      }
    };
    const focusOut = () => { queueMicrotask(() => { if (this.root === root && !this.ownsFocus()) { this.restoreFocus = false; this.commit(); } }); };
    root.addEventListener('pointerdown', pointerDown);
    root.addEventListener('click', click);
    root.addEventListener('beforeinput', beforeInput);
    root.addEventListener('input', input);
    root.addEventListener('compositionstart', compositionStart);
    root.addEventListener('compositionend', compositionEnd);
    root.addEventListener('paste', paste);
    root.addEventListener('cut', cut);
    root.addEventListener('keydown', keydown);
    root.addEventListener('keyup', selection);
    root.addEventListener('mouseup', selection);
    root.addEventListener('focusout', focusOut);
    root.ownerDocument.addEventListener('selectionchange', selection);
    const detach = () => {
      this.capture();
      if (viewport) this.scroll = { top: viewport.scrollTop, left: viewport.scrollLeft };
      root.removeEventListener('pointerdown', pointerDown); root.removeEventListener('click', click);
      root.removeEventListener('beforeinput', beforeInput); root.removeEventListener('input', input);
      root.removeEventListener('compositionstart', compositionStart); root.removeEventListener('compositionend', compositionEnd);
      root.removeEventListener('paste', paste); root.removeEventListener('cut', cut);
      root.removeEventListener('keydown', keydown); root.removeEventListener('keyup', selection); root.removeEventListener('mouseup', selection);
      root.removeEventListener('focusout', focusOut); root.ownerDocument.removeEventListener('selectionchange', selection);
      style.remove();
      if (this.root === root) { this.root = null; this.detach = null; }
    };
    this.detach = detach;
    return detach;
  }
}
