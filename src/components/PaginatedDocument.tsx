import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { PaginationEngine, clearPageCitationHighlight, navigateToPageCitation } from 'docxodus/core';
import type { DocxSession, PageCitation, PaginationOptions, PaginationResult } from 'docxodus/core';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { paragraphSelector, readTextSelection, shadowSelection } from '../editing/selection';
import type { DocumentTextSelection } from '../types';
import type { CanvasEditor } from '../editing/CanvasEditor';
import { canvasParagraphs } from '../editing/canvasDom';
import type { LiveBlockUpdate } from '../rendering/liveBlocks';
import { replaceBlockPresentation } from '../rendering/liveBlocks';
import { cooperativePagination, yieldToBrowser } from '../rendering/cooperativePagination';

export interface PaginatedDocumentProps extends Pick<PaginationOptions, 'scale' | 'showPageNumbers' | 'pageGap' | 'cssPrefix' | 'fragmentParagraphs' | 'layoutToken'> {
  html: string;
  canvasEditor?: CanvasEditor;
  canvasOwner?: DocxSession | null;
  liveBlocks?: LiveBlockUpdate;
  /** Internal source version, also available when portable citations are disabled. */
  sourceVersion?: number;
  backgroundColor?: string;
  className?: string;
  style?: CSSProperties;
  citation?: PageCitation;
  onPaginationComplete?: (result: PaginationResult) => void;
  onPageVisible?: (page: number) => void;
  onError?: (error: Error) => void;
  onAnchorSelect?: (anchorId: string) => void;
  onTextSelectionChange?: (selection: DocumentTextSelection | null) => void;
  selectedAnchorId?: string;
  /** The document's isolated DOM, for anchor/page navigation. */
  onRootChange?: (root: HTMLElement | null) => void;
}

function adaptRootSelectors(rules: CSSRuleList) {
  for (const rule of Array.from(rules)) {
    if ('selectorText' in rule) {
      const style = rule as CSSStyleRule;
      style.selectorText = style.selectorText.replace(/:root\b/g, '.rdv-document-html').replace(/(^|[\s>+~,(])(html|body)(?=[\s>+~,.#:[)]|$)/g, '$1.rdv-document-$2');
    } else if ('cssRules' in rule) adaptRootSelectors((rule as CSSGroupingRule).cssRules);
  }
}

/** A viewer may stay mounted inside a hidden tab while conversion finishes. */
function waitForLayout(element: HTMLElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let observer: ResizeObserver | undefined;
    let frame: number | undefined;
    const cleanup = () => {
      observer?.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => { cleanup(); reject(new DOMException('Pagination cancelled', 'AbortError')); };
    const check = () => {
      if (element.getBoundingClientRect().width <= 0) return false;
      cleanup(); resolve(); return true;
    };
    if (signal.aborted) { abort(); return; }
    if (check()) return;
    signal.addEventListener('abort', abort, { once: true });
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(check);
      observer.observe(element);
    } else {
      const poll = () => { if (!check()) frame = requestAnimationFrame(poll); };
      frame = requestAnimationFrame(poll);
    }
  });
}

/** Zoom changes presentation, never the document's page breaks. */
function scalePages(result: PaginationResult, scale: number, pageGap: number) {
  for (const page of result.pages) {
    if (CSS.supports('zoom', '1')) page.element.style.zoom = String(scale);
    else {
      page.element.style.transform = `scale(${scale})`;
      page.element.style.transformOrigin = 'top left';
      page.element.style.marginRight = `${page.dimensions.pageWidth * (scale - 1) * 4 / 3}px`;
      page.element.style.marginBottom = `${pageGap + page.dimensions.pageHeight * (scale - 1) * 4 / 3}px`;
    }
  }
}

type BlockGeometry = Map<string, { element: HTMLElement; box: number[] }>;
function blockBox(element: HTMLElement, scale: number): number[] {
  const page = element.closest('[data-page-number]')!.getBoundingClientRect();
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return [...[box.left - page.left, box.top - page.top, box.width, box.height].map(value => value / scale),
    ...[style.marginTop, style.marginBottom, style.marginLeft, style.marginRight].map(value => parseFloat(value) || 0)];
}
function measureBlocks(root: HTMLElement, scale: number): BlockGeometry {
  const grouped = new Map<string, HTMLElement[]>();
  for (const element of canvasParagraphs(root)) {
    const id = element.dataset.sourceAnchorId!;
    grouped.set(id, [...grouped.get(id) ?? [], element]);
  }
  const geometry: BlockGeometry = new Map();
  for (const [id, elements] of grouped) {
    const element = elements[0];
    // Notes, tables and fragments may have hidden/clipped continuations. Reflow
    // those from source until their complete layout dependencies can be updated.
    if (elements.length !== 1 || !id.includes(':body:') || element.closest('td, th, [data-footnote-id], [data-endnote-id]') ||
      !element.closest('[data-page-number]') || element.style.height || element.style.maxHeight) continue;
    geometry.set(id, { element, box: blockBox(element, scale) });
  }
  return geometry;
}

/** React-owned pagination over the core engine; no upstream editor dependency. */
export function PaginatedDocument({ html, canvasEditor, canvasOwner, liveBlocks, sourceVersion, scale = 1, showPageNumbers = true, pageGap = 20, cssPrefix = 'page-', fragmentParagraphs = true, layoutToken, citation, selectedAnchorId, backgroundColor = '#525659', className, style, ...callbacks }: PaginatedDocumentProps) {
  const host = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLElement | null>(null);
  const activeLayout = useRef<{
    wrapper: HTMLElement; dispose: () => void; engine: PaginationEngine; result: PaginationResult;
    scale: number; pageGap: number; owner: DocxSession | null;
    documentVersion?: number; rendererFingerprint?: string;
    geometry: BlockGeometry; settings: string;
  } | null>(null);
  useLayoutEffect(() => () => { activeLayout.current?.dispose(); activeLayout.current = null; }, []);
  const callbacksRef = useRef(callbacks);
  useEffect(() => { callbacksRef.current = callbacks; });
  const task = useAsyncOperation<PaginationResult>();
  const { run, cancel } = task;
  const documentVersion = layoutToken?.documentVersion ?? sourceVersion;
  const rendererFingerprint = layoutToken?.rendererFingerprint;
  const layoutSettings = JSON.stringify({ showPageNumbers, pageGap, cssPrefix, fragmentParagraphs, backgroundColor });
  const scaleRef = useRef(scale);
  useLayoutEffect(() => {
    scaleRef.current = scale;
    const active = activeLayout.current;
    if (!active || active.scale === scale) return;
    scalePages(active.result, scale, active.pageGap);
    active.scale = scale;
    // A draft may already have changed the old DOM while conversion is pending.
    // Only publish measurements for the native version this layout represents.
    if (canvasEditor && (canvasEditor.getSnapshot().suspended || !canvasEditor.acceptsLayout(active.owner, active.documentVersion))) return;
    try {
      const result = { ...active.result };
      if (active.documentVersion !== undefined && active.rendererFingerprint !== undefined) {
        active.engine.normalizePageMapFragmentIdentities();
        result.pageMap = active.engine.materializePageMap(active.documentVersion, active.rendererFingerprint);
      }
      active.result = result;
      callbacksRef.current.onPaginationComplete?.(result);
    } catch (cause) {
      callbacksRef.current.onError?.(cause instanceof Error ? cause : new Error(String(cause)));
    }
  }, [scale, task.data, canvasEditor]);

  useEffect(() => {
    const element = host.current;
    if (!element || !html) return;
    const active = activeLayout.current;
    if (active && liveBlocks && active.owner === liveBlocks.owner && active.owner === canvasOwner &&
      active.documentVersion === liveBlocks.fromVersion && documentVersion === liveBlocks.toVersion &&
      active.settings === layoutSettings && active.rendererFingerprint === rendererFingerprint &&
      (!canvasEditor || (!canvasEditor.getSnapshot().suspended && canvasEditor.acceptsLayout(active.owner, documentVersion)))) {
      const ids = Object.keys(liveBlocks.blocks);
      if (ids.length && ids.every(id => active.geometry.get(id)?.element.isConnected)) {
        const patch = () => {
          for (const id of ids) {
            const fresh = new DOMParser().parseFromString(liveBlocks.blocks[id], 'text/html').body.firstElementChild!;
            replaceBlockPresentation(active.geometry.get(id)!.element, fresh);
          }
        };
        if (canvasEditor) canvasEditor.updateLayout(ids, patch); else patch();
        // Compare against the committed layout, not the already-typed DOM. This
        // catches line wrapping that happened before the native edit committed.
        if (ids.every(id => {
          const before = active.geometry.get(id)!;
          return blockBox(before.element, active.scale).every((value, i) => Math.abs(value - before.box[i]) < 0.25);
        }) && document.fonts?.status !== 'loading') {
          void run(() => {
            const result = { ...active.result };
            if (documentVersion !== undefined && rendererFingerprint !== undefined) {
              active.engine.normalizePageMapFragmentIdentities();
              result.pageMap = active.engine.materializePageMap(documentVersion, rendererFingerprint);
            }
            active.documentVersion = documentVersion; active.result = result;
            callbacksRef.current.onPaginationComplete?.(result);
            return result;
          }).catch(error => callbacksRef.current.onError?.(error));
          return cancel;
        }
      }
    }
    const shadow = element.shadowRoot ?? element.attachShadow({ mode: 'open' });
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const wrapper = document.createElement('div');
    for (const attribute of Array.from(parsed.documentElement.attributes)) wrapper.setAttribute(attribute.name, attribute.value);
    wrapper.classList.add('rdv-document-html');
    const documentBody = document.createElement('div');
    for (const attribute of Array.from(parsed.body.attributes)) documentBody.setAttribute(attribute.name, attribute.value);
    documentBody.classList.add('rdv-document-body');
    wrapper.append(...Array.from(parsed.head.querySelectorAll('style')), documentBody);
    documentBody.append(...Array.from(parsed.body.childNodes));
    // Converted HTML sometimes contains a legacy bootstrap script. React owns execution.
    wrapper.querySelectorAll('script, iframe, object, embed').forEach(node => node.remove());
    for (const node of [wrapper, ...wrapper.querySelectorAll('*')]) {
      for (const attribute of Array.from(node.attributes)) {
        if (/^on/i.test(attribute.name) || (/^(href|src|xlink:href)$/i.test(attribute.name) && /^\s*javascript:/i.test(attribute.value))) node.removeAttribute(attribute.name);
      }
    }
    // Measure the incoming pages while the current editing surface retains focus.
    // The actual DOM handoff happens synchronously after fonts/images are ready.
    if (activeLayout.current) Object.assign(wrapper.style, { opacity: '0', position: 'absolute', top: '0', left: '0', width: '100%', pointerEvents: 'none' });
    wrapper.inert = true;
    shadow.append(wrapper);
    const selectionStyles = document.createElement('style');
    selectionStyles.textContent = '[data-rdv-selected="true"] { outline: 1.5px solid var(--rdv-selection-color, #93aa79); outline-offset: 5px; border-radius: 1px; }';
    wrapper.append(selectionStyles);
    for (const stylesheet of wrapper.querySelectorAll('style')) {
      if (stylesheet.sheet) adaptRootSelectors(stylesheet.sheet.cssRules);
    }
    const onClick = (event: MouseEvent) => {
      if (canvasEditor && event.target instanceof Element && event.target.closest('[data-rdv-editable="true"]')) return;
      const target = event.target instanceof Element ? event.target : null;
      // Inline comment/revision wrappers have their own anchors. Editing a passage
      // should select its paragraph, rather than the discussion attached to it.
      const selection = shadowSelection(documentBody);
      if (callbacksRef.current.onTextSelectionChange) {
        if (target?.closest('a[href]')) event.preventDefault();
        if (selection && !selection.isCollapsed) return;
      }
      const block = target?.closest(paragraphSelector);
      const anchor = (block ?? target?.closest('[data-source-anchor-id]'))?.getAttribute('data-source-anchor-id');
      if (anchor) callbacksRef.current.onAnchorSelect?.(anchor);
      const link = target?.closest('a[href^="#"]');
      if (link) {
        const id = link.getAttribute('href')!.slice(1);
        const destination = Array.from(documentBody.querySelectorAll<HTMLElement>('[id]')).find(node => node.id === id);
        if (destination) { event.preventDefault(); destination.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      }
    };
    documentBody.addEventListener('click', onClick);
    const onSelection = () => {
      if (canvasEditor) return;
      const selection = shadowSelection(documentBody);
      if (callbacksRef.current.onTextSelectionChange && selection && !selection.isCollapsed) {
        callbacksRef.current.onTextSelectionChange(readTextSelection(documentBody, activeLayout.current?.documentVersion));
      }
    };
    documentBody.addEventListener('mouseup', onSelection);
    documentBody.addEventListener('keyup', onSelection);
    let observer: IntersectionObserver | null = null;
    let detachEditor: (() => void) | undefined;
    const dispose = () => {
      detachEditor?.();
      observer?.disconnect();
      documentBody.removeEventListener('click', onClick);
      documentBody.removeEventListener('mouseup', onSelection);
      documentBody.removeEventListener('keyup', onSelection);
      if (body.current === documentBody) { body.current = null; callbacksRef.current.onRootChange?.(null); }
      wrapper.remove();
    };
    void run(async signal => {
      await waitForLayout(element, signal);
      documentBody.getBoundingClientRect(); // Start font requests before awaiting readiness.
      await document.fonts?.ready;
      await Promise.all(Array.from(documentBody.querySelectorAll('img')).map(img => img.decode?.().catch(() => {})));
      if (signal.aborted) throw new DOMException('Pagination cancelled', 'AbortError');
      await waitForLayout(element, signal);
      if (signal.aborted) throw new DOMException('Pagination cancelled', 'AbortError');
      if (canvasEditor) {
        await canvasEditor.whenIdle(signal);
        if (signal.aborted || !canvasEditor.acceptsLayout(canvasOwner ?? null, documentVersion)) throw new DOMException('Editing superseded this layout', 'AbortError');
      }
      const staging = documentBody.querySelector<HTMLElement>('#pagination-staging') ?? documentBody.querySelector<HTMLElement>(`.${cssPrefix}staging`);
      const container = documentBody.querySelector<HTMLElement>('#pagination-container') ?? documentBody.querySelector<HTMLElement>(`.${cssPrefix}container`);
      if (!staging || !container) throw new Error('Generate HTML with PaginationMode.Paginated to display page boxes.');
      // The converter supplies its own default canvas color inside the ShadowRoot.
      // Apply the host's theme to the canvas without changing the document pages.
      container.style.backgroundColor = backgroundColor;
      // Docxodus 12.6.1 measures note/header reserves while creating pages. Zooming
      // those pages during measurement mixes scaled pixels with document points,
      // clipping body paragraphs in documents with substantial footnotes.
      const engine = new PaginationEngine(staging, container, {
        scale: 1, showPageNumbers, pageGap, cssPrefix, fragmentParagraphs,
      });
      const check = () => {
        if (signal.aborted || (canvasEditor && !canvasEditor.acceptsLayout(canvasOwner ?? null, documentVersion))) throw new DOMException('Editing superseded this layout', 'AbortError');
      };
      const idle = async () => { if (canvasEditor) await canvasEditor.whenIdle(signal); };
      const cooperative = cooperativePagination(engine, check, idle);
      const result = await cooperative.paginate();
      await idle(); check();
      const pause = async () => { await yieldToBrowser(); check(); await idle(); check(); };
      await canvasEditor?.prepareLayout(documentBody, canvasOwner ?? null, documentVersion, pause);
      let renderedScale: number;
      let geometry: BlockGeometry;
      do {
        renderedScale = scaleRef.current;
        scalePages(result, renderedScale, pageGap);
        if (documentVersion !== undefined && rendererFingerprint !== undefined) {
          await cooperative.normalizePageMapFragmentIdentities();
          result.pageMap = await cooperative.materializePageMap(documentVersion, rendererFingerprint);
        }
        await idle(); check();
        geometry = measureBlocks(documentBody, renderedScale);
        await pause();
      } while (renderedScale !== scaleRef.current);
      activeLayout.current?.dispose();
      Object.assign(wrapper.style, { opacity: '', position: '', top: '', left: '', width: '', pointerEvents: '' });
      wrapper.inert = false;
      body.current = documentBody;
      callbacksRef.current.onRootChange?.(documentBody);
      detachEditor = canvasEditor?.attach(documentBody, canvasOwner ?? null);
      activeLayout.current = { wrapper, dispose, engine, result, scale: renderedScale, pageGap, owner: canvasOwner ?? null, documentVersion, rendererFingerprint,
        geometry, settings: layoutSettings };
      callbacksRef.current.onPaginationComplete?.(result);
      if (typeof IntersectionObserver !== 'undefined') {
        const visible = new Map<Element, { page: number; ratio: number }>();
        observer = new IntersectionObserver(entries => {
          for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRatio > 0) visible.set(entry.target, { page: Number((entry.target as HTMLElement).dataset.pageNumber), ratio: entry.intersectionRatio });
            else visible.delete(entry.target);
          }
          const mostVisible = [...visible.values()].sort((a, b) => b.ratio - a.ratio)[0];
          if (mostVisible) callbacksRef.current.onPageVisible?.(mostVisible.page);
        }, { root: element.closest('.rdv-pages'), threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
        container.querySelectorAll(`.${cssPrefix}box[data-page-number]`).forEach(page => observer!.observe(page));
      }
      return result;
    }).catch(error => {
      if (activeLayout.current?.wrapper !== wrapper) dispose();
      if (error?.name !== 'AbortError') callbacksRef.current.onError?.(error);
    });
    return () => {
      cancel();
      if (activeLayout.current?.wrapper !== wrapper) dispose();
    };
  }, [html, canvasEditor, canvasOwner, liveBlocks, showPageNumbers, pageGap, cssPrefix, fragmentParagraphs, documentVersion, rendererFingerprint, backgroundColor, layoutSettings, run, cancel]);

  useEffect(() => {
    if (!body.current) return;
    if (task.data && citation) navigateToPageCitation(body.current, citation, { highlight: true });
    else clearPageCitationHighlight(body.current);
  }, [task.data, citation]);

  useEffect(() => {
    const root = body.current;
    if (!root) return;
    root.querySelectorAll('[data-rdv-selected]').forEach(node => node.removeAttribute('data-rdv-selected'));
    if (selectedAnchorId && task.data) {
      for (const node of root.querySelectorAll<HTMLElement>('#pagination-container [data-source-anchor-id]')) {
        if (node.dataset.sourceAnchorId === selectedAnchorId) node.dataset.rdvSelected = 'true';
      }
    }
  }, [selectedAnchorId, task.data]);

  return <div className={className} style={{ backgroundColor, ...style }} aria-busy={task.isRunning}>
    {task.error && task.error.name !== 'AbortError' && <p role="alert">{task.error.message}</p>}
    <div ref={host} />
  </div>;
}
