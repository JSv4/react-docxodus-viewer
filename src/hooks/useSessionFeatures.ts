import { useCallback, useMemo } from 'react';
import type { CharSpan, DocxSession } from 'docxodus/core';
import type { DocxSessionController } from '../session';
import { useSessionQuery } from './useDocxSession';
import { editableText } from '../editing/text';

export type SessionMethod = {
  [K in keyof DocxSession]-?: DocxSession[K] extends (...args: never[]) => unknown ? K : never
}[keyof DocxSession];

/** Bind any subset of the complete synchronous API to an observed React session. */
export function useSessionCommands<K extends SessionMethod>(controller: DocxSessionController, names: readonly K[]): Pick<DocxSession, K> {
  const key = names.join('\n');
  return useMemo(() => Object.fromEntries(key.split('\n').filter(Boolean).map(name => [name, (...args: unknown[]) =>
    controller.run(session => Reflect.apply(session[name as K], session, args)),
  ])) as Pick<DocxSession, K>, [controller, key]);
}

const listComments = (session: DocxSession) => session.listComments();
const listAnnotations = (session: DocxSession) => session.listAnnotations();
const listImages = (session: DocxSession) => session.listImages();
const listContentControls = (session: DocxSession) => session.listContentControls();
const project = (session: DocxSession) => session.project();

export function useDocumentComments(controller: DocxSessionController) {
  const query = useSessionQuery(controller, listComments);
  const commands = useSessionCommands(controller, ['addComment', 'addCommentToRevision', 'addCommentReply', 'updateComment', 'setCommentResolved', 'removeComment'] as const);
  return { comments: query.data ?? [], error: query.error, ...commands };
}

export interface SelectionTarget { anchorId: string; span: CharSpan | null; text: string }
/** The exact text a comment or annotation will attach to: the selected span, or the whole block. */
export function useSelectionTarget(controller: DocxSessionController, anchorId?: string, span?: CharSpan | null): SelectionTarget | null {
  const start = span?.length ? span.start : undefined, length = span?.length || undefined;
  const selector = useCallback((session: DocxSession): SelectionTarget | null => {
    if (!anchorId) return null;
    let text: string | null = null;
    try { text = editableText(session.getFormatting(anchorId)); } catch { /* Tables and other blocks have no native run text. */ }
    const target = start !== undefined && length !== undefined && text !== null && start + length <= text.length ? { start, length } : null;
    const preview = text ?? session.getAnchorInfo(anchorId)?.textPreview ?? '';
    return { anchorId, span: target, text: target ? preview.slice(target.start, target.start + target.length) : preview };
  }, [anchorId, start, length]);
  return useSessionQuery(controller, selector).data ?? null;
}

export function useSessionAnnotations(controller: DocxSessionController): Pick<DocxSession, 'addAnnotation' | 'removeAnnotation' | 'updateAnnotation' | 'moveAnnotation' | 'findByAnnotation' | 'findByLabel'> & { annotations: ReturnType<DocxSession['listAnnotations']>; error: Error | null } {
  const query = useSessionQuery(controller, listAnnotations);
  const commands = useSessionCommands(controller, ['addAnnotation', 'removeAnnotation', 'updateAnnotation', 'moveAnnotation', 'findByAnnotation', 'findByLabel'] as const);
  return { annotations: query.data ?? [], error: query.error, ...commands };
}

export function useDocumentImages(controller: DocxSessionController) {
  const query = useSessionQuery(controller, listImages);
  const commands = useSessionCommands(controller, ['getImageCapabilities', 'insertImage', 'replaceImage', 'setImageDimensions', 'setImageMetadata', 'setImageFloatingLayout', 'removeImage'] as const);
  return { images: query.data ?? [], error: query.error, ...commands };
}

export function useContentControls(controller: DocxSessionController) {
  const query = useSessionQuery(controller, listContentControls);
  const commands = useSessionCommands(controller, ['fillContentControlText', 'fillContentControlRichText', 'setContentControlChecked', 'setContentControlDate', 'selectContentControlItem', 'fillContentControlPicture', 'addRepeatingSectionItem', 'removeRepeatingSectionItem'] as const);
  return { controls: query.data ?? [], error: query.error, ...commands };
}

export function useDocumentProjection(controller: DocxSessionController): Pick<DocxSession, 'projectAnchor' | 'findByText' | 'findAllByText' | 'findByRegex' | 'findByKind' | 'findByBookmark' | 'findByAnnotation' | 'findByLabel' | 'grep' | 'grepCrossBlock' | 'findPlaceholders' | 'getAnchorInfo' | 'getAnchorInfos' | 'getBlockMetadata' | 'getBlockMetadatas'> & { projection: ReturnType<DocxSession['project']> | null; error: Error | null } {
  const query = useSessionQuery(controller, project);
  const commands = useSessionCommands(controller, ['projectAnchor', 'findByText', 'findAllByText', 'findByRegex', 'findByKind', 'findByBookmark', 'findByAnnotation', 'findByLabel', 'grep', 'grepCrossBlock', 'findPlaceholders', 'getAnchorInfo', 'getAnchorInfos', 'getBlockMetadata', 'getBlockMetadatas'] as const);
  return { projection: query.data, error: query.error, ...commands };
}
