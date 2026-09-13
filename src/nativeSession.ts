import { DocxSession, getWasmExports } from 'docxodus/core';
import type { DocxSessionSettings, EditorRenderOptions } from 'docxodus/core';

/** One handle for both the public editing API and the native editor's render bridge. */
export function openNativeSession(bytes: Uint8Array, settings: DocxSessionSettings) {
  const bridge = getWasmExports().DocxSessionBridge;
  const handle = bridge.OpenSession(bytes, JSON.stringify(settings));
  const session = new DocxSession(handle, bridge);
  return {
    session,
    anchorIndex: (): ReturnType<DocxSession['project']>['anchorIndex'] => bridge.ListAnchors
      ? JSON.parse(bridge.ListAnchors(handle)).anchorIndex : session.project().anchorIndex,
    renderBlocks: (ids: readonly string[], options: EditorRenderOptions): Record<string, string | null> | null => {
      if (!bridge.RenderEditorBlocksHtml) return null;
      const result = JSON.parse(bridge.RenderEditorBlocksHtml(handle, JSON.stringify(ids), JSON.stringify(options)));
      return result.error ? null : result;
    },
  };
}

export type NativeSession = ReturnType<typeof openNativeSession>;
