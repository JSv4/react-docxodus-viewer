import type { DocxSession, PageCitation, PageCitationRequest, PageMap, PageMapStatus } from 'docxodus/core';

// Portable constraints mirror Docxodus 12.4.1's MIT-licensed PageMapContract
// (Copyright John Scrudato IV). A failed/unknown case always uses native validation.
// Native validation additionally proves anchor/story/table ownership. That proof
// survives only journaled paragraph text/run edits with no created/removed anchors.
function portable(map: PageMap, version: number, fingerprint?: string): boolean {
  // Native whitespace/UTF-16 handling owns non-ASCII identifiers. The browser
  // engine emits printable ASCII; unfamiliar strings take the native path.
  const text = (value: unknown): value is string => typeof value === 'string' && /^[\x20-\x7e]*[\x21-\x7e][\x20-\x7e]*$/.test(value);
  const int = (value: number) => Number.isInteger(value) && value >= 0 && value <= 2147483647;
  // Unknown fields/defaults belong to the native JSON contract. Reusing only
  // its explicit portable shape also preserves citation serialization exactly.
  const shape = (value: object, keys: string) => Object.keys(value).every(key => keys.split(' ').includes(key));
  if (!map || map.schemaVersion !== 1 || map.documentVersion !== version || !Number.isSafeInteger(version) || version < 0 ||
    !text(map.rendererFingerprint) || (fingerprint !== undefined && map.rendererFingerprint !== fingerprint) ||
    !Array.isArray(map.pages) || !Array.isArray(map.fragments) || !shape(map, 'schemaVersion mode availability documentVersion rendererFingerprint pages fragments')) return false;
  if (map.mode === 'continuous') return map.availability === 'unavailable' && !map.pages.length && !map.fragments.length;
  if (map.mode !== 'paginated' || map.availability !== 'available' || !map.pages.length || !map.fragments.length) return false;
  const sections = new Set<number>();
  for (const [index, page] of map.pages.entries()) {
    if (!page || page.pageNumber !== index + 1 || !int(page.pageInSection) || page.pageInSection < 1 ||
      !Number.isFinite(page.width) || page.width <= 0 || !Number.isFinite(page.height) || page.height <= 0 ||
      !text(page.pageName) || page.sectionIndex == null || !int(page.sectionIndex) || !shape(page, 'pageNumber pageInSection width height sectionIndex pageName')) return false;
    const previous = map.pages[index - 1];
    if (!index && page.pageInSection !== 1) return false;
    if (page.pageInSection === 1) {
      if (page.sectionIndex != null) {
        if (sections.has(page.sectionIndex)) return false;
        sections.add(page.sectionIndex);
      }
    } else if (!previous || page.pageInSection !== previous.pageInSection + 1 || (page.sectionIndex ?? null) !== (previous.sectionIndex ?? null)) return false;
  }
  const ids = new Set<string>(), sequence = new Map<string, number>();
  const stories = new Set(['body', 'header', 'footer', 'footnote', 'endnote', 'comment']);
  let previousPage = 0;
  for (const fragment of map.fragments) {
    if (!fragment || !text(fragment.fragmentId) || ids.has(fragment.fragmentId) || !text(fragment.anchorId) ||
      !Number.isInteger(fragment.pageNumber) || fragment.pageNumber < 1 || fragment.pageNumber < previousPage ||
      !int(fragment.fragmentIndex) || fragment.fragmentIndex !== (sequence.get(fragment.anchorId) ?? 0) ||
      !stories.has(fragment.story) || typeof fragment.inTableCell !== 'boolean' || (fragment.story === 'comment' && fragment.inTableCell) ||
      !shape(fragment, 'fragmentId anchorId fragmentIndex pageNumber geometry story inTableCell')) return false;
    const page = map.pages[fragment.pageNumber - 1], rect = fragment.geometry;
    if (!page || !rect || !shape(rect, 'x y width height') || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) ||
      rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 ||
      rect.x + rect.width > page.width + 0.25 || rect.y + rect.height > page.height + 0.25) return false;
    ids.add(fragment.fragmentId); sequence.set(fragment.anchorId, fragment.fragmentIndex + 1); previousPage = fragment.pageNumber;
  }
  return true;
}
const ownership = (fragment: PageMap['fragments'][number]) => JSON.stringify([fragment.anchorId, fragment.story, fragment.inTableCell]);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Browser layout is derived data. Reuse native-validated anchor ownership while
 * revalidating every geometry/order/version constraint for each new layout.
 * Content edits, saving, undo and all metadata still use the same native session.
 */
export function cacheSessionPageMaps(session: DocxSession, canReuse: (version: number) => boolean, inTransaction: () => boolean) {
  const register = session.registerPageMap.bind(session);
  const nativeStatus = session.getPageMapStatus.bind(session);
  const nativeCitation = session.getPageCitation.bind(session);
  let map: PageMap | null = null;
  let proof = new Set<string>();
  let browserLayout = false;
  const remember = (next: PageMap, browser: boolean) => {
    map = clone(next); proof = new Set(map.fragments.map(ownership)); browserLayout = browser;
  };
  session.registerPageMap = (next, fingerprint) => {
    const version = session.getVersion(); // Also preserves the native closed-session guard.
    if (inTransaction()) {
      map = null; proof.clear(); browserLayout = false;
      return register(next, fingerprint);
    }
    // JSON snapshot matches the bridge's value semantics; callers cannot mutate
    // a registered map through references retained by the viewer or onPageMap.
    const candidate = clone(next);
    if (map && candidate && candidate.mode === map.mode && candidate.rendererFingerprint === map.rendererFingerprint &&
      canReuse(map.documentVersion) && portable(candidate, version, fingerprint) && candidate.fragments.every(fragment => proof.has(ownership(fragment)))) {
      remember(candidate, true);
      return { success: true };
    }
    const result = register(next, fingerprint);
    if (result.success) remember(candidate, false);
    return result;
  };
  session.getPageMapStatus = (request): PageMapStatus => {
    const version = session.getVersion();
    if (!map || !browserLayout || inTransaction()) return nativeStatus(request);
    const common = { documentVersion: version, rendererFingerprint: map.rendererFingerprint, mode: map.mode };
    if (map.documentVersion !== version || (request && request.documentVersion !== version)) return { ...common, availability: 'unavailable', unavailableReason: 'stale_document_version' };
    if (request && request.rendererFingerprint !== map.rendererFingerprint) return { ...common, availability: 'unavailable', unavailableReason: 'renderer_fingerprint_mismatch' };
    if (map.mode === 'continuous' || map.availability === 'unavailable') return { ...common, availability: 'unavailable', unavailableReason: 'continuous_mode' };
    return { ...common, availability: 'available' };
  };
  session.getPageCitation = (anchorId, request): PageCitation => {
    if (!map || !browserLayout || inTransaction() || typeof anchorId !== 'string' || !request) return nativeCitation(anchorId, request);
    const status = session.getPageMapStatus(request);
    const unavailable = (unavailableReason: PageCitation['unavailableReason'], documentVersion = status.documentVersion): PageCitation => ({
      anchorId, availability: 'unavailable', unavailableReason, documentVersion, rendererFingerprint: request.rendererFingerprint, pages: [], fragments: [],
    });
    if (status.availability !== 'available') return unavailable(status.unavailableReason);
    const fragments = map.fragments.filter(fragment => fragment.anchorId === anchorId);
    if (!fragments.length) return unavailable('anchor_not_mapped', request.documentVersion);
    const pages = new Set(fragments.map(fragment => fragment.pageNumber));
    return clone({ anchorId, availability: 'available', documentVersion: request.documentVersion, rendererFingerprint: request.rendererFingerprint,
      pages: map.pages.filter(page => pages.has(page.pageNumber)), fragments });
  };
  // These native queries optionally embed citations. Re-project only those
  // derived citations, leaving native search/projection/anchor results intact.
  const citationMethods = ['projectAnchor', 'grep', 'grepCrossBlock', 'findPlaceholders', 'findByAnnotation', 'findByLabel', 'findByBookmark', 'findByKind', 'findByText', 'findAllByText', 'findByRegex'] as const;
  for (const name of citationMethods) {
    const original = session[name];
    if (typeof original !== 'function') continue;
    Reflect.set(session, name, (...args: unknown[]) => {
      const result: unknown = Reflect.apply(original, session, args);
      if (!map || !browserLayout || inTransaction()) return result;
      const request = args.flatMap(arg => arg && typeof arg === 'object' ? [arg, ...Object.values(arg)] : []).find(value => value && typeof value === 'object' &&
        'documentVersion' in value && 'rendererFingerprint' in value) as PageCitationRequest | undefined;
      if (!request) return result;
      const project = (value: unknown): unknown => {
        if (!value || typeof value !== 'object') return value;
        if ('anchorId' in value && 'availability' in value && 'rendererFingerprint' in value && 'documentVersion' in value) return session.getPageCitation(String(value.anchorId), request);
        if (Array.isArray(value)) return value.map(project);
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, project(child)]));
      };
      return project(result);
    });
  }
  return {
    /** Transactions and their native shadow queries must see the current map. */
    flush: () => {
      if (map && browserLayout && map.documentVersion === session.getVersion()) {
        const result = register(map, map.rendererFingerprint);
        if (!result.success) throw new Error(result.message ?? 'The page map could not be registered.');
        browserLayout = false;
      }
    },
  };
}
