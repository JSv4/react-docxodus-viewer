/** Align converter paragraph kinds with the exact native snapshot being rendered. */
export function reconcileSourceAnchors(html: string, anchors: readonly string[]) {
  // Docxodus 12.4.1 can stamp a numbered paragraph as p while its session uses li.
  // Scope + Unid is stable across paragraph/heading/list kind changes.
  const canonical = new Map(anchors.filter(id => /^(p|h|li):/.test(id)).map(id => [id.slice(id.indexOf(':')), id]));
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  let changed = false;
  for (const element of parsed.querySelectorAll('[data-source-anchor-id]')) {
    const stamped = element.getAttribute('data-source-anchor-id')!;
    if (!/^(p|h|li):/.test(stamped)) continue;
    const id = canonical.get(stamped.slice(stamped.indexOf(':')));
    if (id && id !== stamped) { element.setAttribute('data-source-anchor-id', id); changed = true; }
  }
  return changed ? `<!doctype html>\n${parsed.documentElement.outerHTML}` : html;
}
