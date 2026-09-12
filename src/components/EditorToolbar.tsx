import { useEffect, useRef, useState } from 'react';
import { TrackedChangeMode } from 'docxodus/core';
import type { CSSProperties, ReactNode } from 'react';
import type { ParagraphFormatOp } from 'docxodus/core';
import type { DocumentEditorState } from '../hooks/useDocumentEditor';
import { Icon } from './Icon';

export type EditorToolbarGroup = 'history' | 'font' | 'paragraph' | 'insert' | 'review';
export interface EditorToolbarProps {
  editor: DocumentEditorState;
  groups?: EditorToolbarGroup[];
  /** Commit a host's pending text draft before applying a document command. */
  beforeAction?: () => boolean;
  onEditText?: () => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}
const allGroups: EditorToolbarGroup[] = ['history', 'font', 'paragraph', 'insert', 'review'];
const fonts = ['Arial', 'Aptos', 'Calibri', 'Cambria', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'];
const sizes = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

/** Word-style native formatting commands, independent of the page or studio layout. */
export function EditorToolbar({ editor, groups = allGroups, beforeAction, onEditText, className = '', style, children }: EditorToolbarProps) {
  const [dialog, setDialog] = useState<'link' | 'table' | null>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('https://');
  const [rows, setRows] = useState(2);
  const [columns, setColumns] = useState(2);
  useEffect(() => { if (dialog) { const element = modal.current!; element.showModal(); return () => element.close(); } }, [dialog]);
  const act = (command: () => boolean) => (!beforeAction || beforeAction()) && command();
  const has = (group: EditorToolbarGroup) => groups.includes(group);
  const disabled = !editor.canEdit;
  const historyDisabled = !editor.ready || editor.readOnly || editor.busy;
  const value = editor.formatValue;
  const family = value('fontFamily');
  const size = value('fontSizePts');
  const alignment = editor.details?.formatting?.effectiveParagraph.alignment ?? 'left';
  const pformat = editor.details?.formatting?.effectiveParagraph;
  const color = value('color');
  const button = (label: string, content: ReactNode, command: () => boolean, pressed?: boolean | 'mixed', unavailable = disabled) => <button type="button" title={label} aria-label={label} aria-pressed={pressed} disabled={unavailable} onMouseDown={event => event.preventDefault()} onClick={() => act(command)}>{content}</button>;
  return <div className={`rdv-format-toolbar ${className}`} style={style} role="toolbar" aria-label="Document formatting">
    {has('history') && <div className="rdv-format-group" role="group" aria-label="Editing history">
      {button('Undo', <Icon name="undo" size={16} />, editor.undo, undefined, historyDisabled)}
      {button('Redo', <Icon name="redo" size={16} />, editor.redo, undefined, historyDisabled)}
      {onEditText && <button type="button" className="rdv-tool-text" disabled={disabled} onClick={onEditText} title="Edit paragraph text"><Icon name="edit" size={15} />Edit text</button>}
    </div>}
    {has('font') && <>
      <div className="rdv-format-group" role="group" aria-label="Styles and fonts">
        <select aria-label="Paragraph style" title="Paragraph style" className="rdv-style-select" disabled={disabled} value={pformat?.styleId ?? ''} onChange={event => act(() => editor.setStyle(event.target.value))}><option value="" disabled>Paragraph style</option>{editor.styles.map(style => <option value={style.id} key={style.id}>{style.name}</option>)}</select>
        <select aria-label="Font family" title="Font family" className="rdv-font-select" disabled={disabled} value={family ?? ''} onChange={event => act(() => editor.format({ fontFamily: event.target.value }))}><option value="">Document font</option>{family === 'mixed' && <option value="mixed" disabled>Mixed fonts</option>}{typeof family === 'string' && family !== 'mixed' && !fonts.includes(family) && <option>{family}</option>}{fonts.map(font => <option key={font}>{font}</option>)}</select>
        <select aria-label="Font size" title="Font size in points" className="rdv-size-select" disabled={disabled} value={size ?? ''} onChange={event => act(() => editor.format({ fontSizePts: Number(event.target.value) }))}><option value="" disabled>Size</option>{size === 'mixed' && <option value="mixed" disabled>Mixed</option>}{typeof size === 'number' && !sizes.includes(size) && <option>{size}</option>}{sizes.map(size => <option key={size} value={size}>{size}</option>)}</select>
      </div>
      <div className="rdv-format-group" role="group" aria-label="Character formatting">
        {(['bold', 'italic', 'underline', 'strike'] as const).map(key => <span key={key}>{button(({ bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strikethrough' })[key], <span className={`rdv-glyph-${key}`}>{({ bold: 'B', italic: 'I', underline: 'U', strike: 'S' })[key]}</span>, () => editor.toggleFormat(key), value(key) === 'mixed' ? 'mixed' : value(key) === true)}</span>)}
        {button('Superscript', <span>x<sup>2</sup></span>, () => editor.format({ vertAlign: value('vertAlign') === 'superscript' ? '' : 'superscript' }), value('vertAlign') === 'superscript')}
        {button('Subscript', <span>x<sub>2</sub></span>, () => editor.format({ vertAlign: value('vertAlign') === 'subscript' ? '' : 'subscript' }), value('vertAlign') === 'subscript')}
        <label className="rdv-color-tool" title="Text color"><span>A</span><input aria-label="Text color" type="color" disabled={disabled} value={typeof color === 'string' && /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : '#35432c'} onChange={event => act(() => editor.format({ color: event.target.value.slice(1) }))} /></label>
        <select className="rdv-highlight-select" aria-label="Text highlight" title="Text highlight" disabled={disabled} value={value('highlight') ?? 'none'} onChange={event => act(() => editor.format({ highlight: event.target.value }))}><option value="none">Highlight</option>{value('highlight') === 'mixed' && <option value="mixed" disabled>Mixed</option>}{['yellow', 'green', 'cyan', 'magenta', 'blue', 'red', 'darkBlue', 'darkCyan', 'darkGreen', 'darkMagenta', 'darkRed', 'darkYellow', 'darkGray', 'lightGray', 'black', 'white'].map(color => <option value={color} key={color}>{color}</option>)}</select>
        {button('Clear character formatting', <Icon name="clearFormat" size={17} />, () => editor.format({ bold: false, italic: false, underline: false, strike: false, color: 'auto', fontFamily: '', fontSizePts: 0, highlight: 'none', vertAlign: '', runStyle: '', caps: false, smallCaps: false }))}
      </div>
    </>}
    {has('paragraph') && <div className="rdv-format-group" role="group" aria-label="Paragraph formatting">
      {(['left', 'center', 'right', 'justify'] as const).map(align => <span key={align}>{button(`Align ${align}`, <Icon name={align === 'left' ? 'alignLeft' : align === 'center' ? 'alignCenter' : align === 'right' ? 'alignRight' : 'alignJustify'} size={17} />, () => editor.paragraph({ alignment: align as ParagraphFormatOp['alignment'] }), alignment === align)}</span>)}
      {button('Bulleted list', <Icon name="review" size={17} />, () => editor.setList(editor.details?.list?.format === 'bullet' ? 'none' : 'bullet'), editor.details?.list?.format === 'bullet')}
      {button('Numbered list', <Icon name="orderedList" size={17} />, () => editor.setList(editor.details?.list?.format === 'decimal' ? 'none' : 'decimal'), editor.details?.list?.format === 'decimal')}
      {button('Decrease indent', <Icon name="outdent" size={17} />, () => editor.indent(-1))}
      {button('Increase indent', <Icon name="indent" size={17} />, () => editor.indent(1))}
      <select aria-label="Line spacing" title="Line spacing" disabled={disabled} value={pformat?.lineSpacingRule === 'auto' ? pformat.lineSpacing ?? 240 : ''} onChange={event => act(() => editor.paragraph({ lineSpacing: Number(event.target.value), lineSpacingRule: 'auto' }))}><option value="" disabled>Spacing</option>{![240, 276, 360, 480].includes(pformat?.lineSpacing ?? 240) && <option value={pformat?.lineSpacing}>{((pformat?.lineSpacing ?? 240) / 240).toFixed(2)}</option>}<option value="240">1.0</option><option value="276">1.15</option><option value="360">1.5</option><option value="480">2.0</option></select>
    </div>}
    {has('insert') && <div className="rdv-format-group" role="group" aria-label="Insert into document">
      <button type="button" aria-label="Insert link" title="Insert link" disabled={disabled || !editor.selection?.span?.length} onClick={() => setDialog('link')}><Icon name="link" size={17} /></button>
      <button type="button" aria-label="Insert table" title="Insert table" disabled={disabled} onClick={() => setDialog('table')}><Icon name="table" size={17} /></button>
      <button type="button" aria-label="Insert image" title="Insert image" disabled={disabled} onClick={() => { if (!beforeAction || beforeAction()) imageInput.current?.click(); }}><Icon name="image" size={17} /></button>
      <input ref={imageInput} aria-label="Choose image" className="rdv-editor-file-input" type="file" accept="image/png,image/jpeg,image/gif,image/bmp,image/tiff,image/svg+xml" onChange={event => { const file = event.target.files?.[0]; if (file) void editor.insertImage(file); event.target.value = ''; }} />
      {button('Insert paragraph after', <Icon name="plus" size={16} />, editor.insertParagraph)}
      {button('Page break before', <Icon name="pageBreak" size={17} />, () => editor.paragraph({ pageBreakBefore: !pformat?.pageBreakBefore }), !!pformat?.pageBreakBefore)}
    </div>}
    {has('review') && <div className="rdv-format-group" role="group" aria-label="Track changes">{button('Track changes', <><Icon name="edit" size={15} /><span className="rdv-tool-caption">Track</span></>, () => editor.trackChanges(editor.state.trackedChanges !== TrackedChangeMode.RenderInline), editor.state.trackedChanges === TrackedChangeMode.RenderInline, historyDisabled)}</div>}
    {children}
    {dialog && <dialog ref={modal} className="rdv-editor-dialog" aria-label={dialog === 'link' ? 'Insert hyperlink' : 'Insert table'} onCancel={() => setDialog(null)}><form onSubmit={event => { event.preventDefault(); const success = act(() => dialog === 'link' ? editor.addLink(url) : editor.insertTable(rows, columns)); if (success) setDialog(null); }}><h3>{dialog === 'link' ? 'Link selected text' : 'Insert a table'}</h3>{dialog === 'link' ? <label>Link address<input autoFocus value={url} onChange={event => setUrl(event.target.value)} type="url" required /></label> : <div className="rdv-editor-dialog-grid"><label>Rows<input autoFocus type="number" min="1" max="20" value={rows} required onChange={event => setRows(Number(event.target.value))} /></label><label>Columns<input type="number" min="1" max="20" value={columns} required onChange={event => setColumns(Number(event.target.value))} /></label></div>}{editor.error && <p role="alert">{editor.error.message}</p>}<footer><button type="button" onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="rdv-editor-primary" disabled={!editor.canEdit}>Insert</button></footer></form></dialog>}
  </div>;
}
