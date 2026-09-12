import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { PaginationEngine, clearPageCitationHighlight, navigateToPageCitation } from 'docxodus/core';
import type { DocxSession, PageCitation, PaginationOptions, PaginationResult } from 'docxodus/core';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { paragraphSelector, readTextSelection, shadowSelection } from '../editing/selection';
import type { DocumentTextSelection } from '../types';
import type { CanvasEditor } from '../editing/CanvasEditor';

export interface PaginatedDocumentProps extends Pick<PaginationOptions, 'scale' | 'showPageNumbers' | 'pageGap' | 'cssPrefix' | 'fragmentParagraphs' | 'layoutToken'> {
  html: string;
  canvasEditor?: CanvasEditor;
  canvasOwner?: DocxSession | null;
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

/** React-owned pagination over the core engine; no upstream editor dependency. */
export function PaginatedDocument({ html, canvasEditor, canvasOwner, scale = 1, showPageNumbers = true, pageGap = 20, cssPrefix = 'page-', fragmentParagraphs = true, layoutToken, citation, selectedAnchorId, backgroundColor = '#525659', className, style, ...callbacks }: PaginatedDocumentProps) {
  const host = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLElement | null>(null);
  const activeLayout = useRef<{ wrapper: HTMLElement; dispose: () => void } | null>(null);
  useLayoutEffect(() => () => { activeLayout.current?.dispose(); activeLayout.current = null; }, []);
  const callbacksRef = useRef(callbacks);
  useEffect(() => { callbacksRef.current = callbacks; });
  const task = useAsyncOperation<PaginationResult>();
  const { run, cancel } = task;
  const documentVersion = layoutToken?.documentVersion;
  const rendererFingerprint = layoutToken?.rendererFingerprint;

  useEffect(() => {
    const element = host.current;
    if (!element || !html) return;
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
        callbacksRef.current.onTextSelectionChange(readTextSelection(documentBody, documentVersion));
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
      const engine = new PaginationEngine(staging, container, {
        scale, showPageNumbers, pageGap, cssPrefix, fragmentParagraphs,
        layoutToken: documentVersion !== undefined && rendererFingerprint !== undefined ? { documentVersion, rendererFingerprint } : undefined,
      });
      const result = engine.paginate();
      activeLayout.current?.dispose();
      Object.assign(wrapper.style, { opacity: '', position: '', top: '', left: '', width: '', pointerEvents: '' });
      wrapper.inert = false;
      body.current = documentBody;
      callbacksRef.current.onRootChange?.(documentBody);
      detachEditor = canvasEditor?.attach(documentBody, canvasOwner ?? null);
      activeLayout.current = { wrapper, dispose };
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
    }).catch(error => { if (error?.name !== 'AbortError') callbacksRef.current.onError?.(error); });
    return () => {
      cancel();
      if (activeLayout.current?.wrapper !== wrapper) dispose();
    };
  }, [html, canvasEditor, canvasOwner, scale, showPageNumbers, pageGap, cssPrefix, fragmentParagraphs, documentVersion, rendererFingerprint, backgroundColor, run, cancel]);

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
