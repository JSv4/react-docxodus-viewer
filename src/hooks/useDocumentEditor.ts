import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { TrackedChangeMode } from 'docxodus/core';
import type { CharSpan, DocxSession, EditResult, FormatOp, ParagraphFormatOp, RunFormattingInfo } from 'docxodus/core';
import { documentBytes } from '../session';
import type { DocxSessionController } from '../session';
import type { DocumentTextSelection } from '../types';
import { useSessionQuery, useSessionState } from './useDocxSession';
import { editableText, replaceParagraphText } from '../editing/text';
import { CanvasEditor } from '../editing/CanvasEditor';

export interface EditorSelection {
  anchorId: string;
  /** Null formats the entire paragraph; a span formats only the selected characters. */
  span: CharSpan | null;
  text: string;
  version: number;
  /** A canvas caret changes the formatting of subsequent typing. */
  source?: 'canvas' | 'paragraph';
}
export interface UseDocumentEditorOptions { readOnly?: boolean; onError?: (error: Error) => void }
const styles = (session: DocxSession) => session.listStyles().filter(style => style.type === 'paragraph');
function assertResult(value: unknown) {
  for (const result of Array.isArray(value) ? value : [value]) {
    if (result && typeof result === 'object' && 'success' in result && !result.success) {
      const failure = result as EditResult & { failure?: { error: { message: string } } };
      throw new Error(failure.error?.message ?? failure.failure?.error.message ?? 'This change could not be applied.');
    }
  }
}

/** Shared selection and native commands for an editor, toolbar, or custom host layout. */
export function useDocumentEditor(controller: DocxSessionController, options: UseDocumentEditorOptions = {}) {
  const state = useSessionState(controller);
  const canvasEditor = useMemo(() => new CanvasEditor(controller), [controller]);
  const canvasState = useSyncExternalStore(canvasEditor.subscribe, canvasEditor.getSnapshot, canvasEditor.getSnapshot);
  useLayoutEffect(() => () => canvasEditor.dispose(), [canvasEditor]);
  const [picked, setPicked] = useState<{ owner: DocxSession; selection: EditorSelection } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; });
  const selection = picked?.owner === state.session ? picked?.selection ?? null : null;
  const selectionRef = useRef(selection);
  const selectionOwner = useRef<DocxSession | null>(null);
  useEffect(() => { selectionRef.current = selection; });
  const fail = useCallback((cause: unknown) => {
    const failure = cause instanceof Error ? cause : new Error(String(cause));
    setError(failure); setNotice(''); optionsRef.current.onError?.(failure); return false;
  }, []);
  const select = useCallback((anchorId: string, span: CharSpan | null = null, source: EditorSelection['source'] = 'paragraph') => {
    try {
      const snapshot = controller.getSnapshot();
      if (!snapshot.session) return false;
      const info = controller.read(session => session.getAnchorInfo(anchorId));
      if (!info || !['p', 'h', 'li'].includes(info.kind)) throw new Error('Choose a paragraph or heading to edit.');
      const text = controller.read(session => editableText(session.getFormatting(info.id)));
      if (span && (span.start < 0 || span.length < 0 || span.start + span.length > text.length)) throw new Error('Select text inside this paragraph.');
      const next = { anchorId: info.id, span, text, version: snapshot.version, source };
      if (selectionOwner.current === snapshot.session && JSON.stringify(selectionRef.current) === JSON.stringify(next)) return true;
      selectionRef.current = next;
      selectionOwner.current = snapshot.session;
      setPicked({ owner: snapshot.session, selection: next }); setError(null); setNotice(''); return true;
    } catch (cause) { return fail(cause); }
  }, [controller, fail]);
  const selectText = useCallback((selected: DocumentTextSelection | null) => {
    if (!selected) { selectionRef.current = null; setPicked(null); return; }
    const current = controller.getSnapshot();
    if (selected.documentVersion !== undefined && selected.documentVersion !== current.version) {
      selectionRef.current = null; setPicked(null); fail('The page is refreshing. Select the text again when it finishes.'); return;
    }
    try {
      const text = controller.read(session => editableText(session.getFormatting(selected.anchorId)));
      const spaces = (value: string) => value.replace(/\u00a0/g, ' ');
      if (spaces(text) !== spaces(selected.blockText)) throw new Error('This rendered selection includes generated content. Select the paragraph, or select its text in the text editor.');
      select(selected.anchorId, selected.span);
    } catch (cause) { selectionRef.current = null; setPicked(null); fail(cause); }
  }, [controller, select, fail]);
  const query = useCallback((session: DocxSession) => {
    if (!selection) return null;
    const info = session.getAnchorInfo(selection.anchorId);
    if (!info) return null;
    const formatting = session.getFormatting(info.id);
    return { info, formatting, text: editableText(formatting), list: session.getListMembership(info.id) };
  }, [selection]);
  const details = useSessionQuery(controller, query);
  const availableStyles = useSessionQuery(controller, styles);
  const runs = useMemo(() => {
    const all = details.data?.formatting?.runs ?? [];
    const span = selection?.span;
    if (!span) return all;
    if (!span.length) return [all.find(run => run.span.start < span.start && run.span.start + run.span.length >= span.start) ?? all[0]].filter(Boolean);
    return all.filter(run => run.span.start < span.start + span.length && run.span.start + run.span.length > span.start);
  }, [details.data, selection]);
  const formatValue = <K extends keyof RunFormattingInfo>(key: K): RunFormattingInfo[K] | 'mixed' => {
    const pending = canvasState.format as Partial<RunFormattingInfo> | null;
    if (selection?.source === 'canvas' && !selection.span?.length && pending?.[key] !== undefined) return pending[key];
    const values = runs.map(run => run.effective[key]);
    return values.every(value => value === values[0]) ? values[0] : 'mixed';
  };
  const run = useCallback((operation: (session: DocxSession, selection: EditorSelection | null) => unknown, needsSelection = true, selectCreated = false) => {
    try {
      if (optionsRef.current.readOnly) throw new Error('This editor is read-only.');
      if (!canvasEditor.beforeCommand()) return false;
      const snapshot = controller.getSnapshot();
      if (!snapshot.session || snapshot.isLoading) throw new Error('Wait for the document to finish opening.');
      const target = selectionRef.current;
      if (needsSelection) {
        if (!target) throw new Error('Select a paragraph or some text first.');
        if (selectionOwner.current !== snapshot.session || (target.version !== snapshot.version &&
          controller.read(session => editableText(session.getFormatting(target.anchorId))) !== target.text)) {
          throw new Error('The document changed. Select the text again before editing it.');
        }
      }
      const result = controller.run(session => operation(session, target));
      assertResult(result);
      const created = selectCreated && (result as EditResult).created?.find(anchor => ['p', 'h', 'li'].includes(anchor.kind));
      if (created) {
        select(created.id);
        if (target?.source === 'canvas') canvasEditor.selectCreated(created.id, target.anchorId);
      }
      else if (target) {
        // Style/list changes can change an anchor's kind while retaining its identity.
        const identity = target.anchorId.split(':').slice(1).join(':');
        const anchor = controller.read(session => Object.keys(session.project().anchorIndex).find(id => id.split(':').slice(1).join(':') === identity));
        if (anchor) {
          const text = controller.read(session => editableText(session.getFormatting(anchor)));
          const span = target.span && target.span.start + target.span.length <= text.length ? target.span : null;
          select(anchor, span, target.source);
        } else { selectionRef.current = null; setPicked(null); }
      }
      if (!created && target?.source === 'canvas') canvasEditor.afterCommand();
      setError(null); setNotice(result === false ? 'No further history in that direction.' : 'Change applied');
      return true;
    } catch (cause) { return fail(cause); }
  }, [controller, fail, select, canvasEditor]);
  const format = (op: FormatOp) => selectionRef.current?.source === 'canvas' && !selectionRef.current.span?.length && canvasEditor.selectedSpans().length === 1
    ? canvasEditor.setTypingFormat(op)
    : run((session, target) => target!.source === 'canvas' ? session.executeBatch(canvasEditor.selectedSpans().filter(({ span }) => span.length).map(({ anchorId, span }) => ({ tool: 'EditorToolbar', action: 'format selection', mutation: () => session.applyFormat(anchorId, span, op) }))) : session.applyFormat(target!.anchorId, target!.span?.length ? target!.span : null, op));
  const toggleFormat = (key: 'bold' | 'italic' | 'underline' | 'strike') => {
    if (!canvasEditor.beforeCommand()) return false;
    const target = selectionRef.current;
    if (target?.source === 'canvas' && !target.span?.length && canvasEditor.selectedSpans().length === 1) {
      const pending = canvasEditor.getSnapshot().format?.[key];
      const runs = controller.read(session => session.getFormatting(target.anchorId)?.runs ?? []);
      const run = runs.find(run => run.span.start < target.span!.start && run.span.start + run.span.length >= target.span!.start) ?? runs[0];
      return format({ [key]: !(pending ?? run?.effective[key]) });
    }
    if (target?.source === 'canvas') {
      const runs = controller.read(session => canvasEditor.selectedSpans().flatMap(({ anchorId, span }) => session.getFormatting(anchorId)?.runs.filter(run => run.span.start < span.start + span.length && run.span.start + run.span.length > span.start) ?? []));
      return format({ [key]: !runs.length || !runs.every(run => run.effective[key]) });
    }
    return run((session, target) => {
      const span = target!.span?.length ? target!.span : null;
      const runs = session.getFormatting(target!.anchorId)?.runs.filter(run => !span ||
        (run.span.start < span.start + span.length && run.span.start + run.span.length > span.start)) ?? [];
      return session.applyFormat(target!.anchorId, span, { [key]: !runs.length || !runs.every(run => run.effective[key]) });
    });
  };
  useLayoutEffect(() => { canvasEditor.configure({ readOnly: !!options.readOnly,
    onSelect: (anchor, span) => { select(anchor, span, 'canvas'); }, onError: fail,
    onHistory: direction => run(session => session[direction](), false), onFormat: toggleFormat,
  }); });
  const paragraph = (op: ParagraphFormatOp) => run((session, target) => session.setParagraphFormat(target!.anchorId, op));
  const insertImage = async (file: File) => {
    const owner = controller.getSnapshot().session;
    const target = selectionRef.current;
    setBusy(true);
    try {
      const bytes = await documentBytes(file);
      if (!owner || owner !== controller.getSnapshot().session || target !== selectionRef.current) throw new Error('The selection changed while the image was loading. Choose the location again.');
      return run((session, target) => session.insertImage(target!.anchorId, target!.span?.start ?? target!.text.length, bytes));
    } catch (cause) { return fail(cause); }
    finally { setBusy(false); }
  };
  return {
    controller, state, selection, canvasEditor, canvasState, details: details.data, styles: availableStyles.data ?? [],
    error: error ?? details.error ?? availableStyles.error, notice, busy,
    readOnly: !!options.readOnly, ready: !!state.session && !state.isLoading,
    canEdit: !!selection && !!state.session && !state.isLoading && !options.readOnly && !busy,
    selectAnchor: (anchorId: string) => select(anchorId), select, selectText, formatValue,
    viewerProps: { session: controller, canvasEditor: options.readOnly ? undefined : canvasEditor, selectedAnchorId: selection?.anchorId, onAnchorSelect: (id: string) => select(id), onTextSelectionChange: selectText, allowRevisionResolution: !options.readOnly },
    format, paragraph, toggleFormat,
    setStyle: (styleId: string) => run((session, target) => session.setParagraphStyle(target!.anchorId, styleId)),
    setList: (kind: 'bullet' | 'decimal' | 'none') => run((session, target) => session.applyListFormat(target!.anchorId, kind)),
    indent: (direction: -1 | 1) => details.data?.list ? run((session, target) => session.setListLevel(target!.anchorId, direction)) : paragraph({ indentDelta: direction * 720 }),
    undo: () => run(session => session.undo(), false), redo: () => run(session => session.redo(), false),
    trackChanges: (enabled: boolean) => run(session => session.setTrackedChanges(enabled ? TrackedChangeMode.RenderInline : TrackedChangeMode.Accept), false),
    replaceText: (before: string, after: string) => run((session, target) => replaceParagraphText(session, target!.anchorId, before, after)),
    insertParagraph: () => run((session, target) => session.splitParagraph(target!.anchorId, target!.text.length), true, true),
    insertTable: (rows: number, columns: number) => run((session, target) => session.insertTable(target!.anchorId, 'after', rows, columns)),
    insertImage,
    addLink: (url: string) => run((session, target) => {
      if (!target!.span?.length) throw new Error('Select the text for your link first.');
      const parsed = new URL(url);
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) throw new Error('Use an https, http, or mailto link.');
      return session.addHyperlink(target!.anchorId, target!.span!, 'external', url);
    }),
    clearError: () => setError(null),
  };
}

export type DocumentEditorState = ReturnType<typeof useDocumentEditor>;
