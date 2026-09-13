import type { ConversionOptions, DocxSession, EditorRenderOptions } from 'docxodus/core';
import { CommentRenderMode } from 'docxodus/core';
import type { DocxSessionController } from '../session';

export interface LiveBlockUpdate {
  owner: DocxSession;
  fromVersion: number;
  toVersion: number;
  /** Complete source paragraphs, with pagination metadata retained. */
  blocks: Record<string, string>;
}

/** Only profiles expressible by the native editor bridge can use its block HTML. */
export function liveRenderOptions(options: ConversionOptions, controller: DocxSessionController): EditorRenderOptions | null {
  if (!options.stampAnchors || options.additionalCss || options.documentLanguage ||
    options.renderFootnotesAndEndnotes === false ||
    (options.commentRenderMode !== CommentRenderMode.Disabled && options.commentRenderMode !== CommentRenderMode.Inline) ||
    (options.commentCssClassPrefix && options.commentCssClassPrefix !== 'comment-')) return null;
  if (options.renderAnnotations && controller.read(session => session.listAnnotations()).length) return null;
  if (options.renderTrackedChanges && (options.showDeletedContent === false || options.renderMoveOperations === false) &&
    controller.read(session => session.listRevisions()).length) return null;
  return { cssPrefix: options.cssPrefix, fabricateClasses: false, comments: options.commentRenderMode === CommentRenderMode.Inline,
    renderTrackedChanges: options.renderTrackedChanges };
}

/** Patch the authoritative, unpaginated source, including hidden note registries. */
export function patchSourceBlocks(html: string, rendered: Record<string, string | null>): { html: string; blocks: Record<string, string> } | null {
  const source = new DOMParser().parseFromString(html, 'text/html');
  const indexed = new Map<string, Element[]>();
  for (const element of source.querySelectorAll('[data-source-anchor-id]')) {
    const id = element.getAttribute('data-source-anchor-id')!;
    indexed.set(id, [...indexed.get(id) ?? [], element]);
  }
  const blocks: Record<string, string> = {};
  for (const [id, markup] of Object.entries(rendered)) {
    const originals = indexed.get(id);
    if (!markup || originals?.length !== 1) return null;
    const original = originals[0];
    const parsed = new DOMParser().parseFromString(markup, 'text/html');
    const fresh = parsed.body.firstElementChild;
    if (!fresh || parsed.body.children.length !== 1 || fresh.tagName !== original.tagName ||
      fresh.getAttribute('data-anchor') !== original.getAttribute('data-anchor')) return null;
    // These require the complete converter profile/identity inventory. Never
    // discard image positioning, annotation anchors, or nested block identities.
    const complex = 'img, svg, math, script, iframe, object, embed, [data-source-anchor-id], .unsupported-placeholder, [data-content-type]';
    if (original.querySelector(complex) || fresh.querySelector(complex)) return null;
    // Isolated rendering numbers notes from one. Their unchanged source chrome
    // retains the full document's ordinals, reference IDs, and navigation links.
    const refs = 'a.footnote-ref, a.endnote-ref, a[class$="-backref"], a.comment-marker';
    const oldRefs = Array.from(original.querySelectorAll(refs));
    const newRefs = Array.from(fresh.querySelectorAll(refs));
    if (oldRefs.length !== newRefs.length || oldRefs.some((ref, i) =>
      ['id', 'data-footnote-id', 'data-endnote-id', 'data-comment-id'].some(attr => ref.getAttribute(attr) !== newRefs[i].getAttribute(attr)))) return null;
    newRefs.forEach((ref, i) => ref.replaceWith(oldRefs[i].cloneNode(true)));
    for (const node of [fresh, ...fresh.querySelectorAll('*')]) {
      for (const attribute of Array.from(node.attributes)) {
        if (/^on/i.test(attribute.name) || (/^(href|src|xlink:href)$/i.test(attribute.name) && /^\s*javascript:/i.test(attribute.value))) node.removeAttribute(attribute.name);
      }
    }
    // Text and run formatting don't alter paragraph layout properties. Keep
    // widow/keep/section metadata which the block renderer doesn't emit.
    original.replaceChildren(...fresh.childNodes);
    blocks[id] = original.outerHTML;
  }
  return { html: `<!doctype html>\n${source.documentElement.outerHTML}`, blocks };
}
