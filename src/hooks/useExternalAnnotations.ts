import { useCallback, useState } from 'react';
import type { ConversionOptions, ExternalAnnotationProjectionSettings, ExternalAnnotationSet } from 'docxodus/core';
import type { DocumentSource } from '../session';
import { useDocxodusApi } from './useDocxodusApi';
import { useAsyncOperation } from './useAsyncOperation';

/** External offsets and labels remain host-owned; projection does not modify DOCX bytes. */
export function useExternalAnnotations(wasmBasePath?: string) {
  const { call } = useDocxodusApi({ wasmBasePath });
  const [annotationSet, setAnnotationSet] = useState<ExternalAnnotationSet | null>(null);
  const task = useAsyncOperation<unknown>();
  const { run } = task;
  const create = useCallback((document: DocumentSource, documentId: string) => run(async signal => {
    const [result, embedded] = await Promise.all([call('createExternalAnnotationSet', document, documentId), call('getAnnotations', document)]);
    // The engine includes embedded annotations but leaves their label definitions to hosts.
    for (const annotation of embedded) result.textLabels[annotation.labelId] ??= {
      id: annotation.labelId, text: annotation.label, color: annotation.color,
      description: '', icon: '', labelType: 'text',
    };
    if (!signal.aborted) setAnnotationSet(result);
    return result;
  }) as Promise<ExternalAnnotationSet>, [call, run]);
  return {
    annotationSet, setAnnotationSet: (set: ExternalAnnotationSet | null) => { task.cancel(); setAnnotationSet(set); }, create, isBusy: task.isRunning, error: task.error,
    validate: (document: DocumentSource, set = annotationSet) => run(async () => {
      if (!set) throw new Error('Create or load an annotation set first.');
      return call('validateExternalAnnotations', document, set);
    }),
    project: (document: DocumentSource, conversion?: ConversionOptions, projection?: ExternalAnnotationProjectionSettings, set = annotationSet) => run(async () => {
      if (!set) throw new Error('Create or load an annotation set first.');
      return call('convertDocxToHtmlWithExternalAnnotations', document, set, conversion, projection);
    }) as Promise<string>,
    search: (...args: Parameters<typeof import('docxodus/core').searchTextOffsets>) => call('searchTextOffsets', ...args),
    exportOpenContracts: (document: DocumentSource) => call('exportToOpenContract', document),
    call,
  };
}
