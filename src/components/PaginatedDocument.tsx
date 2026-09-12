import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { PaginationEngine, clearPageCitationHighlight, navigateToPageCitation } from 'docxodus/core';
import type { PageCitation, PaginationOptions, PaginationResult } from 'docxodus/core';
import { useAsyncOperation } from '../hooks/useAsyncOperation';

export interface PaginatedDocumentProps extends Pick<PaginationOptions, 'scale' | 'showPageNumbers' | 'pageGap' | 'cssPrefix' | 'fragmentParagraphs' | 'layoutToken'> {
  html: string;
  backgroundColor?: string;
  className?: string;
  style?: CSSProperties;
  citation?: PageCitation;
  onPaginationComplete?: (result: PaginationResult) => void;
  onPageVisible?: (page: number) => void;
  onError?: (error: Error) => void;
  onAnchorSelect?: (anchorId: string) => void;
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

/** React-owned pagination over the core engine; no upstream editor dependency. */
export function PaginatedDocument({ html, scale = 1, showPageNumbers = true, pageGap = 20, cssPrefix = 'page-', fragmentParagraphs = true, layoutToken, citation, backgroundColor = '#525659', className, style, ...callbacks }: PaginatedDocumentProps) {
  const host = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLElement | null>(null);
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
    shadow.replaceChildren(wrapper);
    for (const stylesheet of wrapper.querySelectorAll('style')) {
      if (stylesheet.sheet) adaptRootSelectors(stylesheet.sheet.cssRules);
    }
    body.current = documentBody;
    callbacksRef.current.onRootChange?.(documentBody);
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('[data-source-anchor-id]')?.getAttribute('data-source-anchor-id');
      if (anchor) callbacksRef.current.onAnchorSelect?.(anchor);
      const link = target?.closest('a[href^="#"]');
      if (link) {
        const id = link.getAttribute('href')!.slice(1);
        const destination = Array.from(documentBody.querySelectorAll<HTMLElement>('[id]')).find(node => node.id === id);
        if (destination) { event.preventDefault(); destination.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      }
    };
    documentBody.addEventListener('click', onClick);
    let observer: IntersectionObserver | null = null;
    void run(async signal => {
      documentBody.getBoundingClientRect(); // Start font requests before awaiting readiness.
      await document.fonts?.ready;
      await Promise.all(Array.from(documentBody.querySelectorAll('img')).map(img => img.decode?.().catch(() => {})));
      if (signal.aborted) throw new DOMException('Pagination cancelled', 'AbortError');
      const staging = documentBody.querySelector<HTMLElement>('#pagination-staging') ?? documentBody.querySelector<HTMLElement>(`.${cssPrefix}staging`);
      const container = documentBody.querySelector<HTMLElement>('#pagination-container') ?? documentBody.querySelector<HTMLElement>(`.${cssPrefix}container`);
      if (!staging || !container) throw new Error('Generate HTML with PaginationMode.Paginated to display page boxes.');
      const engine = new PaginationEngine(staging, container, {
        scale, showPageNumbers, pageGap, cssPrefix, fragmentParagraphs,
        layoutToken: documentVersion !== undefined && rendererFingerprint !== undefined ? { documentVersion, rendererFingerprint } : undefined,
      });
      const result = engine.paginate();
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
      observer?.disconnect();
      documentBody.removeEventListener('click', onClick);
      body.current = null;
      callbacksRef.current.onRootChange?.(null);
      shadow.replaceChildren();
    };
  }, [html, scale, showPageNumbers, pageGap, cssPrefix, fragmentParagraphs, documentVersion, rendererFingerprint, run, cancel]);

  useEffect(() => {
    if (!body.current) return;
    if (task.data && citation) navigateToPageCitation(body.current, citation, { highlight: true });
    else clearPageCitationHighlight(body.current);
  }, [task.data, citation]);

  return <div className={className} style={{ backgroundColor, ...style }} aria-busy={task.isRunning}>
    {task.error && task.error.name !== 'AbortError' && <p role="alert">{task.error.message}</p>}
    <div ref={host} />
  </div>;
}
