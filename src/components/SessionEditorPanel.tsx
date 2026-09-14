import { useCallback, useState } from 'react';
import { TrackedChangeMode } from 'docxodus/core';
import type { DocxSession, EditResult } from 'docxodus/core';
import { documentBytes } from '../session';
import type { DocxSessionController } from '../session';
import { useSessionQuery, useSessionState } from '../hooks/useDocxSession';
import { useDocumentImages, useContentControls } from '../hooks/useSessionFeatures';
import { Icon } from './Icon';

export interface SessionEditorPanelProps { session: DocxSessionController; anchorId?: string; onAnchorSelect?: (anchorId: string) => void }

/** Small form-based editing surface. Hosts can compose the same session API into their own UI. */
export function SessionEditorPanel({ session: controller, anchorId, onAnchorSelect }: SessionEditorPanelProps) {
  const state = useSessionState(controller);
  const selectAnchors = useCallback(() => controller.getAnchorCatalog(), [controller]);
  const inventory = useSessionQuery(controller, selectAnchors, { scope: 'document' });
  const images = useDocumentImages(controller);
  const controls = useContentControls(controller);
  const styles = useCallback(() => controller.getStyles(), [controller]);
  const styleList = useSessionQuery(controller, styles, { scope: 'document' });
  const [picked, setPicked] = useState('');
  const [draft, setDraft] = useState<{ anchor: string; value: string } | null>(null);
  const [find, setFind] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [controlValue, setControlValue] = useState('');
  const anchors = Object.entries(inventory.data ?? {}).map(([id, value]) => ({ ...value, id }));
  const proposed = anchorId ?? picked;
  const anchor = anchors.some(value => value.id === proposed) ? proposed : anchors.find(value => value.kind === 'p')?.id ?? '';
  const selectInfo = useCallback((session: DocxSession) => anchor ? session.getAnchorInfo(anchor) : null, [anchor]);
  const info = useSessionQuery(controller, selectInfo, { scope: 'document' });
  const text = draft?.anchor === anchor ? draft.value : info.data?.visibleText ?? '';
  const setText = (value: string) => setDraft({ anchor, value });
  const apply = (operation: (session: DocxSession) => unknown, refreshContent = false) => {
    try {
      const value = controller.run(operation);
      const outcomes = Array.isArray(value) ? value : [value];
      const failure = outcomes.find((entry): entry is EditResult => entry && typeof entry === 'object' && 'success' in entry && !entry.success);
      if (failure) throw new Error(failure.error?.message ?? 'The operation could not be completed.');
      setError(null); setResult(value);
      if (refreshContent) setDraft(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const upload = async (file: File, operation: (session: DocxSession, bytes: Uint8Array) => EditResult) => {
    const current = state.session;
    try {
      const bytes = await documentBytes(file);
      if (!current || current !== controller.getSnapshot().session) throw new Error('The document changed while the image was loading.');
      apply(session => operation(session, bytes));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <section className="rdv-feature-panel rdv-editor-panel" aria-label="Edit document"><div className="rdv-panel-heading"><span>MAKE IT YOURS</span><h3>Edit document</h3><p>Select a paragraph on the page, then shape the next version here.</p></div>
    {!state.session ? <p>Open a document to edit its blocks.</p> : <>
      <label className="rdv-block-picker">Selected block<select value={anchor} onChange={event => { setPicked(event.target.value); onAnchorSelect?.(event.target.value); }}>{anchors.map(value => <option key={value.id} value={value.id}>{value.kind} · {value.textPreview || value.scope}</option>)}</select></label>
      <div className="rdv-editor-toolbar"><div className="rdv-review-actions"><button type="button" onClick={() => apply(session => session.undo(), true)}><Icon name="undo" size={14} />Undo</button><button type="button" onClick={() => apply(session => session.redo(), true)}><Icon name="redo" size={14} />Redo</button></div><label>Track edits<select value={state.trackedChanges} onChange={event => apply(session => session.setTrackedChanges(Number(event.target.value)))}><option value={TrackedChangeMode.Accept}>Off</option><option value={TrackedChangeMode.RenderInline}>Track changes</option><option value={TrackedChangeMode.StripDeletions}>Strip deletions</option></select></label></div>
      <label className="rdv-content-editor">Paragraph content<textarea aria-label="Markdown content" value={text} placeholder="Write your next version…" onChange={event => setText(event.target.value)} /></label>
      <p className="rdv-field-hint">Markdown formatting is supported.</p>
      <div className="rdv-edit-actions"><button className="rdv-primary-action" type="button" aria-label="Replace selected block" disabled={!anchor} onClick={() => apply(session => session.replaceText(anchor, text), true)}>Apply to paragraph<Icon name="arrow" size={15} /></button><button type="button" aria-label="Insert paragraph after" disabled={!anchor} onClick={() => apply(session => session.insertParagraph(anchor, 'after', text))}><Icon name="plus" size={14} />Insert after</button><button className="rdv-delete-block" type="button" disabled={!anchor} onClick={() => apply(session => session.deleteBlock(anchor), true)}>Delete selected block</button></div>
      <details><summary>Search, replace and templates</summary><label>Find text or pattern<input value={find} onChange={event => setFind(event.target.value)} /></label><div className="rdv-review-actions"><button type="button" onClick={() => apply(session => session.findAllByText(find))}>Find all</button><button type="button" onClick={() => apply(session => session.grep(find))}>Find pattern</button><button type="button" onClick={() => apply(session => session.grepCrossBlock(find))}>Find across blocks</button><button type="button" onClick={() => apply(session => session.replaceTextRange(anchor, find, text))}>Replace matches in block</button><button type="button" onClick={() => apply(session => session.findPlaceholders())}>Find placeholders</button><button type="button" onClick={() => apply(session => session.fillPlaceholders(placeholder => placeholder.hint === find ? text : null))}>Fill matching placeholders</button></div></details>
      <details><summary>Formatting and lists</summary><div className="rdv-review-actions"><button type="button" onClick={() => apply(session => session.applyFormat(anchor, null, { bold: true }))}>Bold block</button><button type="button" onClick={() => apply(session => session.applyFormat(anchor, null, { italic: true }))}>Italic block</button><button type="button" onClick={() => apply(session => session.applyListFormat(anchor, 'bullet'))}>Bulleted list</button><button type="button" onClick={() => apply(session => session.applyListFormat(anchor, 'decimal'))}>Numbered list</button><button type="button" onClick={() => apply(session => session.removeListMembership(anchor))}>Remove list</button><button type="button" onClick={() => apply(session => session.getFormatting(anchor))}>Inspect formatting</button></div><label>Paragraph style<select defaultValue="" onChange={event => event.target.value && apply(session => session.setParagraphStyle(anchor, event.target.value))}><option value="">Choose a style</option>{styleList.data?.map(style => <option value={style.id} key={style.id}>{style.name}</option>)}</select></label></details>
      <details><summary>Tables</summary><p>Select a table cell for row and column operations.</p><div className="rdv-review-actions"><button type="button" onClick={() => apply(session => session.insertTable(anchor, 'after', 2, 2))}>Insert 2 × 2 table</button><button type="button" onClick={() => apply(session => session.insertTableRow(anchor, 'after'))}>Insert row</button><button type="button" onClick={() => apply(session => session.insertTableColumn(anchor, 'after'))}>Insert column</button><button type="button" onClick={() => apply(session => session.deleteTableRow(anchor))}>Delete row</button><button type="button" onClick={() => apply(session => session.deleteTableColumn(anchor))}>Delete column</button><button type="button" onClick={() => apply(session => session.replaceCellContent(anchor, text))}>Replace cell</button><button type="button" onClick={() => apply(session => session.mergeCells(anchor, 1, 2))}>Merge two cells</button><button type="button" onClick={() => apply(session => session.unmergeCells(anchor))}>Unmerge cell</button></div></details>
      <details><summary>Page setup, fields and notes</summary><p>The content field supplies header, footer and note text.</p><div className="rdv-review-actions"><button type="button" onClick={() => apply(session => session.setHeaderText(anchor, 'default', text))}>Set header</button><button type="button" onClick={() => apply(session => session.setFooterText(anchor, 'default', text))}>Set footer</button><button type="button" onClick={() => apply(session => session.setPageSetup(anchor, { landscape: true }))}>Landscape</button><button type="button" onClick={() => apply(session => session.setPageSetup(anchor, { landscape: false }))}>Portrait</button><button type="button" onClick={() => apply(session => session.insertPageNumberField(anchor))}>Insert page number</button><button type="button" onClick={() => apply(session => session.insertTableOfContents(anchor))}>Insert table of contents</button><button type="button" onClick={() => apply(session => session.insertFootnote(anchor, 0, text))}>Insert footnote</button><button type="button" onClick={() => apply(session => session.insertEndnote(anchor, 0, text))}>Insert endnote</button></div></details>
      <details><summary>Images ({images.images.length})</summary><label>Insert image at start of selected block<input type="file" accept="image/png,image/jpeg,image/gif,image/bmp,image/tiff,image/svg+xml" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, (session, bytes) => session.insertImage(anchor, 0, bytes)); event.target.value = ''; }} /></label>{images.images.map(image => <article key={image.id}><p>{image.id}</p><label>Replace image<input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, (session, bytes) => session.replaceImage(image.id, bytes)); event.target.value = ''; }} /></label><div className="rdv-review-actions"><button type="button" onClick={() => apply(session => session.setImageMetadata(image.id, text, null))}>Set alt text</button><button type="button" onClick={() => apply(session => session.setImageDimensions(image.id, { widthPoints: 144, heightPoints: 144 }))}>Resize to 2 inches</button><button type="button" onClick={() => apply(session => session.removeImage(image.id))}>Remove image</button></div></article>)}</details>
      <details><summary>Content controls ({controls.controls.length})</summary><label>Control value<input value={controlValue} onChange={event => setControlValue(event.target.value)} /></label>{controls.controls.map(control => <article key={control.anchorId}><strong>{control.alias || control.tag || control.type}</strong><p>{control.text}</p>{control.unsupportedReason && <p>{control.unsupportedReason}</p>}<div className="rdv-review-actions"><button type="button" disabled={!control.canMutate} onClick={() => apply(session => session.fillContentControlText(control.anchorId, controlValue))}>Fill text</button><button type="button" disabled={!control.canMutate} onClick={() => apply(session => session.fillContentControlRichText(control.anchorId, controlValue))}>Fill rich text</button><button type="button" disabled={!control.canMutate} onClick={() => apply(session => session.setContentControlChecked(control.anchorId, controlValue.toLowerCase() === 'true'))}>Set checkbox</button><button type="button" disabled={!control.canMutate} onClick={() => apply(session => session.setContentControlDate(control.anchorId, controlValue))}>Set date</button>{control.itemValues.map(value => <button type="button" key={value} disabled={!control.canMutate} onClick={() => apply(session => session.selectContentControlItem(control.anchorId, value))}>{value}</button>)}</div></article>)}</details>
      <details><summary>Preview and verification</summary><div className="rdv-review-actions"><button type="button" onClick={() => apply(session => session.previewBatch([{ tool: 'replaceText', action: 'Preview replacement', mutation: shadow => shadow.replaceText(anchor, text) }], 'atomic', { html: 'full' }))}>Preview replacement</button><button type="button" onClick={() => apply(session => session.getSemanticChanges())}>Semantic changes</button><button type="button" onClick={() => apply(session => session.getEditSummary())}>Edit summary</button><button type="button" onClick={() => apply(session => session.verifyDeliverable())}>Verify session</button></div></details>
    </>}
    {error && <p role="alert">{error}</p>}
    {result != null && !error && <div className="rdv-operation-notice" role="status"><Icon name="check" size={14} />Operation completed</div>}
    {result != null && <details className="rdv-operation-details"><summary>Operation details</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>}
  </section>;
}
