// src/export-resource-limits-v1.json
var export_resource_limits_v1_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://docxodus.dev/contracts/export-resource-limits/v1",
  schemaVersion: 1,
  defaults: {
    compressedDocxBytes: 104857600,
    opcEntries: 1e4,
    expandedOpcBytes: 1073741824,
    xmlPartBytes: 33554432,
    opcUriCharacters: 2048,
    opcCompressionRatio: 1e3,
    htmlOutputBytes: 268435456,
    pdfOutputBytes: 268435456,
    pageMapOutputBytes: 268435456,
    renderReportOutputBytes: 268435456,
    pdfParserExpandedBytes: 1073741824,
    finalPages: 1e4,
    domNodes: 1e6,
    automaticResources: 1e4,
    automaticResourceBytes: 268435456,
    renderDiagnostics: 1e4,
    fontDirectoryEntries: 1e4,
    fontFiles: 1e3,
    fontFileBytes: 33554432,
    fontTotalBytes: 134217728,
    fontRequests: 4096,
    fontSampleCodePoints: 65536
  },
  hardCeilings: {
    compressedDocxBytes: 104857600,
    opcEntries: 1e4,
    expandedOpcBytes: 1073741824,
    xmlPartBytes: 33554432,
    opcUriCharacters: 2048,
    opcCompressionRatio: 1e3,
    htmlOutputBytes: 536870912,
    pdfOutputBytes: 536870912,
    pageMapOutputBytes: 536870912,
    renderReportOutputBytes: 536870912,
    pdfParserExpandedBytes: 2147483648,
    finalPages: 1e5,
    domNodes: 2e6,
    automaticResources: 1e5,
    automaticResourceBytes: 536870912,
    renderDiagnostics: 1e5,
    fontDirectoryEntries: 1e5,
    fontFiles: 1e4,
    fontFileBytes: 67108864,
    fontTotalBytes: 536870912,
    fontRequests: 16384,
    fontSampleCodePoints: 262144
  },
  timeoutMs: {
    default: 12e4,
    hardCeiling: 6e5
  }
};

// src/canonical.ts
function isWellFormedUnicode(value) {
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit >= 55296 && unit <= 56319) {
      const next = value.charCodeAt(++index);
      if (!(next >= 56320 && next <= 57343)) return false;
    } else if (unit >= 56320 && unit <= 57343) {
      return false;
    }
  }
  return true;
}
function assertWellFormedUnicode(value) {
  if (!isWellFormedUnicode(value)) {
    throw new TypeError("Canonical JSON does not support unpaired UTF-16 surrogates");
  }
}
function canonicalValue(value) {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    assertWellFormedUnicode(value);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON does not support non-finite numbers");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON supports only plain objects");
    }
    const record = value;
    const result = /* @__PURE__ */ Object.create(null);
    for (const key of Object.keys(record).sort()) {
      assertWellFormedUnicode(key);
      const member = record[key];
      if (member !== void 0) result[key] = canonicalValue(member);
    }
    return result;
  }
  throw new TypeError(`Canonical JSON does not support ${typeof value}`);
}
function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

// src/line-metrics.ts
var PROBE_FONT_SIZE_PX = 1e4;
var probeSizes = /* @__PURE__ */ new WeakMap();
function fontProbeSize(document2) {
  let size = probeSizes.get(document2);
  if (size !== void 0) return size;
  const probe = document2.createElement("span");
  probe.style.cssText = `position:absolute;left:-100000px;top:0;visibility:hidden;display:inline-block;font:${PROBE_FONT_SIZE_PX / 2}px/normal serif;margin:0;padding:0;border:0;`;
  probe.textContent = "Hg";
  (document2.body ?? document2.documentElement).appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.style.fontSize = `${PROBE_FONT_SIZE_PX}px`;
  size = height > 0 && probe.getBoundingClientRect().height === height ? 1e3 : PROBE_FONT_SIZE_PX;
  probe.remove();
  if (height > 0) probeSizes.set(document2, size);
  return size;
}
var LATIN_PROBE = "Hg";
var BEYOND_LATIN = /[^\u0000-\u024f\s\u200e]/u;
var BEYOND_LATIN_CHARACTERS = /[^\u0000-\u024f\s\u200e]/gu;
var MAX_PROBE_CHARACTERS = 256;
function probeCharacters(element) {
  const characters = /* @__PURE__ */ new Set();
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType !== 3) continue;
    const text = node.textContent ?? "";
    if (!BEYOND_LATIN.test(text)) continue;
    for (const [character] of text.matchAll(BEYOND_LATIN_CHARACTERS)) {
      characters.add(character);
      if (characters.size >= MAX_PROBE_CHARACTERS) return Array.from(characters);
    }
  }
  return Array.from(characters);
}
function naturalLineHeightRatios(document2) {
  const probeSize = fontProbeSize(document2);
  const ratios = /* @__PURE__ */ new Map();
  const ratio = (style, text) => {
    const key = `${style.fontStyle}|${style.fontWeight}|${style.fontStretch}|${style.fontFamily}|${text}`;
    let ratio2 = ratios.get(key);
    if (ratio2 === void 0) {
      const probe = document2.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "position:absolute;left:-100000px;top:0;visibility:hidden;display:inline-block;white-space:nowrap;line-height:normal;margin:0;padding:0;border:0;";
      probe.style.fontFamily = style.fontFamily;
      probe.style.fontStyle = style.fontStyle;
      probe.style.fontWeight = style.fontWeight;
      probe.style.fontStretch = style.fontStretch;
      probe.style.fontSize = `${probeSize}px`;
      probe.textContent = text;
      (document2.body ?? document2.documentElement).appendChild(probe);
      ratio2 = probe.getBoundingClientRect().height / probeSize;
      probe.remove();
      ratios.set(key, ratio2);
    }
    return ratio2;
  };
  return ratio;
}
function applyUnroundedNormalLineHeights(root) {
  const document2 = root.ownerDocument;
  const view = document2.defaultView;
  if (!view) return 0;
  const ratioFor = naturalLineHeightRatios(document2);
  const candidates = [];
  const grids = [];
  const minimums = [];
  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (!(element instanceof view.HTMLElement)) continue;
    const style = view.getComputedStyle(element);
    const paragraph = element.matches(PARAGRAPH_SELECTOR);
    const minimum = Number.parseFloat(style.getPropertyValue("--docx-min-line-height")) * 4 / 3;
    if (paragraph && minimum > 0) minimums.push(element);
    const pitch = Number.parseFloat(style.getPropertyValue("--docx-line-grid")) * 4 / 3;
    const floor = pitch > 0 && Math.abs(Number.parseFloat(style.lineHeight) - minimum) < 0.01;
    if (style.lineHeight !== "normal" && !floor) continue;
    const fontSize = Number.parseFloat(style.fontSize);
    if (!(fontSize > 0)) continue;
    const { fontStyle, fontWeight, fontStretch, fontFamily } = style;
    candidates.push({
      element,
      font: { fontStyle, fontWeight, fontStretch, fontFamily },
      fontSize,
      characters: probeCharacters(element),
      floor
    });
    if (paragraph && pitch > 0) grids.push({ paragraph: element, pitch });
  }
  const targets = [];
  for (const { element, font, fontSize, characters, floor } of candidates) {
    const ratio = ratioFor(font, LATIN_PROBE + [...characters].sort().join(""));
    if (ratio > 0) targets.push({ element, lineHeight: ratio * fontSize, floor });
  }
  const resolved = targets.filter((target) => !target.floor);
  for (const { element, lineHeight } of resolved) {
    element.style.setProperty("line-height", `${lineHeight.toFixed(4)}px`);
  }
  let restored = 0;
  if (grids.length || minimums.length) {
    const naturalHeights = new Map(targets.map(({ element, lineHeight }) => [element, lineHeight]));
    if (grids.length) applyParagraphLineGrids(grids, naturalHeights);
    if (minimums.length) restored = applyUniformLineMinimums(minimums, ratioFor, naturalHeights);
  }
  positionRubyAnnotations(root);
  return resolved.length + restored;
}
var faceCanvases = /* @__PURE__ */ new WeakMap();
function sameLineFace(document2, run, paragraph) {
  if (run.fontSize !== paragraph.fontSize || run.fontStretch !== paragraph.fontStretch) return false;
  if (run.fontFamily === paragraph.fontFamily && run.fontStyle === paragraph.fontStyle && run.fontWeight === paragraph.fontWeight) return true;
  if (!faceCanvases.has(document2)) faceCanvases.set(document2, document2.createElement("canvas").getContext("2d"));
  const canvas = faceCanvases.get(document2), size = fontProbeSize(document2);
  if (!canvas) return false;
  const extent = (face) => {
    canvas.font = "1px serif";
    canvas.font = `${face.fontStyle} ${face.fontWeight} ${size}px ${face.fontFamily}`;
    const { fontBoundingBoxAscent, fontBoundingBoxDescent } = canvas.measureText(LATIN_PROBE);
    return canvas.font.includes(`${size}px`) ? `${fontBoundingBoxAscent}|${fontBoundingBoxDescent}` : void 0;
  };
  const own = extent(paragraph);
  return own !== void 0 && own === extent(run);
}
function isBreakPiece(child) {
  return child.matches("br[data-docx-break]");
}
function uniformParagraphRuns(paragraph, allowStructuralWrappers = false, positioned) {
  const view = paragraph.ownerDocument.defaultView;
  const style = view.getComputedStyle(paragraph);
  if (style.direction !== "ltr" || style.writingMode !== "horizontal-tb") return;
  const children = Array.from(paragraph.children);
  const marker = allowStructuralWrappers && children[0]?.getAttribute("data-list-marker") === "true" && view.getComputedStyle(children[0]).display === "inline-flex" ? children[0] : null;
  const note = allowStructuralWrappers && paragraph.matches("section.endnotes > ol > li > p") && children.length === 1 && children[0].getAttribute("data-source-anchor-id")?.startsWith("en:en:") ? children[0] : null;
  const wrappers = children.filter((child) => child === note || allowStructuralWrappers && /^(ins|del)$/.test(child.localName));
  const runs = children.flatMap((child) => child === marker ? [child, ...Array.from(child.querySelectorAll("*"))] : wrappers.includes(child) ? [child, ...Array.from(child.children)] : [child]);
  if (!children.length || [paragraph, ...wrappers].some((parent) => Array.from(parent.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim())) || runs.some((child) => {
    const inMarker = marker?.contains(child), wrapper = wrappers.includes(child);
    if (!(child instanceof view.HTMLElement) || !wrapper && child.localName !== "span" || !inMarker && (!wrapper && Array.from(child.children).some((piece) => !piece.matches("[data-docx-condensed-line]") && !isBreakPiece(piece)) || !child.textContent?.trim())) return true;
    const run = view.getComputedStyle(child);
    const display = child === marker ? "inline-flex" : child.parentElement === marker ? "block" : inMarker && child.hasAttribute("data-docx-tab") ? "inline-block" : "inline";
    return !sameLineFace(paragraph.ownerDocument, run, style) || run.display !== display || run.position !== "static" && !positioned?.(run) || run.verticalAlign !== "baseline" || run.transform !== "none";
  })) return;
  return runs;
}
function applyUniformLineMinimums(paragraphs, ratioFor, naturalHeights) {
  const view = paragraphs[0].ownerDocument.defaultView;
  let changed = 0;
  for (const paragraph of paragraphs) {
    if (paragraph.closest("a, aside, [data-comment-id], [data-docx-textbox], [data-docx-text-frame], [data-docx-drawing-anchor]") || paragraph.closest("ol, ul, li") && !paragraph.matches("section.endnotes > ol > li > p") || BEYOND_LATIN.test(paragraph.textContent ?? "")) continue;
    const style = view.getComputedStyle(paragraph);
    const minimum = Number.parseFloat(style.getPropertyValue("--docx-min-line-height")) * 4 / 3;
    if (!(minimum > 0)) continue;
    const natural = ratioFor(style, LATIN_PROBE) * Number.parseFloat(style.fontSize);
    const height = Number.parseFloat(style.lineHeight);
    const restoreNatural = natural > minimum && Math.abs(height - minimum) < 0.01;
    const applyMinimum = minimum < 14 * 4 / 3 && minimum > natural && naturalHeights.has(paragraph) && Math.abs(height - natural) < 0.01;
    if (!restoreNatural && !applyMinimum) continue;
    const runs = uniformParagraphRuns(paragraph, true);
    if (!runs || runs.some((run) => view.getComputedStyle(run).lineHeight !== style.lineHeight || applyMinimum && !naturalHeights.has(run))) continue;
    for (const element of [paragraph, ...runs]) {
      element.style.lineHeight = `${Math.max(natural, minimum).toFixed(4)}px`;
      if (!naturalHeights.has(element)) changed++;
    }
    if (restoreNatural) paragraph.style.setProperty("--docx-auto-line-spacing", "1");
  }
  return changed;
}
var BREAK_CARRIER = /^\u200e+$/u;
var GLYPH_ASCENT = "span[data-docx-glyph-ascent]";
function prepareMixedLineHeights(root, checkpoint) {
  const document2 = root.ownerDocument, view = document2.defaultView;
  const ratioFor = naturalLineHeightRatios(document2), probeSize = fontProbeSize(document2);
  const canvas = document2.createElement("canvas").getContext("2d");
  if (!canvas) return 0;
  const fontMetrics = /* @__PURE__ */ new Map();
  const measure = (font, size) => {
    const key = `${font.fontStyle} ${font.fontWeight} ${font.fontStretch} ${size}px ${font.fontFamily}`;
    let result = fontMetrics.get(key);
    if (result) return result;
    const height = ratioFor(font, LATIN_PROBE) * size;
    canvas.font = `${font.fontStyle} ${font.fontWeight} ${probeSize}px ${font.fontFamily}`;
    const descent = canvas.measureText(LATIN_PROBE).fontBoundingBoxDescent / probeSize * size;
    const probe = document2.createElement("span"), marker = document2.createElement("span");
    probe.style.cssText = "position:absolute;left:-100000px;visibility:hidden;display:inline-block;white-space:nowrap;line-height:normal";
    Object.assign(probe.style, {
      fontFamily: font.fontFamily,
      fontStyle: font.fontStyle,
      fontWeight: font.fontWeight,
      fontStretch: font.fontStretch,
      fontSize: `${size}px`
    });
    probe.textContent = LATIN_PROBE;
    marker.style.cssText = "display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline";
    probe.append(marker);
    document2.body.append(probe);
    const range = document2.createRange();
    range.selectNodeContents(probe.firstChild);
    result = {
      ascent: height - descent,
      descent,
      native: probe.getBoundingClientRect().height,
      offset: marker.getBoundingClientRect().top - range.getBoundingClientRect().top
    };
    probe.remove();
    fontMetrics.set(key, result);
    return result;
  };
  const paragraphs = root.matches(PARAGRAPH_SELECTOR) ? [root] : Array.from(root.querySelectorAll(PARAGRAPH_SELECTOR));
  let prepared = 0;
  for (const paragraph of paragraphs) {
    checkpoint?.();
    const owned = paragraph.hasAttribute("data-docx-mixed-lines");
    const width = paragraph.getBoundingClientRect().width;
    if (owned && Number(paragraph.dataset.docxMixedLines) === width) continue;
    if (!(width > 0) || paragraph.closest("table, ol, ul, li, aside, [data-hf-type], #pagination-hf-registry, #pagination-footnote-registry, #pagination-comment-margin-registry, [data-footnote-id], [data-comment-id], section.endnotes, [data-docx-textbox], [data-docx-text-frame], [data-docx-drawing-anchor]")) continue;
    const style = view.getComputedStyle(paragraph);
    const minimum = Number.parseFloat(style.getPropertyValue("--docx-min-line-height")) * 4 / 3 || 0;
    const multiple = Number(style.getPropertyValue("--docx-auto-line-spacing")) || 1;
    const pitch = Number.parseFloat(style.getPropertyValue("--docx-line-grid")) * 4 / 3 || 0;
    const section = paragraph.closest("[data-section-index]");
    if (Number(section?.dataset.cols ?? 1) > 1 || section?.querySelector(
      "[data-docx-text-frame], [data-docx-wrap-text], [data-docx-edge-picture]"
    )) continue;
    if (style.direction !== "ltr" || style.writingMode !== "horizontal-tb" || multiple < 1 && !pitch || Number.parseFloat(style.getPropertyValue("--docx-exact-line-height")) > 0 || Array.from(paragraph.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim())) continue;
    const marker = paragraph.firstElementChild?.getAttribute("data-list-marker") === "true" ? paragraph.firstElementChild : null;
    if (/[^\u0020-\u024f\u200e]/u.test((paragraph.textContent ?? "").slice(marker?.textContent?.length ?? 0))) continue;
    if (paragraph.querySelector("[data-field], [data-footnote-id], [data-endnote-id], [data-comment-id], [data-docx-fit-text-group], [data-docx-word-line], [data-docx-ruby]")) continue;
    if (marker && (marker.children.length !== 2 || marker.children[0].children.length !== 1 || !marker.children[0].firstElementChild?.matches('span[data-list-marker="true"]') || Array.from(marker.children[0].firstElementChild.children).some((child) => !child.matches(GLYPH_ASCENT)) || marker.children[1].children.length !== 1 || !marker.children[1].firstElementChild?.matches("span[data-docx-tab]") || marker.children[1].firstElementChild.childNodes.length)) continue;
    const glyphAscent = !!marker?.querySelector(GLYPH_ASCENT);
    const runs = Array.from(paragraph.querySelectorAll("span")).filter((run) => !run.hasAttribute("data-docx-line-metric") && !run.matches(GLYPH_ASCENT));
    const fonts = runs.map((run) => {
      const css2 = view.getComputedStyle(run);
      return {
        run,
        size: Number.parseFloat(css2.fontSize),
        family: css2.fontFamily,
        weight: css2.fontWeight,
        style: css2.fontStyle,
        stretch: css2.fontStretch,
        display: css2.display,
        align: css2.verticalAlign,
        position: css2.position,
        top: css2.top,
        height: css2.lineHeight,
        transform: css2.transform,
        sides: [css2.left, css2.right],
        bottom: css2.bottom,
        float: css2.cssFloat
      };
    });
    const paragraphFont = owned ? void 0 : measure(style, Number.parseFloat(style.fontSize));
    const contained = (child) => isBreakPiece(child) || owned && child.hasAttribute("data-docx-line-metric");
    if (!runs.length || paragraph.querySelector("*:not(span):not(br[data-docx-break])") || Array.from(paragraph.children).some((child) => child.localName === "br") || fonts.some((f) => !(f.size > 0) || f.transform !== "none" || !["static", "relative"].includes(f.position) || f.float !== "none" || f.sides.some((side) => !["auto", "0px"].includes(side)) || !["auto", "0px"].includes(f.bottom) && !(f.position === "relative" && Math.abs(Number.parseFloat(f.bottom) + Number.parseFloat(f.top)) < 0.02) || f.position === "relative" && !(multiple !== 1 && Math.abs(Number.parseFloat(f.top) - Math.min(0, Number.parseFloat(f.height) * (1 / multiple - 1) / 2)) < 0.02) || !owned && f.run.style.lineHeight && !["normal", "calc(1lh*var(--docx-auto-line-spacing))"].includes(f.run.style.lineHeight.replace(/\s/g, "")) || !owned && f.height !== "normal" && Math.abs(Number.parseFloat(f.height) - (minimum >= 14 * 4 / 3 ? minimum : paragraphFont.native * multiple)) > 0.02 || f.display !== (f.run === marker ? "inline-flex" : f.run.parentElement === marker ? "block" : marker?.contains(f.run) && f.run.hasAttribute("data-docx-tab") ? "inline-block" : "inline") || f.align !== "baseline" || !marker?.contains(f.run) && Array.from(f.run.children).some((child) => !contained(child))) || !owned && style.lineHeight !== "normal" && !(minimum >= 14 * 4 / 3 && Math.abs(Number.parseFloat(style.lineHeight) - minimum) < 0.02) || !owned && !glyphAscent && new Set(fonts.map((f) => `${f.size}|${f.family}|${f.weight}|${f.style}`)).size < 2) continue;
    const metrics = new Map(fonts.map((f) => [f.run, measure({
      fontFamily: f.family,
      fontWeight: f.weight,
      fontStyle: f.style,
      fontStretch: f.stretch
    }, f.size)]));
    if (!owned && !glyphAscent && new Set([...metrics.values()].map((m) => `${m.ascent}|${m.descent}`)).size < 2) continue;
    const before = paragraph.cloneNode(true);
    const sourceText = paragraph.textContent;
    const words = () => {
      const pieces = [];
      const walker2 = document2.createTreeWalker(paragraph, view.NodeFilter.SHOW_TEXT);
      for (let node = walker2.nextNode(); node; node = walker2.nextNode())
        for (const match of marker?.contains(node) ? [] : node.data.matchAll(/\S+/gu)) {
          const range = document2.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          if (range.getClientRects().length !== 1) return void 0;
          const box = range.getBoundingClientRect();
          pieces.push({
            node,
            start: match.index,
            end: match.index + match[0].length,
            left: box.left,
            width: box.width,
            top: box.top
          });
        }
      return pieces;
    };
    let pristine = owned ? void 0 : words();
    if (!owned && !pristine?.length) continue;
    for (const strut of Array.from(paragraph.querySelectorAll("[data-docx-line-metric]"))) strut.remove();
    paragraph.normalize();
    if (owned) pristine = words();
    for (const f of fonts) {
      const font = { fontFamily: f.family, fontWeight: f.weight, fontStyle: f.style, fontStretch: f.stretch };
      const metric = metrics.get(f.run);
      Object.assign(f.run.style, font, { fontSize: `${f.size}px`, lineHeight: `${metric.ascent + metric.descent}px`, position: "static", top: "auto" });
    }
    for (const property of [
      "text-indent",
      "margin-top",
      "margin-bottom",
      "margin-left",
      "margin-right",
      "padding-top",
      "padding-bottom",
      "padding-left",
      "padding-right"
    ])
      paragraph.style.setProperty(property, style.getPropertyValue(property));
    paragraph.style.fontSize = "0";
    paragraph.style.lineHeight = "0";
    const lines2 = [];
    let simple = true;
    const walker = document2.createTreeWalker(paragraph, view.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const run = node.parentElement, metric = metrics.get(run);
      if (!metric || marker?.contains(run)) continue;
      for (const match of node.data.matchAll(/\S+/gu)) {
        checkpoint?.();
        const range = document2.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const box = range.getBoundingClientRect();
        if (range.getClientRects().length !== 1) simple = false;
        const baseline = box.top + metric.offset;
        if (!lines2.length || Math.abs(baseline - lines2.at(-1).baseline) > 0.05)
          lines2.push({ pieces: [], ascent: 0, descent: 0, baseline, marker: 0, carrier: { ascent: 0, descent: 0 } });
        const line = lines2.at(-1);
        line.pieces.push({ node, start: match.index, end: match.index + match[0].length, left: box.left, width: box.width, run });
        const extent = BREAK_CARRIER.test(match[0]) ? line.carrier : line;
        extent.ascent = Math.max(extent.ascent, metric.ascent);
        extent.descent = Math.max(extent.descent, metric.descent);
      }
    }
    for (const run of runs) run.style.lineHeight = "0";
    const markerText = document2.createTreeWalker(marker ?? paragraph, view.NodeFilter.SHOW_TEXT);
    for (let node = marker && markerText.nextNode(); node && lines2.length; node = markerText.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const span = node.parentElement, box = span.querySelector(GLYPH_ASCENT);
      lines2[0].marker = Math.max(lines2[0].marker, box ? box.getBoundingClientRect().height : metrics.get(span)?.ascent ?? 0);
    }
    for (const line of lines2) if (!line.descent) Object.assign(line, line.carrier);
    const css = (value) => Number(value.toPrecision(6));
    const inserted = [];
    for (const line of [...lines2].reverse()) {
      const last = line.pieces.at(-1);
      const text = line.ascent + line.descent;
      const natural = css(Math.max(line.ascent, line.marker) + line.descent);
      const spaced = pitch ? gridLineHeight(natural, pitch, multiple) : natural + text * (multiple - 1);
      const height = css(Math.max(minimum, spaced));
      line.descent = css(line.descent);
      const descent = css(line.descent + (pitch ? (spaced - natural) / 2 : minimum ? 0 : height - natural));
      const range = document2.createRange();
      range.setStart(last.node, last.end);
      range.collapse(true);
      const strut = document2.createElement("span");
      strut.dataset.docxLineMetric = pitch ? "grid" : minimum ? "minimum" : "auto";
      if (pitch) strut.dataset.docxLineGrid = String(css(spaced));
      strut.dataset.docxLineNatural = String(natural);
      strut.dataset.docxLineDescent = String(line.descent);
      strut.setAttribute("aria-hidden", "true");
      strut.style.cssText = `display:inline-block;position:static;float:none;transform:none;width:0;height:${height}px;font-size:0;line-height:0;vertical-align:${-descent}px;margin:0;padding:0;border:0`;
      range.insertNode(strut);
      inserted.unshift(strut);
    }
    const observed = (words() ?? []).map((piece) => ({
      ...piece,
      baseline: piece.top + metrics.get(piece.node.parentElement).offset
    }));
    let nextTop = paragraph.getBoundingClientRect().top + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.borderTopWidth);
    const ownsLines = inserted.every((strut, index) => {
      const box = strut.getBoundingClientRect(), expected = Number.parseFloat(strut.style.height);
      const valid2 = Math.abs(box.top - nextTop) < 0.05 + index / 64 && Math.abs(box.height - expected) < 1 / 32;
      nextTop += expected;
      return valid2;
    });
    let pieceIndex = 0;
    const membership = lines2.every((line, index) => {
      const strut = inserted[index], box = strut.getBoundingClientRect();
      const baseline = box.bottom + Number.parseFloat(strut.style.verticalAlign);
      return line.pieces.every(() => Math.abs(observed[pieceIndex++]?.baseline - baseline) < 0.05);
    });
    const markerBox = marker?.getBoundingClientRect(), firstLine = inserted[0]?.getBoundingClientRect();
    const markerOnFirstLine = !markerBox || !!firstLine && markerBox.top >= firstLine.top - 0.05 && markerBox.bottom <= firstLine.bottom + 0.05;
    const valid = pristine && simple && lines2.length > 0 && lines2.every((line) => line.descent > 0) && markerOnFirstLine && ownsLines && membership && sourceText === paragraph.textContent && observed.length === pristine.length && pristine.every((piece, index) => Math.abs(piece.left - observed[index].left) < 1 / 32 && Math.abs(piece.width - observed[index].width) < 1 / 32) && inserted.every((strut, index) => index === 0 || strut.getBoundingClientRect().top > inserted[index - 1].getBoundingClientRect().top);
    if (!valid) {
      paragraph.replaceChildren(...Array.from(before.childNodes));
      const saved = before.getAttribute("style");
      if (saved === null) paragraph.removeAttribute("style");
      else paragraph.setAttribute("style", saved);
      continue;
    }
    paragraph.dataset.docxMixedLines = String(width);
    prepared++;
  }
  return prepared;
}
function isMixedLineMetric(element) {
  if (!element.closest("[data-docx-mixed-lines]") || element.localName !== "span" || element.childNodes.length || element.id || element.hasAttribute("data-anchor") || element.hasAttribute("data-source-anchor-id") || !["auto", "minimum", "grid"].includes(element.dataset.docxLineMetric ?? "")) return false;
  const style = element.isConnected ? element.ownerDocument.defaultView.getComputedStyle(element) : element.style;
  const natural = Number(element.dataset.docxLineNatural), descent = Number(element.dataset.docxLineDescent);
  const height = Number.parseFloat(style.height), kind = element.dataset.docxLineMetric;
  const grid = kind === "grid" ? Number(element.dataset.docxLineGrid) : natural;
  const extra = kind === "auto" ? height - natural : (grid - natural) / 2;
  return natural > 0 && descent > 0 && descent < natural && Number.isFinite(natural) && grid >= natural && grid < height + 0.01 && style.display === "inline-block" && style.position === "static" && style.transform === "none" && style.float === "none" && style.width === "0px" && height > 0 && Number.isFinite(height) && Math.abs(Number.parseFloat(style.verticalAlign) + descent + extra) < 0.01 && [
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width"
  ].every((property) => Number.parseFloat(style.getPropertyValue(property)) === 0);
}
function gridLineHeight(natural, pitch, multiple) {
  return Math.max(Math.ceil(natural / pitch), multiple) * pitch;
}
function applyParagraphLineGrids(grids, naturalHeights) {
  const view = grids[0].paragraph.ownerDocument.defaultView;
  for (const { paragraph, pitch } of grids) {
    const natural = naturalHeights.get(paragraph);
    if (!natural) continue;
    const style = view.getComputedStyle(paragraph);
    const multiple = Number(style.getPropertyValue("--docx-auto-line-spacing")) || 1;
    const height = gridLineHeight(natural, pitch, multiple);
    if (Number.parseFloat(style.getPropertyValue("--docx-min-line-height")) * 4 / 3 > height) continue;
    const multiplied = (run) => multiple !== 1 && run.position === "relative" && Math.abs(Number.parseFloat(run.lineHeight) - natural * multiple) < 0.01 && Math.abs(Number.parseFloat(run.top) - Math.min(0, natural * (1 - multiple) / 2)) < 0.01;
    const runs = uniformParagraphRuns(paragraph, true, multiplied);
    if (!runs || runs.some((run) => run.parentElement === paragraph ? naturalHeights.get(run) !== natural && !multiplied(view.getComputedStyle(run)) : view.getComputedStyle(run).lineHeight !== view.getComputedStyle(run.parentElement).lineHeight)) continue;
    paragraph.style.lineHeight = `${natural.toFixed(4)}px`;
    for (const child of runs) {
      if (child.parentElement !== paragraph) continue;
      child.style.lineHeight = `${height}px`;
      child.style.position = "relative";
      child.style.top = "0px";
      child.style.setProperty("--docx-word-native-height", `${natural}px`);
      child.style.setProperty("--docx-word-grid-height", `${height}px`);
    }
  }
}
function gridTextOffset(run) {
  const grid = Number.parseFloat(run.getPropertyValue("--docx-word-grid-height"));
  const native = Number.parseFloat(run.getPropertyValue("--docx-word-native-height"));
  return grid > native ? (grid - native) / 2 : 0;
}
function positionRubyAnnotations(root) {
  const document2 = root.ownerDocument, view = document2.defaultView;
  for (const wrapper of Array.from(root.querySelectorAll('[data-docx-ruby="true"]'))) {
    if (wrapper.dataset.docxRubyPositioned === "true") continue;
    const raise = Number(wrapper.dataset.docxRubyRaise);
    const annotation = wrapper.querySelector("ruby > rt");
    if (!annotation || !Number.isFinite(raise) || raise < 0) continue;
    const clone = wrapper.cloneNode(true);
    const originals = [wrapper, ...Array.from(wrapper.querySelectorAll("*"))];
    const copies = [clone, ...Array.from(clone.querySelectorAll("*"))];
    originals.forEach((element, index) => {
      const style = view.getComputedStyle(element);
      for (const property of [
        "font-family",
        "font-size",
        "font-style",
        "font-weight",
        "font-stretch",
        "line-height",
        "letter-spacing",
        "word-spacing",
        "white-space",
        "direction"
      ])
        copies[index].style.setProperty(property, style.getPropertyValue(property));
    });
    const base = clone.querySelector("[data-docx-ruby-base]");
    const rt = clone.querySelector("ruby > rt");
    if (!base || !rt) continue;
    const host = document2.createElement("div");
    host.style.cssText = "position:absolute;left:-100000px;top:0;visibility:hidden;width:max-content;";
    host.append(clone);
    (document2.body ?? document2.documentElement).append(host);
    const marker = () => {
      const span = document2.createElement("span");
      span.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline;margin:0;padding:0;border:0";
      return span;
    };
    const baseMarker = marker(), annotationMarker = marker();
    base.append(baseMarker);
    rt.append(annotationMarker);
    const shift = baseMarker.getBoundingClientRect().top - annotationMarker.getBoundingClientRect().top - raise * 96 / 72;
    host.remove();
    annotation.style.position = "relative";
    annotation.style.top = `${shift}px`;
    wrapper.style.marginTop = `${-shift}px`;
    wrapper.dataset.docxRubyPositioned = "true";
  }
}
var PARAGRAPH_SELECTOR = "p, h1, h2, h3, h4, h5, h6";
function baselineOffsets(document2) {
  const offsets = /* @__PURE__ */ new Map();
  const host = document2.body ?? document2.documentElement;
  return (paragraph, child) => {
    const key = [
      paragraph.fontStyle,
      paragraph.fontWeight,
      paragraph.fontStretch,
      paragraph.fontFamily,
      paragraph.fontSize,
      paragraph.lineHeight,
      child.fontStyle,
      child.fontWeight,
      child.fontStretch,
      child.fontFamily,
      child.fontSize,
      child.lineHeight,
      child.verticalAlign,
      child.top
    ].join("|");
    let offset = offsets.get(key);
    if (offset === void 0) {
      const probe = document2.createElement("div");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "position:absolute;left:-100000px;top:0;visibility:hidden;width:max-content;margin:0;padding:0;border:0;white-space:nowrap;";
      for (const property of ["font-family", "font-style", "font-weight", "font-stretch", "font-size", "line-height"])
        probe.style.setProperty(property, paragraph.getPropertyValue(property));
      const span = document2.createElement("span");
      for (const property of [
        "font-family",
        "font-style",
        "font-weight",
        "font-stretch",
        "font-size",
        "line-height",
        "vertical-align",
        "position",
        "top"
      ])
        span.style.setProperty(property, child.getPropertyValue(property));
      const marker = document2.createElement("span");
      marker.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline;margin:0;padding:0;border:0;";
      span.append(marker, LATIN_PROBE);
      probe.append(span);
      host.appendChild(probe);
      offset = marker.getBoundingClientRect().bottom - probe.getBoundingClientRect().top;
      probe.remove();
      offsets.set(key, offset);
    }
    return offset;
  };
}
function alignExactLineBaselines(root) {
  const view = root.ownerDocument.defaultView;
  if (!view) return;
  const offsetFor = baselineOffsets(root.ownerDocument);
  for (const run of Array.from(root.querySelectorAll("[data-docx-exact-run]"))) {
    const paragraph = run.closest(PARAGRAPH_SELECTOR);
    if (!paragraph || !movable(run, view)) continue;
    const style = view.getComputedStyle(paragraph);
    if (!style.getPropertyValue("--docx-exact-line-height")) continue;
    const height = Number.parseFloat(style.lineHeight);
    const runStyle = view.getComputedStyle(run);
    if (!(height > 0) || runStyle.display !== "inline" || runStyle.verticalAlign !== "top") continue;
    const top = Number.parseFloat(runStyle.top) || 0;
    const offset = offsetFor(style, runStyle) - top;
    const shift = height * 0.8 - offset;
    if (!Number.isFinite(shift)) continue;
    run.style.position = "relative";
    run.style.top = `${(top + shift).toFixed(4)}px`;
  }
}
var EXACT_INK_ATTRIBUTE = "data-docx-exact-ink";
function preserveExactLineInk(content, topLimit, bottomLimit, paper) {
  const view = content.ownerDocument.defaultView;
  if (!view) return;
  const band = content.getBoundingClientRect();
  const scale = band.width / content.offsetWidth || 1;
  let above = 0;
  let below = 0;
  for (const paragraph of Array.from(content.querySelectorAll(PARAGRAPH_SELECTOR))) {
    if (!view.getComputedStyle(paragraph).getPropertyValue("--docx-exact-line-height")) continue;
    const box = paragraph.getBoundingClientRect();
    if (box.top < band.top - 0.5 || box.bottom > band.bottom + 0.5) continue;
    if (!paragraph.querySelector("[data-docx-exact-run]") || paragraph.querySelector("img, svg, canvas, video, object, iframe"))
      continue;
    if (Array.from(paragraph.querySelectorAll("*")).some((element) => {
      const style = view.getComputedStyle(element);
      return style.display !== "inline" || !["static", "relative"].includes(style.position);
    })) continue;
    const range = content.ownerDocument.createRange();
    range.selectNodeContents(paragraph);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    if (rects.length === 0) continue;
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    if (top < topLimit || bottom > bottomLimit) continue;
    const extra = Math.max(0, band.top - top, bottom - band.bottom);
    if (extra === 0) continue;
    paragraph.setAttribute(EXACT_INK_ATTRIBUTE, "true");
    above = Math.max(above, band.top - top);
    below = Math.max(below, bottom - band.bottom);
  }
  if (above > 0 || below > 0) {
    const up = Math.ceil(above / scale * 64) / 64;
    const down = Math.ceil(below / scale * 64) / 64;
    content.style.overflowY = "visible";
    content.style.clipPath = `inset(${-up}px ${(band.right - paper.right) / scale}px ${-down}px ${(paper.left - band.left) / scale}px)`;
  }
}
function insetClipBounds(value, box, scale) {
  const n = "-?\\d+(?:\\.\\d+)?";
  const rectangle = new RegExp(`^path\\(["']M\\s*(${n})[ ,]+(${n})\\s*H\\s*(${n})\\s*V\\s*(${n})\\s*H\\s*(${n})\\s*Z(?:\\s*M\\s*${n}[ ,]+${n}\\s*[HV]\\s*${n}){4}["']\\)$`).exec(value);
  if (rectangle && rectangle[1] === rectangle[5]) {
    const [, left2, top2, right2, bottom2] = rectangle.map(Number);
    return {
      left: box.left + left2 * scale,
      top: box.top + top2 * scale,
      right: box.left + right2 * scale,
      bottom: box.top + bottom2 * scale
    };
  }
  const match = /^inset\(((?:-?\d+(?:\.\d+)?px\s*){1,4})\)$/.exec(value);
  if (!match) return null;
  const parts = match[1].trim().split(/\s+/).map(Number.parseFloat);
  const [top, right = top, bottom = top, left = right] = parts;
  return {
    top: box.top + top * scale,
    right: box.right - right * scale,
    bottom: box.bottom - bottom * scale,
    left: box.left + left * scale
  };
}
function isPreservedExactLineInk(element, content) {
  const paragraph = element.closest(`[${EXACT_INK_ATTRIBUTE}]`);
  const view = content.ownerDocument.defaultView;
  if (!paragraph || !view || element === paragraph || !content.contains(paragraph)) return false;
  if (view.getComputedStyle(element).display !== "inline") return false;
  const band = content.getBoundingClientRect();
  const box = paragraph.getBoundingClientRect();
  const clip = insetClipBounds(view.getComputedStyle(content).clipPath, band, band.width / content.offsetWidth || 1);
  const ink = element.getBoundingClientRect();
  return clip !== null && box.top >= band.top - 0.5 && box.bottom <= band.bottom + 0.5 && ink.top >= clip.top - 0.02 && ink.bottom <= clip.bottom + 0.02;
}
var REPLACED_ELEMENTS = /* @__PURE__ */ new Set(["img", "svg", "canvas", "video", "object", "embed", "iframe", "input", "textarea", "select"]);
function measureLaidOutBottoms(band) {
  const bottoms = /* @__PURE__ */ new Map();
  const view = band.ownerDocument.defaultView;
  const scale = band.getBoundingClientRect().width / band.offsetWidth || 1;
  const range = band.ownerDocument.createRange();
  const visit = (element, ancestorBottom) => {
    if (element.hasAttribute("data-docx-line-metric") && isMixedLineMetric(element)) return -Infinity;
    const style = view?.getComputedStyle(element);
    const transparent = style?.display === "contents";
    const inline = style?.display === "inline" && !REPLACED_ELEMENTS.has(element.localName);
    const boxBottom = transparent ? ancestorBottom : element.getBoundingClientRect().bottom - (inline ? (Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderBottomWidth)) * scale : 0);
    const measureChildren = transparent || inline && element.children.length > 0;
    const generated = measureChildren && ["::before", "::after"].some((pseudo) => !["none", "normal"].includes(view.getComputedStyle(element, pseudo).content));
    let contentBottom = -Infinity;
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 1) contentBottom = Math.max(contentBottom, visit(child, boxBottom));
      else if (measureChildren && child.nodeType === 3) {
        range.selectNodeContents(child);
        for (const rect of Array.from(range.getClientRects())) contentBottom = Math.max(contentBottom, rect.bottom);
      }
    }
    const bottom = measureChildren && !generated && Number.isFinite(contentBottom) ? contentBottom : boxBottom;
    bottoms.set(element, bottom);
    return bottom;
  };
  const boundary = band.getBoundingClientRect().bottom;
  for (const element of Array.from(band.children)) visit(element, boundary);
  return bottoms;
}
function alignBaselinesToWord(root) {
  const document2 = root.ownerDocument;
  const view = document2.defaultView;
  if (!view) return 0;
  const descents = /* @__PURE__ */ new Map();
  const probeSize = fontProbeSize(document2);
  const ratioFor = naturalLineHeightRatios(document2);
  const chromiumOffset = baselineOffsets(document2);
  const descentRatio = (style) => {
    const font = `${style.fontStyle} ${style.fontWeight} ${probeSize}px ${style.fontFamily}`;
    let ratio = descents.get(font);
    if (ratio === void 0) {
      const context = document2.createElement("canvas").getContext("2d");
      ratio = Number.NaN;
      if (context) {
        context.font = font;
        if (context.font.includes(`${probeSize}px`))
          ratio = context.measureText(LATIN_PROBE).fontBoundingBoxDescent / probeSize;
      }
      descents.set(font, ratio);
    }
    return ratio;
  };
  const moves = [];
  for (const paragraph of Array.from(root.querySelectorAll(PARAGRAPH_SELECTOR))) {
    if (!(paragraph instanceof view.HTMLElement)) continue;
    const style = view.getComputedStyle(paragraph);
    const candidates = Array.from(paragraph.children).filter((child) => child instanceof view.HTMLElement && (child.textContent ?? "").trim() !== "" && movable(child, view) && view.getComputedStyle(child).display === "inline" && view.getComputedStyle(child).verticalAlign === "baseline");
    const first = candidates.find((child) => view.getComputedStyle(child).fontFamily === style.fontFamily) ?? candidates[0];
    if (!first) continue;
    const lineHeight = Number.parseFloat(style.lineHeight);
    const fontSize = Number.parseFloat(style.fontSize);
    const natural = ratioFor(style, LATIN_PROBE) * fontSize;
    const minimum = Number.parseFloat(style.getPropertyValue("--docx-min-line-height")) * 4 / 3;
    const minimumRuns = minimum >= natural && Math.abs(lineHeight - minimum) < 0.01 && !Number.parseFloat(style.getPropertyValue("--docx-exact-line-height")) && !BEYOND_LATIN.test(paragraph.textContent ?? "") ? uniformParagraphRuns(paragraph, true) : void 0;
    const uniformMinimum = minimumRuns?.every((run) => view.getComputedStyle(run).lineHeight === style.lineHeight);
    if (!(lineHeight > 0) || !(fontSize > 0) || !uniformMinimum && Math.abs(lineHeight - natural) > 0.01) continue;
    const descent = descentRatio(style);
    if (!(descent > 0)) continue;
    const childStyle = view.getComputedStyle(first);
    const pitch = Number.parseFloat(style.getPropertyValue("--docx-line-grid")) * 4 / 3;
    const centred = uniformMinimum && pitch > 0 ? (natural - gridLineHeight(natural, pitch, 1)) / 2 : gridTextOffset(childStyle);
    const shift = lineHeight + centred - descent * fontSize - chromiumOffset(style, childStyle);
    if (!Number.isFinite(shift) || Math.abs(shift) < 1 / 64 || Math.abs(shift) >= lineHeight / 2) continue;
    for (const child of Array.from(paragraph.children))
      if (child instanceof view.HTMLElement && (movable(child, view) || uniformMinimum && minimumRuns.includes(child))) {
        const top = Number.parseFloat(view.getComputedStyle(child).top);
        moves.push({ element: child, top: (Number.isFinite(top) ? top : 0) + shift });
      }
  }
  for (const { element, top } of moves) {
    element.style.setProperty("position", "relative");
    element.style.setProperty("top", `${top.toFixed(4)}px`);
  }
  return moves.length;
}
function movable(element, view) {
  const position = view.getComputedStyle(element).position;
  if (position !== "static" && position !== "relative") return false;
  if (!["inline", "inline-block"].includes(view.getComputedStyle(element).display)) return false;
  if (element.querySelector("img, svg, math")) return false;
  for (const descendant of Array.from(element.querySelectorAll("*")))
    if (["absolute", "fixed"].includes(view.getComputedStyle(descendant).position)) return false;
  return true;
}

// src/font-contract.ts
var FONT_SUBSTITUTION_CONTRACT_VERSION = 1;
var FONT_RESOLVER_SCHEMA_VERSION = 1;
var FONT_RESOLVER_CONTRACT_ID = "https://docxodus.dev/contracts/font-resolver/v1";
function normalizeFontFamilyName(value) {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}
function fontFamilyKey(value) {
  return normalizeFontFamilyName(value).toLowerCase();
}
function substitution(entry) {
  return Object.freeze(entry);
}
var FONT_SUBSTITUTION_CONTRACT = Object.freeze([
  substitution({
    family: "Calibri",
    substitute: "Carlito",
    metricCompatible: true
  }),
  // No open metric clone of the Light cut exists. Determinism requires both
  // renderers to make the same documented approximation.
  substitution({
    family: "Calibri Light",
    substitute: "Carlito",
    metricCompatible: false
  }),
  substitution({
    family: "Cambria",
    substitute: "Caladea",
    metricCompatible: true
  }),
  substitution({
    family: "Times New Roman",
    substitute: "Liberation Serif",
    metricCompatible: true
  }),
  substitution({
    family: "Arial",
    substitute: "Liberation Sans",
    metricCompatible: true
  }),
  substitution({
    family: "Courier New",
    substitute: "Liberation Mono",
    metricCompatible: true
  })
]);
var FONT_SUBSTITUTION_CONTRACT_MATERIAL = Object.freeze({
  schemaVersion: FONT_SUBSTITUTION_CONTRACT_VERSION,
  entries: FONT_SUBSTITUTION_CONTRACT
});
var FONT_REQUEST_ATTRIBUTE = "data-docx-font-request";

// src/word-text.ts
var PREPARED = "data-docx-word-text-prepared";
var FITTED_RUN = "data-docx-word-fit";
var FITTED_LINE = "data-docx-word-line";
var NOTE_FIT = "data-docx-note-fit";
var CONDENSED = "data-docx-condensed-lines";
var CONDENSED_LINE = "data-docx-condensed-line";
var SVG_NS = "http://www.w3.org/2000/svg";
var PARAGRAPHS = "p, h1, h2, h3, h4, h5, h6";
function prepareFitText(root, checkpoint) {
  const view = root.ownerDocument.defaultView;
  if (!view) return 0;
  let count = 0;
  const visited = /* @__PURE__ */ new Set();
  for (const first of Array.from(root.querySelectorAll("[data-docx-fit-text-width]"))) {
    checkpoint?.();
    if (visited.has(first) || first.closest("[data-docx-fit-text-group], [data-field]")) continue;
    const width = Number(first.dataset.docxFitTextWidth);
    const group = [first];
    visited.add(first);
    let next = first.nextSibling;
    while (next instanceof view.HTMLElement && next.dataset.docxFitTextWidth === first.dataset.docxFitTextWidth && next.dataset.docxFitTextId === first.dataset.docxFitTextId) {
      checkpoint?.();
      group.push(next);
      visited.add(next);
      next = next.nextSibling;
    }
    if (!Number.isFinite(width) || width < 0 || group.length !== Number(first.dataset.docxFitTextCount) || group.some((run) => run.localName !== "span" || run.children.length || run.childNodes.length !== 1 || run.firstChild?.nodeType !== 3 || !/^[\u0020-\u024f]+$/u.test(run.textContent ?? "") || (() => {
      const style = view.getComputedStyle(run);
      return style.direction !== "ltr" || style.display !== "inline" || style.cssFloat !== "none" || style.transform !== "none" || style.translate !== "none" || style.rotate !== "none" || style.scale !== "none" || style.writingMode !== "horizontal-tb" || characterScale(style) !== 1 || ["left", "right"].some((side) => !["auto", "0px"].includes(style.getPropertyValue(side))) || ["top", "right", "bottom", "left"].some((side) => style.getPropertyValue(`margin-${side}`) !== "0px" || style.getPropertyValue(`padding-${side}`) !== "0px" || style.getPropertyValue(`border-${side}-width`) !== "0px");
    })())) continue;
    const outer = root.ownerDocument.createElement("span");
    const inner = root.ownerDocument.createElement("span");
    outer.dataset.docxFitTextGroup = "true";
    outer.style.cssText = `display:inline-block;width:${width}pt;text-indent:0;white-space:pre;margin:0;padding:0;border:0`;
    inner.style.cssText = "display:inline-block;white-space:pre;transform-origin:left top;margin:0;padding:0;border:0";
    const originalStyles = group.map((run) => run.getAttribute("style"));
    first.before(outer);
    outer.append(inner);
    inner.append(...group);
    for (const run of group) {
      run.style.whiteSpace = "pre";
      run.style.letterSpacing = "0";
    }
    const natural = Number.parseFloat(view.getComputedStyle(inner).width);
    if (!(natural > 0)) {
      outer.replaceWith(...group);
      group.forEach((run, i) => originalStyles[i] === null ? run.removeAttribute("style") : run.setAttribute("style", originalStyles[i]));
      continue;
    }
    inner.style.transform = `scaleX(${width * 4 / 3 / natural})`;
    count++;
  }
  return count;
}
function isFitTextInlineBox(box) {
  const view = box.ownerDocument.defaultView, inner = box.firstElementChild;
  if (box.localName !== "span" || box.dataset.docxFitTextGroup !== "true" || box.childNodes.length !== 1 || !(inner instanceof view.HTMLElement) || inner.localName !== "span" || !inner.childNodes.length || inner.childNodes.length !== inner.children.length) return false;
  const runs = Array.from(inner.children), first = runs[0];
  const width = Number(first.dataset.docxFitTextWidth);
  const scale = /^scaleX\(([\d.e+-]+)\)$/.exec(inner.style.transform);
  if (!Number.isFinite(width) || width < 0 || !scale || !(Number(scale[1]) >= 0) || runs.length !== Number(first.dataset.docxFitTextCount) || runs.some((run) => run.localName !== "span" || run.children.length || run.childNodes.length !== 1 || run.firstChild?.nodeType !== 3 || run.dataset.docxFitTextId !== first.dataset.docxFitTextId || run.dataset.docxFitTextWidth !== first.dataset.docxFitTextWidth || ["top", "right", "bottom", "left"].some((side) => {
    const style = view.getComputedStyle(run);
    return style.getPropertyValue(`margin-${side}`) !== "0px" || style.getPropertyValue(`padding-${side}`) !== "0px" || style.getPropertyValue(`border-${side}-width`) !== "0px";
  }))) return false;
  if ([box, inner].some((element) => {
    const style = view.getComputedStyle(element);
    return style.display !== "inline-block" || style.position !== "static" || style.cssFloat !== "none" || style.whiteSpace !== "pre" || style.direction !== "ltr" || style.writingMode !== "horizontal-tb" || style.translate !== "none" || style.rotate !== "none" || style.scale !== "none" || element === box && style.transform !== "none" || ["top", "right", "bottom", "left"].some((side) => style.getPropertyValue(`padding-${side}`) !== "0px" || style.getPropertyValue(`border-${side}-width`) !== "0px");
  })) return false;
  const outer = box.getBoundingClientRect(), painted = inner.getBoundingClientRect();
  return Math.abs(outer.width - width * 4 / 3) < 1 / 32 && Math.abs(painted.width - outer.width) < 1 / 32 && Math.abs(painted.left - outer.left) < 1 / 32;
}
function plainFlow(root) {
  if (root.querySelector("svg, math, canvas, video, audio, iframe, object, [data-docx-frame-exclusion]"))
    return false;
  return Array.from(root.querySelectorAll("img")).every((img) => {
    const paragraph = img.closest(PARAGRAPHS);
    return paragraph !== null && plainRun(
      paragraph,
      root.ownerDocument.defaultView?.getComputedStyle(paragraph).direction === "rtl"
    ) !== null;
  });
}
function pictureSibling(element, view) {
  if (!(element instanceof view.HTMLElement) || element.localName !== "span" || element.children.length !== 1)
    return false;
  const wrapper = element.firstElementChild;
  if (wrapper.localName !== "span" || wrapper.children.length !== 1 || wrapper.firstElementChild?.localName !== "img")
    return false;
  if (wrapper.dataset.docxEdgePicture !== "true") return false;
  const style = view.getComputedStyle(wrapper);
  const outer = view.getComputedStyle(element);
  const image = view.getComputedStyle(wrapper.firstElementChild);
  return ["left", "right"].includes(style.cssFloat) && style.position === "static" && style.transform === "none" && outer.display === "inline" && ["static", "relative"].includes(outer.position) && outer.transform === "none" && image.transform === "none" && image.position === "static";
}
function plainRun(paragraph, rightToLeft = false, allowExact = false) {
  const view = paragraph.ownerDocument.defaultView;
  if (!view) return null;
  const children = Array.from(paragraph.children);
  const content = children.filter((child) => child.textContent !== "");
  if (content.length !== 1) return null;
  const run = content[0];
  if (children.length !== 1) {
    const runStyle = view.getComputedStyle(run);
    for (const empty of children.filter((child) => child !== run)) {
      if (pictureSibling(empty, view)) {
        const pictureStyle = view.getComputedStyle(empty);
        if (["font-size", "font-style", "font-weight", "vertical-align"].some((property) => pictureStyle.getPropertyValue(property) !== runStyle.getPropertyValue(property))) return null;
        continue;
      }
      if (paragraph.dataset.columnBreakBefore !== "true") return null;
      if (!(empty instanceof view.HTMLElement) || empty.localName !== "span" || empty.childNodes.length || Array.from(empty.attributes).some((a) => !["class", "style", "lang", "dir"].includes(a.name))) return null;
      const emptyStyle = view.getComputedStyle(empty);
      if ([
        "font-family",
        "font-size",
        "font-style",
        "font-weight",
        "font-stretch",
        "line-height",
        "display",
        "position",
        "top",
        "vertical-align"
      ].some((property) => emptyStyle.getPropertyValue(property) !== runStyle.getPropertyValue(property))) return null;
    }
  }
  if (!(run instanceof view.HTMLElement) || run.localName !== "span") return null;
  const fitted = Number(run.getAttribute(FITTED_RUN)) > 0;
  if (fitted) {
    if (!run.childNodes.length || Array.from(run.childNodes).some((node) => !(node instanceof view.HTMLElement) || node.localName !== "span" || node.getAttribute(FITTED_LINE) !== "true" || node.children.length || node.childNodes.length > 1 || node.firstChild && node.firstChild.nodeType !== 3)) return null;
  } else if (run.children.length || run.childNodes.length !== 1 || run.firstChild?.nodeType !== 3) return null;
  const text = run.textContent ?? "";
  if (!text.trim() || /^\s/.test(text) || !rightToLeft && !/^[\u0020-\u024f]*$/u.test(text)) return null;
  if (Array.from(run.attributes).some((a) => ![
    "class",
    "style",
    "lang",
    "dir",
    FONT_REQUEST_ATTRIBUTE,
    "data-docx-fit-text-width",
    "data-docx-fit-text-id",
    "data-docx-fit-text-count",
    ...allowExact ? ["data-docx-exact-run"] : [],
    ...fitted || run.getAttribute(FITTED_RUN) === "0" ? [FITTED_RUN] : []
  ].includes(a.name))) return null;
  const style = view.getComputedStyle(run);
  const parent = view.getComputedStyle(paragraph);
  if (allowExact && run.hasAttribute("data-docx-exact-run") && style.position === "relative" && ["top", "bottom"].some((side) => !["auto", "0px"].includes(style.getPropertyValue(side)))) return null;
  if (["Top", "Right", "Bottom", "Left"].some((side) => parent.getPropertyValue(`padding-${side.toLowerCase()}`) !== "0px" || parent.getPropertyValue(`border-${side.toLowerCase()}-width`) !== "0px")) return null;
  if (parent.direction !== (rightToLeft ? "rtl" : "ltr") || parent.writingMode !== "horizontal-tb" || style.display !== "inline" || !["static", "relative"].includes(style.position) || style.position === "relative" && [style.left, style.right].some((side) => !["auto", "0px"].includes(side)) || style.textTransform !== "none" || style.fontVariantCaps !== "normal" || style.textDecorationLine !== "none" || !["normal", "0px"].includes(style.letterSpacing) || !["normal", "100%"].includes(style.fontStretch) || style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.textShadow !== "none" || style.transform !== "none" || style.opacity !== "1" || style.verticalAlign !== "baseline" && !(allowExact && run.hasAttribute("data-docx-exact-run") && style.verticalAlign === "top")) return null;
  return run;
}
function contourRows(image, paragraph, run, lineCount, checkpoint) {
  const view = paragraph.ownerDocument.defaultView;
  const wrapper = image.parentElement;
  if (wrapper.dataset.docxWrapText !== "bothSides" || image.closest(".page-content") !== paragraph.closest(".page-content")) return null;
  const wrapStyle = view.getComputedStyle(wrapper);
  if (wrapStyle.marginTop !== "0px" || wrapStyle.marginBottom !== "0px") return null;
  const polygon = /^polygon\((.*)\) border-box$/.exec(wrapStyle.shapeOutside);
  if (!polygon) return null;
  const points = polygon[1].split(",").map((point) => {
    const match = /^\s*([\d.+-]+)%\s+([\d.+-]+)%\s*$/.exec(point);
    return match ? { x: Number(match[1]) / 100, y: Number(match[2]) / 100 } : null;
  });
  if (points.length < 3 || points.some((p) => !p || !Number.isFinite(p.x + p.y))) return null;
  const vertices = points;
  let orientation = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length], c = vertices[(i + 2) % vertices.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-8) continue;
    if (orientation && Math.sign(cross) !== orientation) return null;
    orientation = Math.sign(cross);
  }
  if (!orientation) return null;
  const left = Number.parseFloat(wrapStyle.getPropertyValue("--docx-wrap-distance-left")) * 4 / 3;
  const right = Number.parseFloat(wrapStyle.getPropertyValue("--docx-wrap-distance-right")) * 4 / 3;
  if (!Number.isFinite(left + right) || left < 0 || right < 0) return null;
  const box = paragraph.getBoundingClientRect();
  const picture = image.getBoundingClientRect();
  if (box.top >= picture.bottom || box.bottom <= picture.top) return null;
  const style = view.getComputedStyle(run);
  if (!["start", "left"].includes(view.getComputedStyle(paragraph).textAlign)) return null;
  const pitch = Number.parseFloat(style.lineHeight);
  const nativeHeight = Number.parseFloat(style.getPropertyValue("--docx-word-native-height"));
  if (!(nativeHeight > 0) || !(pitch > 0) || !(picture.width > 0) || !(picture.height > 0)) return null;
  const context = fontContext(paragraph.ownerDocument, style);
  if (!context) return null;
  const measureScale = Number.parseFloat(style.fontSize) / 1e4;
  const words = Array.from(run.textContent.matchAll(/\S+\s*/gu), (match, index) => {
    if ((index & 63) === 0) checkpoint?.();
    return {
      text: match[0],
      width: context.measureText(match[0].trimEnd()).width * measureScale,
      advance: context.measureText(match[0]).width * measureScale
    };
  });
  const rows = /* @__PURE__ */ new Map();
  let next = 0;
  for (let line = 0; line < lineCount && next < words.length; line++) {
    checkpoint?.();
    const top = (box.top + line * pitch + gridTextOffset(style) - picture.top) / picture.height;
    const bottom = top + nativeHeight / picture.height;
    const crossings = [];
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i], b = vertices[(i + 1) % vertices.length];
      if (a.y >= top && a.y <= bottom) crossings.push(a.x);
      for (const y of [top, bottom])
        if (a.y !== b.y && y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y))
          crossings.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y));
    }
    const slots = crossings.length ? [
      [box.left, Math.min(box.right, picture.left + Math.min(...crossings) * picture.width - left)],
      [Math.max(box.left, picture.left + Math.max(...crossings) * picture.width + right), box.right]
    ] : [[box.left, box.right]];
    const row = [];
    for (const [start, end] of slots) {
      let x = start;
      while (next < words.length && x + words[next].width <= end + 1 / 64) {
        const word = words[next++];
        row.push({ text: word.text, x: x - box.left });
        x += word.advance;
      }
    }
    if (!row.length) return null;
    rows.set(line, row);
  }
  return next === words.length && rows.size === lineCount ? rows : null;
}
function characterScale(style) {
  const scale = Number(style.getPropertyValue("--docx-character-scale"));
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
function fontContext(document2, style) {
  const context = document2.createElement("canvas").getContext("2d");
  if (!context || !["none", "normal"].includes(style.fontVariantLigatures) || style.fontFeatureSettings !== "normal")
    return null;
  context.font = `${style.fontStyle} ${style.fontWeight} 10000px ${style.fontFamily}`;
  context.fontKerning = style.fontKerning;
  context.textRendering = style.fontVariantLigatures === "none" ? "optimizeSpeed" : "auto";
  return context.font.includes("10000px") ? context : null;
}
function wordMeasure(run, exactHeight = 0) {
  const style = run.ownerDocument.defaultView.getComputedStyle(run);
  const context = fontContext(run.ownerDocument, style);
  if (!context) return null;
  const scale = Number.parseFloat(style.fontSize) / 1e4;
  if (exactHeight > 0) {
    const metrics = context.measureText("Hg");
    if (metrics.fontBoundingBoxAscent * scale > exactHeight * 0.8 || metrics.fontBoundingBoxDescent * scale > exactHeight * 0.2) return null;
  }
  const width = characterScale(style);
  const cell = context.measureText(" ").width;
  const pitch = Math.round(cell * scale * 15) / 15;
  const fixed = Number.isFinite(pitch) && pitch > 0 && context.fontKerning === "none" && [..."iW.m"].every((char) => context.measureText(char).width === cell);
  return Object.assign((text) => {
    const measured = context.measureText(text).width;
    return (fixed && Math.abs(measured - cell * text.length) < 1 / 64 ? pitch * text.length : measured * scale) * width;
  }, { raw: (text) => context.measureText(text).width * scale * width });
}
function paragraphWidth(paragraph, style) {
  const measured = paragraph.getBoundingClientRect().width;
  const declared = /^([\d.]+)(px|pt)$/.exec(paragraph.style.width);
  const resolved = declared ? Number(declared[1]) * (declared[2] === "pt" ? 4 / 3 : 1) : Number.parseFloat(style.width);
  return Math.abs(resolved - measured) < 1 / 64 ? resolved : measured;
}
function wordPerfectJustified(paragraph, style) {
  return style.textAlign === "justify" && (paragraph.closest("[data-docx-wordperfect-justification]")?.getAttribute("data-docx-wordperfect-justification") ?? paragraph.ownerDocument.body.getAttribute("data-docx-wordperfect-justification")) === "true";
}
function chooseLines(words, width, indent, modernJustification, wordPerfect, checkpoint) {
  const rows = [];
  let start = 0;
  while (start < words.length) {
    checkpoint?.();
    const available = width - (rows.length ? 0 : indent);
    const selectionWidth = wordPerfect ? available * (1 + 281 / 7200) : available;
    let natural = 0, gaps = 0, best = start, bestCost = Infinity, bestNatural = 0;
    for (let end = start; end < words.length; end++) {
      if ((end & 63) === 0) checkpoint?.();
      if (end > start) {
        gaps += words[end - 1].gap;
        natural += words[end - 1].gap;
      }
      natural += words[end].width;
      const minimum = natural - (modernJustification ? gaps / 4 : 0);
      const roundoff = Number.EPSILON * 2 * (end - start + 1) * Math.max(natural, selectionWidth);
      if (minimum - selectionWidth > roundoff) break;
      const cost = !modernJustification ? -end : end === words.length - 1 && natural - available <= roundoff ? -1 : gaps ? Math.abs(available - natural) / gaps * (natural > available ? 2 : 1) : Infinity;
      if (cost <= bestCost) {
        best = end;
        bestCost = cost;
        bestNatural = natural;
      }
    }
    if (wordPerfect && words.slice(start, best + 1).reduce((sum, word) => sum + word.width, 0) > available) return null;
    rows.push({
      start,
      end: best,
      available,
      natural: bestNatural,
      spaces: words.slice(start, best).reduce((n, w) => n + w.spaces, 0)
    });
    start = best + 1;
  }
  return rows;
}
function fitWordLines(paragraph, run, modernJustification, checkpoint, exact = false) {
  const view = run.ownerDocument.defaultView;
  const style = view.getComputedStyle(paragraph);
  const runStyle = view.getComputedStyle(run);
  const wordPerfect = wordPerfectJustified(paragraph, style);
  modernJustification &&= !wordPerfect;
  const scale = characterScale(runStyle);
  const text = run.textContent;
  if (runStyle.whiteSpace !== "pre-wrap" || /[^\u0020-\u007e\u00c0-\u024f]|[-/]/u.test(text) || !/^-?[\d.]+px$/.test(style.textIndent) || style.wordBreak !== "normal" || !["normal", "0px"].includes(runStyle.wordSpacing) && !run.style.getPropertyValue("--docx-word-space-compression")) return null;
  const measure = wordMeasure(run, exact ? Number.parseFloat(runStyle.lineHeight) : 0);
  const width = paragraphWidth(paragraph, style);
  const indent = Number.parseFloat(style.textIndent) || 0;
  if (!measure || !(width > 0) || !(width - indent > 0)) return null;
  const space = measure(" ");
  const words = Array.from(text.matchAll(/\S+ */gu), (match, index) => {
    if ((index & 63) === 0) checkpoint?.();
    const word = match[0].trimEnd(), spaces = match[0].length - word.length;
    return { text: match[0], width: measure(word), spaces, gap: spaces * space };
  });
  if (!words.length || words.some((w) => w.width > width) || words[0].width > width - indent) return null;
  const choices = chooseLines(words, width, indent, modernJustification, wordPerfect, checkpoint);
  if (!choices) return null;
  const rows = choices.map((row) => ({
    text: words.slice(row.start, row.end + 1).map((w) => w.text).join(""),
    spaces: row.spaces,
    available: row.available
  }));
  if (scale === 1 && run.childNodes.length === 1 && run.firstChild?.nodeType === 3) {
    const measured = [];
    let offset = 0, top = NaN;
    for (const word of words) {
      checkpoint?.();
      const range = run.ownerDocument.createRange();
      range.setStart(run.firstChild, offset);
      range.setEnd(run.firstChild, offset + word.text.trimEnd().length);
      if (range.getClientRects().length !== 1) break;
      const box = range.getBoundingClientRect(), next = box.top;
      if (next !== top) {
        measured.push("");
        top = next;
      }
      if (box.width > width - (measured.length === 1 ? indent : 0)) return null;
      measured[measured.length - 1] += word.text;
      offset += word.text.length;
    }
    if (offset === text.length && rows.length === measured.length && rows.every((row, index) => row.text === measured[index])) {
      run.setAttribute(FITTED_RUN, "0");
      if (modernJustification || wordPerfect) run.style.setProperty("--docx-word-space-compression", `${-space / 4}px`);
      return "unchanged";
    }
  }
  const previousStyle = run.getAttribute("style");
  const previousFit = run.getAttribute(FITTED_RUN);
  const previousContent = Array.from(run.childNodes);
  const fragment = run.ownerDocument.createDocumentFragment();
  const lines2 = rows.map((row, index) => {
    checkpoint?.();
    const line = run.ownerDocument.createElement("span");
    line.setAttribute(FITTED_LINE, "true");
    line.style.cssText = "display:block;white-space:pre;word-spacing:0px;text-indent:0";
    if (exact) line.style.textAlignLast = "start";
    if (!index && indent) line.style.marginLeft = `${indent}px`;
    if (scale !== 1) {
      line.style.width = `${row.available / scale}px`;
      line.style.transformOrigin = "left top";
      line.style.transform = `scaleX(${scale})`;
    }
    line.textContent = row.text;
    fragment.append(line);
    return line;
  });
  run.style.wordSpacing = "0px";
  run.replaceChildren(fragment);
  for (let index = 0; index < lines2.length; index++) {
    checkpoint?.();
    const range = run.ownerDocument.createRange();
    range.setStart(lines2[index].firstChild, 0);
    range.setEnd(lines2[index].firstChild, rows[index].text.trimEnd().length);
    const excess = range.getBoundingClientRect().width - rows[index].available;
    const justify = exact && index < lines2.length - 1;
    if (excess <= 0 && !justify) continue;
    if (!rows[index].spaces || exact && !wordPerfect && excess / rows[index].spaces > space / 4 + 1 / 64) {
      run.replaceChildren(...previousContent);
      if (previousFit === null) run.removeAttribute(FITTED_RUN);
      else run.setAttribute(FITTED_RUN, previousFit);
      if (previousStyle === null) run.removeAttribute("style");
      else run.setAttribute("style", previousStyle);
      return null;
    }
    lines2[index].style.wordSpacing = `${-excess / rows[index].spaces / scale}px`;
  }
  run.setAttribute(FITTED_RUN, String(exact ? Number.parseFloat(runStyle.lineHeight) : Number.parseFloat(run.style.getPropertyValue("--docx-word-native-height"))));
  if (modernJustification || wordPerfect) run.style.setProperty("--docx-word-space-compression", `${-space / 4}px`);
  return "fitted";
}
function inlineTexts(paragraph) {
  const view = paragraph.ownerDocument.defaultView, filter = view.NodeFilter;
  const walker = paragraph.ownerDocument.createTreeWalker(paragraph, filter.SHOW_ELEMENT | filter.SHOW_TEXT, {
    acceptNode: (node) => node.nodeType === 3 ? filter.FILTER_ACCEPT : node.dataset.listMarker === "true" ? filter.FILTER_REJECT : filter.FILTER_SKIP
  });
  const texts = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.data) texts.push(node);
  return texts;
}
function textRects(paragraph, range) {
  const nodes = inlineTexts(paragraph);
  return (begin, end) => {
    let start = 0;
    for (const text of nodes) {
      const length = text.data.length;
      if (begin >= start && begin < start + length) range.setStart(text, begin - start);
      if (end > start && end <= start + length) {
        range.setEnd(text, end - start);
        break;
      }
      start += length;
    }
    return range.getBoundingClientRect();
  };
}
function planCondensedLines(paragraph, modernJustification, measureFor, range, checkpoint) {
  const document2 = paragraph.ownerDocument, view = document2.defaultView;
  const style = view.getComputedStyle(paragraph);
  const wordPerfect = wordPerfectJustified(paragraph, style);
  modernJustification &&= !wordPerfect;
  if (paragraph.hasAttribute(CONDENSED) || style.textAlign !== "justify" || !(modernJustification || wordPerfect) || style.direction !== "ltr" || style.writingMode !== "horizontal-tb" || style.wordBreak !== "normal" || ["top", "right", "bottom", "left"].some((side) => style.getPropertyValue(`padding-${side}`) !== "0px" || style.getPropertyValue(`border-${side}-width`) !== "0px")) return null;
  const texts = inlineTexts(paragraph);
  if (!texts.length) return null;
  for (const element of Array.from(paragraph.querySelectorAll("*"))) {
    checkpoint?.();
    const marker = element.closest("[data-list-marker]");
    if (marker) {
      if (marker.compareDocumentPosition(texts[0]) & view.Node.DOCUMENT_POSITION_PRECEDING) return null;
      continue;
    }
    const s = view.getComputedStyle(element);
    if (!["span", "a"].includes(element.localName) || element.matches("[data-field], [data-comment-id]") || s.display !== "inline" || s.cssFloat !== "none" || !["static", "relative"].includes(s.position) || [s.left, s.right].some((side) => !["auto", "0px"].includes(side)) || s.verticalAlign !== "baseline" || ["transform", "translate", "rotate", "scale"].some((property) => s.getPropertyValue(property) !== "none") || s.textTransform !== "none" || s.fontVariantCaps !== "normal" || !["normal", "100%"].includes(s.fontStretch) || !["normal", "0px"].includes(s.letterSpacing) || !["normal", "0px"].includes(s.wordSpacing) || characterScale(s) !== 1) return null;
  }
  const words = [];
  let offset = 0;
  for (const text of texts) {
    const parent = text.parentElement;
    if (view.getComputedStyle(parent).whiteSpace !== "pre-wrap" || /[^\u0020-\u007e\u00c0-\u024f]|[-/]/u.test(text.data))
      return null;
    const measure = measureFor(parent);
    if (!measure) return null;
    for (const match of text.data.matchAll(/ +|[^ ]+/gu)) {
      if ((words.length & 63) === 0) checkpoint?.();
      const piece = match[0], last = words.at(-1), begin = offset + match.index;
      if (piece[0] === " ") {
        if (!last) return null;
        last.text += piece;
        last.spaces += piece.length;
        last.gap += measure(piece);
      } else if (last && !last.spaces) {
        last.text += piece;
        last.width += measure(piece);
        last.end = begin + piece.length;
      } else words.push({ text: piece, width: measure(piece), spaces: 0, gap: 0, begin, end: begin + piece.length });
    }
    offset += text.data.length;
  }
  const box = paragraph.getBoundingClientRect(), width = paragraphWidth(paragraph, style);
  const indent = textRects(paragraph, range)(words[0].begin, words[0].end).left - box.left;
  if (!(width > 0) || words.some((word) => word.width > width) || words[0].width > width - indent) return null;
  const rows = chooseLines(words, width, indent, modernJustification, wordPerfect, checkpoint);
  return rows?.some((row) => row.spaces && row.natural > row.available) ? { paragraph, words, rows } : null;
}
function condenseLines(paragraphs, modernJustification, checkpoint) {
  if (!paragraphs.length) return;
  const range = paragraphs[0].ownerDocument.createRange();
  const measurers = /* @__PURE__ */ new Map();
  const measureFor = (run) => {
    const s = run.ownerDocument.defaultView.getComputedStyle(run);
    const key = [s.fontStyle, s.fontWeight, s.fontSize, s.fontFamily, s.fontKerning, s.fontVariantLigatures, s.fontFeatureSettings].join("|");
    if (!measurers.has(key)) {
      const measure = wordMeasure(run), widths = /* @__PURE__ */ new Map();
      measurers.set(key, measure && ((text) => widths.get(text) ?? widths.set(text, measure(text)).get(text)));
    }
    return measurers.get(key);
  };
  const plans = paragraphs.flatMap((paragraph) => {
    checkpoint?.();
    const plan = planCondensedLines(paragraph, modernJustification, measureFor, range, checkpoint);
    return plan ? [{ ...plan, authored: paragraph.getAttribute("style") }] : [];
  });
  for (const { paragraph } of plans) {
    paragraph.style.width = "max-content";
    paragraph.style.textAlign = "left";
  }
  const excess = plans.map(({ paragraph, words, rows }) => {
    checkpoint?.();
    const rect = textRects(paragraph, range);
    return rows.map((row) => row.spaces ? rect(words[row.start].begin, words[row.end].end).width - row.available : 0);
  });
  for (const { paragraph, authored } of plans)
    if (authored === null) paragraph.removeAttribute("style");
    else paragraph.setAttribute("style", authored);
  plans.forEach(({ paragraph, words, rows }, plan) => {
    checkpoint?.();
    const nodes = inlineTexts(paragraph);
    const segments = rows.flatMap((row, index) => {
      if (!(excess[plan][index] > 0)) return [];
      const begin = words[row.start].begin, end = words[row.end].end;
      const spacing = `${-(excess[plan][index] + 1 / 16) / row.spaces}px`;
      let start = 0;
      return nodes.flatMap((text) => {
        const from = Math.max(begin - start, 0), to = Math.min(end - start, text.data.length);
        start += text.data.length;
        return from < to && text.data.slice(from, to).includes(" ") ? [{ text, from, to, spacing }] : [];
      });
    });
    for (const { text, from, to, spacing } of segments.reverse()) {
      if (to < text.data.length) text.splitText(to);
      const target = from > 0 ? text.splitText(from) : text;
      const line = paragraph.ownerDocument.createElement("span");
      line.setAttribute(CONDENSED_LINE, "true");
      line.style.wordSpacing = spacing;
      target.replaceWith(line);
      line.append(target);
    }
  });
  const matched = plans.map(({ paragraph, words, rows }) => {
    checkpoint?.();
    const rect = textRects(paragraph, range);
    let line = 0, right = -Infinity;
    const actual = words.map((word) => {
      const bounds = rect(word.begin, word.end);
      if (bounds.left < right - 1 / 8) line++;
      right = bounds.right;
      return line;
    });
    return rows.every((row, index) => actual[row.start] === index && actual[row.end] === index);
  });
  plans.forEach(({ paragraph }, plan) => {
    if (matched[plan]) {
      paragraph.setAttribute(CONDENSED, "true");
      return;
    }
    for (const condensedLine of Array.from(paragraph.querySelectorAll(`[${CONDENSED_LINE}]`))) {
      const parent = condensedLine.parentElement;
      condensedLine.replaceWith(...Array.from(condensedLine.childNodes));
      parent.normalize();
    }
  });
}
function positionWords(paragraph, run, rows, checkpoint) {
  if (!run.hasAttribute(FITTED_RUN)) return;
  if (/[^\u0020-\u007e\u00c0-\u024f]/u.test(run.textContent)) return;
  const view = run.ownerDocument.defaultView;
  const style = view.getComputedStyle(run);
  if (style.whiteSpace !== "pre-wrap") return;
  if (!["normal", "0px"].includes(style.wordSpacing) && !run.style.getPropertyValue("--docx-word-space-compression")) return;
  const measure = wordMeasure(run);
  if (!measure) return;
  const parent = view.getComputedStyle(paragraph);
  const width = paragraph.getBoundingClientRect().width;
  if (!/^-?[\d.]+px$/.test(parent.textIndent)) return;
  const indent = Number.parseFloat(parent.textIndent) || 0;
  const lines2 = Array.from(rows.values());
  lines2.forEach((words, index) => {
    checkpoint?.();
    const start = index === 0 ? indent : 0;
    const available = width - start;
    const last = index === lines2.length - 1;
    let align = parent.textAlign;
    if (last) align = parent.textAlignLast === "auto" ? align === "justify" ? "start" : align : parent.textAlignLast;
    const advances = words.map((word, i) => {
      if ((i & 63) === 0) checkpoint?.();
      return measure(word.text);
    });
    const natural = advances.reduce((a, b) => a + b, 0) - (advances.at(-1) - measure.raw(words.at(-1).text.trimEnd()));
    const spaces = words.slice(0, -1).reduce((count, word) => count + (word.text.match(/ +$/)?.[0].length ?? 0), 0);
    const compressed = run.style.getPropertyValue("--docx-word-space-compression") && natural > available;
    const adjustment = spaces && (align === "justify" || compressed) ? (available - natural) / spaces : 0;
    const remaining = available - natural - adjustment * spaces;
    let x = start + (["right", "end"].includes(align) ? remaining : align === "center" ? remaining / 2 : 0);
    words.forEach((word, i) => {
      word.x = x;
      x += advances[i] + adjustment * (word.text.match(/ +$/)?.[0].length ?? 0);
    });
  });
}
function prepareWordText(root, checkpoint, owners = "all") {
  return prepareText(root, checkpoint, owners);
}
function paragraphsIn(root) {
  return root.matches(PARAGRAPHS) ? [root] : Array.from(root.querySelectorAll(PARAGRAPHS));
}
function createFootnoteTextPreparer(registry, checkpoint) {
  const eligible = registry && plainFlow(registry) && !registry.querySelector(
    "img, [data-docx-textbox], [data-docx-text-frame], [data-docx-drawing-anchor]"
  );
  const sources = /* @__PURE__ */ new Map();
  for (const paragraph of eligible ? paragraphsIn(registry) : []) {
    checkpoint?.();
    const anchor = paragraph.dataset.sourceAnchorId;
    if (anchor) sources.set(anchor, !sources.has(anchor) && !!plainRun(paragraph) && paragraph.ownerDocument.defaultView.getComputedStyle(paragraph).display === "block");
  }
  return (root) => {
    if (!eligible) return true;
    for (const paragraph of paragraphsIn(root)) {
      checkpoint?.();
      if (!paragraph.closest("[data-footnote-id]") || !sources.get(paragraph.dataset.sourceAnchorId ?? "")) continue;
      const owned = paragraph.hasAttribute(PREPARED);
      let before;
      if (owned) {
        let saved2;
        try {
          saved2 = JSON.parse(paragraph.getAttribute(NOTE_FIT) ?? "null");
        } catch {
          return false;
        }
        if (!saved2 || !Number.isFinite(saved2.width) || saved2.width <= 0 || !(saved2.runStyle === null || typeof saved2.runStyle === "string") || typeof saved2.lineHeight !== "string" || !["", "important"].includes(saved2.priority)) return false;
        if (paragraph.getBoundingClientRect().width === saved2.width) continue;
        const run2 = plainRun(paragraph);
        if (!run2 || !(Number(run2.getAttribute(FITTED_RUN)) > 0)) return false;
        before = paragraph.cloneNode(true);
        run2.textContent = run2.textContent;
        run2.removeAttribute(FITTED_RUN);
        if (saved2.runStyle === null) run2.removeAttribute("style");
        else run2.setAttribute("style", saved2.runStyle);
        if (saved2.lineHeight) paragraph.style.setProperty("line-height", saved2.lineHeight, saved2.priority);
        else paragraph.style.removeProperty("line-height");
        paragraph.removeAttribute(PREPARED);
      }
      const run = plainRun(paragraph);
      if (!run) {
        if (owned) return false;
        else continue;
      }
      const saved = {
        runStyle: run.getAttribute("style"),
        lineHeight: paragraph.style.lineHeight,
        priority: paragraph.style.getPropertyPriority("line-height")
      };
      if (prepareText(paragraph, checkpoint, "notes")) {
        paragraph.setAttribute(NOTE_FIT, JSON.stringify({ ...saved, width: paragraph.getBoundingClientRect().width }));
      } else if (before) {
        paragraph.replaceChildren(...Array.from(before.childNodes));
        const style = before.getAttribute("style");
        if (style === null) paragraph.removeAttribute("style");
        else paragraph.setAttribute("style", style);
        paragraph.setAttribute(PREPARED, "true");
        return false;
      }
    }
    return true;
  };
}
function prepareText(root, checkpoint, owners) {
  const mode = Number(root.closest("[data-docx-compatibility-mode]")?.getAttribute("data-docx-compatibility-mode") ?? root.ownerDocument.body.getAttribute("data-docx-compatibility-mode") ?? 14);
  if (owners !== "notes" && !plainFlow(root)) return 0;
  const view = root.ownerDocument.defaultView;
  if (!view) return 0;
  const fixedTables = /* @__PURE__ */ new Map();
  const fixedGrid = (table) => {
    const cached = fixedTables.get(table);
    if (cached !== void 0) return cached;
    const fixed = table.dataset.docxFixedWidth === "true" && view.getComputedStyle(table).tableLayout === "fixed" && table.getBoundingClientRect().width > 0;
    const columns = fixed ? Array.from(table.querySelectorAll(":scope > colgroup > col")) : [];
    const count = fixed ? Array.from(table.rows).reduce((max, row) => Math.max(max, Array.from(row.cells).reduce((n, cell) => n + cell.colSpan, 0)), 0) : 0;
    const valid = fixed && (count === 1 || columns.length === count && columns.every((col) => col.span === 1 && col.getBoundingClientRect().width > 0));
    fixedTables.set(table, valid);
    return valid;
  };
  prepareSectionTextWidths(root);
  let prepared = 0;
  const condensable = [];
  let picture;
  const pictures = () => picture ??= root.querySelector("img") !== null;
  for (const paragraph of paragraphsIn(root)) {
    checkpoint?.();
    if (paragraph.hasAttribute(PREPARED)) continue;
    const table = paragraph.closest("table");
    if (owners === "notes" && (table || !paragraph.closest("[data-footnote-id]"))) continue;
    if (owners === "body" && table || owners === "tables" && !table) continue;
    let stable = true;
    for (let owner = table; owner; owner = owner.parentElement?.closest("table") ?? null)
      if (!fixedGrid(owner)) {
        stable = false;
        break;
      }
    if (!stable) continue;
    if (paragraph.closest("ol, ul, li, a, aside, template, section.footnotes, section.endnotes, [data-comment-id], [data-docx-textbox], [data-docx-text-frame], [data-docx-drawing-anchor]") || owners !== "notes" && paragraph.closest("[data-footnote-id]")) continue;
    const style = view.getComputedStyle(paragraph);
    if (owners === "notes" && style.display !== "block") continue;
    const multiple = Number(style.getPropertyValue("--docx-auto-line-spacing"));
    const exact = mode >= 15 && Number.parseFloat(style.getPropertyValue("--docx-exact-line-height")) > 0;
    const inColumns = () => {
      for (let ancestor = paragraph.parentElement; ancestor && ancestor !== root; ancestor = ancestor.parentElement)
        if (Number(view.getComputedStyle(ancestor).columnCount) > 1) return true;
      return false;
    };
    const condense = () => style.textAlign === "justify" && owners !== "running" && owners !== "notes" && !pictures() && !inColumns() && condensable.push(paragraph);
    const run = plainRun(paragraph, false, exact);
    if (!run) {
      condense();
      continue;
    }
    const runStyle = view.getComputedStyle(run);
    const scale = characterScale(runStyle);
    if ((owners === "running" || owners === "notes") && scale === 1) continue;
    if (table && scale === 1) {
      condense();
      continue;
    }
    const kerning = runStyle.fontKerning === "normal" ? "normal" : "none";
    const height = Number.parseFloat(runStyle.lineHeight);
    if (!(multiple > 0) && !exact) {
      condense();
      continue;
    }
    if (!(height > 0)) continue;
    const nativeHeight = Number.parseFloat(runStyle.getPropertyValue("--docx-word-native-height")) || height / multiple;
    const column = inColumns();
    if (scale !== 1 && (exact || column || pictures() || paragraph.closest("[data-hf-type], #pagination-hf-registry"))) continue;
    if (exact && (style.textAlign !== "justify" || !["auto", "start", "left"].includes(style.textAlignLast) || column || pictures())) continue;
    if (exact) {
      if (fitWordLines(paragraph, run, true, checkpoint, true) === "fitted") prepared++;
      continue;
    }
    const previousStyle = run.getAttribute("style");
    run.style.fontKerning = kerning;
    run.style.lineHeight = `${height}px`;
    run.style.setProperty("--docx-word-native-height", `${nativeHeight}px`);
    const fitted = !column && !pictures() ? fitWordLines(paragraph, run, mode >= 15 && style.textAlign === "justify", checkpoint) : null;
    if (scale !== 1 && fitted === null) {
      if (previousStyle === null) run.removeAttribute("style");
      else run.setAttribute("style", previousStyle);
      continue;
    }
    for (const picture2 of Array.from(paragraph.children).filter((child) => pictureSibling(child, view))) {
      picture2.style.lineHeight = run.style.lineHeight;
      picture2.style.top = "0";
    }
    for (const empty of Array.from(paragraph.children).filter((child) => child !== run && !child.children.length)) empty.remove();
    paragraph.style.lineHeight = run.style.lineHeight;
    paragraph.setAttribute(PREPARED, "true");
    prepared++;
  }
  condenseLines(condensable, mode >= 15, checkpoint);
  return prepared;
}
function prepareSectionTextWidths(root) {
  for (const section of Array.from(root.querySelectorAll("[data-section-index][data-content-width]"))) {
    const width = Number(section.dataset.contentWidth);
    if (Number.isFinite(width) && width > 0) section.style.width = `${width}pt`;
  }
}
function paintWordText(root, checkpoint) {
  const document2 = root.ownerDocument;
  const view = document2.defaultView;
  if (!view) return 0;
  const paragraphs = Array.from(root.querySelectorAll(`[${PREPARED}]`));
  const allPictures = Array.from(root.querySelectorAll("img"));
  const storyPictures = /* @__PURE__ */ new Map();
  const columnOf = (paragraph) => {
    for (let parent = paragraph.parentElement; parent && parent !== root; parent = parent.parentElement)
      if (Number(view.getComputedStyle(parent).columnCount) > 1) return parent;
    return null;
  };
  const fragmentedColumns = /* @__PURE__ */ new Set();
  for (const paragraph of paragraphs) {
    checkpoint?.();
    const column = columnOf(paragraph);
    if (column && paragraph.getClientRects().length !== 1) fragmentedColumns.add(column);
  }
  const metrics = /* @__PURE__ */ new Map();
  function fontMetrics(style) {
    const font = `${style.fontStyle} ${style.fontWeight} 10000px ${style.fontFamily}`;
    const cached = metrics.get(font);
    if (cached) return cached;
    const probe = document2.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = `position:absolute;left:-100000px;top:0;visibility:hidden;display:inline-block;white-space:nowrap;margin:0;padding:0;border:0;font:${font};line-height:normal`;
    probe.textContent = "Hg";
    document2.body.append(probe);
    const height = probe.getBoundingClientRect().height / 1e4;
    probe.remove();
    const context = document2.createElement("canvas").getContext("2d");
    if (!context) return null;
    context.font = font;
    if (!context.font.includes("10000px")) return null;
    const descent = context.measureText("Hg").fontBoundingBoxDescent / 1e4;
    if (!(height > 0) || !(descent > 0)) return null;
    const result = { height, descent };
    metrics.set(font, result);
    return result;
  }
  const pending = [];
  const drift = /* @__PURE__ */ new Map();
  for (const paragraph of paragraphs) {
    checkpoint?.();
    const story = paragraph.closest(".page-header, .page-footer, .page-footnotes");
    if (story && !storyPictures.has(story)) storyPictures.set(story, Array.from(story.querySelectorAll("img")));
    const pictures = story ? storyPictures.get(story) : allPictures;
    const hasPictures = pictures.length > 0;
    const column = columnOf(paragraph);
    if (column && fragmentedColumns.has(column)) {
      paragraph.removeAttribute(PREPARED);
      continue;
    }
    const run = plainRun(paragraph);
    if (!run) continue;
    const style = view.getComputedStyle(run);
    const scale = characterScale(style);
    if (scale !== 1 && !(Number(run.getAttribute(FITTED_RUN)) > 0)) continue;
    const metric = fontMetrics(style);
    const fontSize = Number.parseFloat(style.fontSize);
    const pitch = Number.parseFloat(style.lineHeight);
    const box = paragraph.getBoundingClientRect();
    if (!metric || !(fontSize > 0) || !(pitch > 0) || !(box.width > 0) || !(box.height > 0)) continue;
    const columnBand = column || hasPictures ? paragraph.closest(".page-content") : null;
    const band = columnBand?.getBoundingClientRect() ?? box;
    let rows = /* @__PURE__ */ new Map();
    let wordCount = 0;
    let splitWord = false;
    const walker = document2.createTreeWalker(run, view.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) for (const match of node.textContent.matchAll(/\S+\s*/gu)) {
      if ((wordCount++ & 63) === 0) checkpoint?.();
      const range = document2.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].trimEnd().length);
      if (range.getClientRects().length !== 1) {
        splitWord = true;
        break;
      }
      const rect = range.getBoundingClientRect();
      const row = Math.round(rect.top * 4);
      const words = rows.get(row) ?? [];
      words.push({ text: match[0], x: rect.left - box.left });
      rows.set(row, words);
    }
    if (!rows.size || splitWord) continue;
    if (!hasPictures && !column) positionWords(paragraph, run, rows, checkpoint);
    if (pictures.length === 1) rows = contourRows(pictures[0], paragraph, run, rows.size, checkpoint) ?? rows;
    const flow = paragraph.closest("td, th") ?? paragraph.closest(".page-content, .page-header, .page-footer, .page-footnotes") ?? paragraph.closest(".page-box");
    const lost = column || !flow ? 0 : drift.get(flow) ?? 0;
    if (flow && !column) {
      const shortfall = rows.size * pitch - box.height;
      if (shortfall > 0 && shortfall < 1) drift.set(flow, lost + shortfall);
    }
    const svg = document2.createElementNS(SVG_NS, "svg");
    const fontRequest = run.getAttribute(FONT_REQUEST_ATTRIBUTE);
    if (fontRequest) svg.setAttribute(FONT_REQUEST_ATTRIBUTE, fontRequest);
    svg.setAttribute("width", String(band.width));
    svg.setAttribute("height", String(band.height));
    svg.setAttribute("viewBox", `0 0 ${band.width * 4} ${band.height * 4}`);
    const page = paragraph.closest(".page-box")?.getBoundingClientRect();
    const remainder = (offset) => offset - Math.round(offset);
    const dx = page ? remainder(band.left - page.left) : 0;
    const dy = page ? remainder(band.top - page.top) : 0;
    svg.setAttribute("role", "group");
    svg.style.cssText = columnBand ? "position:absolute;left:0;top:0;display:block;overflow:visible" : "position:relative;display:block;overflow:visible";
    const baseline = (metric.height - metric.descent) * fontSize + gridTextOffset(style);
    Array.from(rows.values()).forEach((words, index) => {
      const line = document2.createElementNS(SVG_NS, "text");
      if (scale !== 1) {
        line.setAttribute("transform", `scale(${scale} 1)`);
        line.setAttribute("text-rendering", "geometricPrecision");
      }
      line.setAttribute("y", String((box.top - band.top + dy + lost + baseline + index * pitch) * 4));
      line.setAttribute("xml:space", "preserve");
      for (const property of [
        "font-family",
        "font-weight",
        "font-style",
        "font-stretch",
        "font-kerning",
        "font-variant-ligatures",
        "font-feature-settings"
      ])
        line.style.setProperty(property, style.getPropertyValue(property));
      line.style.fontSize = `${fontSize * 4}px`;
      line.style.fill = style.color;
      for (const word of words) {
        const span = document2.createElementNS(SVG_NS, "tspan");
        span.setAttribute("x", String((box.left - band.left + dx + word.x) * 4 / scale));
        span.textContent = word.text;
        line.append(span);
      }
      svg.append(line);
    });
    pending.push({ paragraph, run, svg, height: box.height, column: column !== null });
  }
  for (const { paragraph, run, svg, height, column } of pending) {
    checkpoint?.();
    if (Array.from(paragraph.children).some((child) => pictureSibling(child, view))) run.replaceWith(svg);
    else paragraph.replaceChildren(svg);
    paragraph.style.setProperty("--docx-word-text-height", `${height}px`);
    paragraph.style.height = "var(--docx-word-text-height)";
    if (column) paragraph.style.breakInside = "avoid";
    paragraph.removeAttribute(PREPARED);
    paragraph.removeAttribute(NOTE_FIT);
  }
  return pending.length;
}

// src/exact-row-text.ts
var EXACT_ROW_CELL = 'div[data-docx-exact-row-cell="true"]';
function exactRowClipSpan(element) {
  let top = -Infinity;
  let bottom = Infinity;
  for (let clip = element.parentElement?.closest(EXACT_ROW_CELL); clip; clip = clip.parentElement?.closest(EXACT_ROW_CELL)) {
    const box = clip.getBoundingClientRect();
    top = Math.max(top, box.top);
    bottom = Math.min(bottom, box.bottom);
  }
  return top === -Infinity ? null : { top, bottom };
}
var EXACT_ROW_TEXT_ATTRIBUTE = "data-docx-exact-row-text";
var SVG_NS2 = "http://www.w3.org/2000/svg";
var REACH = 1e5;
var number = (value) => String(Number(value.toFixed(6)));
var px = (value) => `${number(value)}px`;
var expandedClip = (left, top, right, bottom) => `M${number(left)} ${number(top)}H${number(right)}V${number(bottom)}H${number(left)}Z M${number(left)} ${number(top)}H${REACH} M${number(left)} ${number(top)}H${-REACH} M${number(left)} ${number(top)}V${REACH} M${number(left)} ${number(top)}V${-REACH}`;
function textNodes(clip) {
  const nodes = [];
  const walker = clip.ownerDocument.createTreeWalker(clip, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    if ((node.nodeValue ?? "").trim()) nodes.push(node);
  return nodes;
}
function hidesText(clip, view, page) {
  const document2 = clip.ownerDocument;
  const own = clip.getBoundingClientRect();
  const box = {
    left: own.left,
    right: own.right,
    top: Math.max(own.top, page.top),
    bottom: Math.min(own.bottom, page.bottom)
  };
  const context = document2.createElement("canvas").getContext("2d");
  const range = document2.createRange();
  for (const node of textNodes(clip)) {
    const style = view.getComputedStyle(node.parentElement);
    let descent = 0;
    if (context) {
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = context.measureText("");
      const height = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      if (height > 0) descent = metrics.fontBoundingBoxDescent / height;
    }
    range.selectNodeContents(node);
    for (const line of Array.from(range.getClientRects())) {
      if (!(line.width > 0) || !(line.height > 0)) continue;
      const baseline = line.bottom - descent * line.height;
      if (baseline > box.bottom || baseline < box.top) return true;
      if (line.right <= box.right && line.left >= box.left) continue;
      const text = node.nodeValue ?? "";
      for (let index = 0; index < text.length; index++) {
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        if (Array.from(range.getClientRects()).some((glyph) => glyph.width > 0 && (glyph.left >= box.right || glyph.right <= box.left))) return true;
      }
      range.selectNodeContents(node);
    }
  }
  return false;
}
function hideTextOutsidePage(clip, view, page) {
  const range = clip.ownerDocument.createRange();
  const outside = (rect) => rect.bottom <= page.top || rect.top >= page.bottom;
  for (const node of textNodes(clip)) {
    if (view.getComputedStyle(node.parentElement).visibility === "hidden") continue;
    range.selectNodeContents(node);
    const boxes = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (boxes.length === 0 || boxes.every((r) => !outside(r))) continue;
    const hidden = [];
    if (boxes.every(outside)) hidden.push([0, node.length]);
    else {
      let start = -1;
      for (let index = 0; index <= node.length; index++) {
        let hide = false;
        if (index < node.length) {
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const glyphs = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
          hide = glyphs.length > 0 && glyphs.every(outside);
        }
        if (hide && start < 0) start = index;
        if (!hide && start >= 0) {
          hidden.push([start, index]);
          start = -1;
        }
      }
    }
    for (const [start, end] of hidden.reverse()) {
      if (end < node.length) node.splitText(end);
      const text = start > 0 ? node.splitText(start) : node;
      const span = clip.ownerDocument.createElement("span");
      span.style.visibility = "hidden";
      text.parentNode.insertBefore(span, text);
      span.appendChild(text);
    }
  }
}
function textByPaintPhase(clip, view) {
  const positioned = [];
  const inFlow = [];
  for (const node of textNodes(clip)) {
    let found = false;
    for (let element = node.parentElement; element && element !== clip && !found; element = element.parentElement)
      found = view.getComputedStyle(element).position !== "static";
    (found ? positioned : inFlow).push(node);
  }
  return { positioned, inFlow };
}
function holdsOutOfFlowPositioned(clip, view) {
  return Array.from(clip.querySelectorAll("*")).some((element) => ["absolute", "fixed"].includes(view.getComputedStyle(element).position));
}
function preserveClippedExactRowText(root) {
  const document2 = root.ownerDocument;
  const view = document2.defaultView;
  if (!view) return 0;
  let rewritten = 0;
  const rewrittenBands = /* @__PURE__ */ new Set();
  for (const clip of Array.from(root.querySelectorAll(EXACT_ROW_CELL))) {
    const page = clip.closest(".page-box");
    const parent = clip.parentElement;
    if (!page || !parent || holdsOutOfFlowPositioned(clip, view)) continue;
    const pageRect = page.getBoundingClientRect();
    if (!hidesText(clip, view, pageRect)) continue;
    hideTextOutsidePage(clip, view, pageRect);
    const box = clip.getBoundingClientRect();
    if (!(box.width > 0) || !(box.height > 0)) continue;
    const left = box.left - pageRect.left;
    const top = box.top - pageRect.top;
    const fx = left - Math.floor(left);
    const fy = top - Math.floor(top);
    const x0 = Math.round(left) - Math.floor(left);
    const y0 = Math.round(top) - Math.floor(top);
    const x1 = Math.round(left + box.width) - Math.floor(left);
    const y1 = Math.round(top + box.height) - Math.floor(top);
    const svg = document2.createElementNS(SVG_NS2, "svg");
    svg.setAttribute(EXACT_ROW_TEXT_ATTRIBUTE, "true");
    svg.setAttribute("width", number(box.width + fx));
    svg.setAttribute("height", number(box.height + fy));
    const phases = textByPaintPhase(clip, view);
    const position = phases.positioned.length > 0 ? "relative" : "static";
    svg.setAttribute("style", `display:block;position:${position};overflow:visible;width:${px(box.width + fx)};height:${px(box.height + fy)};margin:${px(-fy)} 0 0 ${px(-fx)}`);
    const clipPath = document2.createElementNS(SVG_NS2, "clipPath");
    let serial = rewritten;
    while (document2.getElementById(`docx-exact-row-clip-${serial}`)) serial++;
    const id = `docx-exact-row-clip-${serial}`;
    clipPath.id = id;
    clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");
    const shape = document2.createElementNS(SVG_NS2, "path");
    shape.setAttribute("d", expandedClip(x0, y0, x1, y1));
    clipPath.appendChild(shape);
    const content = document2.createElementNS(SVG_NS2, "foreignObject");
    content.setAttribute("x", number(fx));
    content.setAttribute("y", number(fy));
    content.setAttribute("width", number(box.width));
    content.setAttribute("height", number(box.height));
    content.setAttribute("clip-path", `url(#${id})`);
    content.setAttribute("style", "overflow:visible");
    svg.append(clipPath, content);
    const display = view.getComputedStyle(clip).display;
    parent.replaceChild(svg, clip);
    content.appendChild(clip);
    clip.style.setProperty("width", px(box.width));
    if (display === "block") clip.style.setProperty("display", "flow-root");
    clip.style.setProperty("overflow", "clip");
    clip.style.setProperty("overflow-clip-margin", px(REACH));
    if (phases.positioned.length > 0)
      for (const node of phases.inFlow) node.parentElement?.style.setProperty("position", "relative");
    for (let band = svg.parentElement; band; band = band.parentElement) {
      if (rewrittenBands.has(band) || !band.matches(".page-header, .page-footer, .page-content, .page-box")) continue;
      const style = view.getComputedStyle(band);
      const clipsX = ["hidden", "clip"].includes(style.overflowX);
      const clipsY = ["hidden", "clip"].includes(style.overflowY);
      const rect = band.getBoundingClientRect();
      const existing = insetClipBounds(style.clipPath, rect, 1);
      if (!clipsX && !clipsY && !existing || style.clipPath !== "none" && !existing) continue;
      const left2 = rect.left - pageRect.left;
      const top2 = rect.top - pageRect.top;
      band.style.setProperty("clip-path", `path('${expandedClip(
        Math.max(existing ? existing.left - rect.left : -REACH, clipsX ? Math.round(left2) - left2 : -REACH),
        Math.max(existing ? existing.top - rect.top : -REACH, clipsY ? Math.round(top2) - top2 : -REACH),
        Math.min(existing ? existing.right - rect.left : REACH, clipsX ? Math.round(left2 + rect.width) - left2 : REACH),
        Math.min(existing ? existing.bottom - rect.top : REACH, clipsY ? Math.round(top2 + rect.height) - top2 : REACH)
      )}')`);
      band.style.setProperty("overflow", "clip");
      band.style.setProperty("overflow-clip-margin", px(REACH));
      rewrittenBands.add(band);
    }
    rewritten++;
  }
  return rewritten;
}

// src/paragraph-borders.ts
var EXACT = "data-docx-exact-border";
var PAINT = "data-docx-border-paint";
var SVG_NS3 = "http://www.w3.org/2000/svg";
var SIDES = ["top", "right", "bottom", "left"];
var PT_TO_PX = 4 / 3;
function prepareParagraphBorders(root) {
  const view = root.ownerDocument.defaultView;
  if (!view) return 0;
  let prepared = 0;
  for (const element of Array.from(root.querySelectorAll(`[${EXACT}]`))) {
    if (element.hasAttribute(PAINT)) continue;
    const style = view.getComputedStyle(element);
    const painted = [];
    for (const side of SIDES) {
      const declared = Number.parseFloat(style.getPropertyValue(`--docx-border-${side}-width`));
      const cssStyle = style.getPropertyValue(`border-${side}-style`);
      if (!(declared > 0) || cssStyle !== "solid" && cssStyle !== "dashed") continue;
      const exact = declared * PT_TO_PX;
      const laidOut = Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) || 0;
      const padding = Number.parseFloat(style.getPropertyValue(`padding-${side}`)) || 0;
      painted.push({ side, style: cssStyle, color: style.getPropertyValue(`border-${side}-color`), width: exact });
      element.style.setProperty(`border-${side}-style`, "none");
      element.style.setProperty(`padding-${side}`, `${padding + exact}px`);
      if (side === "left" || side === "right") {
        const margin = Number.parseFloat(style.getPropertyValue(`margin-${side}`)) || 0;
        element.style.setProperty(`margin-${side}`, `${margin + laidOut - exact}px`);
      }
    }
    if (painted.length === 0) continue;
    element.style.cssText = element.style.cssText;
    element.setAttribute(PAINT, JSON.stringify(painted));
    prepared++;
  }
  return prepared;
}
function omitPaintedBorderSide(element, side) {
  const recorded = element.getAttribute(PAINT);
  if (!recorded) return;
  const sides = JSON.parse(recorded).filter((painted) => painted.side !== side);
  element.setAttribute(PAINT, JSON.stringify(sides));
}
function paintParagraphBorders(container, pageBoxSelector = ".page-box") {
  const document2 = container.ownerDocument;
  let painted = 0;
  const overlays = /* @__PURE__ */ new Map();
  const overlayFor = (page) => {
    let svg = overlays.get(page);
    if (!svg) {
      svg = document2.createElementNS(SVG_NS3, "svg");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("width", String(page.offsetWidth));
      svg.setAttribute("height", String(page.offsetHeight));
      svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none;z-index:1";
      page.append(svg);
      overlays.set(page, svg);
    }
    return svg;
  };
  for (const element of Array.from(container.querySelectorAll(`[${PAINT}]`))) {
    const page = element.closest(pageBoxSelector);
    if (!page) continue;
    let sides;
    try {
      sides = JSON.parse(element.getAttribute(PAINT));
    } catch {
      continue;
    }
    const pageRect = page.getBoundingClientRect();
    const scale = page.offsetWidth > 0 ? pageRect.width / page.offsetWidth : 1;
    const box = element.getBoundingClientRect();
    if (!(box.width > 0) || !(box.height > 0) || !(scale > 0)) continue;
    const left = (box.left - pageRect.left) / scale;
    const top = (box.top - pageRect.top) / scale;
    const width = box.width / scale;
    const height = box.height / scale;
    const span = exactRowClipSpan(element);
    const clip = !span || span.top <= box.top && span.bottom >= box.bottom ? null : { top: (span.top - pageRect.top) / scale, bottom: (span.bottom - pageRect.top) / scale };
    let paintedSides = 0;
    for (const { side, style, color, width: stroke } of sides) {
      const horizontal = side === "top" || side === "bottom";
      const x = side === "right" ? left + width - stroke : left;
      let y = side === "bottom" ? top + height - stroke : top;
      const w = horizontal ? width : stroke;
      let h = horizontal ? stroke : height;
      let phase = 0;
      if (clip) {
        const y0 = Math.max(y, clip.top);
        const y1 = Math.min(y + h, clip.bottom);
        if (!(y1 > y0)) continue;
        if (!horizontal) phase = y0 - y;
        y = y0;
        h = y1 - y0;
      }
      const svg = overlayFor(page);
      if (style === "solid") {
        const rect = document2.createElementNS(SVG_NS3, "rect");
        for (const [name, value] of [["x", x], ["y", y], ["width", w], ["height", h]])
          rect.setAttribute(name, String(value));
        rect.setAttribute("fill", color);
        svg.append(rect);
      } else {
        const line = document2.createElementNS(SVG_NS3, "line");
        const cx = x + w / 2;
        const cy = y + h / 2;
        line.setAttribute("x1", String(horizontal ? x : cx));
        line.setAttribute("y1", String(horizontal ? cy : y));
        line.setAttribute("x2", String(horizontal ? x + w : cx));
        line.setAttribute("y2", String(horizontal ? cy : y + h));
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", String(horizontal ? h : w));
        const rhythm = Math.max(1, stroke);
        line.setAttribute("stroke-dasharray", `${3 * rhythm} ${2 * rhythm}`);
        if (phase > 0) line.setAttribute("stroke-dashoffset", String(phase));
        svg.append(line);
      }
      paintedSides++;
    }
    if (paintedSides > 0) painted++;
  }
  return painted;
}

// src/table-borders.ts
var TABLE = "data-docx-exact-table-borders";
var CELL = "data-docx-exact-cell-borders";
var EDGES = "data-docx-table-border-edges";
var PREPARED2 = "data-docx-table-borders-prepared";
var PT = 4 / 3;
var edgesOf = (row) => JSON.parse(row.getAttribute(EDGES) ?? "[]");
function refreshTableBorderLayout(table) {
  if (!table.hasAttribute(PREPARED2) || !table.rows.length) return;
  const rows = Array.from(table.rows);
  if (table.hasAttribute("data-docx-grid-align-end")) {
    const end = Number(table.getAttribute(TABLE)) + table.querySelectorAll(":scope > colgroup > col").length;
    const half2 = Math.max(0, ...rows.flatMap((row) => edgesOf(row)).filter((edge) => edge[0] === "vertical" && edge[1] === end).map((edge) => edge[3])) * PT / 2;
    table.style.setProperty(`margin-${table.getAttribute("data-docx-grid-margin-side")}`, `${half2}px`);
  }
  const firstBody = rows.findIndex((row) => row.dataset.docxRepeatedHeaderRow !== "true");
  const join = firstBody > 0 ? rows[firstBody].getAttribute("data-docx-table-header-edges") : null;
  if (join) {
    const edges = JSON.parse(join);
    rows[firstBody].setAttribute(EDGES, JSON.stringify([
      ...edgesOf(rows[firstBody]).filter((e) => e[0] !== "top"),
      ...edges
    ]));
    rows[firstBody - 1].setAttribute(EDGES, JSON.stringify([
      ...edgesOf(rows[firstBody - 1]).filter((e) => e[0] !== "bottom"),
      ...edges.map((e) => ["bottom", ...e.slice(1)])
    ]));
  }
  const half = (row, side) => Math.max(0, ...edgesOf(row).filter((e) => e[0] === side).map((e) => e[3])) * PT / 2;
  for (const [index, row] of rows.entries()) {
    const height = Number(row.getAttribute("data-docx-source-row-height")) * PT;
    const rule = row.getAttribute("data-docx-row-height-rule");
    for (const cell of Array.from(row.cells)) {
      if (!cell.hasAttribute(CELL)) continue;
      const last = cell.rowSpan === 0 ? rows.length - 1 : Math.min(rows.length - 1, index + cell.rowSpan - 1);
      const top = (Number.parseFloat(cell.style.getPropertyValue("--docx-cell-base-padding-top")) || 0) + half(row, "top");
      const bottom = (Number.parseFloat(cell.style.getPropertyValue("--docx-cell-base-padding-bottom")) || 0) + half(rows[last], "bottom");
      cell.style.paddingTop = `${top}px`;
      cell.style.paddingBottom = `${bottom}px`;
      const clip = cell.querySelector(":scope > [data-docx-exact-row-cell]");
      if (height > 0 && rule === "exact" && clip) clip.style.height = `${Math.max(0, height - top - bottom)}px`;
    }
    if (height > 0 && (rule === "exact" || rule === "atLeast"))
      row.style.height = `${height + (rule === "exact" ? 0 : half(row, "top") + half(row, "bottom") + Number(row.getAttribute("data-docx-row-margin-height")) * PT)}px`;
  }
  for (const [side, row] of [["top", table.rows[0]], ["bottom", table.rows[table.rows.length - 1]]]) {
    table.style.setProperty(`padding-${side}`, `${half(row, side)}px`);
  }
}
function prepareTableBorders(root) {
  const view = root.ownerDocument.defaultView;
  if (!view) return;
  for (const table of Array.from(root.querySelectorAll(`table[${TABLE}]`))) {
    if (table.hasAttribute(PREPARED2)) continue;
    const style = view.getComputedStyle(table);
    const points = (name) => (Number.parseFloat(style.getPropertyValue(name)) || 0) * PT;
    const side = table.getAttribute("data-docx-grid-margin-side");
    if (side) table.style.setProperty(`margin-${side}`, `${points("--docx-table-grid-margin")}px`);
    table.style.borderCollapse = "separate";
    table.style.borderSpacing = "0";
    table.style.padding = "0";
    for (const cell of Array.from(table.querySelectorAll(`td[${CELL}]`))) {
      if (cell.closest("table") !== table) continue;
      const cellStyle = view.getComputedStyle(cell);
      const padding = {};
      for (const edge of ["top", "right", "bottom", "left"]) {
        const half = (Number.parseFloat(cellStyle.getPropertyValue(`--docx-cell-border-${edge}`)) || 0) * PT / 2;
        const margin = Number.parseFloat(cellStyle.getPropertyValue(`padding-${edge}`)) || 0;
        if (edge === "top" || edge === "bottom") cell.style.setProperty(`--docx-cell-base-padding-${edge}`, `${margin}px`);
        padding[edge] = edge === "left" || edge === "right" ? Math.max(margin, half) : margin + half;
      }
      cell.style.border = "none";
      for (const edge of Object.keys(padding)) cell.style.setProperty(`padding-${edge}`, `${padding[edge]}px`);
      cell.style.cssText = cell.style.cssText;
    }
    table.style.cssText = table.style.cssText;
    table.setAttribute(PREPARED2, "true");
    refreshTableBorderLayout(table);
  }
}
function paddingMatrix(element, view) {
  const saved = element.style.cssText;
  const probes = [];
  try {
    if (view.getComputedStyle(element).position === "static") {
      element.style.position = "relative";
      element.style.inset = "auto";
    }
    const points = [[0, 0], [100, 0], [0, 100]].map(([x2, y2]) => {
      const probe = element.ownerDocument.createElement("span");
      probe.style.cssText = `all:initial;display:block;position:absolute;left:${x2}px;top:${y2}px;width:0;height:0;min-width:0;min-height:0;margin:0;padding:0;border:0;visibility:hidden;pointer-events:none`;
      element.append(probe);
      probes.push(probe);
      return probe.getBoundingClientRect();
    });
    const [origin, x, y] = points;
    return new view.DOMMatrix([
      (x.left - origin.left) / 100,
      (x.top - origin.top) / 100,
      (y.left - origin.left) / 100,
      (y.top - origin.top) / 100,
      origin.left,
      origin.top
    ]);
  } finally {
    probes.forEach((probe) => probe.remove());
    element.style.cssText = saved;
  }
}
var matrixText = (m) => `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].join(" ")})`;
var SVG_NS4 = "http://www.w3.org/2000/svg";
function clippedGroup(table, page, svg, toOverlay, view) {
  const doc = table.ownerDocument;
  let parent = svg;
  const appendClip = (shapes) => {
    const clip = doc.createElementNS(SVG_NS4, "clipPath");
    let serial = svg.childElementCount;
    while (doc.getElementById(`docx-table-clip-${serial}`)) serial++;
    clip.id = `docx-table-clip-${serial}`;
    clip.setAttribute("clipPathUnits", "userSpaceOnUse");
    clip.append(...shapes);
    svg.append(clip);
    const group2 = doc.createElementNS(SVG_NS4, "g");
    group2.setAttribute("clip-path", `url(#${clip.id})`);
    parent.append(group2);
    parent = group2;
  };
  for (let ancestor = table; ancestor && ancestor !== page; ancestor = ancestor.parentElement) {
    if (ancestor instanceof view.SVGGraphicsElement) {
      const id = /^url\(["']?#([^"')]+)["']?\)$/.exec(ancestor.getAttribute("clip-path") ?? "")?.[1];
      const source = id ? doc.getElementById(id) : null, ctm = ancestor.getScreenCTM();
      if (source instanceof view.SVGClipPathElement && ctm) {
        const matrix2 = matrixText(toOverlay.multiply(new view.DOMMatrix([ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f])));
        appendClip(Array.from(source.children).map((child) => {
          const clone = child.cloneNode(true);
          clone.removeAttribute("id");
          clone.setAttribute("transform", `${matrix2} ${clone.getAttribute("transform") ?? ""}`);
          return clone;
        }));
      }
      continue;
    }
    if (!(ancestor instanceof view.HTMLElement)) continue;
    const style = view.getComputedStyle(ancestor);
    const clipsX = /^(hidden|clip|scroll|auto)$/.test(style.overflowX);
    const clipsY = /^(hidden|clip|scroll|auto)$/.test(style.overflowY);
    if (!clipsX && !clipsY && style.clipPath === "none") continue;
    const px2 = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0;
    const bl = px2("border-left-width"), bt = px2("border-top-width");
    const br = px2("border-right-width"), bb = px2("border-bottom-width");
    const w = px2("width") + (style.boxSizing === "border-box" ? -bl - br : px2("padding-left") + px2("padding-right"));
    const h = px2("height") + (style.boxSizing === "border-box" ? -bt - bb : px2("padding-top") + px2("padding-bottom"));
    const reach = 1e5;
    const margin = px2("overflow-clip-margin");
    let left = clipsX ? -margin : -reach, right = clipsX ? w + margin : reach;
    let top = clipsY ? -margin : -reach, bottom = clipsY ? h + margin : reach;
    const inset = insetClipBounds(style.clipPath, new view.DOMRect(-bl, -bt, w + bl + br, h + bt + bb), 1);
    if (inset) {
      left = Math.max(left, inset.left);
      right = Math.min(right, inset.right);
      top = Math.max(top, inset.top);
      bottom = Math.min(bottom, inset.bottom);
    }
    const rect = doc.createElementNS(SVG_NS4, "rect");
    const matrix = toOverlay.multiply(paddingMatrix(ancestor, view));
    for (const [name, value] of Object.entries({ x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }))
      rect.setAttribute(name, String(value));
    rect.setAttribute("transform", matrixText(matrix));
    appendClip([rect]);
  }
  const group = doc.createElementNS(SVG_NS4, "g");
  parent.append(group);
  return group;
}
function paintTableBorders(container) {
  const doc = container.ownerDocument, view = doc.defaultView;
  if (!view) return;
  for (const table of Array.from(container.querySelectorAll(`table[${PREPARED2}]`))) {
    const page = table.closest(".page-box");
    if (!page) continue;
    const matrix = paddingMatrix(table, view), inverse = matrix.inverse();
    if (![inverse.a, inverse.b, inverse.c, inverse.d, inverse.e, inverse.f].every(Number.isFinite)) continue;
    const columns = Array.from(table.querySelectorAll(":scope > colgroup > col"));
    const boundaries = [0];
    for (const column of columns) boundaries.push(boundaries[boundaries.length - 1] + Number.parseFloat(view.getComputedStyle(column).width));
    const prefix = Number(table.getAttribute(TABLE));
    const rtl = view.getComputedStyle(table).direction === "rtl";
    const xAt = (index) => rtl ? boundaries[boundaries.length - 1] - boundaries[index - prefix] : boundaries[index - prefix];
    const svg = doc.createElementNS(SVG_NS4, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("data-docx-table-border-paint", "true");
    svg.setAttribute("width", String(page.offsetWidth));
    svg.setAttribute("height", String(page.offsetHeight));
    svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
    table.before(svg);
    const screen = svg.getScreenCTM();
    if (!screen) {
      svg.remove();
      continue;
    }
    const toOverlay = new view.DOMMatrix([screen.a, screen.b, screen.c, screen.d, screen.e, screen.f]).inverse();
    const group = clippedGroup(table, page, svg, toOverlay, view);
    group.setAttribute("transform", matrixText(toOverlay.multiply(matrix)));
    const rows = Array.from(table.rows), painted = /* @__PURE__ */ new Set();
    const allEdges = rows.map(edgesOf);
    for (const [index, row] of rows.entries()) {
      const bounds = row.getBoundingClientRect();
      const center = inverse.transformPoint({ x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 });
      const height = Number.parseFloat(view.getComputedStyle(row).height);
      const top = center.y - height / 2, bottom = center.y + height / 2;
      for (const [side, start, end, width, color] of allEdges[index]) {
        const stroke = width * PT;
        let x, y, w, h;
        if (side === "vertical") {
          x = xAt(start) - stroke / 2;
          y = top;
          w = stroke;
          h = height;
        } else {
          const adjacent = allEdges[index + (side === "top" ? -1 : 1)] ?? [];
          const half = (column) => Math.max(0, ...[...allEdges[index], ...adjacent].filter((e) => e[0] === "vertical" && e[1] === column).map((e) => e[3])) * PT / 2;
          const a = xAt(start), b = xAt(end), startHalf = half(start), endHalf = half(end);
          x = Math.min(a, b) - (rtl ? endHalf : startHalf);
          w = Math.abs(b - a) + startHalf + endHalf;
          y = (side === "top" ? top : bottom) - stroke / 2;
          h = stroke;
        }
        const box = [x, y, w, h];
        if (!box.every(Number.isFinite) || !(w > 0 && h > 0)) continue;
        const fill = color === "currentColor" ? view.getComputedStyle(row).color : color;
        const key = `${side === "vertical" ? `row:${index}` : `boundary:${side === "top" ? index : index + 1}`}|${start}|${end}|${width}|${fill}`;
        if (painted.has(key)) continue;
        painted.add(key);
        const rect = doc.createElementNS(SVG_NS4, "rect");
        ["x", "y", "width", "height"].forEach((name, i) => rect.setAttribute(name, String(box[i])));
        rect.setAttribute("fill", fill);
        group.append(rect);
      }
    }
  }
}

// src/page-number-format.ts
var ROMAN_ONES = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix"];
var ROMAN_TENS = ["", "x", "xx", "xxx", "xl", "l", "lx", "lxx", "lxxx", "xc"];
var ROMAN_HUNDREDS = ["", "c", "cc", "ccc", "cd", "d", "dc", "dcc", "dccc", "cm"];
var ROMAN_THOUSANDS = ["", "m", "mm", "mmm"];
function toRoman(value) {
  if (value <= 0 || value >= 4e3) return String(value);
  return ROMAN_THOUSANDS[Math.floor(value / 1e3)] + ROMAN_HUNDREDS[Math.floor(value % 1e3 / 100)] + ROMAN_TENS[Math.floor(value % 100 / 10)] + ROMAN_ONES[value % 10];
}
function toLetter(value) {
  if (value <= 0) return String(value);
  const wrapped = value % 780 === 0 ? 780 : value % 780;
  const repeats = Math.floor((wrapped - 1) / 26) + 1;
  return "abcdefghijklmnopqrstuvwxyz".charAt((wrapped - 1) % 26).repeat(repeats);
}
var RENDERERS = {
  // ST_NumberFormat tokens (w:pgNumType/@w:fmt, w:numFmt).
  decimal: (v) => String(v),
  lowerRoman: toRoman,
  upperRoman: (v) => toRoman(v).toUpperCase(),
  lowerLetter: toLetter,
  upperLetter: (v) => toLetter(v).toUpperCase(),
  // Field `\*` general-formatting switch arguments.
  Arabic: (v) => String(v),
  roman: toRoman,
  ROMAN: (v) => toRoman(v).toUpperCase(),
  alphabetic: toLetter,
  ALPHABETIC: (v) => toLetter(v).toUpperCase()
};
function formatPageNumber(value, format) {
  const renderer = format ? RENDERERS[format] : void 0;
  return (renderer ?? RENDERERS.decimal)(value);
}

// src/page-geometry.ts
var DEFAULT_PAGE_WIDTH = 612;
var DEFAULT_PAGE_HEIGHT = 792;
var DEFAULT_MARGIN = 72;
var DEFAULT_HEADER_FOOTER_DISTANCE = 36;
function pxToPt(px2) {
  return px2 * 0.75;
}
function ptToPx(pt) {
  return pt / 0.75;
}
function finiteDataNumber(value, fallback) {
  if (value === void 0 || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function positiveDataNumber(value, fallback) {
  const parsed = finiteDataNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}
function nonNegativeDataNumber(value, fallback) {
  const parsed = finiteDataNumber(value, fallback);
  return parsed >= 0 ? parsed : fallback;
}
function positiveFinite(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function parseSectionDimensions(section) {
  const pageWidth = positiveDataNumber(section.dataset.pageWidth, DEFAULT_PAGE_WIDTH);
  const pageHeight = positiveDataNumber(section.dataset.pageHeight, DEFAULT_PAGE_HEIGHT);
  const marginTop = finiteDataNumber(section.dataset.marginTop, DEFAULT_MARGIN);
  const marginRight = finiteDataNumber(section.dataset.marginRight, DEFAULT_MARGIN);
  const marginBottom = finiteDataNumber(section.dataset.marginBottom, DEFAULT_MARGIN);
  const marginLeft = finiteDataNumber(section.dataset.marginLeft, DEFAULT_MARGIN);
  const derivedContentWidth = positiveFinite(pageWidth - marginLeft - marginRight, pageWidth);
  const derivedContentHeight = positiveFinite(pageHeight - marginTop - marginBottom, pageHeight);
  const contentWidth = positiveDataNumber(section.dataset.contentWidth, derivedContentWidth);
  const contentHeight = positiveDataNumber(section.dataset.contentHeight, derivedContentHeight);
  const headerDistance = nonNegativeDataNumber(
    section.dataset.headerHeight,
    DEFAULT_HEADER_FOOTER_DISTANCE
  );
  const footerDistance = nonNegativeDataNumber(
    section.dataset.footerHeight,
    DEFAULT_HEADER_FOOTER_DISTANCE
  );
  return {
    pageWidth,
    pageHeight,
    contentWidth,
    contentHeight,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    headerDistance,
    footerDistance,
    headerHeight: headerDistance,
    footerHeight: footerDistance
  };
}
var MIN_BODY_BAND_PT = 12;
function resolvePageBands(dims, headerContentHeight, footerContentHeight) {
  const headerTop = dims.headerDistance;
  const footerBottom = dims.pageHeight - dims.footerDistance;
  const headerReach = headerContentHeight > 0 ? headerTop + headerContentHeight : 0;
  const footerReach = footerContentHeight > 0 ? footerBottom - footerContentHeight : dims.pageHeight;
  let bodyTop = Math.max(dims.marginTop, headerReach);
  let bodyBottom = Math.min(dims.pageHeight - dims.marginBottom, footerReach);
  const shortfall = MIN_BODY_BAND_PT - (bodyBottom - bodyTop);
  if (shortfall > 0) {
    const headerGrowth = bodyTop - dims.marginTop;
    const footerGrowth = dims.pageHeight - dims.marginBottom - bodyBottom;
    const growth = headerGrowth + footerGrowth;
    if (growth > 0) {
      bodyTop -= shortfall * headerGrowth / growth;
      bodyBottom += shortfall * footerGrowth / growth;
    }
  }
  return {
    headerTop,
    headerHeight: Math.max(0, Math.min(headerContentHeight, bodyTop - headerTop)),
    bodyTop,
    bodyHeight: Math.max(0, bodyBottom - bodyTop),
    footerTop: footerBottom - Math.max(0, Math.min(footerContentHeight, footerBottom - bodyBottom)),
    footerHeight: Math.max(0, Math.min(footerContentHeight, footerBottom - bodyBottom))
  };
}

// src/markup-balloons.ts
var WORD = {
  /** The markup area: Word's default 3.7in balloon width, counted from the text column's right edge. */
  areaWidth: 266.4,
  /** The grey starts this far right of the text column... */
  greyStart: 9,
  /** ...and the balloons this far. */
  balloonStart: 31.6,
  /** Room left between a balloon and the sheet's right edge. */
  balloonEnd: 4,
  /** A leader runs along its anchor's line to this far past the text column, then turns. */
  elbow: 4.6,
  /** A leader reaches its balloon this far below the balloon's top. */
  leaderDrop: 6,
  /**
   * Word's print zoom moves in steps of 1/600: it is the step nearest to the paper's width over the
   * sheet's, so the sheet may overrun the paper's right edge by a fraction of a point, which the paper
   * cuts off. Measured from Save as PDF on ten paper sizes and margins (issues #1559, #1577).
   */
  zoomSteps: 600,
  border: 0.5,
  corner: 3,
  padBlock: 1.8,
  padInline: 4,
  /**
   * A balloon line's height in the balloon font, roughly, which tells a one-line balloon from a longer
   * one. Each line itself takes its own fonts' unrounded height, as Word's do: measured from Word's
   * prints, a Segoe UI 9pt line is 12.1pt and a Times New Roman 9pt line 10.3pt (issue #1577).
   */
  leading: 1.15,
  /** Vertical space between neighbouring balloons. */
  between: 1,
  /** Balloons keep this far inside the page's top and foot. */
  pageInset: 2,
  hairline: 0.2,
  /**
   * A balloon cut short to its first line, at the 9pt balloon font and scaled with it: Word's height
   * for it, and the box at its lower right corner holding the ellipsis (its height and horizontal
   * padding), measured from Word's Save as PDF and Print to PDF of one page with 25 long comments.
   * The line's text ends at least this far before the box; Word's lines break a word earlier, so
   * the exact gap was not measurable.
   */
  cut: { height: 16.1, boxHeight: 11.6, boxPadInline: 4, textGap: 1 },
  markSize: 3,
  grey: "#F2F2F2",
  font: { family: "Segoe UI", sizePt: 9 },
  /**
   * The Word presentation's author colours (WmlToHtmlConverter.WordAuthorPalette), for HTML that does
   * not carry them. Only the first two are Word's; the rest are this implementation's choice.
   */
  palette: ["#0078D4", "#D13438", "#5C2E91", "#038387", "#CA5010", "#498205", "#C239B3", "#986F0B"],
  /** Word's pale comment fills for its first two author colours. */
  paleFills: { "#0078D4": "#D5EDFF", "#D13438": "#F8DCDD" }
};
var MARKUP_MODES = ["mixed", "inline"];
var DEFAULT_BALLOON_FONT = WORD.font;
var SAME_LINE = 2;
function readMarkupBalloonComments(registry) {
  let commentPrefix = "comment-";
  const comments = Array.from(registry?.querySelectorAll("[data-comment-id]") ?? []).flatMap((note) => {
    const noteClass = Array.from(note.classList).find((name) => name.endsWith("margin-note"));
    if (!noteClass) return [];
    commentPrefix = noteClass.replace(/margin-note$/, "");
    const { commentId: id = "", author, initials, authorColor: color, fontFamily, fontStack: fontStack2, dateAsWritten } = note.dataset;
    const body = note.querySelector(`:scope > .${commentPrefix}margin-note-body`);
    const parentId = note.parentElement?.closest("[data-comment-id]")?.dataset.commentId;
    const paragraphs = Array.from(body?.children ?? [], (paragraph) => paragraph.textContent?.trim() ?? "");
    return [{ id, parentId, author, initials, color, fontFamily, fontStack: fontStack2, dateAsWritten, paragraphs }];
  });
  return { comments, commentPrefix };
}
function marginNoteRegistry(root) {
  return root.querySelector("#pagination-comment-margin-registry");
}
var SCOPE = "data-docx-markup-balloons";
function scopeMarkupBalloons(document2, containers, on, commentPrefix = "comment-", cssPrefix = "page-") {
  const commentsInBalloons = on && containers.some((container) => marginNoteRegistry(container) !== null);
  for (const container of containers) {
    if (on) container.setAttribute(SCOPE, commentsInBalloons ? "comments" : "");
    else container.removeAttribute(SCOPE);
  }
  const key = `${commentPrefix} ${cssPrefix}`;
  if (!on || Array.from(document2.querySelectorAll(`style[${SCOPE}]`)).some((style) => style.getAttribute(SCOPE) === key)) return;
  const rules = document2.createElement("style");
  rules.setAttribute(SCOPE, key);
  rules.textContent = [
    `[${SCOPE}="comments"] a.${commentPrefix}marker { font-size: 0 !important; margin: 0 !important; padding: 0 !important; visibility: hidden !important; }`,
    `[${SCOPE}="comments"] span.${commentPrefix}highlight { background: none !important; border: 0 !important; }`,
    `[${SCOPE}] .${cssPrefix}balloon { position: absolute; box-sizing: border-box; border-radius: ${WORD.corner}pt; padding: ${WORD.padBlock + WORD.border}pt ${WORD.padInline + WORD.border}pt; line-height: normal; color: #000; text-align: left; overflow: hidden; overflow-wrap: anywhere; }`,
    `[${SCOPE}] .${cssPrefix}balloon b { font-weight: bold; }`
  ].join("\n");
  document2.head.append(rules);
}
function layoutMarkupBalloons(options) {
  const { document: document2, pages, comments, commentPrefix, cssPrefix } = options;
  const formattingInBalloons = (options.markupMode ?? "mixed") === "mixed";
  const result = { truncatedCommentIds: [], truncatedFormatting: 0, unplacedCommentIds: [], cutComments: [] };
  const font = options.font && options.font.sizePt > 0 ? options.font : WORD.font;
  const thread = /* @__PURE__ */ new Map();
  for (const { id, parentId } of comments) thread.set(id, parentId !== void 0 && thread.has(parentId) ? thread.get(parentId) : id);
  const anchored = pages.map((page) => Array.from(page.element.querySelectorAll("[data-comment-id], [data-format-description]")).filter((element) => element.dataset.formatDescription !== void 0 ? formattingInBalloons : thread.has(element.dataset.commentId ?? "")));
  if (anchored.every((elements) => elements.length === 0)) return result;
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const authorsSeen = [];
  const colorOf = ({ color, author = "" }) => {
    if (color) return color;
    if (!authorsSeen.includes(author)) authorsSeen.push(author);
    return WORD.palette[authorsSeen.indexOf(author) % WORD.palette.length];
  };
  const rangeSpans = (scope, id) => Array.from(scope.querySelectorAll(
    `span.${commentPrefix}highlight[data-comment-id${id === void 0 ? "" : `="${CSS.escape(id)}"`}]`
  ));
  for (const { element: pageBox } of pages) {
    for (const span of rangeSpans(pageBox)) {
      const root = byId.get(thread.get(span.dataset.commentId) ?? "");
      if (root) span.style.setProperty("background-color", paleFill(colorOf(root)), "important");
    }
  }
  const story = (element) => element.closest(`.${cssPrefix}header, .${cssPrefix}footer`);
  const repeats = (element) => story(element) !== null;
  const lastPage = /* @__PURE__ */ new Map();
  pages.forEach((page, index) => anchored[index].forEach((element) => {
    if (repeats(element)) return;
    if (isBlock(element) && element.dataset.sourceAnchorId) lastPage.set(`p:${element.dataset.sourceAnchorId}`, index);
    const root = thread.get(element.dataset.commentId ?? "");
    if (root !== void 0 && element.matches(`span.${commentPrefix}highlight`)) lastPage.set(`c:${root}`, index);
  }));
  const seen = /* @__PURE__ */ new Set();
  const printed = /* @__PURE__ */ new Set();
  pages.forEach((page, pageIndex) => {
    const sheet = new MarkupSheet(document2, page, cssPrefix);
    const entries = [];
    const marks = [];
    let order = 0;
    let lastRun;
    const pendingBlocks = [];
    const leaveBlocksBefore = (element) => {
      while (pendingBlocks.length > 0 && !(element && pendingBlocks[pendingBlocks.length - 1].block.contains(element))) {
        pendingBlocks.pop().entry.order = order++;
      }
    };
    const printedHere = /* @__PURE__ */ new Set();
    for (const element of anchored[pageIndex]) {
      leaveBlocksBefore(element);
      if (element.dataset.commentId !== void 0) {
        const rootId = thread.get(element.dataset.commentId);
        if (rootId === void 0) continue;
        const everyPage = repeats(element);
        if (!everyPage) seen.add(rootId);
        if (printedHere.has(rootId) || !everyPage && (printed.has(rootId) || (lastPage.get(`c:${rootId}`) ?? pageIndex) !== pageIndex)) continue;
        const spans = rangeSpans(page.element, rootId).filter((span) => repeats(span) === everyPage);
        const first = sheet.box(spans.length > 0 ? lines(spans[0])[0] : markerLine(document2, element));
        const last = sheet.box(spans.length > 0 ? lines(spans[spans.length - 1]).pop() : markerLine(document2, element));
        if (!first || !last) continue;
        (everyPage ? printedHere : printed).add(rootId);
        for (const comment of comments.filter((candidate) => thread.get(candidate.id) === rootId)) {
          const color2 = colorOf(comment);
          const reply = comment.parentId !== void 0 ? `R${comments.indexOf(byId.get(comment.parentId)) + 1}` : "";
          entries.push({
            label: `Commented [${comment.initials || initialsOf(comment.author)}${comments.indexOf(comment) + 1}${reply}]:`,
            text: comment.paragraphs,
            color: color2,
            fill: paleFill(color2),
            textFont: comment.fontFamily,
            textFontStack: comment.fontStack,
            order: order++,
            lineTop: last.top,
            from: { x: last.right, y: last.bottom },
            height: 0,
            top: 0,
            commentId: comment.id,
            comment
          });
        }
        if (spans.length > 0) {
          const color2 = colorOf(byId.get(rootId));
          marks.push({ d: `M ${first.left} ${first.top} V ${first.bottom}`, color: color2, filled: false });
          marks.push({ d: `M ${last.right} ${last.top} V ${last.bottom}`, color: color2, filled: false });
        }
        continue;
      }
      const wording = element.dataset.formatDescription ?? "";
      const color = element.dataset.authorColor ?? WORD.palette[0];
      const base = { label: wording ? "Formatted:" : "Formatted", text: wording ? [wording] : [], color, fill: "#FFFFFF" };
      if (isBlock(element)) {
        const anchorId = element.dataset.sourceAnchorId;
        const line = sheet.box(lines(element, document2).pop());
        if (anchorId !== void 0 && !repeats(element) && lastPage.get(`p:${anchorId}`) !== pageIndex || !line) continue;
        const y = (line.top + line.bottom) / 2;
        marks.push({ d: arrowhead(sheet.columnRight, y, "left"), color, filled: true });
        const entry = { ...base, order: 0, lineTop: line.top, from: { x: sheet.columnRight + WORD.markSize, y }, height: 0, top: 0 };
        entries.push(entry);
        pendingBlocks.push({ block: element, entry });
        continue;
      }
      const key = [color, wording, element.dataset.formatKey].join("\n");
      if (lastRun?.key === key && story(lastRun.element) === story(element) && onlyMarksBetween(document2, lastRun.element, element)) {
        lastRun.element = element;
        continue;
      }
      lastRun = { element, key };
      const box = sheet.box(lines(element)[0]);
      if (!box) continue;
      marks.push({ d: arrowhead(box.left, box.bottom, "up"), color, filled: true });
      entries.push({ ...base, order: order++, lineTop: box.top, from: { x: box.left, y: box.bottom }, height: 0, top: 0 });
    }
    leaveBlocksBefore();
    if (entries.length > 0) {
      orderByLine(entries);
      const left = sheet.columnRight + WORD.balloonStart;
      for (const entry of entries) {
        entry.element = balloon(document2, entry, font, cssPrefix, left, sheet.width - WORD.balloonEnd - left);
        sheet.layer.append(entry.element);
        applyUnroundedNormalLineHeights(entry.element);
        entry.height = sheet.height(entry.element);
      }
      const top = sheet.pageTop + WORD.pageInset;
      const bottom = sheet.pageTop + page.dimensions.pageHeight - WORD.pageInset;
      fit(
        entries,
        top,
        bottom,
        font.sizePt * WORD.leading,
        (entry) => cutShort(document2, entry, font, cssPrefix, sheet),
        (entry) => restore(entry, cssPrefix, sheet)
      );
      stack(entries, top, bottom);
      for (const entry of entries) {
        entry.element.style.top = `${entry.top}pt`;
        if (entry.top + entry.height > bottom + 0.01) entry.element.dataset.balloonTruncated = "true";
        if (entry.element.dataset.balloonTruncated !== "true") continue;
        if (entry.commentId === void 0) {
          result.truncatedFormatting++;
        } else if (!result.truncatedCommentIds.includes(entry.commentId)) {
          result.truncatedCommentIds.push(entry.commentId);
          const { author, dateAsWritten, paragraphs } = entry.comment;
          result.cutComments.push({
            commentId: entry.commentId,
            pageNumber: pageIndex + 1,
            label: entry.label.replace(/:$/, ""),
            author,
            dateAsWritten,
            color: entry.color,
            fill: entry.fill,
            textFont: entry.textFont,
            textFontStack: entry.textFontStack,
            paragraphs
          });
        }
        const box = entry.element.querySelector(`:scope > .${cssPrefix}balloon-cut`);
        if (options.numberCutBoxes && box && entry.commentId !== void 0) {
          box.textContent = `\u2026 [${result.cutComments.findIndex((cut) => cut.commentId === entry.commentId) + 1}]`;
        }
      }
      connect(document2, sheet, entries, marks, left);
    }
    sheet.shrink();
  });
  result.unplacedCommentIds = comments.filter((comment) => seen.has(thread.get(comment.id)) && !printed.has(thread.get(comment.id))).map((comment) => comment.id);
  return result;
}
var MarkupSheet = class {
  constructor(document2, page, cssPrefix) {
    const { pageWidth: paperWidth, pageHeight: paperHeight, marginRight } = page.dimensions;
    this.columnRight = paperWidth - marginRight;
    this.width = Math.max(paperWidth, this.columnRight + WORD.areaWidth);
    this.factor = Math.round(WORD.zoomSteps * paperWidth / this.width) / WORD.zoomSteps;
    this.layerHeight = paperHeight / this.factor;
    this.pageTop = (this.layerHeight - paperHeight) / 2;
    const placed = (className, left, top, width, height) => {
      const element = document2.createElement("div");
      element.className = className;
      element.style.cssText = `position:absolute;left:${left}pt;top:${top}pt;width:${width}pt;height:${height}pt`;
      return element;
    };
    this.layer = placed(`${cssPrefix}markup-layer`, 0, paperHeight - this.layerHeight, this.width, this.layerHeight);
    this.layer.style.transformOrigin = "left bottom";
    const pageHolder = placed(`${cssPrefix}markup-page`, 0, this.pageTop, paperWidth, paperHeight);
    pageHolder.style.overflow = "hidden";
    pageHolder.append(...Array.from(page.element.childNodes));
    const area = placed(
      `${cssPrefix}markup-area`,
      this.columnRight + WORD.greyStart,
      this.pageTop,
      this.width - this.columnRight - WORD.greyStart,
      paperHeight
    );
    area.style.background = WORD.grey;
    area.dataset.pageMapExclude = "true";
    area.setAttribute("aria-hidden", "true");
    this.layer.append(pageHolder, area);
    page.element.append(this.layer);
    page.element.dataset.docxMarkupScale = String(this.factor);
  }
  /** Points per CSS pixel in the unscaled layer (the viewer may zoom the page box). */
  get pointsPerPixel() {
    return this.width / this.layer.getBoundingClientRect().width;
  }
  /** A client rect in the layer's own points. */
  box(rect) {
    if (!rect) return void 0;
    const origin = this.layer.getBoundingClientRect();
    const k = this.pointsPerPixel;
    return {
      left: (rect.left - origin.left) * k,
      right: (rect.right - origin.left) * k,
      top: (rect.top - origin.top) * k,
      bottom: (rect.bottom - origin.top) * k
    };
  }
  height(element) {
    return element.getBoundingClientRect().height * this.pointsPerPixel;
  }
  shrink() {
    this.layer.style.transform = `scale(${this.factor})`;
  }
};
function balloon(document2, entry, font, cssPrefix, left, width) {
  const element = document2.createElement("div");
  element.className = `${cssPrefix}balloon`;
  element.dataset.pageMapExclude = "true";
  element.style.cssText = `left:${left}pt;width:${width}pt;font-size:${font.sizePt}pt;box-shadow:inset 0 0 0 ${WORD.border}pt ${entry.color};background-color:${entry.fill}`;
  element.style.fontFamily = fontStack(entry.textFont ?? font.family, entry.textFont ? entry.textFontStack : font.stack);
  const content = document2.createElement("div");
  const label = document2.createElement("b");
  label.style.fontFamily = fontStack(font.family, font.stack);
  label.textContent = entry.label;
  content.append(label, ...entry.text.flatMap((paragraph, index) => index === 0 ? [` ${paragraph}`] : [document2.createElement("br"), paragraph]));
  element.append(content);
  return element;
}
function fit(entries, top, bottom, lineHeight, shorten, lengthen) {
  const whole = entries.map((entry) => entry.height);
  if (whole.reduce((sum, height) => sum + height + WORD.between, -WORD.between) <= bottom - top + 0.01) return;
  const oneLine = lineHeight + 2 * (WORD.padBlock + WORD.border);
  const cuttable = whole.map((height) => height > oneLine + lineHeight / 2);
  entries.forEach((entry, index) => {
    if (cuttable[index]) shorten(entry);
  });
  const cut = entries.map((entry) => entry.height);
  const stackedFoot = (heightOf) => entries.reduce((floor, entry, index) => Math.max(floor, entry.lineTop) + heightOf(index) + WORD.between, top) - WORD.between;
  const fits = (keptWhole2) => stackedFoot((index) => index < keptWhole2 ? whole[index] : cut[index]) <= bottom + 0.01;
  let keptWhole = 0;
  while (keptWhole < entries.length && fits(keptWhole + 1)) keptWhole++;
  for (let index = 0; index < keptWhole; index++) if (cuttable[index]) lengthen(entries[index]);
}
function cutShort(document2, entry, font, cssPrefix, sheet) {
  const element = entry.element;
  const scale = font.sizePt / WORD.font.sizePt;
  let box = element.querySelector(`:scope > .${cssPrefix}balloon-cut`);
  if (!box) {
    box = document2.createElement("span");
    box.className = `${cssPrefix}balloon-cut`;
    box.textContent = "\u2026";
    element.append(box);
  }
  const boxHeight = WORD.cut.boxHeight * scale;
  box.style.cssText = `align-self:end;box-sizing:border-box;height:${boxHeight}pt;margin:0 -${WORD.padInline}pt -${WORD.padBlock}pt 0;line-height:${boxHeight - 2 * WORD.hairline}pt;padding:0 ${WORD.cut.boxPadInline * scale}pt;border:${WORD.hairline}pt solid #000;background:#fff;color:#000;white-space:nowrap;font-size:${font.sizePt}pt`;
  box.style.fontFamily = fontStack(font.family, font.stack);
  element.style.display = "grid";
  element.style.gridTemplateColumns = "minmax(0, 1fr) auto";
  element.style.minHeight = `${WORD.cut.height * scale}pt`;
  const content = element.firstElementChild;
  content.style.cssText = `align-self:start;margin-right:${WORD.cut.textGap * scale}pt`;
  const rows = lines(content, document2).map((rect) => sheet.box(rect));
  const onFirst = rows.filter((row) => row.top < rows[0].bottom - 0.5);
  const firstLine = Math.max(...onFirst.map((row) => row.bottom)) - Math.min(...onFirst.map((row) => row.top));
  content.style.cssText += `;max-height:${firstLine}pt;overflow:hidden`;
  element.dataset.balloonTruncated = "true";
  entry.height = sheet.height(element);
}
function restore(entry, cssPrefix, sheet) {
  const element = entry.element;
  element.querySelector(`:scope > .${cssPrefix}balloon-cut`)?.remove();
  element.style.display = "";
  element.style.gridTemplateColumns = "";
  element.style.minHeight = "";
  element.firstElementChild.style.cssText = "";
  delete element.dataset.balloonTruncated;
  entry.height = sheet.height(element);
}
function stack(entries, top, bottom) {
  const pushDown = () => entries.reduce((floor, entry) => (entry.top = Math.max(entry.top, floor)) + entry.height + WORD.between, top);
  for (const entry of entries) entry.top = entry.lineTop;
  pushDown();
  entries.reduceRight((ceiling, entry) => (entry.top = Math.max(top, Math.min(entry.top, ceiling - entry.height))) - WORD.between, bottom);
  pushDown();
}
function connect(document2, sheet, entries, marks, balloonLeft) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document2.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${sheet.width} ${sheet.layerHeight}`);
  svg.setAttribute(
    "style",
    `position:absolute;left:0;top:0;width:${sheet.width}pt;height:${sheet.layerHeight}pt;overflow:visible;pointer-events:none`
  );
  for (const name of ["aria-hidden", "data-page-map-exclude"]) svg.setAttribute(name, "true");
  const elbow = sheet.columnRight + WORD.elbow;
  const paths = [
    ...entries.map(({ from, top, color }) => ({
      d: `M ${from.x} ${from.y} H ${elbow} L ${balloonLeft} ${top + WORD.leaderDrop}`,
      color,
      filled: false,
      dotted: true
    })),
    ...marks.map((mark) => ({ ...mark, dotted: false }))
  ];
  for (const { d, color, filled, dotted } of paths) {
    const path = document2.createElementNS(ns, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", filled ? color : "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", String(WORD.hairline));
    if (dotted) path.setAttribute("stroke-dasharray", String(WORD.hairline));
    svg.append(path);
  }
  sheet.layer.append(svg);
}
function arrowhead(x, y, pointing) {
  const s = WORD.markSize;
  return pointing === "up" ? `M ${x - s / 2} ${y} L ${x} ${y - s} L ${x + s / 2} ${y} Z` : `M ${x} ${y} L ${x + s} ${y + s / 2} V ${y - s / 2} Z`;
}
function orderByLine(entries) {
  const lineTops = [];
  const lineOf = (entry) => {
    const known = lineTops.find((top) => Math.abs(top - entry.lineTop) <= SAME_LINE);
    if (known !== void 0) return known;
    lineTops.push(entry.lineTop);
    return entry.lineTop;
  };
  const keyed = entries.map((entry) => ({ entry, line: lineOf(entry) }));
  keyed.sort((a, b) => a.line - b.line || a.entry.order - b.entry.order);
  keyed.forEach(({ entry }, index) => entries[index] = entry);
}
function isBlock(element) {
  return ["p", "li", "h1", "h2", "h3", "h4", "h5", "h6"].includes(element.localName);
}
function onlyMarksBetween(document2, earlier, later) {
  const trackedMark = (element) => isBlock(element) && /(^|\s)\S*para-(ins|del)(\s|$)/.test(element.className);
  for (let block = earlier.parentElement; block && !block.contains(later); block = block.parentElement) {
    if (trackedMark(block)) return false;
  }
  const walker = document2.createTreeWalker(document2.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  walker.currentNode = earlier;
  for (let node = walker.nextNode(); node && node !== later; node = walker.nextNode()) {
    if (earlier.contains(node)) continue;
    if (node instanceof Element) {
      if (trackedMark(node) && !node.contains(later)) return false;
    } else if (node.textContent?.trim() && !node.parentElement?.closest("[data-list-marker]")) {
      return false;
    }
  }
  return true;
}
function initialsOf(author = "") {
  return (author.match(/(?:^|\s)(\S)/g) ?? []).map((initial) => initial.trim().toUpperCase()).join("");
}
function paleFill(color) {
  return WORD.paleFills[color.toUpperCase()] ?? `color-mix(in srgb, ${color} 17%, white)`;
}
function fontStack(family, resolved) {
  return resolved ?? `${JSON.stringify(family)}, sans-serif`;
}
function markerLine(document2, marker) {
  const at = marker.getBoundingClientRect();
  const block = marker.closest("p, li, h1, h2, h3, h4, h5, h6") ?? marker.parentElement;
  if (!block) return void 0;
  const middle = at.top + at.height / 2;
  const rows = lines(block, document2);
  const row = rows.find((rect) => middle >= rect.top - 1 && middle <= rect.bottom + 1) ?? rows.reduce((best, rect) => !best || Math.abs(rect.top - middle) < Math.abs(best.top - middle) ? rect : best, void 0);
  return row && new DOMRect(at.left, row.top, 0, row.height);
}
function lines(element, document2) {
  let target = element;
  if (document2) {
    target = document2.createRange();
    target.selectNodeContents(element);
  }
  return Array.from(target.getClientRects()).filter((rect) => rect.height > 0);
}

// src/balloon-appendix.ts
var APPENDIX = {
  /** The bar's outer edges stand this far outside the text column on either side. */
  barOutset: 4.92,
  barBorder: 0.48,
  /** Its shadow, cast right and down in the comment's colour. */
  barShadow: 0.96,
  /** Border box height, the borders included. */
  barHeight: 14.88,
  /** The date ends this far inside the text column. */
  dateInset: 4,
  /** From the end of one comment's text to the next bar, and from a bar to its comment's text. */
  spaceBeforeBar: 5.9,
  spaceAfterBar: 2.2,
  /** Word's Comment Text size. */
  textSizePt: 10,
  leading: 1.15,
  /** Widow and orphan control: lines a paragraph keeps on each side of a page break. */
  minLines: 2
};
var BalloonAppendix = class {
  constructor(document2, comments, cssPrefix, font = DEFAULT_BALLOON_FONT) {
    this.document = document2;
    this.cssPrefix = cssPrefix;
    this.font = font;
    this.queue = comments.flatMap((comment, index) => [
      { kind: "bar", comment, number: index + 1 },
      ...comment.paragraphs.map((text) => ({ kind: "text", comment, number: index + 1, text }))
    ]);
  }
  get finished() {
    return this.queue.length === 0;
  }
  fill(page) {
    const { marginLeft, marginTop, contentWidth, contentHeight } = page.dimensions;
    const column = this.document.createElement("div");
    column.className = `${this.cssPrefix}balloon-appendix`;
    column.dataset.pageMapExclude = "true";
    column.style.cssText = `position:absolute;left:${marginLeft}pt;top:${marginTop}pt;width:${contentWidth}pt`;
    page.element.append(column);
    const origin = column.getBoundingClientRect();
    const k = contentWidth / origin.width;
    const bottomOf = (element) => (element.getBoundingClientRect().bottom - origin.top) * k;
    while (this.queue.length > 0) {
      const block = this.queue[0];
      const previous = column.lastElementChild;
      const element = block.kind === "bar" ? this.bar(block) : this.paragraph(block.comment, block.text);
      element.style.marginTop = `${!previous ? 0 : block.kind === "bar" ? APPENDIX.spaceBeforeBar : previous.dataset.appendixBar === "true" ? APPENDIX.spaceAfterBar : 0}pt`;
      column.append(element);
      if (bottomOf(element) <= contentHeight + 0.01) {
        this.queue.shift();
        continue;
      }
      if (block.kind === "bar") {
        if (previous) element.remove();
        else this.queue.shift();
        return;
      }
      const rows = lineBoxes(this.document, element);
      const room = rows.filter((row) => (row.bottom - origin.top) * k <= contentHeight + 0.01).length;
      let keep = Math.min(room, rows.length - APPENDIX.minLines);
      if (!previous) keep = Math.max(1, keep);
      let split = -1;
      for (; keep >= (previous ? APPENDIX.minLines : 1); keep--) {
        element.textContent = block.text;
        split = rowStart(this.document, element, rows[keep]);
        if (split <= 0) continue;
        element.textContent = block.text.slice(0, split).trimEnd();
        if (bottomOf(element) <= contentHeight + 0.01) break;
        split = -1;
      }
      if (split > 0) {
        this.queue[0] = { ...block, text: block.text.slice(split).trimStart() };
      } else if (previous) {
        element.remove();
      } else {
        this.queue.shift();
      }
      return;
    }
  }
  /** The heading: page, box number and label at the left, the author centred, the date at the right. */
  bar({ comment, number: number2 }) {
    const bar = this.document.createElement("div");
    bar.className = `${this.cssPrefix}balloon-appendix-bar`;
    bar.dataset.appendixBar = "true";
    const inset = APPENDIX.barOutset - APPENDIX.barBorder;
    bar.style.cssText = `display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;column-gap:${APPENDIX.dateInset}pt;box-sizing:border-box;height:${APPENDIX.barHeight}pt;margin-left:-${APPENDIX.barOutset}pt;margin-right:-${APPENDIX.barOutset}pt;padding:0 ${inset}pt;border:${APPENDIX.barBorder}pt solid ${comment.color};box-shadow:${APPENDIX.barShadow}pt ${APPENDIX.barShadow}pt 0 ${comment.color};background:${comment.fill};color:#000;font-weight:bold;font-size:${this.font.sizePt}pt;line-height:1;white-space:nowrap`;
    bar.style.fontFamily = fontStack(this.font.family, this.font.stack);
    const cell = (text, css) => {
      const span = this.document.createElement("span");
      span.textContent = text;
      span.style.cssText = `overflow:hidden;${css}`;
      return span;
    };
    bar.append(
      cell(`Page ${comment.pageNumber}: [${number2}] ${comment.label}`, "justify-self:start"),
      cell(comment.author ?? "", ""),
      cell(printedDate(comment.dateAsWritten), `justify-self:end;padding-right:${APPENDIX.dateInset}pt`)
    );
    return bar;
  }
  paragraph(comment, text) {
    const paragraph = this.document.createElement("div");
    paragraph.className = `${this.cssPrefix}balloon-appendix-text`;
    const lineHeight = APPENDIX.textSizePt * APPENDIX.leading;
    paragraph.style.cssText = `min-height:${lineHeight}pt;color:#000;overflow-wrap:anywhere;font-size:${APPENDIX.textSizePt}pt;line-height:${lineHeight}pt`;
    paragraph.style.fontFamily = fontStack(comment.textFont ?? this.font.family, comment.textFont ? comment.textFontStack : this.font.stack);
    paragraph.textContent = text;
    return paragraph;
  }
};
function lineBoxes(document2, element) {
  const range = document2.createRange();
  range.selectNodeContents(element);
  const rows = [];
  for (const rect of Array.from(range.getClientRects())) {
    if (rect.height <= 0) continue;
    const row = rows.find((known) => Math.abs(known.top - rect.top) < rect.height / 2);
    if (!row) rows.push(rect);
  }
  rows.sort((a, b) => a.top - b.top);
  return rows.length > 0 ? rows : [element.getBoundingClientRect()];
}
function rowStart(document2, element, row) {
  const text = element.firstChild;
  const length = text?.textContent?.length ?? 0;
  if (!text || !row) return -1;
  const range = document2.createRange();
  const below = (offset) => {
    range.setStart(text, offset);
    range.setEnd(text, offset + 1);
    const rect = Array.from(range.getClientRects()).find((candidate) => candidate.width > 0) ?? range.getBoundingClientRect();
    return rect.top >= row.top - row.height / 2;
  };
  let low = 0;
  let high = length;
  while (low < high) {
    const middle = low + high >> 1;
    if (below(middle)) high = middle;
    else low = middle + 1;
  }
  return low < length ? low : -1;
}
function printedDate(written = "") {
  const digits = written.replace(/(Z|[+-]\d{2}:\d{2})$/, "");
  const at = /* @__PURE__ */ new Date(`${digits}Z`);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(digits) || Number.isNaN(at.getTime())) return "";
  return at.toLocaleString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).replace(",", "").replace(/\s+/g, " ");
}

// src/pagination.ts
function samePageBox(a, b) {
  return a.pageWidth === b.pageWidth && a.pageHeight === b.pageHeight;
}
var MAX_FOOTNOTE_AREA_RATIO = 1;
var FOOTNOTE_MEASUREMENT_GUARD_PT = 2;
var MIN_FOOTNOTE_START_PT = 20;
var FOOTNOTE_SOURCE_POSITION_ATTR = "data-pagination-footnote-source-position";
var CONVERTER_MATHML_ELEMENTS = /^m(ath|row|[ino]|text|space|frac|sqrt|root|sub|sup|subsup|multiscripts|prescripts|under|over|underover|table|tr|td|phantom|padded)$/;
function collapsedBlockMarginsPx(view, element) {
  return {
    topPx: collapseMarginChain(view, element, "top"),
    bottomPx: collapseMarginChain(view, element, "bottom")
  };
}
function collapseMarginChain(view, element, edge) {
  const margins = [];
  let current = element;
  while (current) {
    const style = view.getComputedStyle(current);
    margins.push(parseFloat(edge === "top" ? style.marginTop : style.marginBottom) || 0);
    current = collapsesThroughTo(view, current, style, edge);
  }
  const positive = Math.max(0, ...margins);
  const negative = Math.min(0, ...margins);
  return positive + negative;
}
function collapsesThroughTo(view, parent, style, edge) {
  const ordinaryBlock = (style.display === "block" || style.display === "list-item") && style.overflowX === "visible" && style.overflowY === "visible" && style.float === "none" && style.position !== "absolute" && style.position !== "fixed";
  if (!ordinaryBlock) return null;
  if (style.columnCount !== "auto" || style.columnWidth !== "auto") return null;
  const border = parseFloat(edge === "top" ? style.borderTopWidth : style.borderBottomWidth) || 0;
  const padding = parseFloat(edge === "top" ? style.paddingTop : style.paddingBottom) || 0;
  if (border !== 0 || padding !== 0) return null;
  if (edge === "bottom" && parent.style.height !== "") return null;
  const nodes = Array.from(parent.childNodes);
  if (edge === "bottom") nodes.reverse();
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? "").trim() !== "") return null;
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const child = node;
    const childStyle = view.getComputedStyle(child);
    if (childStyle.display === "none") continue;
    if (childStyle.position === "absolute" || childStyle.position === "fixed" || childStyle.float !== "none") continue;
    const blockLevel = childStyle.display === "block" || childStyle.display === "list-item" || childStyle.display === "table" || childStyle.display === "flow-root" || childStyle.display === "flex" || childStyle.display === "grid";
    return blockLevel ? child : null;
  }
  return null;
}
var DRAWING_HOST_ATTRIBUTE = "data-docx-anchor-host";
var HOSTS_PROMOTED_DRAWING_ATTRIBUTE = "data-docx-hosts-promoted-drawing";
var OVERSIZED_BLOCK_ATTRIBUTE = "data-pagination-oversized";
function findOversizedExactRow(element) {
  const block = element.closest(`[${OVERSIZED_BLOCK_ATTRIBUTE}]`);
  const body = block?.parentElement;
  if (!block || !body) return null;
  const height = body.getBoundingClientRect().height;
  const columnTable = element.matches("colgroup, col") ? element.closest("table") : null;
  for (const clip of Array.from(block.querySelectorAll(EXACT_ROW_CELL))) {
    const row = clip.closest("tr");
    if (row && clip.getBoundingClientRect().height > height + 1 && (row.contains(element) || element.contains(row) || columnTable?.contains(row))) return row;
  }
  return null;
}
function clippedAwayByExactRow(element, rect) {
  if (!(rect.width > 0 && rect.height > 0)) {
    const zeroHeightClip = (cell) => {
      const clip = cell.querySelector(`:scope > ${EXACT_ROW_CELL}`);
      return clip !== null && !(clip.getBoundingClientRect().height > 0);
    };
    const zeroHeightRow = (row) => {
      const cells = Array.from(row.cells);
      return cells.length > 0 && cells.some(zeroHeightClip);
    };
    if (element.localName === "tr") return zeroHeightRow(element);
    if (element.localName === "td" || element.localName === "th") return zeroHeightClip(element);
    if (element.localName === "table") {
      const rows = Array.from(element.rows);
      return rows.length > 0 && rows.every(zeroHeightRow);
    }
    return false;
  }
  const body = element.closest(`[${OVERSIZED_BLOCK_ATTRIBUTE}]`)?.parentElement;
  if (body && findOversizedExactRow(element)) {
    const boundary = body.style.overflowY === "visible" && body.parentElement ? body.parentElement.getBoundingClientRect().bottom : body.getBoundingClientRect().bottom;
    if (rect.top >= boundary) return true;
  }
  for (let clip = element.parentElement?.closest(EXACT_ROW_CELL); clip; clip = clip.parentElement?.closest(EXACT_ROW_CELL)) {
    const box = clip.getBoundingClientRect();
    if (rect.bottom <= box.top || rect.top >= box.bottom || rect.right <= box.left || rect.left >= box.right) return true;
  }
  return false;
}
function hiddenPastLinkedStoryEnd(element, rect) {
  const frame = element.parentElement?.closest('[data-docx-textbox-overflow="true"]')?.getBoundingClientRect();
  return frame !== void 0 && (rect.top >= frame.bottom || rect.bottom <= frame.top || rect.left >= frame.right || rect.right <= frame.left);
}
function blankLineClippedByTextBox(view, element, rect, page) {
  if (!rendersOnlyItsLine(element) || !(rect.height > 0) || rect.width < 0) return false;
  if (rect.width === 0) {
    const owner = element.parentElement?.closest('[data-docx-textbox-source-clip="true"]');
    if (!owner || !eligibleSourceTextBox(owner)) return false;
  }
  return clippedByTextBox(view, element, [rect], page) !== null;
}
function sourceTextBoxAnchor(box) {
  if (box.dataset.docxDrawingAnchor === "true" || box.dataset.docxTextboxSourceClip !== "true") return box;
  if (box.parentElement?.dataset.docxDrawingMember !== "true") return box;
  const view = box.ownerDocument.defaultView;
  for (let node = box; node; node = node.parentElement) {
    const style = view.getComputedStyle(node);
    if (node.dataset.docxShape === "partial" || node.dataset.docxTextboxLinked === "true" || ["transform", "translate", "rotate", "scale"].some((name) => style.getPropertyValue(name) !== "none")) return box;
    if (node !== box && node.dataset.docxDrawingMember !== "true" && node.dataset.docxDrawingGroup !== "true") return box;
    if (node.dataset.docxDrawingAnchor === "true") return node.dataset.docxDrawingGroup === "true" ? node : box;
  }
  return box;
}
function eligibleSourceTextBox(box, placement = false) {
  if (box.dataset.docxTextboxLinked === "true" || box.dataset.docxShape === "partial") return false;
  const anchor = placement ? sourceTextBoxAnchor(box) : box;
  if (placement && anchor !== box && ["h", "v"].some((axis) => anchor.hasAttribute(`data-docx-anchor-${axis}-align`) || !(anchor.getAttribute(`data-docx-anchor-${axis}-offset`) ?? "").trim() || !Number.isFinite(Number(anchor.getAttribute(`data-docx-anchor-${axis}-offset`))))) return false;
  if (placement && box.dataset.docxTextboxSourcePosition === "page-offset") {
    return box.dataset.docxDrawingAnchor === "true" && ["h", "v"].every((axis) => box.getAttribute(`data-docx-anchor-${axis}-relative`) === "page" && !box.hasAttribute(`data-docx-anchor-${axis}-align`) && (box.getAttribute(`data-docx-anchor-${axis}-offset`) ?? "").trim() !== "" && Number.isFinite(Number(box.getAttribute(`data-docx-anchor-${axis}-offset`)))) && ["width", "height"].every((axis) => {
      const percent = Number(box.getAttribute(`data-docx-anchor-${axis}-percent`) ?? 0);
      return Number.isFinite(percent) && percent >= 0 && (percent === 0 || box.getAttribute(`data-docx-anchor-${axis}-relative`) === "page");
    });
  }
  return box.dataset.docxTextboxClip === "true" && (placement ? box.dataset.docxTextboxSourcePosition === "true" || anchor !== box : box.dataset.docxTextboxSourceClip === "true") && anchor.dataset.docxAnchorAutofit !== "true" && ["width", "height"].every((axis) => {
    const percent = anchor.getAttribute(`data-docx-anchor-${axis}-percent`);
    return percent === null || percent.trim() !== "" && Number(percent) === 0;
  }) && (!placement || sourcePlacedDrawing(anchor));
}
function sourcePlacedDrawing(anchor) {
  const h = anchor.dataset.docxAnchorHRelative ?? "", v = anchor.dataset.docxAnchorVRelative ?? "";
  return anchor.dataset.docxDrawingAnchor === "true" && (["page", "margin"].includes(h) && ["page", "margin"].includes(v) || ["column", "margin"].includes(h) && v === "paragraph");
}
function outsidePaper(rect, paper) {
  return rect.right <= paper.left || rect.left >= paper.right || rect.bottom <= paper.top || rect.top >= paper.bottom;
}
function sourcePlacementBounds(box, rects, paper, scaleX = 1, scaleY = 1) {
  if (!(box.width > 0 && box.height > 0) || !rects.length || !rects.every((rect) => outsidePaper(rect, paper))) return;
  return textBounds(box, rects, paper, scaleX, scaleY);
}
function textBounds(box, rects, origin, scaleX = 1, scaleY = 1) {
  return [box, ...rects].flatMap((rect) => [
    (rect.left - origin.left) / scaleX,
    (rect.top - origin.top) / scaleY,
    rect.width / scaleX,
    rect.height / scaleY
  ]);
}
function sourceTextRects(view, element, checkpoint) {
  const result = [];
  const walker = element.ownerDocument.createTreeWalker(element, view.NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    checkpoint();
    if (!(node.textContent ?? "").replace(/\s/g, "")) continue;
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(node);
    result.push(...Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0));
  }
  return result;
}
function clippedByTextBox(view, element, rects, page, provenSource = false) {
  if (!rects.length) return null;
  for (let clip = element.parentElement?.closest('[data-docx-textbox-clip="true"]'); clip; clip = clip.parentElement?.closest('[data-docx-textbox-clip="true"]')) {
    if (provenSource && !eligibleSourceTextBox(clip)) continue;
    const style = view.getComputedStyle(clip);
    const box = clip.getBoundingClientRect();
    if (provenSource && !(box.width > 0 && box.height > 0)) continue;
    const paper = page && clip.dataset.docxDrawingAnchor === "true" && style.position === "absolute" ? page : box;
    const clipsX = style.overflowX === "hidden" || style.overflowX === "clip";
    const clipsY = style.overflowY === "hidden" || style.overflowY === "clip";
    const left = Math.max(box.left, paper.left), right = Math.min(box.right, paper.right);
    const top = Math.max(box.top, paper.top), bottom = Math.min(box.bottom, paper.bottom);
    if (clipsX && right <= left || clipsY && bottom <= top) return clip;
    if (rects.every((rect) => clipsX && (rect.right <= left || rect.left >= right) || clipsY && (rect.bottom <= top || rect.top >= bottom))) return clip;
  }
  return null;
}
function rendersOnlyItsLine(element) {
  return (element.textContent ?? "").replace(/[\s\u00a0]/g, "") === "" && element.querySelector("img, svg, canvas, [data-docx-drawing-anchor]") === null;
}
function ownsText(element) {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    if (/\S/.test(node.textContent ?? "") && node.parentElement?.closest("[data-source-anchor-id]") === element) return true;
  return false;
}
function createRenderedSourceMeasurer(clipInset, drawingHostAttribute, hostsPromotedDrawingAttribute) {
  function visibleWithinPage(view, element, page, pageRect, rect, includeSelf = false, paperClip) {
    let left = Math.max(rect.left, pageRect.left);
    let top = Math.max(rect.top, pageRect.top);
    let right = Math.min(rect.right, pageRect.right);
    let bottom = Math.min(rect.bottom, pageRect.bottom);
    const clips = (value) => value === "hidden" || value === "clip" || value === "scroll" || value === "auto";
    for (let ancestor = includeSelf ? element : element.parentElement; ancestor && ancestor !== page; ancestor = ancestor.parentElement) {
      if (ancestor === paperClip) continue;
      const style = view.getComputedStyle(ancestor);
      const clipsX = clips(style.overflowX);
      const clipsY = clips(style.overflowY);
      if (!clipsX && !clipsY && style.clipPath === "none") continue;
      const ancestorRect = ancestor.getBoundingClientRect();
      const scale = ancestorRect.width / ancestor.offsetWidth || 1;
      const inset = clipInset(style.clipPath, ancestorRect, scale);
      if (inset) {
        left = Math.max(left, inset.left);
        top = Math.max(top, inset.top);
        right = Math.min(right, inset.right);
        bottom = Math.min(bottom, inset.bottom);
      }
      const expanded = inset !== null && style.clipPath.startsWith("path(");
      if (clipsX && !expanded) {
        left = Math.max(left, ancestorRect.left);
        right = Math.min(right, ancestorRect.right);
      }
      if (clipsY && !expanded) {
        top = Math.max(top, ancestorRect.top);
        bottom = Math.min(bottom, ancestorRect.bottom);
      }
    }
    return { left, top, right, bottom };
  }
  return function measureRenderedSource2(view, element, page, pageRect = page.getBoundingClientRect(), textRect, paperClip) {
    if (textRect) return { rect: textRect, visible: visibleWithinPage(view, element, page, pageRect, textRect, true, paperClip) };
    const own = element.getBoundingClientRect();
    const ownResult = () => ({ rect: own, visible: visibleWithinPage(view, element, page, pageRect, own) });
    const ownMeasurable = own.width > 0 && own.height > 0;
    const hostsPromotedDrawing = element.hasAttribute(hostsPromotedDrawingAttribute);
    if (ownMeasurable && !hostsPromotedDrawing) return ownResult();
    const hostAnchorId = element.dataset.sourceAnchorId;
    const promoted = hostAnchorId ? Array.from(page.querySelectorAll(`[${drawingHostAttribute}]`)).filter((drawing) => drawing.getAttribute(drawingHostAttribute)?.split(" ").includes(hostAnchorId)) : [];
    if (ownMeasurable && promoted.length === 0) return ownResult();
    const rendered = [
      ...ownMeasurable ? [element] : Array.from(element.querySelectorAll("*")),
      ...promoted.flatMap((drawing) => [drawing, ...Array.from(drawing.querySelectorAll("*"))])
    ];
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const child of rendered) {
      const style = view.getComputedStyle(child);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const childRect = child.getBoundingClientRect();
      if (childRect.width <= 0 || childRect.height <= 0) continue;
      const visible = visibleWithinPage(view, child, page, pageRect, childRect);
      if (visible.right <= visible.left || visible.bottom <= visible.top) continue;
      left = Math.min(left, visible.left);
      top = Math.min(top, visible.top);
      right = Math.max(right, visible.right);
      bottom = Math.max(bottom, visible.bottom);
    }
    if (!(left < right && top < bottom)) return ownResult();
    return { rect: new DOMRect(left, top, right - left, bottom - top), visible: { left, top, right, bottom } };
  };
}
var measureRenderedSource = createRenderedSourceMeasurer(
  insetClipBounds,
  DRAWING_HOST_ATTRIBUTE,
  HOSTS_PROMOTED_DRAWING_ATTRIBUTE
);
function renderedSourceMeasurerExpression() {
  return `(${createRenderedSourceMeasurer.toString()})(${insetClipBounds.toString()},
    ${JSON.stringify(DRAWING_HOST_ATTRIBUTE)}, ${JSON.stringify(HOSTS_PROMOTED_DRAWING_ATTRIBUTE)})`;
}
var PaginationEngine = class {
  /**
   * Creates a new pagination engine.
   *
   * @param staging - The staging element or its ID containing the content to paginate
   * @param container - The container element or its ID where pages will be rendered
   * @param options - Pagination options
   */
  constructor(staging, container, options = {}) {
    this.createdPageCount = 0;
    this.footnoteSeparator = null;
    this.footnoteContinuationSeparator = null;
    this.commentReturnLinks = [];
    this.footnoteLayoutLikeWord8 = false;
    /** The document's `compatibilityMode` (`data-docx-compatibility-mode`); NaN when unstated. */
    this.compatibilityMode = NaN;
    this.pendingFootnoteContinuation = null;
    /** Per-section `w:pgNumType` (start / format), read off the section wrappers. */
    this.pageNumbering = /* @__PURE__ */ new Map();
    this.bodySectionDimensions = /* @__PURE__ */ new Map();
    this.lastPages = [];
    this.expectedPageMapAnchorIds = /* @__PURE__ */ new Set();
    this.sourceClipBoxes = /* @__PURE__ */ new WeakSet();
    this.inspectedSourceText = /* @__PURE__ */ new WeakSet();
    this.sourceClipBoxSequence = 0;
    this.initiallyClippedText = /* @__PURE__ */ new Map();
    this.sourceTextPlacement = /* @__PURE__ */ new Map();
    this.lastClippedTextAnchors = [];
    this.lastClippedTableContentAnchors = [];
    this.linkedTextBoxOverflowAnchors = [];
    this.state = "ready";
    this.runningStyleSources = [];
    this.runningStyleContexts = /* @__PURE__ */ new Map();
    this.runningStyleDefaults = /* @__PURE__ */ new Map();
    this.preparedRunningStories = /* @__PURE__ */ new Map();
    this.storyFrameExclusions = /* @__PURE__ */ new WeakMap();
    this.runningStylePageCount = 1;
    const ownerDocument = typeof staging !== "string" ? staging.ownerDocument : typeof container !== "string" ? container.ownerDocument : globalThis.document;
    this.stagingElement = typeof staging === "string" ? ownerDocument.getElementById(staging) : staging;
    this.containerElement = typeof container === "string" ? ownerDocument.getElementById(container) : container;
    if (!this.stagingElement) {
      throw new Error("Staging element not found");
    }
    if (!this.containerElement) {
      throw new Error("Container element not found");
    }
    if (this.stagingElement.ownerDocument !== this.containerElement.ownerDocument) {
      throw new Error("Staging and container elements must belong to the same document");
    }
    const view = ownerDocument.defaultView;
    if (!view) {
      throw new Error("Pagination requires an attached document with a defaultView");
    }
    this.document = ownerDocument;
    this.view = view;
    this.scale = options.scale ?? 1;
    this.cssPrefix = options.cssPrefix ?? "page-";
    this.showPageNumbers = options.showPageNumbers ?? true;
    this.pageGap = options.pageGap ?? 20;
    this.commentColumnPlacement = options.commentColumnPlacement ?? "margin";
    this.commentOverflow = options.commentOverflow ?? "scroll";
    if (!["scroll", "appendix"].includes(this.commentOverflow)) {
      throw new RangeError("commentOverflow must be scroll or appendix");
    }
    this.commentColumnWidthPt = options.commentColumnWidthPt ?? 144;
    this.commentColumnGapPt = options.commentColumnGapPt ?? 12;
    if (!["margin", "outside", "balloons"].includes(this.commentColumnPlacement)) {
      throw new RangeError("commentColumnPlacement must be one of margin, outside, balloons");
    }
    this.deferMarkupBalloons = options.deferMarkupBalloons ?? false;
    this.balloonOverflow = options.balloonOverflow ?? "truncate";
    if (this.balloonOverflow !== "truncate" && this.balloonOverflow !== "appendix") {
      throw new RangeError("balloonOverflow must be one of truncate, appendix");
    }
    this.markupMode = options.markupMode ?? "mixed";
    if (!MARKUP_MODES.includes(this.markupMode)) throw new RangeError(`markupMode must be one of ${MARKUP_MODES.join(", ")}`);
    if (!Number.isFinite(this.commentColumnWidthPt) || this.commentColumnWidthPt <= 0) {
      throw new RangeError("commentColumnWidthPt must be a finite positive number");
    }
    if (!Number.isFinite(this.commentColumnGapPt) || this.commentColumnGapPt < 0) {
      throw new RangeError("commentColumnGapPt must be a finite non-negative number");
    }
    this.fragmentParagraphs = options.fragmentParagraphs ?? false;
    this.alignBaselines = options.alignBaselinesToWord ?? false;
    this.deferFragmentIdentities = options.deferFragmentIdentities ?? false;
    this.bodyBudgetReductionsPt = options.bodyBudgetReductionsPt ?? {};
    this.cancellationCheckpoint = options.checkCancellation;
    this.pageCountCheckpoint = options.checkPageCount;
    this.prepareTableFragment = options.prepareTableFragment;
    this.prepareTableText = options.prepareTableText;
    this.prepareStoryText = options.prepareStoryText;
    this.prepareFootnoteText = options.prepareFootnoteText;
    this.layoutToken = options.layoutToken;
    this.hfRegistry = /* @__PURE__ */ new Map();
    this.footnoteRegistry = /* @__PURE__ */ new Map();
    this.commentMarginRegistry = /* @__PURE__ */ new Map();
  }
  /**
   * Runs the pagination process.
   *
   * @returns PaginationResult with page information
   */
  paginate() {
    this.checkpoint();
    if (this.state !== "ready") {
      throw new Error(`PaginationEngine is one-shot and is already ${this.state}`);
    }
    if (!this.stagingElement.isConnected || !this.containerElement.isConnected) {
      throw new Error("Pagination requires staging and container elements attached to their document");
    }
    if (this.document.documentElement.getBoundingClientRect().width <= 0) {
      throw new Error("Pagination requires a browsing context with non-zero layout");
    }
    this.state = "running";
    try {
      this.initializeRunningStyles();
      const pristine = this.runningStyleSources.length > 0 ? this.stagingElement.cloneNode(true) : null;
      const seen = /* @__PURE__ */ new Set();
      let previous = "";
      let pages;
      for (let pass = 0; ; pass++) {
        this.checkpoint();
        if (pass > 0 && pristine) {
          this.containerElement.replaceChildren();
          this.stagingElement.style.cssText = pristine.style.cssText;
          this.stagingElement.replaceChildren(...Array.from(pristine.childNodes, (node) => node.cloneNode(true)));
        }
        pages = this.paginatePass();
        if (!pristine) break;
        const signature = this.updateRunningStyleContexts(pages);
        if (signature === previous) break;
        if (seen.has(signature) || pass === 11) {
          throw new Error("Running style fields did not stabilize: pagination cycle or pass limit");
        }
        seen.add(signature);
        previous = signature;
      }
      for (const page of pages) {
        this.checkpoint();
        if (page.element.dataset.sectionFiller === "true") continue;
        const pageInSection = parseInt(page.element.dataset.pageInSection || "1", 10);
        const displayedPageNumber = parseInt(
          page.element.dataset.displayedPageNumber || String(page.pageNumber),
          10
        );
        const header = this.selectHeader(page.sectionIndex, pageInSection, displayedPageNumber);
        const footer = this.selectFooter(page.sectionIndex, pageInSection, displayedPageNumber);
        for (const story of [header, footer]) {
          if (!story) continue;
          this.collectExpectedSourceAnchors(story, this.expectedPageMapAnchorIds);
          for (const reference of Array.from(story.querySelectorAll("[data-comment-id]"))) {
            const source = this.commentMarginRegistry.get(reference.dataset.commentId ?? "");
            if (source) this.collectExpectedSourceAnchors(source, this.expectedPageMapAnchorIds);
          }
        }
      }
      this.qualifyPageFragments(pages);
      this.transferVisibleFragmentTargets();
      if (!this.deferFragmentIdentities) this.normalizeVisiblePageFragments(pages);
      if (this.alignBaselines) alignBaselinesToWord(this.containerElement);
      this.activateCommentReturnLinks(pages);
      this.lastPages = [...pages];
      if (!this.deferMarkupBalloons) pages.push(...this.layoutMarkupBalloons()?.appendedPages ?? []);
      if (!this.edgeExclusionsMatch(this.containerElement))
        throw new Error("A wrapping picture does not match its destination exclusion");
      const result = {
        totalPages: pages.length,
        pages,
        pageMap: this.layoutToken ? this.materializePageMap(
          this.layoutToken.documentVersion,
          this.layoutToken.rendererFingerprint
        ) : void 0
      };
      this.state = "complete";
      return result;
    } catch (error) {
      this.state = "failed";
      throw error;
    }
  }
  /** One flow pass; field-dependent running bands are fixed for this pass. */
  paginatePass() {
    for (const wrapper of Array.from(this.stagingElement.querySelectorAll(
      "div[data-docx-break-paragraph]"
    )).reverse()) wrapper.replaceWith(...Array.from(wrapper.childNodes));
    this.createdPageCount = 0;
    this.commentReturnLinks = [];
    this.pendingFootnoteContinuation = null;
    this.markupBalloons = void 0;
    this.preparedRunningStories.clear();
    this.bodySectionDimensions.clear();
    const pages = [];
    let pageNumber = 1;
    const balloons = this.commentColumnPlacement === "balloons";
    if (balloons) {
      this.markupBalloons = readMarkupBalloonComments(marginNoteRegistry(this.stagingElement));
    }
    scopeMarkupBalloons(
      this.document,
      [this.stagingElement, this.containerElement],
      balloons,
      this.markupBalloons?.commentPrefix,
      this.cssPrefix
    );
    const stagingStyle = this.stagingElement.style.cssText;
    try {
      Object.assign(this.stagingElement.style, { display: "block", visibility: "hidden", position: "absolute", left: "-9999px" });
      prepareSectionTextWidths(this.stagingElement);
      prepareMixedLineHeights(this.stagingElement, () => this.checkpoint());
      applyUnroundedNormalLineHeights(this.stagingElement);
    } finally {
      this.stagingElement.style.cssText = stagingStyle;
    }
    this.sourceClipBoxes = /* @__PURE__ */ new WeakSet();
    this.inspectedSourceText = /* @__PURE__ */ new WeakSet();
    this.sourceClipBoxSequence = 0;
    this.initiallyClippedText.clear();
    this.sourceTextPlacement.clear();
    this.lastClippedTextAnchors = [];
    this.lastClippedTableContentAnchors = [];
    this.linkedTextBoxOverflowAnchors = [];
    this.hfRegistry = this.parseHeaderFooterRegistry();
    this.footnoteRegistry = this.parseFootnoteRegistry();
    ({
      normal: this.footnoteSeparator,
      continuation: this.footnoteContinuationSeparator
    } = this.parseFootnoteSeparators());
    this.commentMarginRegistry = this.parseCommentMarginRegistry();
    if (this.commentColumnPlacement !== "margin") {
      for (const source of this.commentMarginRegistry.values()) source.dataset.pageMapExclude = "true";
    }
    this.footnoteLayoutLikeWord8 = this.stagingElement.dataset.footnoteLayoutLikeWord8 === "true";
    this.compatibilityMode = Number(this.stagingElement.dataset.docxCompatibilityMode);
    const sections = this.stagingElement.querySelectorAll(
      "[data-section-index]"
    );
    this.pageNumbering = this.parsePageNumbering(sections);
    const sectionsToProcess = sections.length > 0 ? Array.from(sections) : [this.stagingElement];
    this.expectedPageMapAnchorIds = /* @__PURE__ */ new Set();
    const referencedFootnoteIds = /* @__PURE__ */ new Set();
    const referencedCommentIds = /* @__PURE__ */ new Set();
    for (const section of sectionsToProcess) {
      this.checkpoint();
      this.prepareSourceTextBoxSizes(section, parseSectionDimensions(section));
      this.collectExpectedSourceAnchors(section, this.expectedPageMapAnchorIds, true);
      for (const reference of Array.from(section.querySelectorAll("[data-footnote-id]"))) {
        this.checkpoint();
        if (reference.closest("#pagination-footnote-registry, #pagination-hf-registry")) continue;
        const id = reference.dataset.footnoteId;
        if (id) referencedFootnoteIds.add(id);
      }
      for (const reference of Array.from(section.querySelectorAll("[data-comment-id]"))) {
        this.checkpoint();
        if (reference.closest(
          "#pagination-comment-margin-registry, #pagination-footnote-registry, #pagination-hf-registry"
        )) continue;
        const id = reference.dataset.commentId;
        if (id) referencedCommentIds.add(id);
      }
    }
    for (const id of referencedFootnoteIds) {
      this.checkpoint();
      const source = this.footnoteRegistry.get(id);
      if (!source) continue;
      this.collectExpectedSourceAnchors(source, this.expectedPageMapAnchorIds);
      for (const reference of Array.from(
        source.querySelectorAll("[data-comment-id]")
      )) {
        this.checkpoint();
        const commentId = reference.dataset.commentId;
        if (commentId) referencedCommentIds.add(commentId);
      }
    }
    for (const id of referencedCommentIds) {
      this.checkpoint();
      const source = this.commentMarginRegistry.get(id);
      if (source) this.collectExpectedSourceAnchors(source, this.expectedPageMapAnchorIds);
    }
    const runs = [];
    for (const section of sectionsToProcess) {
      this.checkpoint();
      const dims = parseSectionDimensions(section);
      this.bodySectionDimensions.set(parseInt(section.dataset.sectionIndex || "0", 10), dims);
      for (const id of this.extractFootnoteRefs(section)) {
        const note = this.footnoteRegistry.get(id);
        if (note) {
          note.style.width = `${dims.contentWidth}pt`;
          note.style.maxWidth = "100%";
        }
      }
      const previous = runs[runs.length - 1];
      if (previous && section.dataset.sectionType === "continuous" && samePageBox(previous.dims, dims)) {
        previous.sections.push(section);
        previous.sectionDimensions.set(
          parseInt(section.dataset.sectionIndex || "0", 10),
          dims
        );
      } else {
        const sectionIndex = parseInt(section.dataset.sectionIndex || "0", 10);
        runs.push({
          sections: [section],
          sectionIndex,
          sectionType: section.dataset.sectionType ?? "nextPage",
          dims,
          sectionDimensions: /* @__PURE__ */ new Map([[sectionIndex, dims]])
        });
      }
    }
    for (const run of runs) {
      this.checkpoint();
      const needsParityFiller = pages.length > 0 && (run.sectionType === "oddPage" && pageNumber % 2 === 0 || run.sectionType === "evenPage" && pageNumber % 2 === 1);
      if (needsParityFiller) {
        const precedingPage = pages[pages.length - 1];
        const precedingPageInSection = parseInt(
          precedingPage.element.dataset.pageInSection ?? "1",
          10
        );
        const precedingDisplayedPageNumber = parseInt(
          precedingPage.element.dataset.displayedPageNumber ?? String(precedingPage.pageNumber),
          10
        );
        const filler = this.createPage(
          precedingPage.dimensions,
          pageNumber,
          precedingPage.sectionIndex,
          precedingDisplayedPageNumber + 1,
          [],
          precedingPageInSection + 1,
          [],
          0,
          null,
          void 0,
          true
        );
        pages.push(filler);
        pageNumber++;
      }
      this.stagingElement.style.visibility = "hidden";
      this.stagingElement.style.position = "absolute";
      this.stagingElement.style.left = "-9999px";
      this.stagingElement.style.display = "block";
      const blocks = [];
      let pictureBodyHeight = 0;
      for (const section of run.sections) {
        this.checkpoint();
        const sectionIndex = parseInt(section.dataset.sectionIndex || "0", 10);
        const sectionDims = run.sectionDimensions.get(sectionIndex) ?? run.dims;
        pictureBodyHeight = Math.max(
          pictureBodyHeight,
          this.smallestEffectiveContentHeight(sectionDims, sectionIndex)
        );
        section.style.width = `${sectionDims.contentWidth}pt`;
        const columnCount = parseInt(section.dataset.cols || "1", 10);
        if (columnCount > 1) {
          const gap = parseFloat(section.dataset.colGap || "");
          blocks.push(...this.buildColumnBlocks(
            section,
            sectionDims,
            sectionIndex,
            columnCount,
            Number.isFinite(gap) ? gap : 36,
            section.dataset.sectionType === "continuous" && section === sectionsToProcess[sectionsToProcess.length - 1]
          ));
        } else {
          blocks.push(...this.measureBlocks(section, sectionDims, sectionIndex, pictureBodyHeight));
        }
      }
      for (let b = 1; b < blocks.length; b++) {
        if (blocks[b].element.dataset.sectionMark === "true" && blocks[b - 1].isPageBreak)
          [blocks[b - 1], blocks[b]] = [blocks[b], blocks[b - 1]];
      }
      for (const block of blocks) block.element.dataset.paginationSection = String(block.sectionIndex);
      const sectionPages = this.flowToPages(
        blocks,
        run.dims,
        pageNumber,
        run.sectionIndex,
        run.sectionDimensions
      );
      this.checkpoint();
      pages.push(...sectionPages);
      pageNumber += sectionPages.length;
    }
    this.flowLinkedTextBoxes();
    if (this.commentColumnPlacement === "margin" && this.commentOverflow === "appendix") {
      const bodyFragmentation = this.fragmentParagraphs;
      this.fragmentParagraphs = true;
      try {
        this.appendCommentOverflow(pages);
      } finally {
        this.fragmentParagraphs = bodyFragmentation;
      }
    }
    this.stagingElement.style.display = "none";
    this.substitutePageNumberFields(pages.length);
    return pages;
  }
  /** Move overflowing columns' complete threads into ordinary flow; each column keeps a pointer. */
  appendCommentOverflow(pages) {
    const columns = Array.from(this.containerElement.querySelectorAll(`.${this.cssPrefix}comment-margin`)).filter((column) => column.scrollHeight > column.clientHeight + 1);
    const overflow = /* @__PURE__ */ new Map();
    for (const column of columns) {
      for (const note of Array.from(column.children)) {
        this.checkpoint();
        overflow.set(note.dataset.commentId, note);
      }
    }
    if (overflow.size === 0) return;
    const last = pages[pages.length - 1], dims = last.dimensions;
    const sectionIndex = Math.max(...this.bodySectionDimensions.keys()) + 1;
    const blocks = [];
    for (const [id, note] of overflow) {
      const projected = this.measureCommentBlocks(note, dims, sectionIndex);
      const first = projected.find((block) => block.heightPt > 0);
      if (!first) throw new Error(`Comment ${id} has no printable blocks`);
      first.element.id = `comment-appendix-${id}`;
      blocks.push(...projected);
    }
    for (const column of columns) {
      const pointer = this.document.createElement("a");
      pointer.href = `#comment-appendix-${column.firstElementChild.dataset.commentId}`;
      pointer.textContent = "Full comments after the document.";
      pointer.title = pointer.textContent;
      pointer.setAttribute("aria-label", pointer.textContent);
      column.replaceChildren(pointer);
      if (column.scrollHeight > column.clientHeight + 1) {
        pointer.textContent = "[+]";
        pointer.style.cssText = "font-size:9pt;line-height:1";
        if (column.scrollHeight > column.clientHeight + 1) pointer.remove();
      }
    }
    const appended = this.flowToPages(
      blocks,
      dims,
      last.pageNumber + 1,
      sectionIndex,
      /* @__PURE__ */ new Map([[sectionIndex, dims]])
    );
    for (const page of appended) page.element.dataset.commentAppendix = "true";
    pages.push(...appended);
  }
  /** Project converter comment headers, paragraphs and replies without their indivisible wrappers. */
  measureCommentBlocks(root, dims, sectionIndex) {
    const blocks = [];
    const visit = (element, owners = []) => {
      this.checkpoint();
      if (element.dataset.sourceAnchorId?.startsWith("cmt:")) owners = [...owners, element.dataset.sourceAnchorId];
      const header = Array.from(element.classList).some((name) => name.endsWith("-header"));
      if (header || element.localName === "p") {
        const clone = element.cloneNode(true);
        const style = this.view.getComputedStyle(element);
        this.preserveInheritedPresentation(clone, style);
        for (const property of ["margin-top", "margin-bottom", "overflow-wrap"])
          clone.style.setProperty(property, style.getPropertyValue(property));
        if (header && owners.length > 0) {
          clone.dataset.sourceAnchorId = owners[owners.length - 1];
          clone.dataset.keepWithNext = "true";
        }
        if (!header) for (const id of [...owners].reverse()) {
          const owner = this.document.createElement("span");
          owner.dataset.sourceAnchorId = id;
          owner.style.whiteSpace = "inherit";
          while (clone.firstChild) owner.appendChild(clone.firstChild);
          clone.appendChild(owner);
        }
        if (element.localName === "p" && this.hasRangeFragmentSafeLayout(element))
          clone.dataset.paginationSafeEndnote = "true";
        let projected = clone;
        if (header) for (const id of owners.slice(0, -1).reverse()) {
          const owner = this.document.createElement("div");
          owner.dataset.sourceAnchorId = id;
          owner.dataset.keepWithNext = "true";
          owner.appendChild(projected);
          projected = owner;
        }
        blocks.push(this.measureElement(projected, dims, sectionIndex));
      } else {
        for (const child of Array.from(element.children)) visit(child, owners);
      }
    };
    visit(root);
    return blocks;
  }
  initializeRunningStyles() {
    if (!this.stagingElement.querySelector('#pagination-hf-registry [data-field="STYLEREF"]')) return;
    for (const paragraph of Array.from(this.stagingElement.querySelectorAll(
      "[data-paragraph-style][data-styleref-text]"
    ))) {
      if (paragraph.closest("#pagination-hf-registry, #pagination-footnote-registry, #pagination-comment-margin-registry, [data-docx-textbox]")) continue;
      const source = {
        id: String(this.runningStyleSources.length),
        style: paragraph.dataset.paragraphStyle,
        text: paragraph.dataset.stylerefText
      };
      paragraph.dataset.stylerefSource = source.id;
      this.runningStyleSources.push(source);
      if (!this.runningStyleDefaults.has(source.style)) {
        this.runningStyleDefaults.set(source.style, { first: source, last: source });
      }
    }
  }
  runningStylePageKey(section, pageInSection, displayed) {
    return `${section}:${pageInSection}:${displayed}`;
  }
  /** The next pass reads these page-owned sources, including full text on split paragraphs. */
  updateRunningStyleContexts(pages) {
    const preceding = /* @__PURE__ */ new Map();
    const contexts = /* @__PURE__ */ new Map();
    const ownership = [];
    for (const page of pages) {
      this.checkpoint();
      const body = page.element.querySelector(`.${this.cssPrefix}content`);
      const onPage = /* @__PURE__ */ new Map();
      const ids = /* @__PURE__ */ new Set();
      for (const element of Array.from(body.querySelectorAll("[data-styleref-source]"))) {
        const id = element.dataset.stylerefSource;
        if (ids.has(id)) continue;
        ids.add(id);
        const source = this.runningStyleSources[Number(id)];
        if (!source) continue;
        const match = onPage.get(source.style);
        onPage.set(source.style, { first: match?.first ?? source, last: source });
      }
      const context = /* @__PURE__ */ new Map();
      for (const [style, initial] of this.runningStyleDefaults) {
        const prior = preceding.get(style);
        context.set(style, onPage.get(style) ?? (prior ? { first: prior, last: prior } : initial));
      }
      for (const [style, match] of onPage) preceding.set(style, match.last);
      const key = this.runningStylePageKey(
        page.sectionIndex,
        Number(page.element.dataset.pageInSection),
        Number(page.element.dataset.displayedPageNumber)
      );
      contexts.set(key, context);
      ownership.push([
        key,
        [...context].map(([style, match]) => [style, match.first.id, match.last.id]),
        [...ids],
        body.textContent,
        Array.from(body.querySelectorAll(
          "[data-source-anchor-id], [data-anchor]"
        ), (element) => element.dataset.sourceAnchorId ?? element.dataset.anchor)
      ]);
    }
    this.runningStyleContexts = contexts;
    this.runningStylePageCount = pages.length;
    return JSON.stringify(ownership);
  }
  /** Measurement and page cloning share these exact resolved stories within a pass. */
  prepareRunningStories(dims, sectionIndex, pageInSection, displayed, physical = displayed) {
    const headerSource = this.selectHeader(sectionIndex, pageInSection, displayed);
    const footerSource = this.selectFooter(sectionIndex, pageInSection, displayed);
    if (this.runningStyleSources.length === 0 && ![headerSource, footerSource].some((source) => source?.querySelector("[data-docx-frame-exclusion]"))) return void 0;
    const pageKey = this.runningStylePageKey(sectionIndex, pageInSection, displayed);
    const key = `${pageKey}:${dims.contentWidth}:${physical}`;
    const cached = this.preparedRunningStories.get(key);
    if (cached) return cached;
    const context = this.runningStyleContexts.get(pageKey) ?? this.runningStyleDefaults;
    const prepare = (source) => {
      if (!source) return void 0;
      const clone = source.cloneNode(true);
      for (const marker of Array.from(clone.querySelectorAll("[data-field]"))) {
        if (marker.dataset.field === "STYLEREF") {
          const match = context.get(marker.dataset.fieldStyle ?? "");
          if (match) marker.textContent = (marker.dataset.fieldLast === "true" ? match.last : match.first).text;
        }
      }
      this.substituteStoryPageNumbers(clone, sectionIndex, displayed, this.runningStylePageCount);
      return clone;
    };
    const header = prepare(headerSource);
    const footer = prepare(footerSource);
    const result = {
      header,
      footer,
      headerHeight: header ? this.measureHeaderFooterHeight(header, dims, physical) : 0,
      footerHeight: footer ? this.measureHeaderFooterHeight(footer, dims, physical) : 0
    };
    this.preparedRunningStories.set(key, result);
    return result;
  }
  checkpoint() {
    this.cancellationCheckpoint?.();
  }
  /**
   * With "balloons" placement, lays out Word's markup area and balloons on the finished pages
   * (once; later calls return the first result). Runs inside paginate() unless deferMarkupBalloons
   * is set. Returns what could not be printed in full; undefined under other placements.
   */
  layoutMarkupBalloons() {
    if (!this.markupBalloons || this.markupBalloons.result) return this.markupBalloons?.result;
    if (this.lastPages.length === 0) throw new Error("paginate() must complete before layoutMarkupBalloons()");
    const staging = this.stagingElement.dataset;
    const font = staging.balloonFontFamily && Number.parseFloat(staging.balloonFontSize ?? "") > 0 ? { family: staging.balloonFontFamily, sizePt: Number.parseFloat(staging.balloonFontSize), stack: staging.balloonFontStack } : void 0;
    const appendix = this.balloonOverflow === "appendix";
    const layout = layoutMarkupBalloons({
      document: this.document,
      pages: this.lastPages,
      comments: this.markupBalloons.comments,
      commentPrefix: this.markupBalloons.commentPrefix,
      cssPrefix: this.cssPrefix,
      font,
      numberCutBoxes: appendix,
      markupMode: this.markupMode
    });
    const appendedPages = [];
    if (appendix && layout.cutComments.length > 0) {
      const pages = new BalloonAppendix(this.document, layout.cutComments, this.cssPrefix, font);
      while (!pages.finished) {
        this.checkpoint();
        pages.fill(this.appendBlankPage(appendedPages));
      }
    }
    return this.markupBalloons.result = { ...layout, appendedPages };
  }
  /**
   * A page after the last, in the last page's section, with no running stories: one more page of the
   * pagination, its result and its PageMap.
   */
  appendBlankPage(appended) {
    const last = this.lastPages[this.lastPages.length - 1];
    const number2 = (key, fallback) => Number.parseInt(last.element.dataset[key] ?? "", 10) || fallback;
    const page = this.createPage(
      last.dimensions,
      last.pageNumber + 1,
      last.sectionIndex,
      number2("displayedPageNumber", last.pageNumber) + 1,
      [],
      number2("pageInSection", 1) + 1,
      [],
      0,
      null,
      void 0,
      true
    );
    page.element.dataset.balloonAppendix = "true";
    this.lastPages.push(page);
    appended.push(page);
    return page;
  }
  /**
   * Normalize visible fragment identities after a caller applies final standalone styles.  This
   * deliberately runs before the stability barrier; materializePageMap is read-only so PageMap
   * measurement cannot mutate a tree after it was declared stable.
   */
  normalizePageMapFragmentIdentities() {
    if (this.lastPages.length === 0) {
      throw new Error("paginate() must complete before fragment identities can be normalized");
    }
    this.normalizeVisiblePageFragments(this.lastPages);
  }
  /**
   * Materialize the last completed browser layout as portable page-relative point geometry.
   * The caller supplies both invalidation tokens; this engine never guesses a document version
   * or renderer fingerprint.
   */
  materializePageMap(documentVersion, rendererFingerprint) {
    this.lastClippedTableContentAnchors = [];
    if (!Number.isSafeInteger(documentVersion) || documentVersion < 0) {
      throw new Error("documentVersion must be a non-negative safe integer");
    }
    if (!rendererFingerprint) throw new Error("rendererFingerprint must be non-empty");
    if (this.lastPages.length === 0) throw new Error("paginate() must complete before materializePageMap()");
    const pages = this.lastPages.map((page) => ({
      pageNumber: page.pageNumber,
      pageInSection: parseInt(page.element.dataset.pageInSection || "1", 10),
      width: page.dimensions.pageWidth,
      height: page.dimensions.pageHeight,
      sectionIndex: page.sectionIndex,
      pageName: `docxodus-section-${page.sectionIndex}`
    }));
    const fragments = [];
    const requiredAnchorIds = new Set(this.expectedPageMapAnchorIds);
    if (requiredAnchorIds.size === 0 && !this.stagingElement.querySelector('[data-docx-empty-review-display="true"]')) {
      throw new Error("cannot publish an available PageMap without canonical source inventory");
    }
    const measuredAnchorIds = /* @__PURE__ */ new Set();
    const unpaintedAnchorIds = /* @__PURE__ */ new Set();
    const clippedTextAnchorIds = /* @__PURE__ */ new Set();
    const clippedTableTextAnchorIds = /* @__PURE__ */ new Set();
    const emittedFragmentCounts = /* @__PURE__ */ new Map();
    const partialTextBoxInk = /* @__PURE__ */ new Map();
    for (const page of this.lastPages) {
      this.checkpoint();
      const pageRect = page.element.getBoundingClientRect();
      if (pageRect.width <= 0 || pageRect.height <= 0) {
        throw new Error(`page ${page.pageNumber} has no measurable geometry`);
      }
      const pointPerRenderedX = page.dimensions.pageWidth / pageRect.width;
      const pointPerRenderedY = page.dimensions.pageHeight / pageRect.height;
      const sourceFrame = this.sourcePageFrame(page.element, page.dimensions);
      const nodes = page.element.querySelectorAll("[data-source-anchor-id]");
      for (const element of Array.from(nodes)) {
        this.checkpoint();
        if (this.isDeliberatelyUnrenderedSource(element, page.element)) continue;
        const anchorId = element.dataset.sourceAnchorId;
        if (!anchorId || !element.dataset.pageFragmentId || !Number.isInteger(parseInt(element.dataset.fragmentIndex || "", 10))) {
          throw new Error(`page ${page.pageNumber} contains an unqualified source anchor`);
        }
        const style = this.view.getComputedStyle(element);
        const deliberatelyHidden = style.display === "none" || style.visibility === "hidden";
        if (deliberatelyHidden) continue;
        const { rect, visible: visibleRect } = measureRenderedSource(this.view, element, page.element, pageRect);
        requiredAnchorIds.add(anchorId);
        const left = visibleRect.left;
        const top = visibleRect.top;
        const right = visibleRect.right;
        const bottom = visibleRect.bottom;
        if (rect.width <= 0 || rect.height <= 0 || right <= left || bottom <= top) {
          const collapsedBlankLine = rect.height === 0 && style.fontSize === "0px" && rendersOnlyItsLine(element);
          if (collapsedBlankLine || clippedAwayByExactRow(element, rect) || blankLineClippedByTextBox(this.view, element, rect, sourceFrame.paper))
            unpaintedAnchorIds.add(anchorId);
          else if (this.isInitiallyClippedText(element, sourceFrame, page.element, partialTextBoxInk) || hiddenPastLinkedStoryEnd(element, rect) || this.hiddenByPaper(element, rect, sourceFrame)) {
            unpaintedAnchorIds.add(anchorId);
            if (ownsText(element)) clippedTextAnchorIds.add(anchorId);
          }
          continue;
        }
        measuredAnchorIds.add(anchorId);
        const fragmentIndex = emittedFragmentCounts.get(anchorId) ?? 0;
        emittedFragmentCounts.set(anchorId, fragmentIndex + 1);
        const fragmentId = `p${page.pageNumber}-f${fragmentIndex}-${anchorId}`;
        if (element.dataset.fragmentIndex !== String(fragmentIndex) || element.dataset.pageFragmentId !== fragmentId || element.dataset.pageNumber !== String(page.pageNumber)) {
          throw new Error(
            `page ${page.pageNumber} fragment identity changed after final-tree normalization`
          );
        }
        fragments.push({
          fragmentId,
          anchorId,
          fragmentIndex,
          pageNumber: page.pageNumber,
          geometry: {
            x: (left - pageRect.left) * pointPerRenderedX,
            y: (top - pageRect.top) * pointPerRenderedY,
            width: (right - left) * pointPerRenderedX,
            height: (bottom - top) * pointPerRenderedY
          },
          story: this.storyForCanonicalAnchor(anchorId),
          inTableCell: element.matches("td,th") || element.closest('td,th,[data-docx-frame-in-table-cell="true"]') !== null
        });
      }
      this.collectClippedTableContent(sourceFrame.element, sourceFrame.paper, clippedTableTextAnchorIds);
    }
    const missingAnchor = Array.from(requiredAnchorIds).find((id) => !measuredAnchorIds.has(id) && !unpaintedAnchorIds.has(id));
    if (missingAnchor) {
      throw new Error(`source anchor ${missingAnchor} has no measurable fragment in the paginated layout`);
    }
    this.lastClippedTextAnchors = Array.from(clippedTextAnchorIds).filter((id) => !measuredAnchorIds.has(id));
    this.lastClippedTableContentAnchors = Array.from(clippedTableTextAnchorIds);
    return {
      schemaVersion: 1,
      mode: "paginated",
      availability: "available",
      documentVersion,
      rendererFingerprint,
      pages,
      fragments
    };
  }
  normalizeVisiblePageFragments(pages) {
    const emittedFragmentCounts = /* @__PURE__ */ new Map();
    for (const page of pages) {
      this.checkpoint();
      const pageRect = page.element.getBoundingClientRect();
      for (const element of Array.from(
        page.element.querySelectorAll("[data-source-anchor-id]")
      )) {
        this.checkpoint();
        if (this.isDeliberatelyUnrenderedSource(element, page.element)) continue;
        const anchorId = element.dataset.sourceAnchorId;
        if (!anchorId) continue;
        const style = this.view.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const { rect, visible } = measureRenderedSource(this.view, element, page.element, pageRect);
        if (rect.width <= 0 || rect.height <= 0 || visible.right <= visible.left || visible.bottom <= visible.top) continue;
        const fragmentIndex = emittedFragmentCounts.get(anchorId) ?? 0;
        emittedFragmentCounts.set(anchorId, fragmentIndex + 1);
        element.dataset.pageNumber = String(page.pageNumber);
        element.dataset.fragmentIndex = String(fragmentIndex);
        element.dataset.pageFragmentId = `p${page.pageNumber}-f${fragmentIndex}-${anchorId}`;
      }
    }
  }
  storyForCanonicalAnchor(anchorId) {
    const first = anchorId.indexOf(":");
    const second = first < 0 ? -1 : anchorId.indexOf(":", first + 1);
    const scope = first >= 0 && second > first ? anchorId.slice(first + 1, second) : "body";
    if (scope.startsWith("hdr")) return "header";
    if (scope.startsWith("ftr")) return "footer";
    if (scope === "fn") return "footnote";
    if (scope === "en") return "endnote";
    if (scope === "cmt") return "comment";
    return "body";
  }
  /**
   * Add canonical IDs from an addressable source subtree to the pre-pagination inventory.
   * Registry wrappers are excluded when scanning staging because selectable registry contents are
   * inventoried separately. Producers may explicitly mark content that has no visual substrate
   * with `data-page-map-exclude="true"`; native hidden semantics carry the same signal.
   */
  collectExpectedSourceAnchors(source, destination, excludeRegistries = false) {
    const selector = "[data-source-anchor-id], [data-docx-required-source-anchors]";
    const candidates = source.matches(selector) ? [source] : [];
    candidates.push(...Array.from(source.querySelectorAll(selector)));
    for (const element of candidates) {
      if (excludeRegistries && element.closest(
        "#pagination-hf-registry, #pagination-footnote-registry, #pagination-comment-margin-registry"
      )) {
        continue;
      }
      if (this.isZeroHeightExplicitBreakCarrier(element)) {
        element.dataset.pageMapExclude = "true";
      }
      if (this.isDeliberatelyUnrenderedSource(element, source)) continue;
      for (const required of element.dataset.docxRequiredSourceAnchors?.split(/\s+/) ?? []) {
        if (required) destination.add(required);
      }
      const anchorId = element.dataset.sourceAnchorId;
      if (anchorId) {
        destination.add(anchorId);
        this.captureSourceTextClip(element);
      }
    }
  }
  /** Source paragraphs intentionally unpainted by their authored box or placement, after final mapping. */
  getSourceClippedTextAnchors() {
    return [...this.lastClippedTextAnchors];
  }
  /** Source text or visuals cut by the paper edge in an authored fixed-width table. */
  getClippedTableContentAnchors() {
    return [...this.lastClippedTableContentAnchors];
  }
  /** The first paragraph of each linked text-box story that its last frame cannot hold. */
  getLinkedTextBoxOverflowAnchors() {
    return [...this.linkedTextBoxOverflowAnchors];
  }
  collectClippedTableContent(page, paper, anchors) {
    const selector = 'table[data-docx-fixed-width="true"]';
    const tables = new Set(Array.from(page.querySelectorAll(selector)).filter((table) => {
      const box = table.getBoundingClientRect();
      return box.left < paper.left || box.right > paper.right;
    }));
    if (!tables.size) return;
    const tableAnchors = /* @__PURE__ */ new Set();
    for (const table of tables) {
      this.checkpoint();
      for (const element of [table, ...Array.from(table.querySelectorAll("[data-source-anchor-id]"))])
        if (element.dataset.sourceAnchorId) tableAnchors.add(element.dataset.sourceAnchorId);
    }
    const roots = new Set(tables);
    for (const drawing of Array.from(page.querySelectorAll(`[${DRAWING_HOST_ATTRIBUTE}]`))) {
      this.checkpoint();
      if (drawing.getAttribute(DRAWING_HOST_ATTRIBUTE).split(" ").some((id) => tableAnchors.has(id))) roots.add(drawing);
    }
    const isVisible = (element) => {
      const style = this.view.getComputedStyle(element);
      return style.display !== "none" && style.visibility === "visible" && !this.isDeliberatelyUnrenderedSource(element, page);
    };
    const inspect = (element, rect, anchorId) => {
      if (!(rect.width > 0 && rect.height > 0) || anchors.has(anchorId)) return;
      const visible = this.visibleWithoutPaper(element, rect, page, paper);
      if (visible.right > visible.left && visible.bottom > visible.top && (visible.left < paper.left || visible.right > paper.right)) anchors.add(anchorId);
    };
    for (const root of roots) {
      this.checkpoint();
      let ancestor = root.parentElement;
      while (ancestor && ancestor !== page && !roots.has(ancestor)) ancestor = ancestor.parentElement;
      if (ancestor && roots.has(ancestor)) continue;
      const walker = this.document.createTreeWalker(root, this.view.NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        this.checkpoint();
        const parent = node.parentElement;
        const anchorId = parent?.closest("[data-source-anchor-id]")?.dataset.sourceAnchorId;
        if (!parent || !anchorId || anchors.has(anchorId) || !isVisible(parent)) continue;
        for (const match of (node.textContent ?? "").matchAll(/\S+/gu)) {
          this.checkpoint();
          const range = this.document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          for (const rect of Array.from(range.getClientRects())) inspect(parent, rect, anchorId);
        }
      }
      const visuals = "img, svg[data-docx-visual-resource-id]";
      for (const visual of [...root.matches(visuals) ? [root] : [], ...Array.from(root.querySelectorAll(visuals))]) {
        this.checkpoint();
        const hosts = visual.closest(`[${DRAWING_HOST_ATTRIBUTE}]`)?.getAttribute(DRAWING_HOST_ATTRIBUTE)?.split(" ") ?? [];
        const anchorId = visual.closest("[data-source-anchor-id]")?.dataset.sourceAnchorId ?? hosts.find((id) => id.startsWith("p:"));
        if (anchorId && isVisible(visual)) inspect(visual, visual.getBoundingClientRect(), anchorId);
      }
    }
  }
  /** Where `rect` of `element` shows under every clip except the paper (`page`, sized `paper`). */
  visibleWithoutPaper(element, rect, page, paper) {
    const left = Math.min(paper.left, rect.left), top = Math.min(paper.top, rect.top);
    const unbounded = new this.view.DOMRect(
      left,
      top,
      Math.max(paper.right, rect.right) - left,
      Math.max(paper.bottom, rect.bottom) - top
    );
    const layer = element.closest(".page-drawing-layer");
    return measureRenderedSource(
      this.view,
      element,
      page,
      unbounded,
      rect,
      layer?.parentElement === page ? layer : void 0
    ).visible;
  }
  /**
   * Whether the paper alone hides `element`, as Word prints it (issues #1733, #1734): its layout
   * box has area and lies wholly outside the paper, every other clip would show it, and an
   * authored box carries it there — a fixed-width table, or a frame of a linked text-box story
   * placed from its source offsets. Anything else off the paper may be content the layout lost,
   * so it still fails completeness. An unlinked text box proves its own paragraphs off the paper
   * ({@link isInitiallyClippedText}); a linked story is distributed over its frames after they
   * are placed, so only the frames' placement comes from the source.
   */
  hiddenByPaper(element, rect, frame) {
    if (!(rect.width > 0 && rect.height > 0) || !outsidePaper(rect, frame.paper)) return false;
    const linkedFrame = element.closest('[data-docx-textbox="true"][data-docx-textbox-linked="true"]');
    if (!element.closest('table[data-docx-fixed-width="true"]') && !(linkedFrame && sourcePlacedDrawing(linkedFrame))) return false;
    const visible = this.visibleWithoutPaper(element, rect, frame.element, frame.paper);
    return visible.right > visible.left && visible.bottom > visible.top;
  }
  sourcePageFrame(page, dimensions) {
    const holder = page.querySelector(
      `:scope > .${this.cssPrefix}markup-layer > .${this.cssPrefix}markup-page`
    );
    const element = holder ?? page;
    const paper = element.getBoundingClientRect();
    return {
      element,
      paper,
      dimensions,
      scaleX: paper.width / ptToPx(dimensions.pageWidth),
      scaleY: paper.height / ptToPx(dimensions.pageHeight)
    };
  }
  sourceTextPlacementBounds(owner, rects, frame, partialInk, paragraph) {
    const { paper, scaleX, scaleY } = frame;
    const box = owner.getBoundingClientRect();
    const anchor = sourceTextBoxAnchor(owner);
    if (anchor !== owner) {
      const host = paragraph?.getBoundingClientRect();
      if (anchor.dataset.docxAnchorVRelative === "paragraph" && !host) return;
      const context = {
        staticLeft: 0,
        staticTop: 0,
        lineHeight: 0,
        paragraphLeft: 0,
        paragraphWidth: 0,
        paragraphTop: host ? pxToPt((host.top - paper.top) / scaleY) : 0,
        paragraphHeight: 0
      };
      const horizontal = this.horizontalAnchorReference(
        anchor.dataset.docxAnchorHRelative,
        frame.dimensions,
        1,
        context,
        this.horizontalSectionDimensions(paragraph ?? anchor, frame.dimensions)
      );
      const vertical = this.verticalAnchorReference(anchor.dataset.docxAnchorVRelative, frame.dimensions, 1, context);
      const root = anchor.getBoundingClientRect();
      if (Math.abs((root.left - paper.left) / scaleX - ptToPx(horizontal.start + this.anchorNumber(anchor, "h-offset"))) >= 0.1 || Math.abs((root.top - paper.top) / scaleY - ptToPx(vertical.start + this.anchorNumber(anchor, "v-offset"))) >= 0.1) return;
    }
    if (owner.dataset.docxTextboxSourcePosition === "page-offset") {
      const left = ptToPx(this.anchorNumber(owner, "h-offset") ?? NaN);
      const top = ptToPx(this.anchorNumber(owner, "v-offset") ?? NaN);
      if (!(left >= paper.width / scaleX || top >= paper.height / scaleY) || Math.abs((box.left - paper.left) / scaleX - left) >= 0.1 || Math.abs((box.top - paper.top) / scaleY - top) >= 0.1) return;
    }
    const bounds = sourcePlacementBounds(box, rects, paper, scaleX, scaleY);
    if (!bounds) return;
    let partial = partialInk?.get(owner);
    if (partial === void 0) {
      partial = sourceTextRects(this.view, owner, () => this.checkpoint()).some((rect) => rect.right > paper.left && rect.left < paper.right && rect.bottom > paper.top && rect.top < paper.bottom && (rect.left < paper.left || rect.right > paper.right || rect.top < paper.top || rect.bottom > paper.bottom));
      partialInk?.set(owner, partial);
    }
    return partial ? void 0 : bounds;
  }
  captureSourceTextClip(element, frame, paragraph, partialInk) {
    const paper = frame?.paper;
    if (!paper) {
      if (this.inspectedSourceText.has(element)) return;
      this.inspectedSourceText.add(element);
    }
    const owner = element.parentElement?.closest('[data-docx-textbox-source-clip="true"], [data-docx-textbox-source-position]');
    if (!owner || !eligibleSourceTextBox(owner) && !eligibleSourceTextBox(owner, true)) return;
    if (!this.sourceClipBoxes.has(owner) && !paper) {
      owner.dataset.docxSourceClipId = `textbox-${++this.sourceClipBoxSequence}`;
      this.sourceClipBoxes.add(owner);
    }
    const boxId = owner.dataset.docxSourceClipId;
    const anchorId = element.dataset.sourceAnchorId;
    if (!boxId || !anchorId) return;
    const text = (element.textContent ?? "").replace(/\s/g, "");
    if (!text && (sourceTextBoxAnchor(owner) === owner || !rendersOnlyItsLine(element))) return;
    const rects = text ? sourceTextRects(this.view, element, () => this.checkpoint()) : [element.getBoundingClientRect()];
    let originalOutside = false;
    if (eligibleSourceTextBox(owner, true)) {
      const box = owner.getBoundingClientRect();
      const anchor = sourceTextBoxAnchor(owner), origin = anchor.getBoundingClientRect();
      const style = this.view.getComputedStyle(owner);
      const identity = JSON.stringify([
        boxId,
        text,
        style.transform,
        style.translate,
        style.rotate,
        style.scale,
        ...Array.from(anchor.attributes).filter((a) => a.name.startsWith("data-docx-anchor-") && a.name !== DRAWING_HOST_ATTRIBUTE).map((a) => [a.name, a.value])
      ]);
      const bounds = textBounds(
        box,
        [element.getBoundingClientRect(), ...rects],
        origin,
        frame?.scaleX ?? 1,
        frame?.scaleY ?? 1
      );
      if (!frame) this.sourceTextPlacement.set(anchorId, { identity, bounds });
      else {
        const source = this.sourceTextPlacement.get(anchorId);
        if (!source || source.identity !== identity || source.bounds.length !== bounds.length || bounds.some((value, index) => Math.abs(value - source.bounds[index]) >= 0.1 && !(frame.scaleY !== 1 && index >= 8 && index % 2 === 1))) return;
        const original = [];
        for (let i = 8; i < source.bounds.length; i += 4)
          original.push(new this.view.DOMRect(
            origin.left + source.bounds[i] * frame.scaleX,
            origin.top + source.bounds[i + 1] * frame.scaleY,
            source.bounds[i + 2] * frame.scaleX,
            source.bounds[i + 3] * frame.scaleY
          ));
        originalOutside = sourcePlacementBounds(box, original, frame.paper) !== void 0;
      }
    }
    if (frame && originalOutside && eligibleSourceTextBox(owner, true)) {
      const placement = this.sourceTextPlacementBounds(owner, rects, frame, partialInk, paragraph);
      if (placement) {
        let host;
        const anchor = sourceTextBoxAnchor(owner);
        if (anchor.dataset.docxAnchorVRelative === "paragraph" || anchor !== owner && anchor.dataset.docxAnchorHRelative === "column") {
          if (!paragraph?.dataset.sourceAnchorId) return;
          const rect = paragraph.getBoundingClientRect();
          host = { id: paragraph.dataset.sourceAnchorId, bounds: textBounds(rect, [], frame.paper, frame.scaleX, frame.scaleY) };
        }
        this.initiallyClippedText.set(anchorId, { boxId, text, placement, host });
        return;
      }
    }
    if (!eligibleSourceTextBox(owner)) return;
    if (paper && sourceTextBoxAnchor(owner) !== owner) return;
    if (paper) {
      const box = owner.getBoundingClientRect(), style = this.view.getComputedStyle(owner);
      const outsideX = (style.overflowX === "hidden" || style.overflowX === "clip") && (box.right <= paper.left || box.left >= paper.right);
      const outsideY = (style.overflowY === "hidden" || style.overflowY === "clip") && (box.bottom <= paper.top || box.top >= paper.bottom);
      if (!outsideX && !outsideY && !rects.every((rect) => outsidePaper(rect, paper))) return;
    }
    const clip = clippedByTextBox(this.view, element, rects, paper, true);
    if (clip?.dataset.docxSourceClipId === boxId)
      this.initiallyClippedText.set(anchorId, { boxId, text });
  }
  isInitiallyClippedText(element, frame, pageElement, partialInk) {
    const proof = this.initiallyClippedText.get(element.dataset.sourceAnchorId ?? "");
    if (!proof || (element.textContent ?? "").replace(/\s/g, "") !== proof.text) return false;
    const rects = proof.text ? sourceTextRects(this.view, element, () => this.checkpoint()) : [element.getBoundingClientRect()];
    if (proof.placement) {
      let paragraph = null;
      if (proof.host) {
        const host = pageElement.querySelector(`[data-source-anchor-id="${this.view.CSS.escape(proof.host.id)}"]`);
        if (!host) return false;
        paragraph = host;
        const rect = host.getBoundingClientRect();
        const bounds2 = textBounds(rect, [], frame.paper, frame.scaleX, frame.scaleY);
        if (bounds2.some((value, index) => Math.abs(value - proof.host.bounds[index]) >= 0.1)) return false;
      }
      const owner = element.parentElement?.closest('[data-docx-textbox-source-position], [data-docx-textbox-source-clip="true"]');
      if (!owner || owner.dataset.docxSourceClipId !== proof.boxId || !eligibleSourceTextBox(owner, true)) return false;
      const bounds = this.sourceTextPlacementBounds(owner, rects, frame, partialInk, paragraph);
      return bounds?.length === proof.placement.length && bounds.every((value, index) => Math.abs(value - proof.placement[index]) < 0.1);
    }
    return clippedByTextBox(this.view, element, rects, frame.paper, true)?.dataset.docxSourceClipId === proof.boxId;
  }
  isZeroHeightExplicitBreakCarrier(element) {
    const next = element.nextElementSibling;
    const bounds = element.getBoundingClientRect();
    return element.hasAttribute("data-source-anchor-id") && (element.textContent ?? "").replace(/\u00a0/g, "").trim() === "" && bounds.height <= 0.01 && !element.querySelector("[data-source-anchor-id]") && !element.querySelector("img,svg,canvas,table,hr,input,textarea,select") && (next?.dataset.pageBreak === "true" || next?.classList.contains(`${this.cssPrefix}break`) === true);
  }
  isDeliberatelyUnrenderedSource(element, sourceRoot) {
    for (let current = element; current; current = current.parentElement) {
      const zeroHeightExplicitBreakCarrier = current === element && this.isZeroHeightExplicitBreakCarrier(current);
      if (current.dataset.pageMapExclude === "true" || current.dataset.pageBreak === "true" || current.classList.contains(`${this.cssPrefix}break`) || zeroHeightExplicitBreakCarrier || current.hidden || current.getAttribute("aria-hidden") === "true" || current.style.display === "none" || current.style.visibility === "hidden") {
        return true;
      }
      if (current === sourceRoot) break;
    }
    return false;
  }
  /**
   * Keep exactly one active bare-Unid editor anchor per source block. Presentation clones use
   * canonical source identity plus page/fragment qualification instead.
   */
  qualifyPageFragments(pages) {
    const fragmentCounts = /* @__PURE__ */ new Map();
    const activeCanonicalIds = /* @__PURE__ */ new Set();
    const activeBareAnchorIds = /* @__PURE__ */ new Set();
    const makeInactive = (element) => {
      element.removeAttribute("data-anchor");
      element.removeAttribute("data-committed-text");
      if (element.hasAttribute("contenteditable")) element.setAttribute("contenteditable", "false");
    };
    for (const page of pages) {
      const nodes = page.element.querySelectorAll("[data-source-anchor-id]");
      for (const element of Array.from(nodes)) {
        const anchorId = element.dataset.sourceAnchorId;
        if (!anchorId) continue;
        const fragmentIndex = fragmentCounts.get(anchorId) ?? 0;
        fragmentCounts.set(anchorId, fragmentIndex + 1);
        element.dataset.pageNumber = String(page.pageNumber);
        element.dataset.fragmentIndex = String(fragmentIndex);
        element.dataset.pageFragmentId = `p${page.pageNumber}-f${fragmentIndex}-${anchorId}`;
        const story = this.storyForCanonicalAnchor(anchorId);
        const mayOwnActiveEditorAnchor = story === "body" || story === "comment" || story === "footnote" || story === "endnote";
        if (element.hasAttribute("data-anchor")) {
          const bareAnchorId = element.dataset.anchor;
          if (mayOwnActiveEditorAnchor && !activeCanonicalIds.has(anchorId) && !activeBareAnchorIds.has(bareAnchorId)) {
            activeCanonicalIds.add(anchorId);
            activeBareAnchorIds.add(bareAnchorId);
          } else {
            makeInactive(element);
          }
        }
      }
    }
    const activeStagingCanonicalIds = /* @__PURE__ */ new Set();
    for (const element of Array.from(
      this.stagingElement.querySelectorAll("[data-source-anchor-id][data-anchor]")
    )) {
      const anchorId = element.dataset.sourceAnchorId;
      if (!anchorId) continue;
      const bareAnchorId = element.dataset.anchor;
      if (activeCanonicalIds.has(anchorId) || activeStagingCanonicalIds.has(anchorId) || activeBareAnchorIds.has(bareAnchorId)) {
        makeInactive(element);
      } else {
        activeStagingCanonicalIds.add(anchorId);
        activeBareAnchorIds.add(bareAnchorId);
      }
    }
  }
  /**
   * Page flow clones source blocks while the hidden staging tree stays in the document. Any HTML
   * fragment target copied into a visible page would therefore resolve to its earlier hidden
   * source. Transfer target ownership to the page presentation after flow is complete; registry
   * and wrapper IDs that have no visible counterpart remain available to pagination internals.
   */
  transferVisibleFragmentTargets() {
    const visibleIds = new Set(Array.from(
      this.containerElement.querySelectorAll("[id]")
    ).map((element) => element.id).filter(Boolean));
    if (visibleIds.size === 0) return;
    for (const source of Array.from(
      this.stagingElement.querySelectorAll("[id]")
    )) {
      if (visibleIds.has(source.id)) source.removeAttribute("id");
    }
  }
  /** Read each section's `w:pgNumType` off its wrapper (see {@link SectionPageNumbering}). */
  parsePageNumbering(sections) {
    const map = /* @__PURE__ */ new Map();
    for (const section of Array.from(sections)) {
      const index = parseInt(section.dataset.sectionIndex || "0", 10);
      const rawStart = section.dataset.pageNumStart;
      const start = rawStart === void 0 ? void 0 : parseInt(rawStart, 10);
      map.set(index, {
        start: start !== void 0 && Number.isFinite(start) ? start : void 0,
        format: section.dataset.pageNumFmt
      });
    }
    return map;
  }
  /**
   * Fill in the page-number fields inside every page's cloned header/footer.
   *
   * A header/footer is authored once and cloned onto each page, so a PAGE field's single cached
   * result would otherwise show the same number on every page — the whole reason the converter
   * marks these. `data-field-format` (the field's own `\*` switch) wins over the section's format
   * when present, which is exactly how Word resolves the two.
   *
   * Runs after layout because NUMPAGES cannot be known before the last page exists. In documents
   * with running STYLEREF fields, the reconciliation pass also measures these page-number values
   * before allocating body space. Other documents retain the established late substitution.
   *
   * Ordinary cached fields are scoped to the CLONED header/footer regions. A page-number field in body text is
   * ordinary run content that the editor may make editable, and committing an edited block writes
   * back whatever text the DOM holds — rewriting it here would mean a body field commits a number
   * the document never contained. Legacy w:pgNum blocks are the exception: they have no cached
   * text and are explicitly non-editable, so their marked projection follows the current page
   * in every story while ordinary body fields keep their cached results.
   */
  substitutePageNumberFields(totalPages) {
    const boxes = this.containerElement.querySelectorAll(`.${this.cssPrefix}box`);
    for (const box of Array.from(boxes)) {
      const markers = box.querySelectorAll(
        `.${this.cssPrefix}header [data-field], .${this.cssPrefix}footer [data-field], [data-legacy-page-number="true"]`
      );
      if (markers.length === 0) continue;
      const sectionIndex = parseInt(box.dataset.sectionIndex || "0", 10);
      const pageNumber = parseInt(box.dataset.pageNumber || "1", 10);
      const displayed = parseInt(box.dataset.displayedPageNumber || String(pageNumber), 10);
      this.substituteStoryPageNumbers(box, sectionIndex, displayed, totalPages, markers);
    }
  }
  substituteStoryPageNumbers(story, sectionIndex, displayed, totalPages, markers = story.querySelectorAll("[data-field]")) {
    for (const marker of Array.from(markers)) {
      const kind = marker.dataset.field;
      if (kind !== "PAGE" && kind !== "NUMPAGES") continue;
      const format = marker.dataset.fieldFormat ?? this.pageNumbering.get(sectionIndex)?.format;
      marker.textContent = formatPageNumber(kind === "PAGE" ? displayed : totalPages, format);
    }
  }
  /**
   * Measures all content blocks in a section.
   */
  measureBlocks(section, dims, sectionIndex, pictureBodyHeight = this.smallestEffectiveContentHeight(dims, sectionIndex)) {
    const blocks = [];
    if (this.fragmentParagraphs) {
      this.fitOverwideTables(section, dims);
      this.fitOversizedPictures(section, dims, sectionIndex, pictureBodyHeight);
      this.prepareBodyEdgePictures(section);
    }
    this.prepareShapeClearance(section, dims);
    this.prepareTableText?.(section);
    const children = Array.from(section.children);
    for (const child of children) {
      this.checkpoint();
      if (child.dataset.sectionIndex !== void 0) {
        const nestedSectionIndex = parseInt(child.dataset.sectionIndex || String(sectionIndex), 10);
        const nestedBlocks = this.measureBlocks(child, dims, nestedSectionIndex, pictureBodyHeight);
        blocks.push(...nestedBlocks);
        continue;
      }
      if (child.matches("section.endnotes")) {
        const endnoteBlocks = this.measureSafeEndnoteBlocks(child, dims, sectionIndex);
        if (endnoteBlocks) {
          blocks.push(...endnoteBlocks);
          continue;
        }
      }
      this.prepareCommentGroups(child);
      if (this.floatingPictureCarriers(child).length > 0) {
        blocks.push(this.measureElement(child, dims, sectionIndex));
        continue;
      }
      const rect = child.getBoundingClientRect();
      const { topPx: marginTopPx, bottomPx: marginBottomPx } = collapsedBlockMarginsPx(this.view, child);
      const heightPt = pxToPt(rect.height);
      const marginTopPt = pxToPt(marginTopPx);
      const marginBottomPt = pxToPt(marginBottomPx);
      const isPageBreak = child.dataset.pageBreak === "true" || child.classList.contains(`${this.cssPrefix}break`);
      blocks.push({
        element: child,
        sectionIndex,
        heightPt,
        trailingLeadingPt: this.lastLineTrailingLeadingPt(child),
        marginTopPt,
        marginBottomPt,
        keepWithNext: child.dataset.keepWithNext === "true",
        keepLines: child.dataset.keepLines === "true",
        pageBreakBefore: child.dataset.pageBreakBefore === "true",
        isPageBreak,
        isWordParagraph: this.hasParagraphSpacing(child)
      });
    }
    return blocks;
  }
  /** Only converter comment shells may be split recursively; retain custom HTML intact. */
  prepareCommentGroups(section) {
    if (section.localName !== "aside") return;
    const name = Array.from(section.classList).find((value) => value.endsWith("s-section"));
    if (!name) return;
    const base = name.slice(0, -"s-section".length);
    const header = section.children[1]?.firstElementChild?.firstElementChild;
    const prefix = Array.from(header?.classList ?? []).find((value) => value.endsWith("header") && value.slice(0, -"header".length).replace(/-+$/, "") === base)?.slice(0, -"header".length);
    if (prefix === void 0) return;
    const matches = (element, tag, name2) => element.localName === tag && element.classList.contains(name2);
    const groups = [], headings = [];
    const visit = (element, kind) => {
      const children = Array.from(element.children);
      this.checkpoint();
      const style = this.view.getComputedStyle(element);
      if (style.position === "absolute" || style.position === "fixed" || style.float !== "none" || !["block", "list-item"].includes(style.display) || style.columnCount !== "auto" || style.columnWidth !== "auto" || Array.from(element.childNodes).some((node) => node.nodeType === this.view.Node.TEXT_NODE && this.hasVisibleText(node.textContent ?? ""))) return false;
      groups.push(element);
      if (kind === "section") {
        if (children.length !== 2 || children[0].localName !== "h2" || !matches(children[1], "ol", `${base}s-list`)) return false;
        headings.push(children[0]);
        return visit(children[1], "list");
      }
      if (kind === "list") return children.length > 0 && children.every((child) => matches(child, "li", base) && visit(child, "item"));
      if (kind === "body") return children.length > 0 && children.every((child) => child.localName === "p");
      if (children.length < 2 || children.length > 3 || !matches(children[0], "div", `${prefix}header`) || !matches(children[1], "div", `${prefix}body`)) return false;
      headings.push(children[0]);
      return visit(children[1], "body") && (children.length === 2 || matches(children[2], "ol", `${prefix}replies`) && visit(children[2], "list"));
    };
    if (!visit(section, "section")) return;
    for (const group of groups) group.dataset.paginationCommentGroup = "true";
    for (const heading of headings) heading.dataset.keepWithNext = "true";
  }
  /** Floated pictures participate in page fit even though normal block height excludes them. */
  floatingPictureCarriers(element) {
    const carriers = /* @__PURE__ */ new Set();
    const images = Array.from(element.querySelectorAll("img"));
    if (images.length === 0 || this.view.getComputedStyle(element).overflowY !== "visible") return [];
    for (const image of images) {
      this.checkpoint();
      if (image.closest(`[data-docx-drawing-anchor], ${EXACT_ROW_CELL}`)) continue;
      let floated = null;
      for (let current = image; current && current !== element; current = current.parentElement) {
        const style = this.view.getComputedStyle(current);
        if (current.hasAttribute("data-docx-fragment-edge") && style.position === "absolute" && style.float === "none" && style.overflowY === "visible") {
          floated = current;
          continue;
        }
        if (style.position === "absolute" || style.position === "fixed" || current !== image && style.overflowY !== "visible") {
          floated = null;
          break;
        }
        if (style.float !== "none") floated = current;
      }
      if (floated) carriers.add(floated);
    }
    return [...carriers];
  }
  /** An indivisible picture must fit one page before paragraph fragmentation can help. */
  fitOversizedPictures(section, dims, sectionIndex, availableBodyHeight = this.smallestEffectiveContentHeight(dims, sectionIndex)) {
    let changed = false;
    const sectionLeft = section.getBoundingClientRect().left;
    const paperLeft = sectionLeft - ptToPx(dims.marginLeft);
    const paperRight = sectionLeft + ptToPx(dims.contentWidth + dims.marginRight);
    const bodyHeight = ptToPx(availableBodyHeight);
    for (const image of Array.from(section.querySelectorAll("img"))) {
      this.checkpoint();
      if (image.closest("#pagination-hf-registry, #pagination-footnote-registry, #pagination-comment-margin-registry, [data-docx-drawing-anchor]")) continue;
      if (image.closest(EXACT_ROW_CELL)) continue;
      const paragraph = image.closest("p,h1,h2,h3,h4,h5,h6");
      if (!paragraph) continue;
      let supported = true;
      let floating = null;
      for (let carrier = image; carrier && carrier !== paragraph; carrier = carrier.parentElement) {
        const style2 = this.view.getComputedStyle(carrier);
        if (carrier !== image && style2.overflowY !== "visible") {
          supported = false;
          break;
        }
        const edge = carrier.hasAttribute("data-docx-fragment-edge") && style2.position === "absolute" && style2.float === "none";
        if ((edge || style2.float !== "none" && style2.position === "static") && style2.transform === "none" && !floating && (carrier === image || carrier.querySelectorAll("img").length === 1 && !this.hasVisibleText(carrier.textContent ?? ""))) {
          floating = carrier;
          continue;
        }
        if (style2.display !== "inline" || !this.hasRangeFragmentSafePosition(carrier, style2) || style2.float !== "none" || style2.transform !== "none") {
          supported = false;
          break;
        }
      }
      if (!supported) continue;
      const style = this.view.getComputedStyle(paragraph);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
      const rect = image.getBoundingClientRect();
      const frame = floating?.getBoundingClientRect();
      const frameStyle = floating ? this.view.getComputedStyle(floating) : null;
      const extraWidth = frame ? Math.max(0, frame.width - rect.width) : 0;
      const extraHeight = frame ? Math.max(0, frame.height - rect.height) : 0;
      const frameMargins = (first, second) => frameStyle ? Math.max(0, parseFloat(frameStyle[first]) || 0) + Math.max(0, parseFloat(frameStyle[second]) || 0) : 0;
      const maximumHeight = bodyHeight - lineHeight - Math.max(0, parseFloat(style.marginTop)) - extraHeight - frameMargins("marginTop", "marginBottom");
      const maximumWidth = paragraph.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - extraWidth - frameMargins("marginLeft", "marginRight");
      if (!(maximumHeight > 0 && maximumWidth > 0 && rect.width > 0 && rect.height > 0)) continue;
      let tooTall = rect.height > bodyHeight;
      if (!tooTall && rect.height > maximumHeight) {
        let isolated = image.cloneNode(true);
        for (let carrier = image.parentElement; carrier && carrier !== paragraph; carrier = carrier.parentElement) {
          const wrapper = carrier.cloneNode(false);
          wrapper.appendChild(isolated);
          isolated = wrapper;
        }
        const imageLine = paragraph.cloneNode(false);
        imageLine.appendChild(isolated);
        tooTall = ptToPx(this.measureElement(imageLine, dims, sectionIndex).heightPt) > bodyHeight;
      }
      if (!tooTall && rect.left >= paperLeft - 1 && rect.right <= paperRight + 1) continue;
      const ratio = Math.min(1, maximumWidth / rect.width, maximumHeight / rect.height);
      if (ratio >= 1) continue;
      changed = true;
      image.style.setProperty("width", `${rect.width * ratio}px`, "important");
      image.style.setProperty("height", `${rect.height * ratio}px`, "important");
      image.style.setProperty("min-width", "0", "important");
      image.style.setProperty("min-height", "0", "important");
      if (floating && floating !== image) {
        floating.style.setProperty("box-sizing", "border-box", "important");
        floating.style.setProperty("width", `${rect.width * ratio + extraWidth}px`, "important");
        floating.style.setProperty("height", `${rect.height * ratio + extraHeight}px`, "important");
        floating.style.setProperty("min-width", "0", "important");
        floating.style.setProperty("min-height", "0", "important");
      }
    }
    return changed;
  }
  /** Fit to the actual page after a section transition or running field changes its body band. */
  fitBlockPicturesToPage(block, dims, bodyHeight) {
    if (!block.element.querySelector("img")) return null;
    const host = this.document.createElement("div");
    host.style.cssText = `position:absolute;visibility:hidden;left:-9999px;width:${dims.contentWidth}pt`;
    const clone = block.element.cloneNode(true);
    host.appendChild(clone);
    this.stagingElement.appendChild(host);
    try {
      if (!this.fitOversizedPictures(host, dims, block.sectionIndex, bodyHeight)) return null;
      this.prepareBodyEdgePictures(host);
      return { ...block, ...this.measureElement(clone, dims, block.sectionIndex) };
    } finally {
      clone.remove();
      host.remove();
    }
  }
  /** Reflow an over-wide table into its containing band without shrinking its text. */
  fitOverwideTables(section, dims) {
    const sectionLeft = section.getBoundingClientRect().left;
    const paperLeft = sectionLeft - ptToPx(dims.marginLeft);
    const paperRight = sectionLeft + ptToPx(dims.contentWidth + dims.marginRight);
    const fitted = /* @__PURE__ */ new Set();
    for (const table of Array.from(section.querySelectorAll("table"))) {
      this.checkpoint();
      if (table.closest("#pagination-hf-registry, #pagination-footnote-registry, #pagination-comment-margin-registry")) continue;
      if (table.dataset.docxFixedWidth === "true") continue;
      const parent = table.parentElement;
      if (!parent) continue;
      const rect = table.getBoundingClientRect();
      const outer = parent.closest("table");
      if (!outer || !fitted.has(outer)) {
        if (rect.left >= paperLeft - 1 && rect.right <= paperRight + 1) continue;
      }
      const style = this.view.getComputedStyle(table);
      const parentStyle = this.view.getComputedStyle(parent);
      if (style.position === "absolute" || style.position === "fixed") continue;
      const available = parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight) - Math.max(0, parseFloat(style.marginLeft)) - Math.max(0, parseFloat(style.marginRight));
      const width = rect.width;
      if (!(available > 0) || width <= available + 1) continue;
      const columns = Array.from(table.querySelectorAll(":scope > colgroup > col"));
      const columnWidths = columns.map((column) => column.getBoundingClientRect().width);
      const total = columnWidths.reduce((sum, value) => sum + value, 0);
      const cells = Array.from(table.rows).flatMap((row) => Array.from(row.cells));
      const cellWidths = cells.map((cell) => parseFloat(this.view.getComputedStyle(cell).width));
      table.style.setProperty("width", `${available}px`, "important");
      table.style.setProperty("min-width", "0", "important");
      table.style.setProperty("table-layout", "fixed", "important");
      for (const group of Array.from(table.children).filter((child) => child.localName === "colgroup"))
        group.style.setProperty("width", "auto", "important");
      columns.forEach((column, index) => {
        if (total > 0) column.style.setProperty("width", `${columnWidths[index] / total * 100}%`, "important");
      });
      cells.forEach((cell, index) => {
        cell.style.setProperty("width", total > 0 ? "auto" : `${cellWidths[index] * available / width}px`, "important");
        cell.style.setProperty("min-width", "0", "important");
      });
      fitted.add(table);
    }
  }
  /**
   * Flatten the converter's `section.endnotes > ol > li > p` presentation into
   * ordinary paragraph blocks. This preserves paragraph formatting and canonical
   * p:en/en:en identities while allowing the existing paragraph fragmenter to
   * split a long endnote across page boundaries.
   */
  measureSafeEndnoteBlocks(section, dims, sectionIndex) {
    const sectionChildren = Array.from(section.children);
    const list = sectionChildren.find((child) => child.tagName === "OL");
    if (!list || sectionChildren.some((child) => child.tagName !== "HR" && child !== list) || Array.from(list.children).some((child) => child.tagName !== "LI")) {
      return null;
    }
    const items = Array.from(list.children);
    if (items.length === 0 || items.some(
      (item) => item.children.length === 0 || Array.from(item.children).some((child) => child.tagName !== "P")
    )) {
      return null;
    }
    const blocks = [];
    const sectionStyle = this.view.getComputedStyle(section);
    for (const rule of sectionChildren.filter((child) => child.tagName === "HR")) {
      this.checkpoint();
      const clonedRule = rule.cloneNode(true);
      const ruleStyle = this.view.getComputedStyle(rule);
      for (const property of [
        "height",
        "width",
        "max-width",
        "border",
        "background-color",
        "color",
        "margin-top",
        "margin-right",
        "margin-bottom",
        "margin-left"
      ]) {
        clonedRule.style.setProperty(property, ruleStyle.getPropertyValue(property));
      }
      if (blocks.length === 0) {
        clonedRule.style.marginTop = `calc(${sectionStyle.marginTop} + ${ruleStyle.marginTop})`;
      }
      blocks.push(this.measureElement(clonedRule, dims, sectionIndex));
    }
    const listStyle = this.view.getComputedStyle(list);
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      this.checkpoint();
      const item = items[itemIndex];
      const ownerAnchorId = item.dataset.sourceAnchorId;
      const paragraphs = Array.from(item.children);
      for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
        this.checkpoint();
        const paragraph = paragraphs[paragraphIndex];
        if (!this.hasRangeFragmentSafeLayout(paragraph)) {
          return null;
        }
        const clone = paragraph.cloneNode(true);
        clone.dataset.paginationSafeEndnote = "true";
        this.preserveInheritedPresentation(clone, this.view.getComputedStyle(paragraph));
        clone.style.paddingLeft ||= listStyle.paddingLeft;
        if (ownerAnchorId && !Array.from(
          clone.querySelectorAll("[data-source-anchor-id]")
        ).some((node) => node.dataset.sourceAnchorId === ownerAnchorId)) {
          const owner = this.document.createElement("span");
          owner.dataset.sourceAnchorId = ownerAnchorId;
          while (clone.firstChild) owner.appendChild(clone.firstChild);
          clone.appendChild(owner);
        }
        if (paragraphIndex === 0) {
          const itemId = item.id;
          if (itemId) {
            if (clone.id && clone.id !== itemId) return null;
            clone.id = itemId;
          }
          if (!clone.querySelector("[data-endnote-number]")) {
            const value = parseInt(item.getAttribute("value") || String(itemIndex + 1), 10);
            const marker = this.formatOrderedListMarker(
              Number.isFinite(value) ? value : itemIndex + 1,
              listStyle.listStyleType
            );
            clone.insertBefore(this.document.createTextNode(`${marker}. `), clone.firstChild);
          }
        }
        blocks.push(this.measureElement(clone, dims, sectionIndex));
      }
    }
    return blocks;
  }
  /** Render the CSS ordered-list formats emitted by the converter after an endnote is flattened. */
  formatOrderedListMarker(value, listStyleType) {
    const format = (() => {
      switch (listStyleType) {
        case "lower-roman":
          return "lowerRoman";
        case "upper-roman":
          return "upperRoman";
        case "lower-alpha":
        case "lower-latin":
          return "lowerLetter";
        case "upper-alpha":
        case "upper-latin":
          return "upperLetter";
        default:
          return "decimal";
      }
    })();
    return formatPageNumber(value, format);
  }
  /**
   * Flows a multi-column (`w:cols`) section's children into CSS-multicol container
   * blocks. Word lays such a section out as N columns inside the same body extent;
   * a `column-count` container reproduces that geometry, and the paginator
   * then places each container as one ordinary measured block. A container grows
   * greedily until it would exceed the smallest page body available to the section.
   * Final continuous sections fill that height sequentially; other sections retain
   * balancing. A long columned section still splits across pages at block
   * boundaries. Each child lands in exactly one container, so anchors never
   * duplicate. An explicit page break child passes through as its own block, which
   * ends the current container and lets the normal flow logic turn the page.
   */
  buildColumnBlocks(section, dims, sectionIndex, columnCount, columnGapPt, sequential = false) {
    const children = Array.from(section.children);
    const blocks = [];
    const maxFragmentHeight = this.smallestEffectiveContentHeight(dims, sectionIndex);
    const isBreak = (child) => child.dataset.pageBreak === "true" || child.classList.contains(`${this.cssPrefix}break`);
    const makeContainer = (slice) => {
      const container = this.document.createElement("div");
      container.dataset.paginationColumns = "true";
      container.style.columnCount = String(columnCount);
      container.style.columnGap = `${columnGapPt}pt`;
      if (sequential) {
        container.dataset.paginationSequentialColumns = "true";
        container.style.columnFill = "auto";
        container.style.maxHeight = `${maxFragmentHeight}pt`;
      }
      for (const child of slice) {
        container.appendChild(child.cloneNode(true));
      }
      if (sequential) this.liftColumnSpaceBefore(container, dims);
      return container;
    };
    let start = 0;
    while (start < children.length) {
      this.checkpoint();
      if (isBreak(children[start])) {
        blocks.push(this.measureElement(children[start], dims, sectionIndex));
        start++;
        continue;
      }
      let end = start + 1;
      let container = makeContainer(children.slice(start, end));
      if (sequential && this.columnContainerOverflows(container, dims)) {
        container.style.columnFill = "balance";
        container.style.maxHeight = "";
      }
      let measured = this.measureElement(container, dims, sectionIndex);
      while (end < children.length && !isBreak(children[end])) {
        this.checkpoint();
        const candidate = makeContainer(children.slice(start, end + 1));
        const candidateMeasured = this.measureElement(candidate, dims, sectionIndex);
        if (candidateMeasured.heightPt > maxFragmentHeight || sequential && this.columnContainerOverflows(candidate, dims)) break;
        container = candidate;
        measured = candidateMeasured;
        end++;
      }
      blocks.push({
        element: container,
        sectionIndex,
        heightPt: measured.heightPt,
        marginTopPt: measured.marginTopPt,
        marginBottomPt: measured.marginBottomPt,
        keepWithNext: false,
        keepLines: false,
        pageBreakBefore: false,
        isPageBreak: false,
        isWordParagraph: false
      });
      start = end;
    }
    return blocks;
  }
  /** Keep Word's paragraph space-before in the ordinary inter-block spacing budget. */
  liftColumnSpaceBefore(container, dims) {
    container.style.marginTop = "";
    const first = container.firstElementChild;
    if (!first || !this.isWordParagraphElement(first)) return;
    const host = this.document.createElement("div");
    host.style.width = `${dims.contentWidth}pt`;
    host.appendChild(container);
    this.stagingElement.appendChild(host);
    try {
      const spaceBefore = first.dataset.paginationColumnSpaceBefore ?? this.view.getComputedStyle(first).marginTop;
      first.dataset.paginationColumnSpaceBefore = spaceBefore;
      first.style.marginTop = "0";
      container.style.marginTop = spaceBefore;
    } finally {
      container.remove();
      host.remove();
    }
  }
  /** A height-constrained multicol box overflows horizontally when it needs another column. */
  columnContainerOverflows(element, dims) {
    const host = this.document.createElement("div");
    host.style.width = `${dims.contentWidth}pt`;
    const clone = element.cloneNode(true);
    host.appendChild(clone);
    this.stagingElement.appendChild(host);
    try {
      if (clone.scrollWidth > clone.clientWidth + 1 || clone.scrollHeight > clone.clientHeight + 1) return true;
      return Array.from(clone.querySelectorAll('[data-keep-lines="true"]')).some((paragraph) => paragraph.getClientRects().length > 1);
    } finally {
      host.remove();
    }
  }
  /** CSS may break a column's table internally; protect row features it cannot model. */
  canFragmentColumnTable(element, container = element) {
    const table = this.blockTable(element);
    return !!table && !container.querySelector("[data-footnote-id]") && !table.querySelector('table, [rowspan]:not([rowspan="1"]), [data-docx-header-row="true"], [data-docx-cant-split="true"], [data-keep-with-next="true"]');
  }
  /** Reflow a column child stream against the actual remaining body band. */
  reflowColumns(block, dims, availableHeightPt) {
    if (block.element.dataset.paginationColumns !== "true" || availableHeightPt <= 0) return null;
    const sequential = block.element.dataset.paginationSequentialColumns === "true";
    const height = Math.min(availableHeightPt, this.smallestEffectiveContentHeight(dims, block.sectionIndex));
    const children = Array.from(block.element.children);
    const make = (slice, limit) => {
      const container = block.element.cloneNode(false);
      if (sequential) {
        container.style.columnFill = "auto";
        container.style.maxHeight = `${limit}pt`;
      }
      for (const child of slice) container.appendChild(child.cloneNode(true));
      if (sequential) this.liftColumnSpaceBefore(container, dims);
      return container;
    };
    const fits = (slice) => {
      const candidate = make(slice, height);
      return this.measureElement(candidate, dims, block.sectionIndex).heightPt <= height && !this.columnContainerOverflows(candidate, dims);
    };
    if (fits(children)) {
      if (!sequential || block.element.style.columnFill === "auto" && Math.abs(parseFloat(block.element.style.maxHeight) - height) < 0.01) return null;
      return [this.measureElement(make(children, height), dims, block.sectionIndex)];
    }
    let end = 0;
    while (end < children.length && fits(children.slice(0, end + 1))) {
      this.checkpoint();
      end++;
    }
    let head = children.slice(0, end);
    let tail = children.slice(end);
    const host = this.document.createElement("div");
    const count = Number(block.element.style.columnCount);
    const gap = parseFloat(block.element.style.columnGap);
    const columnWidth = (dims.contentWidth - (count - 1) * gap) / count;
    host.style.width = `${columnWidth}pt`;
    const source = children[end].cloneNode(true);
    host.appendChild(source);
    this.stagingElement.appendChild(host);
    let split = null;
    try {
      const fitsChild = (candidate) => fits([...head, candidate]);
      if (!block.element.querySelector("[data-footnote-id]")) {
        const measured = this.measureElement(source, { ...dims, contentWidth: columnWidth }, block.sectionIndex);
        if (this.canFragmentParagraph({ ...measured, element: source })) {
          const paragraph = this.splitParagraphAtLargestFit(source, fitsChild, {
            preserveWidowLines: source.dataset.widowControl !== "false"
          });
          if (paragraph.kind === "split") split = paragraph;
        } else if (this.fragmentParagraphs) {
          split = this.splitParagraphGroup(source, fitsChild, { bodyParagraph: true });
        }
        if (!split && this.canFragmentColumnTable(source)) {
          split = this.splitTableAtRows(source, fitsChild, false);
        }
      }
    } finally {
      host.remove();
    }
    if (split) {
      head = [...head, split.head];
      tail = [split.tail, ...children.slice(end + 1)];
      delete split.tail.dataset.paginationColumnSpaceBefore;
    } else {
      while (end > 0 && children[end - 1].dataset.keepWithNext === "true") end--;
      head = children.slice(0, end);
      tail = children.slice(end);
    }
    if (head.length === 0) return null;
    const parts = [make(head, height), make(tail, this.smallestEffectiveContentHeight(dims, block.sectionIndex))];
    delete parts[0].dataset.paginationColumnTail;
    parts[1].dataset.paginationColumnTail = "true";
    this.reconcileFragmentIdentities(parts[0], parts[1]);
    return parts.map((element) => this.measureElement(element, dims, block.sectionIndex));
  }
  /**
   * Measures one element in the same hidden staging context used for the source blocks.
   * This is intentionally DOM-based: table row heights cannot be inferred from individual
   * rows because wrapping and collapsed borders change the height of a fragment.
   */
  measureElement(element, dims, sectionIndex, preceding = [], pageNumber = Number(element.dataset.paginationPhysicalPage ?? 1)) {
    element.dataset.paginationSection = String(sectionIndex);
    const measurementHost = this.document.createElement("div");
    measurementHost.style.position = "absolute";
    measurementHost.style.visibility = "hidden";
    measurementHost.style.left = "-9999px";
    measurementHost.style.width = `${dims.contentWidth}pt`;
    const measuredElement = element.cloneNode(true);
    this.appendSectionContent(
      measurementHost,
      [...preceding.map((previous) => previous.cloneNode(true)), measuredElement],
      dims
    );
    this.stagingElement.appendChild(measurementHost);
    let prefixTop;
    if (measuredElement.querySelector("[data-docx-frame-clearance]")) {
      const sentinel = this.document.createElement("div");
      sentinel.style.cssText = "height:0;margin:0";
      measuredElement.replaceWith(sentinel);
      this.prepareFrameExclusions(measurementHost, dims, pageNumber);
      prefixTop = sentinel.getBoundingClientRect().top;
      sentinel.replaceWith(measuredElement);
    }
    this.prepareFrameExclusions(measurementHost, dims, pageNumber);
    const rect = measuredElement.getBoundingClientRect();
    const margins = collapsedBlockMarginsPx(this.view, measuredElement);
    let clearancePt = 0;
    if (this.hasFlowExclusion(preceding)) {
      clearancePt = pxToPt(Math.max(0, rect.top - this.unclearedBlockTop(measuredElement)));
    }
    if (prefixTop !== void 0) clearancePt += pxToPt(rect.top - prefixTop);
    const frameBottoms = Array.from(measurementHost.querySelectorAll("[data-docx-frame-exclusion] > [data-docx-text-frame]")).filter((frame) => !frame.closest("[data-docx-textbox]")).map((frame) => this.frameExclusionRectangle(frame).bottom - rect.top);
    const heightPt = this.edgeExclusionsMatch(measuredElement) ? pxToPt(Math.max(rect.height, ...this.floatingPictureCarriers(measuredElement).map((picture) => picture.getBoundingClientRect().bottom - rect.top))) : Infinity;
    const measured = {
      element,
      sectionIndex,
      heightPt,
      trailingLeadingPt: this.lastLineTrailingLeadingPt(measuredElement),
      clearancePt,
      frameExtentPt: frameBottoms.length ? Math.max(0, pxToPt(Math.max(...frameBottoms))) : void 0,
      marginTopPt: pxToPt(margins.topPx),
      marginBottomPt: pxToPt(margins.bottomPx),
      keepWithNext: element.dataset.keepWithNext === "true",
      keepLines: element.dataset.keepLines === "true",
      pageBreakBefore: element.dataset.pageBreakBefore === "true",
      isPageBreak: element.dataset.pageBreak === "true" || element.classList.contains(`${this.cssPrefix}break`),
      isWordParagraph: this.hasParagraphSpacing(measuredElement)
    };
    this.stagingElement.removeChild(measurementHost);
    return measured;
  }
  /**
   * Returns the contiguous keep-with-next chain beginning at a block.
   *
   * A hard page break or a page-break-before directive is stronger than a
   * keep-with-next directive, so it terminates the chain. The caller only
   * keeps a chain together when the whole chain or a valid first fragment can fit on a fresh page.
   */
  getKeepWithNextChain(blocks, startIndex) {
    const firstBlock = blocks[startIndex];
    if (!firstBlock) return [];
    const chain = [firstBlock];
    let lastIndex = startIndex;
    while (blocks[lastIndex].keepWithNext) {
      const nextBlock = blocks[lastIndex + 1];
      if (!nextBlock || nextBlock.isPageBreak || nextBlock.pageBreakBefore) {
        break;
      }
      chain.push(nextBlock);
      lastIndex++;
    }
    return chain;
  }
  /**
   * Measures the visible body height of a keep-with-next chain using the same
   * collapsed-margin rules as normal block placement. The trailing margin is
   * intentionally excluded, matching the individual block fit check.
   */
  measureKeepWithNextChainHeight(chain, previousMarginBottomPt, isFirstOnPage, pageInSection) {
    const firstBlock = chain[0];
    if (!firstBlock) return { flowHeight: 0, frameBottom: 0 };
    const firstMarginTop = this.effectiveBlockMarginTop(
      firstBlock,
      previousMarginBottomPt,
      isFirstOnPage,
      pageInSection
    );
    let bodyHeight = firstMarginTop + firstBlock.heightPt;
    let frameBottom = firstMarginTop + (firstBlock.frameExtentPt ?? 0);
    for (let index = 1; index < chain.length; index++) {
      const previousBlock = chain[index - 1];
      const block = chain[index];
      bodyHeight += Math.max(previousBlock.marginBottomPt, block.marginTopPt) + (block.clearancePt ?? 0);
      frameBottom = Math.max(frameBottom, bodyHeight + (block.frameExtentPt ?? 0));
      bodyHeight += block.heightPt;
    }
    return { flowHeight: bodyHeight, frameBottom };
  }
  /** Word paragraphs render as `p`, or as `h1`–`h6` when their style has an outline level. */
  isWordParagraphElement(element) {
    return element.tagName === "P" || /^H[1-6]$/.test(element.tagName);
  }
  /**
   * Whether a laid-out block's top margin is Word paragraph space-before: a paragraph's own, or
   * that of the box around a bordered run of paragraphs, which carries the run's (issue #1677).
   */
  hasParagraphSpacing(element) {
    return this.isWordParagraphElement(element) || this.isBorderGroup(element);
  }
  /**
   * The extra leading an auto line-spacing multiple puts below the text of a laid-out paragraph's
   * last line. Word puts that leading below the text (issue #908), and a page's last line needs
   * only its text height: the leading may run past the bottom margin (issue #1571). Only text the
   * converter's lift holds at the top of its line box qualifies; a run laid out with CSS's split
   * leading would paint below its text height, and pictures, bottom borders and padding keep the
   * full line. The smallest run bounds the leading below every run's text. Word centres a grid
   * line's text instead, so half of that line's extra height lies below its text (#1551). Mixed text's
   * line metrics carry their own lines, of which only a grid line's leading qualifies.
   */
  lastLineTrailingLeadingPt(paragraph) {
    const style = this.view.getComputedStyle(paragraph);
    const multiple = parseFloat(style.getPropertyValue("--docx-auto-line-spacing"));
    const grid = parseFloat(style.getPropertyValue("--docx-line-grid")) > 0;
    if (!(multiple > 1 || grid) || !this.isWordParagraphElement(paragraph) || paragraph.querySelector("img, svg") || parseFloat(style.paddingBottom) > 0 || parseFloat(style.borderBottomWidth) > 0) return 0;
    const metric = Array.from(paragraph.querySelectorAll("[data-docx-line-metric]")).at(-1);
    if (metric) return metric.dataset.docxLineMetric === "grid" && isMixedLineMetric(metric) ? pxToPt((Number(metric.dataset.docxLineGrid) - Number(metric.dataset.docxLineNatural)) / 2) : 0;
    let leading = Infinity;
    let checked = null;
    const walker = this.document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!/\S/.test(text.textContent ?? "")) continue;
      let run = text.parentElement;
      while (run !== paragraph && run.parentElement !== paragraph) run = run.parentElement;
      if (run === checked) continue;
      checked = run;
      const runStyle = this.view.getComputedStyle(run);
      const height = parseFloat(runStyle.lineHeight);
      const native = grid ? parseFloat(run.style.getPropertyValue("--docx-word-native-height")) : NaN;
      const natural = native > 0 ? native : height / multiple;
      if (!(native > 0 || multiple > 1) || runStyle.position !== "relative" || !(Math.abs(parseFloat(runStyle.top) - (native > 0 ? 0 : (natural - height) / 2)) < 0.01)) return 0;
      leading = Math.min(leading, native > 0 ? (height - natural) / 2 : height - natural);
    }
    return Number.isFinite(leading) ? pxToPt(leading) : 0;
  }
  /**
   * The height a block needs above the bottom of the page; see `MeasuredBlock.trailingLeadingPt`.
   * Before compatibility mode 15 the leading may also run under a note band; from mode 15 the band
   * clears the full line box, and only the page foot lets the leading run past (#1751).
   */
  fitHeightPt(block, aboveNotes = false) {
    const leading = aboveNotes && this.compatibilityMode >= 15 ? 0 : block.trailingLeadingPt ?? 0;
    return Math.max(0, block.heightPt - leading);
  }
  /** The leading a block placed in `availablePt` lets run past: its last line fits only by its text height. */
  droppedLeadingPt(block, availablePt) {
    return block.heightPt > availablePt ? block.heightPt - this.fitHeightPt(block) : 0;
  }
  shouldSuppressPageTopSpacing(block, isFirstOnPage, pageInSection) {
    return isFirstOnPage && pageInSection > 1 && block.isWordParagraph === true;
  }
  /**
   * Resolves the part of a block's top margin that consumes the current page.
   *
   * In Word's native DOCX layout, paragraph space-before is suppressed when a paragraph is the
   * first body block on a later page of the SAME section. The first page of a document/section is
   * the exception and keeps its spacing. Tables and other block margins are not paragraph spacing,
   * so they continue to use the ordinary CSS collapsing rule.
   */
  effectiveBlockMarginTop(block, previousMarginBottomPt, isFirstOnPage, pageInSection) {
    const margin = this.shouldSuppressPageTopSpacing(block, isFirstOnPage, pageInSection) ? 0 : isFirstOnPage ? block.marginTopPt : Math.max(block.marginTopPt, previousMarginBottomPt) - previousMarginBottomPt;
    return margin + (block.clearancePt ?? 0);
  }
  /** Clone a source block with the same page-top spacing decision used by the height budget. */
  cloneBlockForPage(block, isFirstOnPage, pageInSection, availablePt = Infinity) {
    const clone = block.element.cloneNode(true);
    if (this.droppedLeadingPt(block, availablePt) > 0) {
      clone.style.setProperty("--docx-word-text-height", `${this.fitHeightPt(block)}pt`);
      clone.style.height = "var(--docx-word-text-height)";
    }
    if (clone.dataset.paginationSequentialColumns === "true" && clone.style.columnFill === "auto" && block.heightPt >= parseFloat(clone.style.maxHeight) - pxToPt(1 / 64)) {
      clone.style.height = clone.style.maxHeight;
      clone.style.maxHeight = "";
    }
    if (this.shouldSuppressPageTopSpacing(block, isFirstOnPage, pageInSection)) {
      clone.style.setProperty("margin-top", "0", "important");
    }
    return clone;
  }
  /** Horizontal body geometry follows the source section, independently of the page's bands. */
  horizontalSectionDimensions(element, page) {
    const section = element.closest("[data-pagination-section]")?.dataset.paginationSection;
    const dims = section === void 0 ? void 0 : this.bodySectionDimensions.get(Number(section));
    return dims ?? page;
  }
  /** Use the same ordinary block containers for physical pages and fragment measurement prefixes. */
  appendSectionContent(host, content, dims) {
    let group;
    let groupLeft = NaN, groupWidth = NaN;
    for (const element of content) {
      const section = this.horizontalSectionDimensions(element, dims);
      if (section.marginLeft === dims.marginLeft && section.contentWidth === dims.contentWidth) {
        host.appendChild(element);
        group = void 0;
      } else {
        if (!group || section.marginLeft !== groupLeft || section.contentWidth !== groupWidth) {
          group = this.document.createElement("div");
          group.style.width = `${section.contentWidth}pt`;
          group.style.marginLeft = `${section.marginLeft - dims.marginLeft}pt`;
          host.appendChild(group);
          groupLeft = section.marginLeft;
          groupWidth = section.contentWidth;
        }
        group.appendChild(element);
      }
    }
  }
  hasFlowExclusion(content) {
    const selector = "[data-docx-edge-picture],[data-docx-shape-exclusion],[data-docx-shape-clearance],[data-docx-frame-exclusion],[data-docx-header-exclusion]";
    return content.some((element) => element.matches(selector) || element.querySelector(selector));
  }
  /**
   * Finds footnote references introduced by a sequence of blocks, preserving
   * document order and excluding references already assigned to the page.
   */
  collectNewFootnoteIds(blocks, existingFootnoteIds) {
    const knownIds = new Set(existingFootnoteIds);
    const newIds = [];
    for (const block of blocks) {
      this.checkpoint();
      for (const id of this.extractFootnoteRefs(block.element)) {
        if (!knownIds.has(id)) {
          knownIds.add(id);
          newIds.push(id);
        }
      }
    }
    return newIds;
  }
  /**
   * The shortest body available to a section's first, default, or even page.
   * A row fragment must fit every variant, otherwise a later header/footer could
   * send it through the oversized-block fallback again.
   */
  smallestEffectiveContentHeight(dims, sectionIndex) {
    return Math.min(
      this.getPageBands(dims, sectionIndex, 1, 1).bodyHeight,
      this.getPageBands(dims, sectionIndex, 2, 2).bodyHeight,
      this.getPageBands(dims, sectionIndex, 3, 3).bodyHeight
    );
  }
  /**
   * Builds a clone of a simple table wrapper containing a contiguous run of rows.
   * The caller supplies complete vertical-merge groups: no rowspan crosses a
   * fragment boundary.
   * Horizontal merges (colspan) are confined to their own row. `repeatedRows` (the table's
   * header rows, on a continuation) are copied in first, marked as repeats.
   */
  createSimpleTableFragment(wrapper, table, body, rows, retainAnchor, repeatedRows = []) {
    const wrapperClone = wrapper ? wrapper.cloneNode(false) : null;
    const tableClone = table.cloneNode(false);
    for (const child of Array.from(table.children)) {
      if (child !== body) {
        tableClone.appendChild(child.cloneNode(true));
      }
    }
    const bodyClone = body.cloneNode(false);
    for (const row of repeatedRows) {
      const repeat = row.cloneNode(true);
      this.makePresentationCopyInert(repeat, true);
      repeat.dataset.docxRepeatedHeaderRow = "true";
      bodyClone.appendChild(repeat);
    }
    for (const row of rows) {
      bodyClone.appendChild(row.cloneNode(true));
    }
    tableClone.appendChild(bodyClone);
    this.prepareTableFragment?.(tableClone);
    if (!retainAnchor) {
      wrapperClone?.removeAttribute("data-anchor");
      tableClone.removeAttribute("data-anchor");
    }
    if (!wrapperClone) return tableClone;
    if (retainAnchor) for (const sibling of Array.from(wrapper.children)) {
      if (sibling === table) break;
      wrapperClone.appendChild(sibling.cloneNode(true));
    }
    wrapperClone.appendChild(tableClone);
    return wrapperClone;
  }
  /**
   * The row counts after which a table may split: a boundary is safe only after every cell
   * starting above it has ended. Overlapping merges in different columns extend the same
   * indivisible group; HTML rowspan=0 extends through the remainder of the row section. The last
   * entry is always `rows.length`.
   */
  tableRowGroupEnds(rows) {
    const ends = [];
    let mergedEnd = 0;
    for (let index = 0; index < rows.length; index++) {
      this.checkpoint();
      for (const cell of Array.from(rows[index].cells)) {
        mergedEnd = Math.max(mergedEnd, cell.rowSpan === 0 ? rows.length : Math.min(rows.length, index + cell.rowSpan));
      }
      if (index + 1 >= mergedEnd) ends.push(index + 1);
    }
    return ends;
  }
  /**
   * How many leading rows are the table's header rows (`w:tblHeader`), which a split repeats at
   * the top of each continuation: the run must end at a safe boundary and leave rows to carry.
   */
  leadingHeaderRowCount(rows, ends) {
    let count = 0;
    while (count < rows.length && rows[count].dataset.docxHeaderRow === "true") count++;
    return count === rows.length || !ends.includes(count) ? 0 : count;
  }
  /**
   * Splits an oversized, ordinary table at row boundaries. This only participates
   * in the existing oversized-block fallback; unsupported tables keep the previous
   * overflow behavior rather than risking broken table semantics.
   *
   * Word repeats a table's leading run of header rows (`w:tblHeader`) at the top of every page
   * the table continues on, whatever their height rule (issue #1171), so each continuation
   * starts with copies of them. When the copies leave no room to split the table, it splits as
   * it did without them (`repeatHeaderRows` false).
   */
  trySplitSimpleOversizedTable(block, dims, sectionIndex, repeatHeaderRows = true) {
    const wrapper = block.element;
    if (wrapper.tagName !== "DIV" || block.keepWithNext || block.keepLines || block.pageBreakBefore || block.isPageBreak) {
      return null;
    }
    const table = this.blockTable(wrapper);
    if (!table) return null;
    const body = table.tBodies.length === 1 ? table.tBodies[0] : null;
    if (!body || table.tHead || table.tFoot || Array.from(table.children).some((child) => child !== body && child.tagName !== "COLGROUP") || table.querySelector("[data-footnote-id]") || wrapper.querySelector("[data-footnote-id]")) {
      return null;
    }
    const rows = Array.from(body.rows);
    const rowGroupEnds = this.tableRowGroupEnds(rows);
    const minimumContentHeight = this.smallestEffectiveContentHeight(dims, sectionIndex);
    const maximumFragmentHeight = minimumContentHeight - block.marginTopPt - block.marginBottomPt;
    if (maximumFragmentHeight <= 0) {
      return null;
    }
    if (this.capMinimumRowHeights(wrapper, table, body, rows, dims, maximumFragmentHeight)) {
      const capped = this.measureElement(wrapper, dims, block.sectionIndex);
      if (capped.heightPt <= maximumFragmentHeight) return [{
        ...block,
        ...capped,
        keepWithNext: false,
        keepLines: false,
        pageBreakBefore: false,
        isPageBreak: false
      }];
    }
    if (this.fragmentParagraphs) {
      const recovered = this.recoverOversizedMergedGroups(
        wrapper,
        table,
        body,
        rows,
        dims,
        sectionIndex,
        maximumFragmentHeight
      );
      if (recovered) return this.trySplitSimpleOversizedTable(
        { ...block, element: recovered },
        dims,
        sectionIndex,
        repeatHeaderRows
      );
      const host = !wrapper.isConnected ? this.document.createElement("div") : null;
      const candidate = host ? wrapper.cloneNode(true) : wrapper;
      if (host) {
        host.style.cssText = `position:absolute;visibility:hidden;left:-9999px;width:${dims.contentWidth}pt`;
        host.appendChild(candidate);
        this.stagingElement.appendChild(host);
      }
      try {
        const split = this.splitTableContent(candidate, (head) => this.measureElement(head, dims, block.sectionIndex).heightPt <= maximumFragmentHeight, false, true);
        if (split) {
          this.reconcileFragmentIdentities(split.head, split.tail);
          split.head.style.setProperty("margin-bottom", "0", "important");
          split.tail.style.setProperty("margin-top", "0", "important");
          return [split.head, split.tail].map((element) => ({
            ...this.measureElement(element, dims, block.sectionIndex),
            element,
            keepWithNext: false,
            keepLines: false,
            pageBreakBefore: false,
            isPageBreak: false
          }));
        }
      } finally {
        host?.remove();
      }
    }
    const headerCount = repeatHeaderRows ? this.leadingHeaderRowCount(rows, rowGroupEnds) : 0;
    const headerRows = rows.slice(0, headerCount);
    const withoutRepeats = () => {
      if (headerCount === 0) return null;
      const fragments2 = this.trySplitSimpleOversizedTable(block, dims, sectionIndex, false);
      if (fragments2 && headerRows.some((row) => row.querySelector(EXACT_ROW_CELL) !== null && !rowFits(row))) {
        fragments2.push({
          ...block,
          element: this.document.createElement("div"),
          heightPt: 0,
          marginTopPt: 0,
          marginBottomPt: 0,
          keepWithNext: false,
          keepLines: false,
          pageBreakBefore: false,
          isPageBreak: true
        });
      }
      return fragments2;
    };
    const groups = [];
    const oversizedGroups = /* @__PURE__ */ new Set();
    const rowFits = (row) => this.measureElement(
      this.createSimpleTableFragment(wrapper, table, body, [row], true),
      dims,
      block.sectionIndex
    ).heightPt <= maximumFragmentHeight;
    let start = 0;
    let boundaryIndex = 0;
    while (start < rows.length) {
      this.checkpoint();
      let end = start;
      while (boundaryIndex < rowGroupEnds.length) {
        this.checkpoint();
        const candidateEnd = rowGroupEnds[boundaryIndex];
        const candidate = this.createSimpleTableFragment(
          wrapper,
          table,
          body,
          rows.slice(start, candidateEnd),
          start === 0,
          start === 0 ? [] : headerRows
        );
        const measured = this.measureElement(candidate, dims, block.sectionIndex);
        if (measured.heightPt > maximumFragmentHeight) {
          break;
        }
        end = candidateEnd;
        boundaryIndex++;
      }
      if (headerCount > 0 && (end === start || start === 0 && end <= headerCount)) {
        return withoutRepeats();
      }
      if (end === start) {
        const row = rows[start];
        if (rowGroupEnds[boundaryIndex] !== start + 1) return null;
        for (const piece of this.splitRowAtBlocks(row, rowFits)) {
          const group = [piece.row];
          groups.push(group);
          if (piece.oversized) oversizedGroups.add(group);
        }
        start++;
        boundaryIndex++;
        continue;
      }
      groups.push(rows.slice(start, end));
      start = end;
    }
    if (groups.length < 2) {
      return withoutRepeats();
    }
    const fragments = [];
    for (let index = 0; index < groups.length; index++) {
      const isFirst = index === 0;
      const isLast = index === groups.length - 1;
      const fragment = this.createSimpleTableFragment(
        wrapper,
        table,
        body,
        groups[index],
        isFirst,
        isFirst ? [] : headerRows
      );
      if (!isFirst) {
        fragment.style.setProperty("margin-top", "0", "important");
      }
      if (!isLast) {
        fragment.style.setProperty("margin-bottom", "0", "important");
      }
      const measured = this.measureElement(fragment, dims, block.sectionIndex);
      if (!oversizedGroups.has(groups[index]) && measured.heightPt + measured.marginTopPt + measured.marginBottomPt > minimumContentHeight) {
        return withoutRepeats();
      }
      fragments.push({
        ...measured,
        keepWithNext: false,
        keepLines: false,
        pageBreakBefore: false,
        isPageBreak: false
      });
    }
    return fragments;
  }
  /**
   * A vertical merge taller than a fresh page has no legal whole-group boundary. Materialize
   * its occupied grid slots as rows: source content stays once at its starting row and empty
   * presentation cells carry the remaining span. The ordinary row/cell fragmenter then owns
   * continuation. Fitting merges, repeated-header groups and authored exact-height rows stay intact.
   */
  recoverOversizedMergedGroups(wrapper, table, body, rows, dims, sectionIndex, maximumHeight) {
    let recovered = null;
    let start = 0;
    for (const end of this.tableRowGroupEnds(rows)) {
      this.checkpoint();
      const group = rows.slice(start, end);
      const first = start;
      start = end;
      if (group.length < 2 || group.some((row) => row.dataset.docxHeaderRow === "true" || row.dataset.docxRowHeightRule === "exact" || row.querySelector(EXACT_ROW_CELL))) continue;
      const sample = this.createSimpleTableFragment(wrapper, table, body, group, true);
      if (this.measureElement(sample, dims, sectionIndex).heightPt <= maximumHeight) continue;
      recovered ??= wrapper.cloneNode(true);
      const target = this.blockTable(recovered).tBodies[0];
      let slots = [];
      for (let index = 0; index < group.length; index++) {
        this.checkpoint();
        const row = group[index];
        let column = 0;
        for (const cell of Array.from(row.cells)) {
          let occupying;
          while (occupying = slots.find((slot) => slot.from < index && slot.to > index && column >= slot.column && column < slot.column + slot.cell.colSpan)) {
            column = occupying.column + occupying.cell.colSpan;
          }
          slots.push({
            cell,
            column,
            from: index,
            to: cell.rowSpan === 0 ? group.length : Math.min(group.length, index + cell.rowSpan)
          });
          column += cell.colSpan;
        }
        const clone = row.cloneNode(false);
        for (const slot of slots.filter((slot2) => slot2.from <= index && slot2.to > index).sort((a, b) => a.column - b.column)) {
          const cell = slot.cell.cloneNode(slot.from === index);
          cell.removeAttribute("rowspan");
          if (slot.from !== index) {
            this.makePresentationCopyInert(cell, false);
            cell.style.setProperty("border-top", "0", "important");
          }
          if (slot.to > index + 1) cell.style.setProperty("border-bottom", "0", "important");
          clone.appendChild(cell);
        }
        target.rows[first + index].replaceWith(clone);
        slots = slots.filter((slot) => slot.to > index + 1);
      }
    }
    return recovered;
  }
  /**
   * Lowers the minimum of each `atLeast` row whose minimum alone makes the row taller than
   * `maximumHeight` until it fits, and reports whether any changed. Content still sets its height.
   */
  capMinimumRowHeights(wrapper, table, body, rows, dims, maximumHeight) {
    const minimums = rows.filter((row) => row.dataset.docxRowHeightRule === "atLeast");
    if (minimums.length === 0) return false;
    const empty = minimums.map((row) => {
      const clone = row.cloneNode(false);
      for (const cell of Array.from(row.cells)) clone.appendChild(cell.cloneNode(false));
      return clone;
    });
    const host = this.document.createElement("div");
    host.style.cssText = `position:absolute;visibility:hidden;left:-9999px;width:${dims.contentWidth}pt`;
    const probe = host.appendChild(this.createSimpleTableFragment(wrapper, table, body, empty, false));
    this.stagingElement.appendChild(host);
    const heights = Array.from(this.blockTable(probe).rows, (row) => pxToPt(row.getBoundingClientRect().height));
    const chrome = pxToPt(probe.getBoundingClientRect().height) - heights.reduce((sum, height) => sum + height, 0);
    host.remove();
    let capped = false;
    minimums.forEach((row, index) => {
      const excess = chrome + heights[index] - maximumHeight;
      if (!(excess > 0)) return;
      const lower = excess + 0.25;
      row.style.setProperty("height", `${Math.max(0, heights[index] - lower)}pt`, "important");
      const source = row.dataset.docxSourceRowHeight;
      if (source) row.dataset.docxSourceRowHeight = String(Math.max(0, Number(source) - lower));
      capped = true;
    });
    return capped;
  }
  /**
   * Cuts a row taller than a page into rows that each fit one (`fits`), as Word breaks such a row
   * (issue #1202): every cell keeps, in order, the blocks it holds, and a cell whose blocks are all
   * placed is left empty. A block taller than a page is a piece of its own, marked `oversized`. An
   * exact-height row is not cut: Word starts it on a new page and clips it there. Neither is a row
   * whose cells hold anything but blocks.
   */
  splitRowAtBlocks(row, fits) {
    const cells = Array.from(row.cells);
    const whole = [{ row, oversized: true }];
    if (cells.some((cell) => cell.querySelector(`:scope > ${EXACT_ROW_CELL}`))) return whole;
    const pending = cells.map((cell) => Array.from(cell.childNodes));
    if (pending.some((nodes) => nodes.some((node) => node.nodeType !== this.view.Node.ELEMENT_NODE && (node.nodeType !== this.view.Node.TEXT_NODE || (node.textContent ?? "").trim() !== "")))) return whole;
    const blocks = pending.map((nodes) => nodes.filter((node) => node.nodeType === this.view.Node.ELEMENT_NODE));
    const build = (parts, first) => {
      const piece = row.cloneNode(false);
      cells.forEach((cell, index) => {
        const clone = cell.cloneNode(false);
        for (const element of parts[index]) clone.appendChild(element.cloneNode(true));
        if (!first) {
          clone.removeAttribute("id");
          clone.removeAttribute("data-anchor");
        }
        piece.appendChild(clone);
      });
      if (!first) {
        piece.removeAttribute("id");
        piece.removeAttribute("data-anchor");
      }
      return piece;
    };
    const pieces = [];
    while (blocks.some((list) => list.length > 0)) {
      this.checkpoint();
      let take = blocks.map((list, index) => {
        let count = 0;
        while (count < list.length && fits(build(blocks.map((other, j) => j === index ? list.slice(0, count + 1) : []), true))) count++;
        return count;
      });
      const oversized = take.every((count) => count === 0);
      if (oversized) take = blocks.map((list) => Math.min(1, list.length));
      pieces.push({ row: build(blocks.map((list, index) => list.slice(0, take[index])), pieces.length === 0), oversized });
      blocks.forEach((list, index) => list.splice(0, take[index]));
    }
    return pieces.length > 0 ? pieces : whole;
  }
  /**
   * DOM endpoints that can finish a paragraph fragment. The flattened UTF-16
   * offsets are checked against the browser's Unicode grapheme segmenter, so a
   * formatting-run boundary can never bisect a surrogate pair, combining
   * sequence, or joined emoji. NBSP/word-joiner boundaries remain indivisible.
   * PAGE/NUMPAGES field results are atomic because splitting their marker would
   * make later substitution duplicate or replace only half of the field.
   */
  paragraphFragmentEndpoints(paragraph, emergencyGraphemeBreaks = false) {
    if (paragraph.hasAttribute("data-docx-mixed-lines")) {
      const endpoints2 = [];
      const walker2 = this.document.createTreeWalker(
        paragraph,
        this.view.NodeFilter.SHOW_TEXT | this.view.NodeFilter.SHOW_ELEMENT
      );
      let textOffset = 0, pending = false;
      for (let node2 = walker2.nextNode(); node2; node2 = walker2.nextNode()) {
        this.checkpoint();
        if (node2 instanceof this.view.HTMLElement && isMixedLineMetric(node2)) pending = true;
        if (node2.nodeType !== this.view.Node.TEXT_NODE) continue;
        const text = node2.data;
        const spaces = /^\s*/u.exec(text)[0].length;
        if (pending && spaces < text.length) {
          endpoints2.push({ node: node2, offset: spaces, textOffset: textOffset + spaces, priority: 2 });
          pending = false;
        }
        textOffset += text.length;
      }
      return endpoints2;
    }
    const textNodes2 = [];
    const textStarts = /* @__PURE__ */ new Map();
    const lastTextByAtomic = /* @__PURE__ */ new Map();
    const layoutAtoms = this.rangeAtomicInlineBoxes(paragraph);
    const mathAtoms = new Set(Array.from(layoutAtoms).filter((atom) => atom.dataset.docxMath === "true"));
    const atomicAncestor = (element) => {
      let outer = null;
      for (let current = element; current && current !== paragraph; current = current.parentElement) {
        if (layoutAtoms.has(current) || current.matches("[data-field], [data-docx-word-line=true], [data-docx-frame-line]")) {
          outer = current;
        }
      }
      return outer;
    };
    const breaks = [];
    const images = [];
    const drawings = new Set(this.fragmentDrawingBoxes(paragraph));
    const walker = this.document.createTreeWalker(
      paragraph,
      this.view.NodeFilter.SHOW_TEXT | this.view.NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node2) => drawings.has(node2) || mathAtoms.has(node2.parentElement) ? this.view.NodeFilter.FILTER_REJECT : this.view.NodeFilter.FILTER_ACCEPT
      }
    );
    const flattenedChunks = [];
    let flattenedLength = 0;
    let node;
    while (node = walker.nextNode()) {
      this.checkpoint();
      if (node.nodeType === this.view.Node.ELEMENT_NODE) {
        if (node.localName === "br") {
          breaks.push({ element: node, textOffset: flattenedLength });
          flattenedChunks.push("\n");
          flattenedLength++;
        } else if (node.localName === "img" || mathAtoms.has(node)) {
          images.push({ element: node, textOffset: flattenedLength });
          flattenedChunks.push("\uFFFC");
          flattenedLength++;
        }
        continue;
      }
      const textNode = node;
      textStarts.set(textNode, flattenedLength);
      textNodes2.push(textNode);
      flattenedChunks.push(textNode.data);
      flattenedLength += textNode.data.length;
      const field = atomicAncestor(textNode.parentElement);
      if (field) lastTextByAtomic.set(field, textNode);
    }
    const flattenedText = flattenedChunks.join("");
    if (!this.hasVisibleText(flattenedText)) return [];
    const invisible = /[\s\u200B-\u200F\uFEFF]/;
    let firstVisibleOffset = -1;
    let lastVisibleOffset = -1;
    for (let index = 0; index < flattenedText.length; index++) {
      if (index % 4096 === 0) this.checkpoint();
      if (invisible.test(flattenedText[index])) continue;
      if (firstVisibleOffset < 0) firstVisibleOffset = index;
      lastVisibleOffset = index;
    }
    const graphemeBoundaries = this.graphemeBoundaryOffsets(flattenedText);
    const candidates = [];
    const addCandidate = (candidate) => {
      const { textOffset } = candidate;
      if (textOffset <= 0 || textOffset >= flattenedText.length) return;
      if (textOffset <= firstVisibleOffset || textOffset > lastVisibleOffset) return;
      if (!candidate.consumeBreak && this.isNonBreakingTextBoundary(flattenedText, textOffset)) return;
      if (!this.isLegalParagraphLineBoundary(paragraph, flattenedText, textOffset)) return;
      if (graphemeBoundaries) {
        if (!graphemeBoundaries.has(textOffset)) return;
      } else if (!candidate.consumeBreak && flattenedText[textOffset - 1] !== "\uFFFC" && flattenedText[textOffset] !== "\uFFFC" && !this.isConservativeFallbackTextBoundary(flattenedText, textOffset)) {
        return;
      }
      candidates.push(candidate);
    };
    for (const { element, textOffset } of images) {
      this.checkpoint();
      if (atomicAncestor(element.parentElement) || element.closest("[data-list-marker], a[data-comment-id]")) continue;
      const parent = element.parentNode;
      if (!parent) continue;
      const offset = Array.prototype.indexOf.call(parent.childNodes, element);
      addCandidate({ node: parent, offset, textOffset, priority: 1 });
      addCandidate({ node: parent, offset: offset + 1, textOffset: textOffset + 1, priority: 1 });
    }
    for (const { element, textOffset } of breaks) {
      this.checkpoint();
      if (atomicAncestor(element) || element.closest("[data-list-marker], a[data-comment-id]") || flattenedText[textOffset - 1] === "\n") continue;
      const parent = element.parentNode;
      if (!parent) continue;
      addCandidate({
        node: parent,
        offset: Array.prototype.indexOf.call(parent.childNodes, element),
        textOffset,
        priority: 2,
        consumeBreak: true
      });
    }
    for (const node2 of textNodes2) {
      this.checkpoint();
      const start = textStarts.get(node2);
      const atomic = node2.parentElement?.closest(
        "[data-field], [data-list-marker], a[data-comment-id], [data-docx-word-line=true], [data-docx-frame-line]"
      );
      if (atomicAncestor(node2.parentElement) || atomic && paragraph.contains(atomic)) continue;
      const whitespace = /[\u0009-\u000D\u0020]+/g;
      let match;
      let matchesSinceCheckpoint = 0;
      while ((match = whitespace.exec(node2.data)) !== null) {
        if (++matchesSinceCheckpoint % 256 === 0) this.checkpoint();
        const offset = match.index + match[0].length;
        addCandidate({ node: node2, offset, textOffset: start + offset, priority: 0 });
      }
      addCandidate({
        node: node2,
        offset: node2.data.length,
        textOffset: start + node2.data.length,
        priority: 0
      });
      if (emergencyGraphemeBreaks) {
        for (let offset = 1; offset < node2.data.length; offset++) {
          if (offset % 256 === 0) this.checkpoint();
          addCandidate({
            node: node2,
            offset,
            textOffset: start + offset,
            priority: -1
          });
        }
      }
    }
    for (const [field, last] of lastTextByAtomic) {
      this.checkpoint();
      const parent = field.parentNode;
      if (!last || !parent) continue;
      const childIndex = Array.prototype.indexOf.call(parent.childNodes, field);
      if (childIndex < 0) continue;
      addCandidate({
        node: parent,
        offset: childIndex + 1,
        textOffset: textStarts.get(last) + last.data.length,
        priority: 1
      });
    }
    candidates.sort((left, right) => left.textOffset - right.textOffset || right.priority - left.priority);
    const endpoints = [];
    for (const candidate of candidates) {
      if (endpoints[endpoints.length - 1]?.textOffset !== candidate.textOffset) {
        endpoints.push(candidate);
      }
    }
    return endpoints;
  }
  /** Browser-native UAX #29 boundaries; null keeps older runtimes conservative. */
  graphemeBoundaryOffsets(text) {
    const SegmenterConstructor = this.view.Intl.Segmenter;
    if (!SegmenterConstructor) return null;
    const boundaries = /* @__PURE__ */ new Set([0, text.length]);
    let segmentCount = 0;
    for (const part of new SegmenterConstructor("en", { granularity: "grapheme" }).segment(text)) {
      if (++segmentCount % 256 === 0) this.checkpoint();
      boundaries.add(part.index);
      boundaries.add(part.index + part.segment.length);
    }
    return boundaries;
  }
  /**
   * Conservative UAX #14/CSS wrapping opportunities used for synthetic page
   * boundaries. In particular, a formatting-run boundary is not itself a word
   * boundary, and Japanese opening/closing punctuation stays with its pair.
   * Arbitrary grapheme breaks are admitted only when the paragraph's CSS asks
   * the browser to wrap anywhere.
   */
  isLegalParagraphLineBoundary(paragraph, text, offset) {
    const lastCodeUnit = text.charCodeAt(offset - 1);
    const beforeOffset = lastCodeUnit >= 56320 && lastCodeUnit <= 57343 ? Math.max(0, offset - 2) : offset - 1;
    const beforeCodePoint = text.codePointAt(beforeOffset);
    const afterCodePoint = text.codePointAt(offset);
    const before = beforeCodePoint === void 0 ? "" : String.fromCodePoint(beforeCodePoint);
    const after = afterCodePoint === void 0 ? "" : String.fromCodePoint(afterCodePoint);
    if (/^[\u0009-\u000D\u0020]$/.test(before) || /^[\u0009-\u000D\u0020]$/.test(after)) return true;
    if (/[-\u00AD\u2010]$/u.test(before)) return true;
    if (before === "\uFFFC" || after === "\uFFFC") return true;
    const style = this.view.getComputedStyle(paragraph);
    if (style.wordBreak === "break-all" || style.overflowWrap === "anywhere" || style.overflowWrap === "break-word") return true;
    const eastAsian = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
    if (!eastAsian.test(before) && !eastAsian.test(after)) return false;
    const opening = "([{<\u2018\u201C\u3008\u300A\u300C\u300E\u3010\u3014\u3016\u3018\u301A\uFF08\uFF3B\uFF5B";
    const closing = ")]}>\u2019\u201D\u3001\u3002\u3009\u300B\u300D\u300F\u3011\u3015\u3017\u3019\u301B\uFF01\uFF05\uFF09\uFF0C\uFF0E\uFF1A\uFF1B\uFF1F\uFF3D\uFF5D";
    return !opening.includes(before) && !closing.includes(after);
  }
  /** Never fragment across characters whose line-break meaning is explicitly non-breaking. */
  isNonBreakingTextBoundary(text, offset) {
    const codePointBefore = (index) => {
      if (index <= 0) return void 0;
      const last = text.charCodeAt(index - 1);
      const start = last >= 56320 && last <= 57343 ? index - 2 : index - 1;
      return text.codePointAt(Math.max(0, start));
    };
    const nonBreaking = /* @__PURE__ */ new Set([
      160,
      8206,
      8207,
      8209,
      8234,
      8235,
      8236,
      8237,
      8238,
      8239,
      8288,
      8294,
      8295,
      8296,
      8297,
      65279
    ]);
    return nonBreaking.has(codePointBefore(offset) ?? -1) || nonBreaking.has(text.codePointAt(offset) ?? -1);
  }
  /**
   * Without Intl.Segmenter, admit only an all-ASCII boundary. This still
   * fragments ordinary prose while refusing to guess about Unicode clusters.
   */
  isConservativeFallbackTextBoundary(text, offset) {
    return text.charCodeAt(offset - 1) <= 127 && text.charCodeAt(offset) <= 127;
  }
  /**
   * Whether a range retains visible text or a whole inline image.
   */
  hasVisibleFragmentContent(fragment) {
    return this.hasVisibleText(fragment.textContent || "") || fragment.querySelector("img") !== null;
  }
  hasVisibleText(text) {
    return text.replace(/[\u200B-\u200F\uFEFF]/g, "").trim().length > 0;
  }
  /**
   * Text, hard line breaks and whole inline images share Range fragmentation.
   * Out-of-flow objects and richer inline boxes retain their dedicated layout rules.
   */
  canFragmentParagraph(block, relaxKeepLines = false, relaxKeepWithNext = false) {
    if (!this.fragmentParagraphs) {
      return false;
    }
    const paragraph = block.element;
    if (block.keepWithNext && !relaxKeepWithNext || block.keepLines && !relaxKeepLines && !block.relaxedKeepLines || block.pageBreakBefore || block.isPageBreak || paragraph.hasAttribute("contenteditable")) {
      return false;
    }
    return this.canRangeFragmentParagraph(
      paragraph,
      false,
      true,
      relaxKeepLines || block.relaxedKeepLines === true,
      false,
      false,
      relaxKeepWithNext
    );
  }
  /**
   * Shared structural gate for body and note paragraph fragmentation. Footnote
   * first paragraphs are inline beside their marker, so that one known layout
   * context may opt into an inline root while retaining every descendant and
   * break-safety restriction used for body text.
   */
  canRangeFragmentParagraph(paragraph, allowInlineRoot = false, bodyParagraph = false, relaxKeepLines = false, terminalCellParagraph = false, textBoxParagraph = false, relaxKeepWithNext = false, drawings = this.fragmentDrawingBoxes(paragraph, bodyParagraph)) {
    const wordParagraph = textBoxParagraph ? paragraph.localName === "span" && paragraph.dataset.docxTextboxParagraph === "true" : bodyParagraph ? this.isWordParagraphElement(paragraph) : paragraph.tagName === "P";
    if (!wordParagraph || paragraph.dataset.keepWithNext === "true" && !terminalCellParagraph && !relaxKeepWithNext || paragraph.dataset.keepLines === "true" && !relaxKeepLines || paragraph.dataset.pageBreakBefore === "true" || paragraph.hasAttribute("contenteditable")) {
      return false;
    }
    const unsupportedDescendants = [
      ...bodyParagraph || textBoxParagraph ? [] : ["img"],
      "picture",
      "svg",
      "math",
      "canvas",
      "video",
      "audio",
      "iframe",
      "object",
      "embed",
      "input",
      "button",
      "select",
      "textarea",
      "table",
      "ol",
      "ul",
      "li",
      "dl",
      "div",
      "p",
      "section",
      "article",
      "aside",
      "figure",
      "fieldset",
      "details",
      ...bodyParagraph ? [] : ["[data-footnote-id]"],
      "[contenteditable]"
    ].join(", ");
    const atoms = this.rangeAtomicInlineBoxes(paragraph);
    if (Array.from(paragraph.querySelectorAll(unsupportedDescendants)).some((element) => !drawings.some((drawing) => drawing.contains(element)) && !(element.localName === "math" && Array.from(atoms).some((atom) => atom.dataset.docxMath === "true" && atom.contains(element))))) {
      return false;
    }
    for (const image of Array.from(paragraph.querySelectorAll("img"))) {
      const drawing = drawings.find((drawing2) => drawing2.contains(image));
      if (drawing?.dataset.docxDrawingAnchor === "true") continue;
      if (image.closest("[data-field], [data-list-marker], a[data-comment-id]")) return false;
      if (!(image.getBoundingClientRect().width > 0 && image.getBoundingClientRect().height > 0)) return false;
      for (let carrier = image; carrier && carrier !== paragraph && carrier !== drawing; carrier = carrier.parentElement) {
        const style = this.view.getComputedStyle(carrier);
        if (style.display !== "inline" || !this.hasRangeFragmentSafePosition(carrier, style) || style.float !== "none" || style.transform !== "none") return false;
      }
    }
    const isValidatedEndnote = paragraph.dataset.paginationSafeEndnote === "true";
    return isValidatedEndnote || this.hasRangeFragmentSafeLayout(paragraph, allowInlineRoot, relaxKeepLines, relaxKeepWithNext, drawings);
  }
  /** The converter's automatic-spacing lift moves ink without changing inline line boxes. */
  hasRangeFragmentSafePosition(element, style) {
    const spacing = parseFloat(style.getPropertyValue("--docx-auto-line-spacing"));
    const automaticBaseline = spacing > 0 && spacing !== 1 && parseFloat(style.top) <= 0;
    const grid = parseFloat(element.style.getPropertyValue("--docx-word-grid-height"));
    const natural = parseFloat(element.style.getPropertyValue("--docx-word-native-height"));
    const gridBaseline = natural > 0 && grid >= natural && Math.abs(parseFloat(style.lineHeight) - grid) < 1e-3 && Math.abs(parseFloat(style.top)) < 1e-3;
    const imageCarrier = element.localName !== "img" && !!element.querySelector("img") && !this.hasVisibleText(element.textContent ?? "");
    return style.position === "static" || style.position === "relative" && (automaticBaseline || gridBaseline || imageCarrier) && (style.left === "auto" || parseFloat(style.left) === 0) && (style.right === "auto" || parseFloat(style.right) === 0);
  }
  /** A single edge picture can exclude space from the beginning of its source fragment. */
  canReflowEdgePicture(paragraph) {
    if (paragraph.closest("table, section.endnotes, [data-footnote-id], [data-comment-id], [data-hf-type], [data-docx-textbox], [data-docx-text-frame], [data-pagination-columns], #pagination-hf-registry, #pagination-footnote-registry, #pagination-comment-margin-registry") || paragraph.querySelector("[data-footnote-id], [data-docx-drawing-anchor]") || paragraph.querySelectorAll("img").length !== 1 || paragraph.querySelectorAll('[data-docx-edge-picture="true"]').length !== 1) return false;
    const drawing = paragraph.querySelector('[data-docx-edge-picture="true"]');
    for (let carrier = drawing.parentElement; carrier && carrier !== paragraph; carrier = carrier.parentElement) {
      const style = this.view.getComputedStyle(carrier);
      if (style.position !== "static" || style.transform !== "none" || style.translate !== "none" || style.rotate !== "none" || style.scale !== "none" || style.filter !== "none" || style.backdropFilter !== "none" || style.perspective !== "none" || style.contain !== "none" || style.containerType !== "normal" || style.willChange !== "auto") return false;
    }
    return true;
  }
  isLeadingDrawing(paragraph, drawing) {
    for (let node = drawing; node !== paragraph; node = node.parentNode)
      for (let sibling = node.previousSibling; sibling; sibling = sibling.previousSibling)
        if (sibling.nodeType === this.view.Node.ELEMENT_NODE || sibling.nodeType === this.view.Node.TEXT_NODE && sibling.textContent !== "") return false;
    return true;
  }
  /** Resolve the float while attached, retaining the picture at its original Range position. */
  prepareBodyEdgePictures(section) {
    for (const paragraph of Array.from(section.querySelectorAll("p,h1,h2,h3,h4,h5,h6"))) {
      this.checkpoint();
      const drawing = paragraph.querySelector('[data-docx-edge-picture="true"]');
      if (!drawing || !this.canReflowEdgePicture(paragraph) || !drawing.hasAttribute("data-docx-fragment-edge") && this.isLeadingDrawing(paragraph, drawing) || !this.canRangeFragmentParagraph(
        paragraph,
        false,
        true,
        true,
        false,
        false,
        false,
        this.fragmentDrawingBoxes(paragraph, true, true)
      )) continue;
      const style = this.view.getComputedStyle(drawing);
      const proxy = this.document.createElement("span");
      proxy.style.cssText = drawing.getAttribute("data-docx-fragment-edge") ?? "";
      if (style.float !== "none") proxy.style.float = style.float;
      for (const property of [
        "width",
        "height",
        "margin-top",
        "margin-right",
        "margin-bottom",
        "margin-left",
        "shape-outside",
        "shape-margin"
      ]) proxy.style.setProperty(property, style.getPropertyValue(property));
      drawing.setAttribute("data-docx-fragment-edge", proxy.style.cssText);
      this.rebuildEdgeExclusion(paragraph);
    }
  }
  /** A cloned prefix excludes only pictures actually retained by that prefix's raw Range. */
  rebuildEdgeExclusion(paragraph) {
    for (const proxy of Array.from(paragraph.querySelectorAll("[data-docx-edge-exclusion]"))) proxy.remove();
    for (const drawing of Array.from(paragraph.querySelectorAll("[data-docx-fragment-edge]"))) {
      const proxy = this.document.createElement("span");
      proxy.setAttribute("data-docx-edge-exclusion", "true");
      proxy.setAttribute("aria-hidden", "true");
      proxy.style.cssText = drawing.getAttribute("data-docx-fragment-edge");
      paragraph.prepend(proxy);
      paragraph.style.position = "relative";
      drawing.style.position = "absolute";
      drawing.style.float = "none";
      drawing.style.top = "0";
      drawing.style.setProperty(proxy.style.float, "0");
    }
  }
  edgeExclusionsMatch(element) {
    return Array.from(element.querySelectorAll("[data-docx-fragment-edge]")).every((drawing) => {
      this.checkpoint();
      const proxy = drawing.closest("p,h1,h2,h3,h4,h5,h6")?.querySelector(":scope > [data-docx-edge-exclusion]");
      if (!proxy) return false;
      const ink = drawing.getBoundingClientRect(), exclusion = proxy.getBoundingClientRect();
      return ["left", "top", "width", "height"].every((axis) => Math.abs(ink[axis] - exclusion[axis]) < 0.1);
    });
  }
  /** Fixed-base anchors follow their source Range. Edge pictures retain that same ownership
   * while a separate empty float reflows the destination fragment from its beginning. */
  fragmentDrawingBoxes(paragraph, bodyParagraph = true, preparingEdge = false) {
    return Array.from(paragraph.querySelectorAll(
      '[data-docx-drawing-anchor="true"], [data-docx-edge-picture="true"]'
    )).filter((drawing) => {
      const style = this.view.getComputedStyle(drawing);
      if (drawing.dataset.docxDrawingAnchor === "true") {
        if (drawing.dataset.docxAnchorWrap !== "wrapNone" || drawing.dataset.docxAnchorHRelative === "character" || drawing.dataset.docxAnchorVRelative === "line" || drawing.dataset.docxAnchorVRelative === "paragraph" && drawing.hasAttribute("data-docx-anchor-v-align") || style.position !== "absolute" || style.float !== "none") return false;
        if (bodyParagraph) return true;
      } else if (!bodyParagraph || !(style.position === "static" && ["left", "right"].includes(style.float) || drawing.hasAttribute("data-docx-fragment-edge") && style.position === "absolute" && style.float === "none") || style.transform !== "none" || style.translate !== "none" || style.rotate !== "none" || style.scale !== "none" || drawing.children.length !== 1 || drawing.firstElementChild?.localName !== "img" || this.hasVisibleText(drawing.textContent ?? "")) return false;
      else if ((preparingEdge || drawing.hasAttribute("data-docx-fragment-edge")) && this.canReflowEdgePicture(paragraph)) return true;
      return this.isLeadingDrawing(paragraph, drawing);
    });
  }
  /**
   * Boxes that move whole: an inline block (a converter shape, text box or ruby pair) lays out its
   * content in its own formatting context, and converter tab segments, inline math and fitted text
   * are likewise single units. Range endpoints never enter one, so it keeps its inner layout.
   */
  rangeAtomicInlineBoxes(paragraph) {
    const boxes = /* @__PURE__ */ new Set();
    for (const marker of Array.from(paragraph.querySelectorAll("span"))) {
      if (isMixedLineMetric(marker)) {
        boxes.add(marker);
        continue;
      }
      if (marker.hasAttribute("data-docx-frame-line")) {
        boxes.add(marker);
        continue;
      }
      let box = marker;
      const fitted = marker.hasAttribute("data-docx-fit-text-group");
      if (fitted) {
        if (!isFitTextInlineBox(marker)) continue;
      } else if (marker.dataset.docxMath === "true") {
        const math = marker.firstElementChild;
        if (marker.childNodes.length !== 1 || math?.localName !== "math" || math.getAttribute("display") !== "inline" || this.view.getComputedStyle(marker).display !== "inline" || [math, ...Array.from(math.querySelectorAll("*"))].some((element) => element.namespaceURI !== "http://www.w3.org/1998/Math/MathML" || !CONVERTER_MATHML_ELEMENTS.test(element.localName))) continue;
      } else if (marker.hasAttribute("data-docx-tab")) {
        if (marker.childNodes.length || this.view.getComputedStyle(marker).height !== "0px") continue;
        for (box = marker.parentElement; box && box !== paragraph; box = box.parentElement) {
          if (this.view.getComputedStyle(box).display === "inline-flex") break;
        }
        if (!box || box === paragraph) continue;
      } else if (marker.dataset.docxRuby === "true" && (marker.children.length !== 1 || marker.firstElementChild?.localName !== "ruby") || this.view.getComputedStyle(marker).display !== "inline-block") {
        continue;
      }
      if (box.localName !== "span" || box.querySelector("br, img")) continue;
      if ([box, ...Array.from(box.querySelectorAll("*"))].some((element) => {
        const style = this.view.getComputedStyle(element);
        const rubyAnnotation = marker.dataset.docxRuby === "true" && element.localName === "rt" && style.position === "relative" && (style.left === "auto" || parseFloat(style.left) === 0);
        return !rubyAnnotation && !this.hasRangeFragmentSafePosition(element, style) || style.float !== "none" || style.transform !== "none" && !(fitted && element === marker.firstElementChild);
      })) continue;
      boxes.add(box);
    }
    return boxes;
  }
  /**
   * A range clone preserves nested inline formatting exactly. Anything that establishes its own
   * box/layout context is deferred until a future fragmenter can model it accurately. Callers
   * must invoke this while the paragraph is attached to the styled document.
   */
  hasRangeFragmentSafeLayout(paragraph, allowInlineRoot = false, relaxKeepLines = false, relaxKeepWithNext = false, drawings = this.fragmentDrawingBoxes(paragraph, false)) {
    const paragraphStyle = this.view.getComputedStyle(paragraph);
    const avoidAfter = relaxKeepWithNext && paragraph.dataset.keepWithNext === "true";
    const unshiftedHost = paragraphStyle.position === "relative" && paragraphStyle.transform === "none" && paragraphStyle.translate === "none" && paragraphStyle.rotate === "none" && paragraphStyle.scale === "none" && ["top", "right", "bottom", "left"].every((side) => paragraphStyle.getPropertyValue(side) === "auto" || parseFloat(paragraphStyle.getPropertyValue(side)) === 0);
    if (paragraphStyle.display !== "block" && !(allowInlineRoot && paragraphStyle.display === "inline") || paragraphStyle.position !== "static" && !unshiftedHost || paragraphStyle.float !== "none" || paragraphStyle.whiteSpace !== "normal" && paragraphStyle.whiteSpace !== "pre-wrap" || paragraphStyle.breakBefore !== "auto" || paragraphStyle.breakAfter !== "auto" && !(avoidAfter && paragraphStyle.breakAfter === "avoid") || paragraphStyle.breakInside === "avoid" && !relaxKeepLines || paragraphStyle.pageBreakBefore !== "auto" || paragraphStyle.pageBreakAfter !== "auto" && !(avoidAfter && paragraphStyle.pageBreakAfter === "avoid") || paragraphStyle.pageBreakInside === "avoid" && !relaxKeepLines) {
      return false;
    }
    if (Array.from(paragraph.querySelectorAll("[data-docx-drawing-anchor]")).some((drawing) => !drawings.includes(drawing))) return false;
    const leading = /* @__PURE__ */ new Set([...this.leadingAtomicBoxes(paragraph), ...this.rangeAtomicInlineBoxes(paragraph), ...drawings]);
    for (const descendant of Array.from(paragraph.querySelectorAll("*"))) {
      let carrier = descendant;
      while (carrier && carrier !== paragraph && !leading.has(carrier)) carrier = carrier.parentElement;
      if (carrier && leading.has(carrier)) continue;
      const style = this.view.getComputedStyle(descendant);
      const wordLine = descendant.dataset.docxWordLine === "true" && Number(descendant.parentElement.dataset.docxWordFit) > 0 && descendant.children.length === 0;
      const tab = descendant.hasAttribute("data-docx-tab") && descendant.childNodes.length === 0 && style.height === "0px";
      if (style.display !== "inline" && !(wordLine && style.display === "block") && !(tab && style.display === "inline-block") || !this.hasRangeFragmentSafePosition(descendant, style) || style.float !== "none" || style.whiteSpace !== "normal" && style.whiteSpace !== "pre-wrap" && !(wordLine && style.whiteSpace === "pre")) {
        return false;
      }
      if (descendant.localName === "br" && (style.clear !== "none" || style.breakBefore !== "auto" || style.breakAfter !== "auto")) return false;
    }
    return true;
  }
  /**
   * Whether the text after `endpoint` begins a new visual line of the laid-out `paragraph`: the
   * nearest glyph after it sits lower than the nearest glyph before it by more than half a line.
   * A raised citation number in the middle of a line sits higher, so it stays on its line.
   */
  startsVisualLine(paragraph, endpoint) {
    if (paragraph.hasAttribute("data-docx-mixed-lines")) return true;
    if (endpoint.consumeBreak) return true;
    const range = this.document.createRange();
    range.selectNodeContents(paragraph);
    range.setEnd(endpoint.node, endpoint.offset);
    const before = this.rangeEdgeGlyph(range, false);
    range.selectNodeContents(paragraph);
    range.setStart(endpoint.node, endpoint.offset);
    const after = this.rangeEdgeGlyph(range, true);
    return !before || !after || after.top > before.top + before.height / 2;
  }
  /** The first/last painted text glyph in a range, excluding whitespace and zero-width marks. */
  rangeEdgeGlyph(range, forward) {
    const root = range.commonAncestorContainer;
    const texts = [];
    if (root.nodeType === this.view.Node.TEXT_NODE) texts.push(root);
    else {
      const walker = this.document.createTreeWalker(root, this.view.NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        this.checkpoint();
        if (range.intersectsNode(node)) texts.push(node);
      }
    }
    if (!forward) texts.reverse();
    for (const text of texts) {
      if (text.parentElement?.closest('[data-docx-ruby="true"] rt, [data-docx-ruby="true"] rp')) continue;
      const math = text.parentElement?.closest('[data-docx-math="true"]');
      if (math?.parentElement && this.rangeAtomicInlineBoxes(math.parentElement).has(math))
        return math.getBoundingClientRect();
      const drawing = text.parentElement?.closest("[data-docx-drawing-anchor]");
      if (drawing && drawing !== root && root.contains(drawing)) continue;
      const start = text === range.startContainer ? range.startOffset : 0;
      const end = text === range.endContainer ? range.endOffset : text.data.length;
      for (let k = 0; k < end - start; k++) {
        this.checkpoint();
        const index = forward ? start + k : end - 1 - k;
        if (!this.hasVisibleText(text.data[index])) continue;
        const character = this.document.createRange();
        character.setStart(text, index);
        character.setEnd(text, index + 1);
        const rect = character.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return rect;
      }
    }
    return null;
  }
  rangeHasMultipleTextLines(range) {
    const first = this.rangeEdgeGlyph(range, true);
    const last = this.rangeEdgeGlyph(range, false);
    return !!first && !!last && last.top > first.top + first.height / 2;
  }
  /**
   * The boxes a paragraph opens with before its first text: its list marker, a note's number,
   * and any box that holds no text, such as the tab that follows either.
   */
  leadingAtomicBoxes(paragraph) {
    const boxes = [];
    for (const node of Array.from(paragraph.childNodes)) {
      if (node.nodeType === this.view.Node.TEXT_NODE) {
        if (this.hasVisibleText(node.textContent ?? "")) break;
        continue;
      }
      if (!(node instanceof this.view.HTMLElement)) continue;
      if (node.dataset.listMarker === "true" || node.dataset.noteRun === "true" || node.classList.contains("footnote-number") || node.classList.contains("endnote-number") || !this.hasVisibleText(node.textContent ?? "")) {
        boxes.push(node);
        continue;
      }
      break;
    }
    return boxes;
  }
  /**
   * Builds one range-cloned paragraph fragment. Only the leading fragment keeps
   * the source paragraph's addressability; continuations must not duplicate an
   * id/data-anchor in the rendered document.
   */
  createParagraphFragment(paragraph, range, retainSourceIdentity, isFinalFragment) {
    const fragment = paragraph.cloneNode(false);
    const contents = range.cloneContents();
    fragment.appendChild(contents);
    if (!retainSourceIdentity) {
      fragment.removeAttribute("id");
      fragment.removeAttribute("data-anchor");
      fragment.style.setProperty("margin-top", "0", "important");
      fragment.style.setProperty("text-indent", "0", "important");
      fragment.style.setProperty("border-top", "none", "important");
      fragment.style.setProperty("padding-top", "0", "important");
      omitPaintedBorderSide(fragment, "top");
    }
    if (!isFinalFragment) {
      fragment.style.setProperty("margin-bottom", "0", "important");
      fragment.style.setProperty("padding-bottom", "0", "important");
      const mixedLine = Array.from(fragment.querySelectorAll("[data-docx-line-metric]")).at(-1);
      if (mixedLine?.dataset.docxLineMetric === "auto" && isMixedLineMetric(mixedLine)) {
        mixedLine.style.height = `${mixedLine.dataset.docxLineNatural}px`;
        mixedLine.style.verticalAlign = `${-Number(mixedLine.dataset.docxLineDescent)}px`;
      }
      const fitted = this.lastLineTrailingLeadingPt(paragraph) > 0 ? null : fragment.querySelector("[data-docx-word-fit]");
      const run = fitted?.style.getPropertyValue("--docx-word-grid-height") ? null : fitted;
      const last = run?.lastElementChild;
      const natural = Number(run?.dataset.docxWordFit);
      if (last && natural > 0 && natural < parseFloat(run.style.lineHeight))
        last.style.lineHeight = `${natural}px`;
      else if (run?.dataset.docxWordFit === "0") {
        const plain = run;
        const text = paragraph.firstElementChild?.firstChild;
        const height = parseFloat(plain.style.getPropertyValue("--docx-word-native-height"));
        const pitch = parseFloat(plain.style.lineHeight);
        if (!plain.children.length && text?.nodeType === 3 && range.endContainer === text && height > 0 && pitch > height) {
          let end = range.endOffset;
          const content = text.textContent;
          while (end > 0 && /\s/.test(content[end - 1])) {
            if ((end & 255) === 0) this.checkpoint();
            end--;
          }
          if (end > 0) {
            const glyph = range.cloneRange();
            glyph.setStart(text, 0);
            glyph.setEnd(text, 1);
            const firstBox = glyph.getBoundingClientRect();
            glyph.setStart(text, end - 1);
            glyph.setEnd(text, end);
            const lastBox = glyph.getBoundingClientRect();
            if (firstBox.height > 0 && lastBox.height > 0 && lastBox.top >= firstBox.top) {
              const lines2 = Math.round((lastBox.top - firstBox.top) / pitch);
              fragment.style.setProperty("--docx-word-text-height", `${lines2 * pitch + height}px`);
              fragment.style.height = "var(--docx-word-text-height)";
            }
          }
        }
      }
      if (this.view.getComputedStyle(paragraph).textAlign === "justify")
        fragment.style.setProperty("text-align-last", "justify", "important");
    }
    this.rebuildEdgeExclusion(fragment);
    return fragment;
  }
  /**
   * Range clones repeat an inline ancestor when the split lands inside it. Keep
   * semantic wrappers (links, comments, formatting) on both sides, but retain a
   * duplicated HTML/editor identity only on the leading fragment. Targets that
   * occur wholly after the split are absent from `head` and remain on `tail`.
   */
  reconcileFragmentIdentities(head, tail) {
    const elements = (root, selector) => [
      ...root.matches(selector) ? [root] : [],
      ...Array.from(root.querySelectorAll(selector))
    ];
    const headIds = new Set(elements(head, "[id]").map((element) => element.id));
    for (const element of elements(tail, "[id]")) {
      if (headIds.has(element.id)) element.removeAttribute("id");
    }
    const headAnchors = new Set(elements(head, "[data-anchor]").map((element) => element.dataset.anchor).filter((anchor) => Boolean(anchor)));
    for (const element of elements(tail, "[data-anchor]")) {
      if (!element.dataset.anchor || !headAnchors.has(element.dataset.anchor)) continue;
      element.removeAttribute("data-anchor");
      element.removeAttribute("data-committed-text");
    }
  }
  /**
   * Range-clone the largest safe prefix accepted by `fits`. The measurement
   * policy stays with the caller, allowing body blocks and note bands to share
   * one DOM fragmenter while measuring in their respective layout contexts.
   */
  splitParagraphAtLargestFit(paragraph, fits, options = {}) {
    const largestFit = (endpoints2) => {
      const lastEndpoint = endpoints2[endpoints2.length - 1];
      if (lastEndpoint) {
        const lastRange = this.document.createRange();
        lastRange.setStart(paragraph, 0);
        lastRange.setEnd(lastEndpoint.node, lastEndpoint.offset);
        const lastContents = lastRange.cloneContents();
        if (this.hasVisibleFragmentContent(lastContents)) {
          const lastHead = this.createParagraphFragment(paragraph, lastRange, true, false);
          if (fits(lastHead)) return { endpoint: lastEndpoint, head: lastHead };
        }
      }
      let low = 0;
      let high = endpoints2.length - 2;
      let best2 = null;
      while (low <= high) {
        this.checkpoint();
        const middle = Math.floor((low + high) / 2);
        const endpoint = endpoints2[middle];
        const headRange = this.document.createRange();
        headRange.setStart(paragraph, 0);
        headRange.setEnd(endpoint.node, endpoint.offset);
        const headContents = headRange.cloneContents();
        if (!this.hasVisibleFragmentContent(headContents)) {
          low = middle + 1;
          continue;
        }
        const head = this.createParagraphFragment(paragraph, headRange, true, false);
        if (fits(head)) {
          best2 = { endpoint, head };
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      return best2;
    };
    let endpoints = this.paragraphFragmentEndpoints(paragraph);
    let best = largestFit(endpoints);
    const hasMultipleFragmentLines = (fragment) => {
      if (fragment.hasAttribute("data-docx-mixed-lines"))
        return fragment.querySelectorAll("[data-docx-line-metric]").length > 1;
      paragraph.replaceWith(fragment);
      try {
        const range = this.document.createRange();
        range.selectNodeContents(fragment);
        return this.rangeHasMultipleTextLines(range);
      } finally {
        fragment.replaceWith(paragraph);
      }
    };
    const legalBreak = (endpoint) => {
      if (options.lineStartsOnly && !this.startsVisualLine(paragraph, endpoint)) return false;
      if (!options.preserveWidowLines) return true;
      const range = this.document.createRange();
      range.selectNodeContents(paragraph);
      range.setEnd(endpoint.node, endpoint.offset);
      const head = this.createParagraphFragment(paragraph, range, true, false);
      range.selectNodeContents(paragraph);
      range.setStart(endpoint.node, endpoint.offset + (endpoint.consumeBreak ? 1 : 0));
      const tail2 = this.createParagraphFragment(paragraph, range, false, true);
      return hasMultipleFragmentLines(head) && hasMultipleFragmentLines(tail2);
    };
    if (best && !legalBreak(best.endpoint)) {
      let index = endpoints.indexOf(best.endpoint) - 1;
      while (index >= 0 && !legalBreak(endpoints[index])) index--;
      if (index < 0) {
        best = null;
      } else {
        const headRange = this.document.createRange();
        headRange.setStart(paragraph, 0);
        headRange.setEnd(endpoints[index].node, endpoints[index].offset);
        best = { endpoint: endpoints[index], head: this.createParagraphFragment(paragraph, headRange, true, false) };
      }
    }
    if (!best && options.emergencyGraphemeBreaks) {
      endpoints = this.paragraphFragmentEndpoints(paragraph, true);
      best = largestFit(endpoints);
    }
    if (!best && options.forceFirstOnNoFit && endpoints.length > 0) {
      const endpoint = endpoints[0];
      const headRange = this.document.createRange();
      headRange.setStart(paragraph, 0);
      headRange.setEnd(endpoint.node, endpoint.offset);
      best = {
        endpoint,
        head: this.createParagraphFragment(paragraph, headRange, true, false)
      };
    }
    if (!best) {
      return endpoints.length > 0 ? { kind: "no-fit" } : { kind: "indivisible" };
    }
    const tailRange = this.document.createRange();
    tailRange.setStart(best.endpoint.node, best.endpoint.offset + (best.endpoint.consumeBreak ? 1 : 0));
    tailRange.setEnd(paragraph, paragraph.childNodes.length);
    const tailContents = tailRange.cloneContents();
    if (!this.hasVisibleFragmentContent(tailContents)) return { kind: "indivisible" };
    const tail = this.createParagraphFragment(paragraph, tailRange, false, true);
    this.reconcileFragmentIdentities(best.head, tail);
    return {
      kind: "split",
      head: best.head,
      tail
    };
  }
  /**
   * The converter's box around a run of paragraphs that share one border (`w:pBdr`): a `div` whose
   * element children are all Word paragraphs and that draws a border. `element` must be laid out.
   */
  isBorderGroup(element) {
    if (element.localName !== "div" || element.children.length === 0 || !Array.from(element.children).every((child) => this.isWordParagraphElement(child))) return false;
    const style = this.view.getComputedStyle(element);
    if (style.position === "absolute" || style.position === "fixed" || style.float !== "none" || element.hasAttribute("data-docx-frame-container")) return false;
    if (element.hasAttribute(PAINT)) return true;
    return [style.borderTopStyle, style.borderBottomStyle, style.borderLeftStyle, style.borderRightStyle].some((value) => value !== "none" && value !== "hidden");
  }
  /**
   * Splits a bordered paragraph group where Word breaks it across pages (issue #1202): after the last
   * paragraph that fits, or inside the paragraph that does not, as an ordinary paragraph splits. Word
   * leaves the border open at the break: the first part has no bottom border and the rest no top
   * border, so each part keeps its side borders. A group that cites notes, or keeps its lines or its
   * next paragraph, keeps the whole-block fallback.
   */
  tryFragmentParagraphGroup(block, dims, fitsHead) {
    if (!this.fragmentParagraphs || block.keepLines || block.isPageBreak || block.element.querySelector("[data-footnote-id]")) return null;
    const host = !block.element.isConnected ? this.document.createElement("div") : null;
    const group = host ? block.element.cloneNode(true) : block.element;
    if (host) {
      host.style.cssText = `position:absolute;visibility:hidden;left:-9999px;width:${dims.contentWidth}pt`;
      host.appendChild(group);
      this.stagingElement.appendChild(host);
    }
    try {
      const split = this.splitParagraphGroup(group, fitsHead, { bodyParagraph: true });
      if (!split) return null;
      return [split.head, split.tail].map((element, index) => ({
        ...this.measureElement(element, dims, block.sectionIndex),
        element,
        keepWithNext: index === 1 && block.keepWithNext,
        keepLines: false,
        pageBreakBefore: false,
        isPageBreak: false
      }));
    } finally {
      host?.remove();
    }
  }
  /** Split paragraph groups in the caller's context, retaining every comment shell around each candidate. */
  splitParagraphGroup(group, fitsCandidate, options = {}) {
    const boxed = group.dataset.paginationCommentGroup !== "true";
    if (boxed && !this.isBorderGroup(group)) return null;
    this.checkpoint();
    const paragraphs = Array.from(group.children);
    const part = (content, open) => {
      const wrapper = group.cloneNode(false);
      wrapper.style.setProperty(`border-${open}`, "none", "important");
      wrapper.style.setProperty(`padding-${open}`, "0", "important");
      wrapper.style.setProperty(`margin-${open}`, "0", "important");
      omitPaintedBorderSide(wrapper, open);
      for (const paragraph of content) wrapper.appendChild(paragraph);
      if (open === "bottom" && boxed) content.at(-1)?.style.setProperty("padding-bottom", "0", "important");
      return wrapper;
    };
    const fits = (content) => fitsCandidate(part(content, "bottom"));
    const clones = (from, to) => paragraphs.slice(from, to).map((p) => p.cloneNode(true));
    let whole = 0;
    while (whole + 1 < paragraphs.length && fits(clones(0, whole + 1))) whole++;
    let head = clones(0, whole);
    let tail = clones(whole, paragraphs.length);
    const next = paragraphs[whole];
    const relaxKeepLines = options.relaxKeepLines && paragraphs.slice(0, whole).every((p) => p.dataset.keepWithNext === "true");
    let divided = false;
    if (this.canRangeFragmentParagraph(next, !options.bodyParagraph, options.bodyParagraph, relaxKeepLines)) {
      const split = this.splitParagraphAtLargestFit(next, (candidate) => fits([...clones(0, whole), candidate]), {
        emergencyGraphemeBreaks: options.forceProgress && whole === 0,
        forceFirstOnNoFit: options.forceProgress && whole === 0,
        preserveWidowLines: next.dataset.widowControl !== "false"
      });
      if (split.kind === "split") {
        head.push(split.head);
        tail = [split.tail, ...clones(whole + 1, paragraphs.length)];
        divided = true;
      }
    } else if (next.dataset.paginationCommentGroup === "true") {
      const split = this.splitParagraphGroup(next, (candidate) => fits([...clones(0, whole), candidate]), options);
      if (split) {
        head.push(split.head);
        tail = [split.tail, ...clones(whole + 1, paragraphs.length)];
        divided = true;
      }
    }
    if (!divided) {
      while (whole > 0 && paragraphs[whole - 1].dataset.keepWithNext === "true") whole--;
      head = clones(0, whole);
      tail = clones(whole, paragraphs.length);
    }
    if (head.length === 0) return null;
    tail[0].style.setProperty("margin-top", "0", "important");
    const spaceBefore = ptToPx(Number.parseFloat(tail[0].dataset.docxSpaceBefore ?? "0"));
    if (!divided && spaceBefore > 0) tail[0].style.setProperty(
      "padding-top",
      `${Number.parseFloat(this.view.getComputedStyle(paragraphs[whole]).paddingTop) - spaceBefore}px`,
      "important"
    );
    const result = { head: part(head, "bottom"), tail: part(tail, "top") };
    this.reconcileFragmentIdentities(result.head, result.tail);
    return result;
  }
  /**
   * Splits a simple paragraph at the largest DOM Range endpoint that fits the
   * currently available body space. The caller then processes the tail normally,
   * allowing it to fragment again on later pages when necessary.
   */
  tryFragmentParagraph(block, dims, availableHeightPt, effectiveMarginTopPt, notesStart, preceding = [], relaxKeepLines = false, freshPage = false, aboveNotes = false) {
    if (availableHeightPt <= effectiveMarginTopPt) return null;
    if (block.element.localName === "div" || block.element.dataset.paginationCommentGroup === "true") {
      return this.tryFragmentParagraphGroup(block, dims, (head) => effectiveMarginTopPt + this.measureElement(head, dims, block.sectionIndex).heightPt <= availableHeightPt);
    }
    const relaxKeepWithNext = block.relaxedKeepWithNext === true || freshPage && this.extractFootnoteRefs(block.element).every((id) => this.footnoteRegistry.has(id));
    const prefix = this.hasFlowExclusion(preceding) ? preceding : [];
    const host = !block.element.isConnected || prefix.length > 0 ? this.document.createElement("div") : null;
    const paragraph = host ? block.element.cloneNode(true) : block.element;
    if (host) {
      host.style.cssText = `position:absolute;visibility:hidden;left:-9999px;width:${dims.contentWidth}pt`;
      this.appendSectionContent(
        host,
        [...prefix.map((previous) => previous.cloneNode(true)), paragraph],
        dims
      );
      this.stagingElement.appendChild(host);
    }
    if (host) this.prepareFrameExclusions(host, dims, Number(paragraph.dataset.paginationPhysicalPage ?? 1));
    let split;
    try {
      if (!this.canFragmentParagraph({ ...block, element: paragraph }, relaxKeepLines, relaxKeepWithNext)) return null;
      let headLimitPt = availableHeightPt;
      if (notesStart) {
        const top = paragraph.getBoundingClientRect().top;
        const cited = [];
        for (const reference of Array.from(paragraph.querySelectorAll("[data-footnote-id]"))) {
          const footnoteId = reference.dataset.footnoteId;
          if (!footnoteId || cited.includes(footnoteId)) continue;
          const marker = this.document.createRange();
          marker.selectNodeContents(reference);
          const rect = marker.getBoundingClientRect();
          if (rect.height === 0) continue;
          if (notesStart([...cited, footnoteId], pxToPt(rect.bottom - top))) {
            cited.push(footnoteId);
            continue;
          }
          headLimitPt = Math.min(headLimitPt, effectiveMarginTopPt + pxToPt(rect.top - top));
          break;
        }
        if (headLimitPt <= effectiveMarginTopPt) return null;
      }
      const fits = (head) => {
        const measured = this.measureElement(head, dims, block.sectionIndex, prefix);
        return effectiveMarginTopPt + this.fitHeightPt(measured, aboveNotes) <= headLimitPt && (!notesStart || notesStart(this.extractFootnoteRefs(head), measured.heightPt));
      };
      split = this.splitParagraphAtLargestFit(paragraph, fits, {
        lineStartsOnly: notesStart !== void 0,
        preserveWidowLines: paragraph.dataset.widowControl !== "false" && this.hasVisibleText(paragraph.textContent ?? "")
      });
      if (split.kind === "no-fit" && freshPage && paragraph.querySelector("img")) {
        split = this.splitParagraphAtLargestFit(paragraph, fits, { lineStartsOnly: notesStart !== void 0 });
      }
    } finally {
      host?.remove();
    }
    if (split.kind !== "split") return null;
    return [split.head, split.tail].map((element, index) => ({
      ...this.measureElement(element, dims, block.sectionIndex, index === 0 ? prefix : []),
      element,
      keepWithNext: index === 1 && block.keepWithNext,
      keepLines: false,
      relaxedKeepLines: relaxKeepLines || block.relaxedKeepLines,
      relaxedKeepWithNext: relaxKeepWithNext,
      pageBreakBefore: false,
      isPageBreak: false
    }));
  }
  /** Fill the remaining body band without separating a citation from its note. */
  tryFragmentTable(block, dims, availableHeightPt, effectiveMarginTopPt, notesStart) {
    if (block.keepLines || block.keepWithNext || block.pageBreakBefore || availableHeightPt <= effectiveMarginTopPt || !this.blockTable(block.element)) return null;
    const host = !block.element.isConnected ? this.document.createElement("div") : null;
    const candidate = host ? block.element.cloneNode(true) : block.element;
    if (host) {
      host.style.cssText = `position:absolute;visibility:hidden;left:-9999px;width:${dims.contentWidth}pt`;
      host.appendChild(candidate);
      this.stagingElement.appendChild(host);
    }
    let split;
    try {
      const fits = (head) => {
        const measured = this.measureElement(head, dims, block.sectionIndex);
        return effectiveMarginTopPt + measured.heightPt <= availableHeightPt && notesStart(this.extractFootnoteRefs(head), measured.heightPt);
      };
      split = this.fragmentParagraphs ? this.splitTableContent(candidate, fits, false) : this.splitTableAtRows(candidate, fits, false);
    } finally {
      host?.remove();
    }
    if (!split) return null;
    this.reconcileFragmentIdentities(split.head, split.tail);
    split.head.style.setProperty("margin-bottom", "0", "important");
    split.tail.style.setProperty("margin-top", "0", "important");
    return [split.head, split.tail].map((element) => ({
      ...this.measureElement(element, dims, block.sectionIndex),
      keepWithNext: false,
      pageBreakBefore: false
    }));
  }
  /**
   * Parses the header/footer registry from the staging element.
   * Also measures heights during parsing for lazy-loading compatibility.
   */
  parseHeaderFooterRegistry() {
    const registry = /* @__PURE__ */ new Map();
    const registryEl = this.stagingElement.querySelector("#pagination-hf-registry");
    if (!registryEl) return registry;
    const sectionDimensions = /* @__PURE__ */ new Map();
    const sections = Array.from(this.stagingElement.querySelectorAll("[data-section-index]"));
    for (const section of sections) {
      const idx = parseInt(section.dataset.sectionIndex || "0", 10);
      sectionDimensions.set(idx, parseSectionDimensions(section));
    }
    const defaultDimensions = sectionDimensions.get(0) ?? parseSectionDimensions(this.stagingElement);
    const entries = Array.from(registryEl.querySelectorAll("[data-section][data-hf-type]"));
    for (const entry of entries) {
      const sectionIndex = parseInt(entry.dataset.section || "0", 10);
      const hfType = entry.dataset.hfType;
      if (!registry.has(sectionIndex)) {
        registry.set(sectionIndex, {});
      }
      const section = registry.get(sectionIndex);
      const content = entry.cloneNode(true);
      const dims = sectionDimensions.get(sectionIndex) ?? defaultDimensions;
      const measuredHeight = this.measureHeaderFooterHeight(content, dims);
      switch (hfType) {
        case "header-default":
          section.headerDefault = content;
          section.headerDefaultHeight = measuredHeight;
          break;
        case "header-first":
          section.headerFirst = content;
          section.headerFirstHeight = measuredHeight;
          break;
        case "header-even":
          section.headerEven = content;
          section.headerEvenHeight = measuredHeight;
          break;
        case "footer-default":
          section.footerDefault = content;
          section.footerDefaultHeight = measuredHeight;
          break;
        case "footer-first":
          section.footerFirst = content;
          section.footerFirstHeight = measuredHeight;
          break;
        case "footer-even":
          section.footerEven = content;
          section.footerEvenHeight = measuredHeight;
          break;
      }
    }
    return registry;
  }
  /**
   * Parses the footnote registry from the staging element.
   */
  parseFootnoteRegistry() {
    const registry = /* @__PURE__ */ new Map();
    const registryEl = this.stagingElement.querySelector("#pagination-footnote-registry");
    if (!registryEl) return registry;
    const entries = Array.from(registryEl.children).filter((entry) => entry instanceof this.view.HTMLElement && entry.hasAttribute("data-footnote-id"));
    for (const entry of entries) {
      const footnoteId = entry.dataset.footnoteId;
      if (footnoteId) {
        registry.set(footnoteId, entry.cloneNode(true));
      }
    }
    return registry;
  }
  /** Read Word's optional normal and continuation separator stories. */
  parseFootnoteSeparators() {
    const registry = this.stagingElement.querySelector("#pagination-footnote-registry");
    const clone = (kind) => {
      const source = Array.from(registry?.children ?? []).find(
        (entry) => entry instanceof this.view.HTMLElement && entry.getAttribute("data-footnote-separator") === kind
      );
      return source?.cloneNode(true);
    };
    return {
      normal: clone("normal") ?? null,
      continuation: clone("continuation") ?? null
    };
  }
  /** Append the exact separator story selected for this initial/continued note band. */
  appendFootnoteSeparator(container, continuation) {
    const kind = continuation ? "continuation" : "normal";
    const source = continuation ? this.footnoteContinuationSeparator : this.footnoteSeparator;
    if (!source) {
      const fallback = this.document.createElement("hr");
      fallback.dataset.footnoteSeparator = kind;
      container.appendChild(fallback);
      return;
    }
    const clone = source.cloneNode(true);
    this.makePresentationCopyInert(clone, false);
    container.appendChild(clone);
  }
  /**
   * Strip every identity from a copy the paginator paints again: element ids and anchor names,
   * editor anchors, note, comment and annotation ids, and internal links, so the copy is not a
   * second bookmark target, comment, note citation or annotation and cannot be edited.
   * `keepSourceAnchors` keeps the canonical source identity, for a copy (a repeated table header
   * row) that the PageMap maps as one more fragment of its source.
   */
  makePresentationCopyInert(root, keepSourceAnchors) {
    for (const mark of Array.from(root.querySelectorAll('a[id^="comment-ref-"]'))) mark.remove();
    for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
      element.removeAttribute("id");
      element.removeAttribute("data-anchor");
      element.removeAttribute("data-committed-text");
      if (!keepSourceAnchors || this.storyForCanonicalAnchor(element.dataset.sourceAnchorId ?? "") === "comment") {
        element.removeAttribute("data-source-anchor-id");
        element.removeAttribute("data-page-fragment-id");
        element.removeAttribute("data-fragment-index");
      }
      element.removeAttribute("data-footnote-id");
      element.removeAttribute("data-comment-id");
      element.removeAttribute("data-annotation-id");
      element.removeAttribute("name");
      if (element instanceof this.view.HTMLAnchorElement && element.getAttribute("href")?.startsWith("#")) {
        element.removeAttribute("href");
      }
      element.setAttribute("contenteditable", "false");
    }
  }
  /** Parses the hidden source notes used to render paginated margin comments. */
  parseCommentMarginRegistry() {
    const registry = /* @__PURE__ */ new Map();
    const registryEl = marginNoteRegistry(this.stagingElement);
    if (!registryEl) return registry;
    for (const entry of Array.from(
      registryEl.querySelectorAll("[data-comment-id]")
    )) {
      const commentId = entry.dataset.commentId;
      if (!commentId) continue;
      let root = entry;
      for (let parent = root.parentElement?.closest("[data-comment-id]"); parent && registryEl.contains(parent); parent = root.parentElement?.closest("[data-comment-id]")) {
        root = parent;
      }
      registry.set(commentId, root.cloneNode(true));
    }
    return registry;
  }
  /**
   * Extracts footnote reference IDs from an element.
   */
  extractFootnoteRefs(element) {
    const refs = element.querySelectorAll("[data-footnote-id]");
    const ids = [];
    for (const ref of Array.from(refs)) {
      const id = ref.dataset.footnoteId;
      if (id && !ids.includes(id)) {
        ids.push(id);
      }
    }
    return ids;
  }
  /** Clone a note child for the continuation queue with its original selector position. */
  cloneFootnoteElementForContinuation(element, sourceIndex) {
    const clone = element.cloneNode(true);
    clone.setAttribute(
      FOOTNOTE_SOURCE_POSITION_ATTR,
      sourceIndex === 0 ? "first" : "later"
    );
    return clone;
  }
  /** Remove identities that belong only to the initial registry presentation shell. */
  makeContinuationShellInert(element) {
    element.removeAttribute("id");
    element.removeAttribute("data-anchor");
    element.removeAttribute("data-committed-text");
  }
  /**
   * Build the exact continuation shape shared by measurement and paint.
   *
   * Keep the source `.footnote-item > .footnote-content` ancestry: document
   * CSS, inherited direction/language, and custom classes frequently target
   * those shells. Only a number rendered beside the content and the initial
   * HTML/editor identities are omitted; the converter's number travels inside
   * the first paragraph (issue #1130). A hidden sentinel preserves
   * `p:not(:first-of-type)` in document CSS for a page whose first carried
   * element was a later source paragraph; the generated stylesheet has no
   * first-paragraph rule any more.
   */
  createFootnoteContinuationWrapper(continuation, elements = continuation.remainingElements) {
    const source = this.footnoteRegistry.get(continuation.footnoteId);
    const wrapper = source ? source.cloneNode(false) : this.document.createElement("div");
    this.makeContinuationShellInert(wrapper);
    wrapper.classList.add("footnote-continuation");
    wrapper.dataset.footnoteId = continuation.footnoteId;
    if (continuation.sourceAnchorId) {
      wrapper.dataset.sourceAnchorId = continuation.sourceAnchorId;
    }
    const sourceContent = source?.querySelector(".footnote-content");
    const content = sourceContent ? sourceContent.cloneNode(false) : this.document.createElement("span");
    this.makeContinuationShellInert(content);
    if (!sourceContent) content.className = "footnote-content";
    const first = elements[0];
    if (first?.tagName === "P" && first.getAttribute(FOOTNOTE_SOURCE_POSITION_ATTR) === "later") {
      const sentinel = this.document.createElement("p");
      sentinel.className = "footnote-continuation-position-sentinel";
      sentinel.setAttribute("aria-hidden", "true");
      sentinel.style.setProperty("display", "none", "important");
      content.appendChild(sentinel);
    }
    for (let index = 0; index < elements.length; index++) {
      this.checkpoint();
      const element = elements[index];
      const clone = element.cloneNode(true);
      clone.removeAttribute(FOOTNOTE_SOURCE_POSITION_ATTR);
      if (index === 0 && clone.tagName === "P") {
        clone.style.setProperty("display", "block", "important");
      }
      content.appendChild(clone);
    }
    wrapper.appendChild(content);
    return wrapper;
  }
  /** Build the exact partial-note item shape shared by measurement and paint. */
  createPartialFootnoteItem(footnote, fittingElements) {
    const item = footnote.cloneNode(false);
    const number2 = footnote.querySelector(":scope > .footnote-number");
    if (number2) item.appendChild(number2.cloneNode(true));
    const sourceContent = footnote.querySelector(".footnote-content");
    const content = sourceContent ? sourceContent.cloneNode(false) : this.document.createElement("span");
    if (!sourceContent) content.className = "footnote-content";
    for (const element of fittingElements) {
      this.checkpoint();
      content.appendChild(element.cloneNode(true));
    }
    item.appendChild(content);
    return item;
  }
  /**
   * Where a note measurement tree is attached.
   *
   * A note band is reserved from a measurement and then painted; if the two
   * happen under different inherited typography the painted notes overflow the
   * reserve, which is the invisible clipping this engine exists to avoid. The
   * registry lives in the staging tree but a band paints inside the output
   * container, so measure there. The host is never a page box, so a page's
   * `zoom` cannot scale a reserve that is accounted for in unscaled points.
   */
  noteMeasurementHost() {
    return this.containerElement.isConnected ? this.containerElement : this.stagingElement;
  }
  /**
   * Measures the height of footnotes for given IDs (in points).
   * Creates a temporary container to measure the footnotes.
   * @param footnoteIds - IDs of footnotes to measure
   * @param contentWidth - Width for measurement
   * @param continuation - Optional continuation content to include first
   */
  measureFootnotesHeight(footnoteIds, contentWidth, continuation, partialFootnotes) {
    const hasContinuation = continuation && continuation.remainingElements.length > 0;
    if (footnoteIds.length === 0 && !hasContinuation) {
      return 0;
    }
    if (this.footnoteRegistry.size === 0 && !hasContinuation) {
      return 0;
    }
    const measureContainer = this.document.createElement("div");
    measureContainer.style.position = "absolute";
    measureContainer.style.visibility = "hidden";
    measureContainer.style.width = `${contentWidth}pt`;
    measureContainer.style.left = "-9999px";
    measureContainer.className = this.cssPrefix + "footnotes";
    this.appendFootnoteSeparator(measureContainer, Boolean(hasContinuation));
    if (hasContinuation) {
      measureContainer.appendChild(this.createFootnoteContinuationWrapper(continuation));
    }
    const partialById = new Map(
      partialFootnotes?.map((partial) => [partial.footnoteId, partial]) ?? []
    );
    for (const id of footnoteIds) {
      this.checkpoint();
      const footnote = this.footnoteRegistry.get(id);
      if (footnote) {
        const partial = partialById.get(id);
        measureContainer.appendChild(partial ? this.createPartialFootnoteItem(footnote, partial.fittingElements) : footnote.cloneNode(true));
      }
    }
    this.noteMeasurementHost().appendChild(measureContainer);
    try {
      this.prepareFootnoteText?.(measureContainer);
      return pxToPt(measureContainer.getBoundingClientRect().height);
    } finally {
      measureContainer.remove();
    }
  }
  blockTable(element) {
    if (element.localName === "table") return element;
    const table = element.lastElementChild;
    if (table?.localName !== "table") return null;
    for (const child of Array.from(element.childNodes)) {
      if (child === table) continue;
      if (child.nodeType === this.view.Node.TEXT_NODE && !(child.textContent ?? "").trim()) continue;
      if (!this.isEmptyBookmarkTarget(child)) return null;
    }
    return table;
  }
  /**
   * Split a body or note table at the largest complete row-group boundary that fits, preserving
   * vertical merges and repeated headers. Null if no group fits, unless `forceFirst` requests
   * the note-only liveness fallback. A wrapper holding only the table is retained.
   */
  splitTableAtRows(element, fits, forceFirst, allowNested = false, relaxKeeps = false) {
    const table = this.blockTable(element);
    if (!table || table.tBodies.length !== 1 || !allowNested && table.querySelector("table") || Array.from(table.children).some((child) => child !== table.tBodies[0] && child.localName !== "colgroup")) {
      return null;
    }
    const body = table.tBodies[0];
    const rows = Array.from(body.rows);
    const allEnds = this.tableRowGroupEnds(rows);
    const headerRows = rows.slice(0, this.leadingHeaderRowCount(rows, allEnds));
    const ends = allEnds.filter((end) => end > headerRows.length && end < rows.length && (relaxKeeps || !this.rowKeepsWithNext(rows[end - 1])));
    if (ends.length === 0) return null;
    const wrapper = element === table ? null : element;
    const fragment = (from, to, first) => this.createSimpleTableFragment(
      wrapper,
      table,
      body,
      rows.slice(from, to),
      first,
      first ? [] : headerRows
    );
    let low = 0;
    let high = ends.length - 1;
    let best = -1;
    while (low <= high) {
      this.checkpoint();
      const middle = Math.floor((low + high) / 2);
      if (fits(fragment(0, ends[middle], true))) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    if (best < 0 && !forceFirst) return null;
    const cut = ends[Math.max(best, 0)];
    return { head: fragment(0, cut, true), tail: fragment(cut, rows.length, false) };
  }
  isEmptyBookmarkTarget(node) {
    return node instanceof this.view.HTMLAnchorElement && !!node.id && !node.hasAttribute("href") && node.childNodes.length === 0;
  }
  /** A terminal flow paragraph can keep this row with its successor. Nested tables own their keeps. */
  rowKeepsWithNext(row) {
    return Array.from(row.cells).some((cell) => {
      let last = cell.lastElementChild;
      while (last) {
        if (this.isEmptyBookmarkTarget(last)) last = last.previousElementSibling;
        else if (last.dataset.paginationCommentGroup === "true" || this.isBorderGroup(last)) {
          last = last.lastElementChild;
        } else return this.isWordParagraphElement(last) && last.dataset.keepWithNext === "true";
      }
      return false;
    });
  }
  /** Split a table between rows, or inside the first row when no complete row fits. */
  splitTableContent(element, fits, forceFirst, freshBody = false) {
    const relaxKeeps = freshBody || forceFirst;
    const wholeRows = this.splitTableAtRows(element, fits, false, true, relaxKeeps);
    if (wholeRows) return wholeRows;
    const fallback = () => forceFirst ? this.splitTableAtRows(element, fits, true, true, true) : null;
    const table = this.blockTable(element);
    if (!table || table.tBodies.length !== 1 || Array.from(table.children).some((child) => child !== table.tBodies[0] && child.localName !== "colgroup")) {
      return null;
    }
    const body = table.tBodies[0];
    const rows = Array.from(body.rows);
    const ends = this.tableRowGroupEnds(rows);
    const headers = rows.slice(0, this.leadingHeaderRowCount(rows, ends));
    const row = rows[headers.length];
    if (!row || !ends.includes(headers.length + 1) || row.dataset.docxCantSplit === "true" && !freshBody || !relaxKeeps && rows.length > headers.length + 1 && this.rowKeepsWithNext(row) || row.dataset.docxHeaderRow === "true" || (row.dataset.docxRowHeightRule ? row.dataset.docxRowHeightRule !== "atLeast" : row.style.height || row.style.minHeight) || Array.from(row.cells).some((cell) => cell.rowSpan !== 1)) return fallback();
    if (Array.from(row.cells).some((cell) => Array.from(cell.childNodes).some((node) => node.nodeType !== this.view.Node.ELEMENT_NODE && (node.nodeType !== this.view.Node.TEXT_NODE || (node.textContent ?? "").trim() !== "")))) {
      return fallback();
    }
    const emptyRow = row.cloneNode(false);
    for (const cell of Array.from(row.cells)) emptyRow.appendChild(cell.cloneNode(false));
    const wrapper = element === table ? null : element;
    const head = this.createSimpleTableFragment(wrapper, table, body, [...headers, emptyRow], true);
    const tail = this.createSimpleTableFragment(
      wrapper,
      table,
      body,
      [emptyRow, ...rows.slice(headers.length + 1)],
      false,
      headers
    );
    const headCells = this.blockTable(head).tBodies[0].rows[headers.length].cells;
    const tailCells = this.blockTable(tail).tBodies[0].rows[headers.length].cells;
    let hasOverflow = rows.length > headers.length + 1;
    let hasContent = false;
    for (let column = 0; column < row.cells.length; column++) {
      this.checkpoint();
      const children = Array.from(row.cells[column].children);
      const current = headCells[column];
      const remaining = tailCells[column];
      for (let index = 0; index < children.length; index++) {
        this.checkpoint();
        const child = children[index];
        let end = index + 1;
        while (end < children.length && children[end - 1].dataset.keepWithNext === "true") {
          this.checkpoint();
          end++;
        }
        const group = children.slice(index, end).map((node) => node.cloneNode(true));
        for (const node of group) current.appendChild(node);
        if (fits(head)) {
          hasContent ||= group.some((node) => this.hasVisibleText(node.textContent ?? ""));
          index = end - 1;
          continue;
        }
        group.forEach((node) => node.remove());
        const fitsChild = (piece) => {
          current.appendChild(piece);
          try {
            return fits(head);
          } finally {
            piece.remove();
          }
        };
        let split = null;
        if (end === index + 1) {
          const relaxKeepLines = freshBody && current.childElementCount === 0;
          const terminal = freshBody && end === children.length;
          if (this.canRangeFragmentParagraph(child, false, false, relaxKeepLines, terminal)) {
            const paragraph = this.splitParagraphAtLargestFit(child, fitsChild, {
              preserveWidowLines: child.dataset.widowControl !== "false"
            });
            if (paragraph.kind === "split") split = paragraph;
          } else {
            split = this.splitParagraphGroup(child, fitsChild, { relaxKeepLines }) ?? this.splitTableContent(child, fitsChild, false, relaxKeepLines);
          }
        }
        if (split) {
          current.appendChild(split.head);
          remaining.appendChild(split.tail);
          hasContent = true;
          index++;
        }
        for (const rest of children.slice(index)) remaining.appendChild(rest.cloneNode(true));
        hasOverflow = true;
        break;
      }
    }
    if (!hasContent || !hasOverflow || !fits(head)) return fallback();
    this.reconcileFragmentIdentities(head, tail);
    return { head, tail };
  }
  /** Partition a carried note, advancing even when its first indivisible element is oversized. */
  splitContinuationForPage(continuation, availableHeightPt, contentWidth) {
    const fitting = [];
    let remaining = [];
    const measureContainer = this.document.createElement("div");
    measureContainer.style.position = "absolute";
    measureContainer.style.visibility = "hidden";
    measureContainer.style.width = `${contentWidth}pt`;
    measureContainer.style.left = "-9999px";
    measureContainer.className = this.cssPrefix + "footnotes";
    this.appendFootnoteSeparator(measureContainer, true);
    const wrapper = this.createFootnoteContinuationWrapper(continuation, []);
    const content = wrapper.querySelector(":scope > .footnote-content");
    if (!content) {
      throw new Error("Footnote continuation is missing its content shell");
    }
    measureContainer.appendChild(wrapper);
    this.noteMeasurementHost().appendChild(measureContainer);
    try {
      for (let index = 0; index < continuation.remainingElements.length; index++) {
        this.checkpoint();
        const element = continuation.remainingElements[index];
        const sourcePosition = element.getAttribute(FOOTNOTE_SOURCE_POSITION_ATTR);
        if (fitting.length === 0 && element.tagName === "P" && element.getAttribute(FOOTNOTE_SOURCE_POSITION_ATTR) === "later") {
          const sentinel = this.document.createElement("p");
          sentinel.className = "footnote-continuation-position-sentinel";
          sentinel.setAttribute("aria-hidden", "true");
          sentinel.style.setProperty("display", "none", "important");
          content.appendChild(sentinel);
        }
        const candidate = element.cloneNode(true);
        candidate.removeAttribute(FOOTNOTE_SOURCE_POSITION_ATTR);
        if (fitting.length === 0 && candidate.tagName === "P") {
          candidate.style.setProperty("display", "block", "important");
        }
        content.appendChild(candidate);
        this.prepareFootnoteText?.(candidate);
        const candidateHeight = pxToPt(measureContainer.getBoundingClientRect().height);
        if (candidateHeight <= availableHeightPt) {
          if (sourcePosition !== null) candidate.setAttribute(FOOTNOTE_SOURCE_POSITION_ATTR, sourcePosition);
          fitting.push(candidate);
          continue;
        }
        const relaxKeepLines = this.fragmentParagraphs && fitting.length === 0 && candidate.dataset.keepLines === "true";
        const canSplitCandidate = candidate.tagName === "P" && this.canRangeFragmentParagraph(candidate, false, false, relaxKeepLines);
        const fitsCandidate = (head) => {
          candidate.replaceWith(head);
          try {
            return pxToPt(measureContainer.getBoundingClientRect().height) <= availableHeightPt;
          } finally {
            head.replaceWith(candidate);
          }
        };
        let split = null;
        if (canSplitCandidate) {
          split = this.splitParagraphAtLargestFit(candidate, fitsCandidate, {
            // Both fallbacks below cut where ordinary line breaking would not,
            // so they are only ever right for an element that owns the whole
            // band: if this page already carries earlier content, a paragraph
            // that will not start here belongs intact in the next note band.
            emergencyGraphemeBreaks: fitting.length === 0,
            // A continuation page owns the full note band. If even one legal
            // grapheme is taller than it, clip only that unit and keep draining.
            forceFirstOnNoFit: fitting.length === 0,
            preserveWidowLines: candidate.dataset.widowControl !== "false"
          });
        }
        const wrappedSplit = split?.kind === "split" ? null : this.splitParagraphGroup(candidate, fitsCandidate, {
          relaxKeepLines: this.fragmentParagraphs && fitting.length === 0,
          forceProgress: fitting.length === 0
        }) ?? this.splitTableContent(candidate, fitsCandidate, fitting.length === 0);
        candidate.remove();
        if (split?.kind === "split") {
          if (sourcePosition) {
            split.head.setAttribute(FOOTNOTE_SOURCE_POSITION_ATTR, sourcePosition);
            split.tail.setAttribute(FOOTNOTE_SOURCE_POSITION_ATTR, sourcePosition);
          }
          fitting.push(split.head);
          remaining = [split.tail, ...continuation.remainingElements.slice(index + 1)];
        } else if (wrappedSplit) {
          if (sourcePosition) wrappedSplit.tail.setAttribute(FOOTNOTE_SOURCE_POSITION_ATTR, sourcePosition);
          fitting.push(wrappedSplit.head);
          remaining = [wrappedSplit.tail, ...continuation.remainingElements.slice(index + 1)];
        } else if (fitting.length === 0) {
          if (sourcePosition !== null) candidate.setAttribute(FOOTNOTE_SOURCE_POSITION_ATTR, sourcePosition);
          fitting.push(candidate);
          remaining = continuation.remainingElements.slice(index + 1);
        } else {
          remaining = continuation.remainingElements.slice(index);
        }
        break;
      }
    } finally {
      measureContainer.remove();
    }
    return {
      current: {
        footnoteId: continuation.footnoteId,
        sourceAnchorId: continuation.sourceAnchorId,
        remainingElements: fitting
      },
      overflow: remaining.length > 0 ? {
        footnoteId: continuation.footnoteId,
        sourceAnchorId: continuation.sourceAnchorId,
        remainingElements: remaining
      } : null
    };
  }
  /**
   * Whether every note in `footnoteIds` can begin in a note band of `availableHeightPt` that
   * already holds the page's packed payload: each whole except the last, which may be split
   * provided at least its first line fits. Mirrors the placement loop's decisions without
   * changing any page state, so the paginator can move a citation to the next page instead of
   * separating it from its note (Word starts a note on the page that cites it).
   */
  notesCanStartOnPage(footnoteIds, availableHeightPt, contentWidth, payload, splitTailTaken, memo) {
    const key = footnoteIds.join(" ");
    const startsFrom = memo?.startsFrom.get(key);
    if (startsFrom !== void 0 && availableHeightPt >= startsFrom) return true;
    const failsUpTo = memo?.failsUpTo.get(key);
    if (failsUpTo !== void 0 && availableHeightPt <= failsUpTo) return false;
    const starts = this.notesStart(footnoteIds, availableHeightPt, contentWidth, payload, splitTailTaken, memo);
    if (memo && starts) memo.startsFrom.set(key, Math.min(startsFrom ?? Infinity, availableHeightPt));
    if (memo && !starts) memo.failsUpTo.set(key, Math.max(failsUpTo ?? -Infinity, availableHeightPt));
    return starts;
  }
  notesStart(footnoteIds, availableHeightPt, contentWidth, payload, splitTailTaken, memo) {
    const packedHeight = (ids) => {
      const key = ids.join(" ");
      let height = memo?.packedHeights.get(key);
      if (height === void 0) {
        height = this.measureFootnotesHeight(
          ids,
          contentWidth,
          payload.continuation,
          payload.partialFootnotes
        );
        memo?.packedHeights.set(key, height);
      }
      return height;
    };
    const placed = [...payload.footnoteIds];
    let placedHeight = packedHeight(placed);
    for (let index = 0; index < footnoteIds.length; index++) {
      this.checkpoint();
      const footnoteId = footnoteIds[index];
      const footnote = this.footnoteRegistry.get(footnoteId);
      if (!footnote) continue;
      if (splitTailTaken) return false;
      const candidateHeight = packedHeight([...placed, footnoteId]);
      if (candidateHeight + FOOTNOTE_MEASUREMENT_GUARD_PT <= availableHeightPt) {
        placed.push(footnoteId);
        placedHeight = candidateHeight;
        continue;
      }
      if (availableHeightPt - placedHeight <= MIN_FOOTNOTE_START_PT) return false;
      const { fits } = this.splitFootnoteToFit(footnote, availableHeightPt, contentWidth, false, {
        footnoteIds: placed,
        continuation: payload.continuation,
        partialFootnotes: payload.partialFootnotes
      });
      return fits.length > 0 && index === footnoteIds.length - 1;
    }
    return true;
  }
  /**
   * Splits a footnote element into parts that fit within the available height.
   * Returns the elements that fit and the elements that need to continue.
   */
  splitFootnoteToFit(footnoteElement, availableHeightPt, contentWidth, forceProgress = false, existingPayload) {
    const layoutContext = this.document.createElement("div");
    layoutContext.style.position = "absolute";
    layoutContext.style.visibility = "hidden";
    layoutContext.style.width = `${contentWidth}pt`;
    layoutContext.style.left = "-9999px";
    layoutContext.className = this.cssPrefix + "footnotes";
    this.appendFootnoteSeparator(layoutContext, false);
    const attachedFootnote = footnoteElement.cloneNode(true);
    layoutContext.appendChild(attachedFootnote);
    this.noteMeasurementHost().appendChild(layoutContext);
    const measureContainer = this.document.createElement("div");
    measureContainer.style.position = "absolute";
    measureContainer.style.visibility = "hidden";
    measureContainer.style.width = `${contentWidth}pt`;
    measureContainer.style.left = "-9999px";
    measureContainer.className = this.cssPrefix + "footnotes";
    const hasContinuation = Boolean(existingPayload?.continuation?.remainingElements.length);
    this.appendFootnoteSeparator(measureContainer, hasContinuation);
    if (hasContinuation) {
      measureContainer.appendChild(this.createFootnoteContinuationWrapper(
        existingPayload.continuation
      ));
    }
    const partialById = new Map(
      existingPayload?.partialFootnotes?.map((partial) => [partial.footnoteId, partial]) ?? []
    );
    for (const id of existingPayload?.footnoteIds ?? []) {
      this.checkpoint();
      const source = this.footnoteRegistry.get(id);
      if (!source) continue;
      const partial = partialById.get(id);
      measureContainer.appendChild(partial ? this.createPartialFootnoteItem(source, partial.fittingElements) : source.cloneNode(true));
    }
    const measuredPartial = this.createPartialFootnoteItem(attachedFootnote, []);
    const measuredContent = measuredPartial.querySelector(":scope > .footnote-content");
    if (!measuredContent) {
      layoutContext.remove();
      throw new Error("Footnote is missing its content shell");
    }
    measureContainer.appendChild(measuredPartial);
    this.noteMeasurementHost().appendChild(measureContainer);
    try {
      this.prepareFootnoteText?.(attachedFootnote);
      this.prepareFootnoteText?.(measureContainer);
      const footnoteContent = attachedFootnote.querySelector(".footnote-content");
      if (!footnoteContent) {
        return {
          fits: Array.from(attachedFootnote.children).map((el) => el.cloneNode(true)),
          overflow: []
        };
      }
      const children = Array.from(footnoteContent.children);
      const fits = [];
      let overflow = [];
      let keptParagraph = false;
      for (let i = 0; i < children.length; i++) {
        this.checkpoint();
        const child = children[i];
        const measuredCandidate = child.cloneNode(true);
        measuredContent.appendChild(measuredCandidate);
        this.prepareFootnoteText?.(measuredCandidate);
        const candidateFits = pxToPt(measureContainer.getBoundingClientRect().height) <= availableHeightPt;
        if (candidateFits) {
          fits.push(child.cloneNode(true));
          continue;
        }
        measuredCandidate.remove();
        const fitsCandidate = (head) => {
          measuredContent.appendChild(head);
          try {
            return pxToPt(measureContainer.getBoundingClientRect().height) <= availableHeightPt;
          } finally {
            head.remove();
          }
        };
        const firstParagraph = this.isBorderGroup(child) ? child.firstElementChild : child;
        keptParagraph = this.fragmentParagraphs && fits.length === 0 && firstParagraph.dataset.keepLines === "true" && this.canRangeFragmentParagraph(firstParagraph, true, false, true);
        const relaxKeepLines = keptParagraph && forceProgress;
        const split = this.canRangeFragmentParagraph(child, true, false, relaxKeepLines) ? this.splitParagraphAtLargestFit(child, fitsCandidate, {
          // Both fallbacks cut where ordinary line breaking would not, so they
          // are only ever right for an element that owns the whole band: with
          // earlier siblings already packed here, a paragraph that will not
          // start belongs intact in the next note band.
          emergencyGraphemeBreaks: fits.length === 0 && forceProgress,
          forceFirstOnNoFit: fits.length === 0 && forceProgress,
          preserveWidowLines: child.dataset.widowControl !== "false"
        }) : null;
        const wrappedSplit = split ? null : this.splitParagraphGroup(child, fitsCandidate, {
          relaxKeepLines: this.fragmentParagraphs && fits.length === 0 && forceProgress,
          forceProgress: fits.length === 0 && forceProgress
        }) ?? this.splitTableContent(child, fitsCandidate, fits.length === 0 && forceProgress);
        if (wrappedSplit) {
          fits.push(wrappedSplit.head);
          wrappedSplit.tail.setAttribute(FOOTNOTE_SOURCE_POSITION_ATTR, i === 0 ? "first" : "later");
          overflow = [wrappedSplit.tail, ...children.slice(i + 1).map((element, offset) => this.cloneFootnoteElementForContinuation(element, i + 1 + offset))];
        } else if (split?.kind === "split") {
          fits.push(split.head);
          split.tail.setAttribute(
            FOOTNOTE_SOURCE_POSITION_ATTR,
            i === 0 ? "first" : "later"
          );
          overflow = [split.tail, ...children.slice(i + 1).map((element, offset) => this.cloneFootnoteElementForContinuation(element, i + 1 + offset))];
        } else if (split?.kind === "no-fit") {
          overflow = children.slice(i).map((element, offset) => this.cloneFootnoteElementForContinuation(element, i + offset));
        } else if (fits.length === 0 && forceProgress) {
          fits.push(child.cloneNode(true));
          overflow = children.slice(i + 1).map((element, offset) => this.cloneFootnoteElementForContinuation(element, i + 1 + offset));
        } else {
          overflow = children.slice(i).map((element, offset) => this.cloneFootnoteElementForContinuation(element, i + offset));
        }
        break;
      }
      return { fits, overflow, keptParagraph };
    } finally {
      measureContainer.remove();
      layoutContext.remove();
    }
  }
  /**
   * Adds footnotes to a page container, including continuation content.
   */
  addPageFootnotes(pageBox, footnoteIds, dims, bands, footnoteHeight, continuation, partialFootnotes, noteBandLimitPt = bands.bodyHeight * MAX_FOOTNOTE_AREA_RATIO) {
    const hasContinuation = continuation && continuation.remainingElements.length > 0;
    if (footnoteIds.length === 0 && !hasContinuation) {
      return;
    }
    if (this.footnoteRegistry.size === 0 && !hasContinuation) {
      return;
    }
    const maxFootnoteHeight = Math.min(footnoteHeight, noteBandLimitPt);
    const footnotesDiv = this.document.createElement("div");
    footnotesDiv.className = `${this.cssPrefix}footnotes`;
    footnotesDiv.style.position = "absolute";
    footnotesDiv.style.bottom = `${dims.pageHeight - (bands.bodyTop + bands.bodyHeight)}pt`;
    footnotesDiv.style.left = `${dims.marginLeft}pt`;
    footnotesDiv.style.width = `${dims.contentWidth}pt`;
    footnotesDiv.style.boxSizing = "border-box";
    footnotesDiv.style.maxHeight = `${maxFootnoteHeight}pt`;
    footnotesDiv.style.overflow = "hidden";
    this.appendFootnoteSeparator(footnotesDiv, Boolean(hasContinuation));
    if (hasContinuation) {
      footnotesDiv.appendChild(this.createFootnoteContinuationWrapper(continuation));
    }
    for (const id of footnoteIds) {
      const partial = partialFootnotes?.find((p) => p.footnoteId === id);
      if (partial) {
        const footnote = this.footnoteRegistry.get(id);
        if (footnote) {
          footnotesDiv.appendChild(
            this.createPartialFootnoteItem(footnote, partial.fittingElements)
          );
        }
      } else {
        const footnote = this.footnoteRegistry.get(id);
        if (footnote) {
          footnotesDiv.appendChild(footnote.cloneNode(true));
        }
      }
    }
    pageBox.appendChild(footnotesDiv);
  }
  /** Select the section's first/odd/even header from its one-based page position. */
  selectHeader(sectionIndex, pageInSection, displayedPageNumber) {
    const sectionHf = this.hfRegistry.get(sectionIndex);
    if (!sectionHf) return void 0;
    if (pageInSection === 1 && sectionHf.headerFirst) {
      return sectionHf.headerFirst;
    }
    if (displayedPageNumber % 2 === 0 && sectionHf.headerEven) {
      return sectionHf.headerEven;
    }
    return sectionHf.headerDefault;
  }
  /**
   * The story KIND (`"first"` / `"even"` / `"default"`) a page position selects — the same
   * decision {@link selectHeader} / {@link selectFooter} make, named rather than resolved to
   * an element, so a page can advertise which OOXML story it is showing.
   */
  storyKindFor(which, sectionIndex, pageInSection, displayedPageNumber) {
    const sectionHf = this.hfRegistry.get(sectionIndex);
    const first = which === "header" ? sectionHf?.headerFirst : sectionHf?.footerFirst;
    const even = which === "header" ? sectionHf?.headerEven : sectionHf?.footerEven;
    if (pageInSection === 1 && first) return "first";
    if (displayedPageNumber % 2 === 0 && even) return "even";
    return "default";
  }
  /** Select the section's first/odd/even footer from its one-based page position. */
  selectFooter(sectionIndex, pageInSection, displayedPageNumber) {
    const sectionHf = this.hfRegistry.get(sectionIndex);
    if (!sectionHf) return void 0;
    if (pageInSection === 1 && sectionHf.footerFirst) {
      return sectionHf.footerFirst;
    }
    if (displayedPageNumber % 2 === 0 && sectionHf.footerEven) {
      return sectionHf.footerEven;
    }
    return sectionHf.footerDefault;
  }
  /**
   * The header, body, and footer bands for one page position.
   *
   * The single owner of "where does anything sit vertically on this page" — placement in
   * {@link createPage}, the body budget the flow loop spends, and the note area's anchor all
   * read it, so those three cannot disagree about where the body ends.
   *
   * Within a flow pass, story values and heights are fixed. STYLEREF documents reconcile page
   * ownership between passes; placement and body budgeting consume the same prepared stories.
   */
  /** The body height a physical page may fill: its body band less any caller-requested reduction. */
  bodyBudgetPt(bodyHeightPt, physicalPageNumber) {
    return Math.max(0, bodyHeightPt - (this.bodyBudgetReductionsPt[physicalPageNumber] ?? 0));
  }
  getPageBands(dims, sectionIndex, pageInSection, displayedPageNumber, physical = displayedPageNumber) {
    const prepared = this.prepareRunningStories(dims, sectionIndex, pageInSection, displayedPageNumber, physical);
    if (prepared) return resolvePageBands(dims, prepared.headerHeight, prepared.footerHeight);
    const sectionHf = this.hfRegistry.get(sectionIndex);
    return resolvePageBands(
      dims,
      this.selectStoryHeight(
        sectionHf?.headerFirstHeight,
        sectionHf?.headerEvenHeight,
        sectionHf?.headerDefaultHeight,
        pageInSection,
        displayedPageNumber
      ),
      this.selectStoryHeight(
        sectionHf?.footerFirstHeight,
        sectionHf?.footerEvenHeight,
        sectionHf?.footerDefaultHeight,
        pageInSection,
        displayedPageNumber
      )
    );
  }
  /**
   * The measured height of the running story this page position selects, mirroring
   * {@link selectHeader}/{@link selectFooter}. Zero when the page has no such story.
   */
  selectStoryHeight(first, even, fallback, pageInSection, displayedPageNumber) {
    if (pageInSection === 1 && first != null) return first;
    if (displayedPageNumber % 2 === 0 && even != null) return even;
    return fallback ?? 0;
  }
  /** Carry the selected header's overhanging frame exclusion into body layout, without its text. */
  headerFramePrefix(dims, section, page, displayed, physical = displayed) {
    const prepared = this.prepareRunningStories(dims, section, page, displayed, physical);
    const source = prepared ? prepared.header : this.selectHeader(section, page, displayed);
    const measured = source ? this.storyFrameExclusions.get(source) ?? [] : [];
    if (measured.length === 0) return [];
    const bands = this.getPageBands(dims, section, page, displayed, physical);
    const offset = bands.headerTop - bands.bodyTop;
    const rectangles = measured.map((rect) => ({ top: Math.max(0, rect.top + offset), bottom: rect.bottom + offset, left: rect.left, right: rect.right })).filter((rect) => rect.bottom > rect.top && rect.right > 0);
    if (rectangles.length === 0) return [];
    const exclusion = this.document.createElement("div");
    exclusion.dataset.docxHeaderExclusion = JSON.stringify(rectangles);
    exclusion.setAttribute("aria-hidden", "true");
    exclusion.style.cssText = `float:left;width:${Math.max(...rectangles.map((rect) => rect.right))}pt;height:${Math.max(...rectangles.map((rect) => rect.bottom))}pt;shape-outside:${this.frameExclusionPolygon(rectangles)}`;
    return [exclusion];
  }
  frameExclusionRectangles(host) {
    const origin = host.getBoundingClientRect();
    return Array.from(host.querySelectorAll("[data-docx-frame-exclusion] > [data-docx-text-frame]")).filter((frame) => !frame.closest("[data-docx-textbox]")).map((frame) => {
      const rect = this.frameExclusionRectangle(frame);
      return { top: pxToPt(rect.top - origin.top), bottom: pxToPt(rect.bottom - origin.top), left: pxToPt(rect.left - origin.left), right: pxToPt(rect.right - origin.left) };
    });
  }
  frameExclusionRectangle(frame, scale = 1) {
    const paint = frame.getBoundingClientRect();
    const distance = (parseFloat(this.view.getComputedStyle(frame).marginRight) || 0) * scale;
    const vertical = ptToPx(Number(frame.dataset.docxFrameClearance ?? 0)) * scale;
    const column = frame.closest("[data-docx-frame-container]").getBoundingClientRect();
    const below = frame.dataset.docxFrameWrap === "notBeside";
    return {
      top: paint.top - vertical,
      bottom: paint.bottom + vertical,
      left: below ? column.left : paint.left - distance,
      right: below ? column.right : paint.right + distance
    };
  }
  frameExclusionPolygon(rectangles) {
    const width = Math.max(...rectangles.map((rect) => rect.right));
    const height = Math.max(...rectangles.map((rect) => rect.bottom));
    if (!(width > 0 && height > 0)) return "none";
    const levels = [.../* @__PURE__ */ new Set([0, ...rectangles.flatMap((rect) => [rect.top, rect.bottom])])].sort((a, b) => a - b);
    const point = (x, y) => `${x / width * 100}% ${y / height * 100}%`;
    const points = [point(0, 0)];
    for (let i = 1; i < levels.length; i++) {
      const top = levels[i - 1], bottom = levels[i];
      const right = Math.max(0, ...rectangles.filter((rect) => rect.top < bottom && rect.bottom > top).map((rect) => rect.right));
      points.push(point(right, top), point(right, bottom));
    }
    points.push(point(0, height));
    return `polygon(${points.join(",")})`;
  }
  /** Probe ordinary flow without changing the preceding paragraphs' float wrapping. */
  unclearedBlockTop(element) {
    const probe = this.document.createElement("div");
    probe.style.cssText = `height:1px;margin-top:${collapsedBlockMarginsPx(this.view, element).topPx}px`;
    element.replaceWith(probe);
    const top = probe.getBoundingClientRect().top;
    probe.replaceWith(element);
    return top;
  }
  /** Lay out each source line in the intervals left by the union of frame rectangles. */
  layoutFrameParagraph(paragraph, rectangles, scale, source = paragraph) {
    const style = this.view.getComputedStyle(paragraph);
    if (!this.hasVisibleText(paragraph.textContent ?? "") && !paragraph.querySelector("img")) return true;
    if (style.direction !== "ltr" || style.writingMode !== "horizontal-tb" || paragraph.querySelector("br,img,svg") || !this.hasRangeFragmentSafeLayout(paragraph, false, true)) return false;
    if (!/^[\u0020-\u024f\s\u2000-\u200a\u2010-\u201f\u2026]*$/u.test(paragraph.textContent ?? "") || style.unicodeBidi.includes("override") || Array.from(paragraph.querySelectorAll("*")).some((node) => {
      const run = this.view.getComputedStyle(node);
      return run.direction !== "ltr" || run.unicodeBidi !== "normal";
    })) return false;
    const box = paragraph.getBoundingClientRect();
    const inset = (side) => (parseFloat(style.getPropertyValue(`padding-${side}`)) + parseFloat(style.getPropertyValue(`border-${side}-width`))) * scale;
    const left = box.left + inset("left"), right = box.right - inset("right");
    const pitch = parseFloat(style.lineHeight) * scale;
    if (!(pitch > 0 && right > left)) return false;
    const holder = this.document.createElement("div");
    holder.style.cssText = `position:absolute;visibility:hidden;width:${(right - left) / scale}px`;
    paragraph.parentElement.appendChild(holder);
    let remaining = source.cloneNode(true);
    for (const line of Array.from(remaining.querySelectorAll("[data-docx-word-line], [data-docx-condensed-line]"))) {
      line.parentElement.removeAttribute("data-docx-word-fit");
      line.replaceWith(...Array.from(line.childNodes));
    }
    remaining.normalize();
    const output = this.document.createDocumentFragment();
    let top = box.top + inset("top"), firstLine = true;
    const measure = (candidate, width) => {
      candidate.style.cssText += `;width:${width / scale}px;margin:0;padding:0;border:0;text-indent:0`;
      holder.appendChild(candidate);
      const range = this.document.createRange();
      range.selectNodeContents(candidate);
      const first = this.rangeEdgeGlyph(range, true), last = this.rangeEdgeGlyph(range, false);
      const rect = candidate.getBoundingClientRect();
      const fits = !this.rangeHasMultipleTextLines(range) && (!first || first.left >= rect.left - 0.1) && (!last || last.right <= rect.right + 0.1) && rect.height <= pitch + 0.1;
      candidate.remove();
      return fits;
    };
    try {
      while (remaining) {
        this.checkpoint();
        holder.appendChild(remaining);
        const start = left + (firstLine ? (parseFloat(style.textIndent) || 0) * scale : 0);
        let intervals = [{ left: start, right }];
        for (const rect of rectangles.filter((rect2) => rect2.top < top + pitch && rect2.bottom > top)) {
          intervals = intervals.flatMap((slot) => rect.right <= slot.left || rect.left >= slot.right ? [slot] : [
            { left: slot.left, right: Math.min(slot.right, rect.left) },
            { left: Math.max(slot.left, rect.right), right: slot.right }
          ].filter((slot2) => slot2.right > slot2.left));
        }
        const line = this.document.createElement("span");
        line.dataset.docxFrameLine = "true";
        line.style.cssText = `display:block;position:relative;height:${pitch / scale}px;text-indent:0;text-align:left`;
        let consumed = false;
        for (const interval of intervals) {
          if (!remaining) break;
          const width = interval.right - interval.left;
          const whole = remaining.cloneNode(true);
          let head;
          if (measure(whole, width)) {
            head = whole;
            remaining.remove();
            remaining = null;
          } else {
            const split = this.splitParagraphAtLargestFit(remaining, (candidate) => measure(candidate, width));
            if (split.kind !== "split") continue;
            head = split.head;
            remaining.replaceWith(split.tail);
            remaining = split.tail;
          }
          consumed = true;
          const slot = this.document.createElement("span");
          slot.dataset.docxFrameSlot = "true";
          slot.style.cssText = `position:absolute;left:${(interval.left - left) / scale}px;top:0;width:${width / scale}px;text-indent:0`;
          slot.style.textAlign = style.textAlign;
          slot.style.textAlignLast = remaining && style.textAlign === "justify" ? "justify" : style.textAlignLast;
          slot.append(...Array.from(head.childNodes));
          line.appendChild(slot);
        }
        if (!consumed) {
          const bottom = Math.min(...rectangles.filter((rect) => rect.bottom > top && rect.top < top + pitch).map((rect) => rect.bottom));
          if (!Number.isFinite(bottom)) return false;
          line.style.height = `${(bottom - top) / scale}px`;
          top = bottom;
        } else {
          top += pitch;
          firstLine = false;
        }
        output.appendChild(line);
      }
      paragraph.replaceChildren(output);
      return true;
    } finally {
      holder.remove();
    }
  }
  prepareFrameExclusions(host, dims, pageNumber = 1) {
    for (const node of Array.from(host.querySelectorAll("[data-docx-frame-line],[data-docx-frame-slot]")).reverse())
      node.replaceWith(...Array.from(node.childNodes));
    for (const proxy of Array.from(host.querySelectorAll("[data-docx-frame-exclusion-segment]"))) proxy.remove();
    const carriers = Array.from(host.querySelectorAll("[data-docx-header-exclusion],[data-docx-frame-exclusion]")).filter((carrier) => !carrier.closest("[data-docx-textbox]"));
    if (!carriers.length) return;
    const reflowsPrefix = carriers.some((carrier) => carrier.querySelector("[data-docx-frame-clearance]"));
    const paragraphSources = new Map(reflowsPrefix ? Array.from(host.querySelectorAll("p,h1,h2,h3,h4,h5,h6")).map((paragraph) => [paragraph, paragraph.cloneNode(true)]) : []);
    for (const carrier of carriers) if (carrier.hasAttribute("data-docx-frame-exclusion")) {
      carrier.style.float = "none";
      carrier.style.position = "absolute";
      carrier.style.left = carrier.style.top = "0";
    }
    const hostRect = host.getBoundingClientRect();
    const pageHost = host.classList.contains(`${this.cssPrefix}box`);
    const pixelsPerPoint = hostRect.width / (pageHost ? dims.pageWidth : dims.contentWidth);
    const pageLeft = hostRect.left - (pageHost ? 0 : dims.marginLeft * pixelsPerPoint);
    for (const carrier of carriers) for (const frame of Array.from(carrier.children)) {
      if (!frame.hasAttribute("data-docx-text-frame")) continue;
      if (reflowsPrefix) {
        frame.dataset.docxFrameTopMargin ??= this.view.getComputedStyle(frame).marginTop;
        frame.style.marginTop = frame.dataset.docxFrameTopMargin;
      }
      const rect = frame.getBoundingClientRect(), anchor = carrier.parentElement.getBoundingClientRect();
      const context = {
        staticLeft: (anchor.left - pageLeft) / pixelsPerPoint,
        paragraphLeft: (anchor.left - pageLeft) / pixelsPerPoint,
        paragraphWidth: anchor.width / pixelsPerPoint
      };
      const left = this.frameHorizontalPosition(frame, dims, pageNumber, context, rect.width / pixelsPerPoint);
      const margin = pxToPt(parseFloat(this.view.getComputedStyle(frame).marginLeft) || 0);
      frame.style.marginLeft = `${margin + left - (rect.left - pageLeft) / pixelsPerPoint}pt`;
    }
    const previous = /* @__PURE__ */ new Map();
    const history = /* @__PURE__ */ new Map();
    const painted = /* @__PURE__ */ new Map();
    const render = (segment, end = Infinity) => {
      const { proxy, origin, scale } = segment;
      const rectangles = segment.rectangles.map((rect) => ({
        top: Math.max(0, rect.top - origin.top),
        bottom: Math.min(end, rect.bottom) - origin.top,
        left: rect.left - origin.left,
        right: rect.right - origin.left
      })).filter((rect) => rect.bottom > rect.top && rect.right > 0);
      proxy.style.width = `${Math.max(0, ...rectangles.map((rect) => rect.right)) / scale}px`;
      proxy.style.height = `${Math.max(0, ...rectangles.map((rect) => rect.bottom)) / scale}px`;
      proxy.style.shapeOutside = this.frameExclusionPolygon(rectangles);
    };
    let supported = true;
    for (const [index, carrier] of carriers.entries()) {
      const context = carrier.closest(`[data-docx-frame-story],.${this.cssPrefix}content`) ?? host;
      const preceding = previous.get(context);
      const header = carrier.dataset.docxHeaderExclusion;
      const anchor = header ? carrier : carrier.parentElement;
      if (preceding) render(preceding, anchor.getBoundingClientRect().top);
      const proxy = header ? carrier : this.document.createElement("div");
      if (!header) {
        proxy.dataset.docxFrameExclusionSegment = "true";
        proxy.setAttribute("aria-hidden", "true");
        anchor.prepend(proxy);
      }
      proxy.style.cssText = "float:left;width:1px;height:0";
      const origin = proxy.getBoundingClientRect(), scale = origin.width;
      const rectangles = (preceding?.rectangles ?? []).filter((rect) => rect.bottom > origin.top);
      const backflow = Array.from(carrier.children).some((frame) => Number(frame.dataset.docxFrameClearance) > 0);
      if (header) {
        for (const rect of JSON.parse(header)) rectangles.push({
          top: origin.top + ptToPx(rect.top) * scale,
          bottom: origin.top + ptToPx(rect.bottom) * scale,
          left: origin.left + ptToPx(rect.left) * scale,
          right: origin.left + ptToPx(rect.right) * scale
        });
      } else for (const frame of Array.from(carrier.children)) {
        const rect = frame.getBoundingClientRect();
        painted.set(frame, { top: rect.top, scale });
        rectangles.push(this.frameExclusionRectangle(frame, scale));
      }
      const segment = { proxy, anchor, origin, scale, rectangles };
      const segments = [...history.get(context) ?? [], segment];
      history.set(context, segments);
      const accumulated = segments.flatMap((segment2) => segment2.rectangles);
      render(segment);
      const next = carriers.slice(index + 1).find((other) => (other.closest(`[data-docx-frame-story],.${this.cssPrefix}content`) ?? host) === context);
      const between = (node) => (backflow || !!(carrier.compareDocumentPosition(node) & this.view.Node.DOCUMENT_POSITION_FOLLOWING)) && (!next || !!(node.compareDocumentPosition(next) & this.view.Node.DOCUMENT_POSITION_FOLLOWING)) && !node.closest("[data-docx-text-frame]");
      const obstacles = Array.from(context.querySelectorAll("table,hr,div,p")).filter((node) => {
        if (!between(node) || node.matches("[data-docx-frame-container],[data-docx-frame-exclusion],[data-docx-frame-exclusion-segment],[data-docx-header-exclusion]")) return false;
        const style = this.view.getComputedStyle(node);
        return node.matches("table,hr") || ["flow-root", "flex", "grid", "inline-block"].includes(style.display) || style.overflow !== "visible" || style.columnCount !== "auto" || style.columnWidth !== "auto";
      });
      for (const paragraph of Array.from(context.querySelectorAll("p,h1,h2,h3,h4,h5,h6")).filter(between)) {
        if (obstacles.some((obstacle) => obstacle.contains(paragraph))) continue;
        const bounds = paragraph.getBoundingClientRect();
        if (rectangles.some((rect) => rect.bottom > bounds.top && rect.top < bounds.bottom) && (backflow || rectangles.some((rect) => rect.left > bounds.left)) && !this.layoutFrameParagraph(paragraph, backflow ? accumulated : rectangles, scale, paragraphSources.get(paragraph))) supported = false;
      }
      for (const obstacle of obstacles) {
        const bounds = obstacle.getBoundingClientRect(), top = this.unclearedBlockTop(obstacle);
        if (rectangles.some((rect) => (backflow || rect.left > origin.left) && rect.top < top + bounds.height && rect.bottom > top))
          supported = false;
      }
      if (backflow) {
        for (const [frame, fixed] of painted) {
          const offset = (fixed.top - frame.getBoundingClientRect().top) / fixed.scale;
          frame.style.marginTop = `${(parseFloat(this.view.getComputedStyle(frame).marginTop) || 0) + offset}px`;
        }
        for (const prior of segments) prior.proxy.style.cssText = "float:left;width:1px;height:0";
        for (const prior of segments) prior.origin = prior.proxy.getBoundingClientRect();
        segments.forEach((prior, index2) => render(prior, segments[index2 + 1]?.anchor.getBoundingClientRect().top));
      }
      previous.set(context, segment);
    }
    if (pageHost && supported) for (const carrier of carriers) {
      for (const frame of Array.from(carrier.querySelectorAll("[data-docx-frame-pending]"))) {
        for (const name of ["data-docx-frame-pending", "data-docx-shape", "data-content-type", "data-element-name", "title"])
          frame.removeAttribute(name);
      }
    }
  }
  /**
   * Measures the content height of a header or footer element.
   *
   * This is what tells {@link resolvePageBands} whether the story stays inside its margin or
   * pushes the body, so it must measure the story ALONE — any padding added here would have to
   * be added to the rendered band too, and the two drifting apart is exactly how a header
   * silently starts overlapping body text.
   */
  measureHeaderFooterHeight(source, dims, physical = 1) {
    const measureContainer = this.document.createElement("div");
    measureContainer.style.position = "absolute";
    measureContainer.style.visibility = "hidden";
    measureContainer.style.width = `${dims.contentWidth}pt`;
    measureContainer.style.left = "-9999px";
    measureContainer.style.display = "flex";
    measureContainer.style.flexDirection = "column";
    for (const child of Array.from(source.childNodes)) {
      measureContainer.appendChild(child);
    }
    this.stagingElement.appendChild(measureContainer);
    if (measureContainer.querySelector("[data-docx-frame-exclusion],[data-docx-frame-flow]") && !measureContainer.querySelector("[data-docx-frame-story]")) {
      const flow = this.document.createElement("div");
      flow.dataset.docxFrameStory = "true";
      let previousAfter = 0;
      for (const child of Array.from(measureContainer.children)) {
        const margins = this.view.getComputedStyle(child);
        const slot = this.document.createElement("div");
        slot.style.paddingTop = `${Math.max(previousAfter, parseFloat(margins.marginTop) || 0) - previousAfter}px`;
        slot.style.paddingBottom = margins.marginBottom;
        if (child.dataset.docxFrameContainer !== "true" || child.dataset.docxFrameFlow === "true") {
          previousAfter = parseFloat(margins.marginBottom) || 0;
        }
        child.style.marginTop = child.style.marginBottom = "0";
        slot.appendChild(child);
        flow.appendChild(slot);
      }
      measureContainer.appendChild(flow);
    } else if (!measureContainer.querySelector("[data-docx-frame-story],[data-docx-story-flow]")) {
      const flow = this.document.createElement("div");
      flow.dataset.docxStoryFlow = "true";
      flow.append(...Array.from(measureContainer.childNodes));
      measureContainer.appendChild(flow);
    }
    const frameStory = measureContainer.querySelector("[data-docx-frame-story]");
    if (frameStory) frameStory.style.height = "";
    if (this.fragmentParagraphs) this.fitOverwideTables(measureContainer, dims);
    this.prepareStoryText?.(measureContainer);
    this.prepareFrameExclusions(measureContainer, dims, physical);
    if (frameStory) {
      const top = frameStory.getBoundingClientRect().top;
      frameStory.style.height = `${(frameStory.lastElementChild?.getBoundingClientRect().bottom ?? top) - top}px`;
    }
    for (const element of Array.from(measureContainer.querySelectorAll("[data-source-anchor-id]")))
      this.captureSourceTextClip(element);
    const rect = measureContainer.getBoundingClientRect();
    const heightPt = pxToPt(rect.height);
    this.storyFrameExclusions.set(source, this.frameExclusionRectangles(measureContainer));
    source.replaceChildren(...Array.from(measureContainer.childNodes));
    this.stagingElement.removeChild(measureContainer);
    return heightPt;
  }
  /**
   * Flows measured blocks into page containers.
   * Implements a single-pass, forward-only algorithm that is compatible with future lazy loading.
   * Supports footnote continuation - long footnotes can split across pages.
   */
  flowToPages(blocks, dims, startPageNumber, sectionIndex, sectionDimensions) {
    const pages = [];
    let currentContent = [];
    let pageNumber = startPageNumber;
    let pageSectionIndex = sectionIndex;
    const sectionStartPages = /* @__PURE__ */ new Map([[sectionIndex, startPageNumber]]);
    const pageInSection = (owner = pageSectionIndex, physicalPage = pageNumber) => physicalPage - (sectionStartPages.get(owner) ?? physicalPage) + 1;
    const dimensionsFor = (owner = pageSectionIndex) => sectionDimensions.get(owner) ?? dims;
    const hasExclusions = this.hasFlowExclusion(blocks.map((block) => block.element));
    const reflowsPrefix = blocks.some((block) => block.element.querySelector("[data-docx-frame-clearance]"));
    const measureOnPage = (chain, page, preceding = [], owner = pageSectionIndex, physical = pageNumber) => {
      const prefix = pagePrefix(preceding, owner, physical);
      if (!hasExclusions && prefix.length === 0) return chain;
      return chain.map((source) => {
        const element = source.element.cloneNode(true);
        this.prepareShapeClearance(element, page);
        element.dataset.paginationPhysicalPage = String(physical);
        const { heightPt, frameExtentPt, clearancePt, marginTopPt, marginBottomPt } = this.measureElement(element, page, source.sectionIndex, prefix, physical);
        prefix.push(element);
        return { ...source, element, heightPt, frameExtentPt, clearancePt, marginTopPt, marginBottomPt };
      });
    };
    const markSectionPlaced = (owner) => {
      if (!sectionStartPages.has(owner)) sectionStartPages.set(owner, pageNumber);
    };
    const previousBox = this.containerElement.querySelector(
      `.${this.cssPrefix}box:last-of-type`
    );
    let precedingDisplayedPageNumber = parseInt(
      previousBox?.dataset.displayedPageNumber ?? "0",
      10
    );
    const displayedPageNumber = (owner = pageSectionIndex, ownerPageInSection = pageInSection(owner), physicalPage = pageNumber) => {
      const numbering = this.pageNumbering.get(owner) ?? {};
      if (numbering.start !== void 0) {
        return numbering.start + ownerPageInSection - 1;
      }
      const ownerNumbering = this.pageNumbering.get(pageSectionIndex) ?? {};
      const currentPhysicalNumber = ownerNumbering.start !== void 0 ? ownerNumbering.start + pageInSection(pageSectionIndex) - 1 : precedingDisplayedPageNumber + 1;
      return currentPhysicalNumber + physicalPage - pageNumber;
    };
    const pagePrefix = (preceding, owner = pageSectionIndex, physical = pageNumber) => {
      const page = pageInSection(owner, physical);
      const prefix = [...this.headerFramePrefix(
        dimensionsFor(owner),
        owner,
        page,
        displayedPageNumber(owner, page, physical),
        physical
      ), ...preceding];
      return reflowsPrefix || this.hasFlowExclusion(prefix) ? prefix : [];
    };
    let effectiveContentHeight = this.bodyBudgetPt(this.getPageBands(
      dimensionsFor(),
      pageSectionIndex,
      pageInSection(),
      displayedPageNumber(),
      pageNumber
    ).bodyHeight, pageNumber);
    let remainingHeight = effectiveContentHeight;
    let prevMarginBottomPt = 0;
    let prevDroppedLeadingPt = 0;
    let currentFootnoteIds = [];
    let currentPageHasFootnoteReference = false;
    let currentFootnoteHeight = 0;
    let currentContinuation = this.pendingFootnoteContinuation;
    let nextPageContinuation = null;
    let currentContinuationPartitioned = false;
    let continuationRunsOn = false;
    let currentPageAdmitted = false;
    let deferredFootnoteIds = [];
    let currentPartialFootnotes = [];
    const noteBandLimit = (bodyHeight) => Math.max(0, Math.min(
      bodyHeight * MAX_FOOTNOTE_AREA_RATIO,
      bodyHeight - (effectiveContentHeight - remainingHeight - prevMarginBottomPt - prevDroppedLeadingPt)
    ));
    const adoptEmptyPageOwner = (owner) => {
      pageSectionIndex = owner;
      const bands = this.getPageBands(
        dimensionsFor(owner),
        owner,
        pageInSection(owner),
        displayedPageNumber(owner),
        pageNumber
      );
      effectiveContentHeight = this.bodyBudgetPt(bands.bodyHeight, pageNumber);
      remainingHeight = effectiveContentHeight;
    };
    const admitCurrentPage = () => {
      if (currentPageAdmitted) return;
      this.admitPageAllocation();
      currentPageAdmitted = true;
    };
    const prepareCurrentContinuation = () => {
      if (currentContinuationPartitioned || (currentContinuation?.remainingElements.length ?? 0) === 0) return;
      admitCurrentPage();
      const ownedDimensions = dimensionsFor();
      const pageBands = this.getPageBands(
        ownedDimensions,
        pageSectionIndex,
        pageInSection(),
        displayedPageNumber(),
        pageNumber
      );
      const partition = this.splitContinuationForPage(
        currentContinuation,
        noteBandLimit(pageBands.bodyHeight),
        ownedDimensions.contentWidth
      );
      currentContinuation = partition.current;
      continuationRunsOn = partition.overflow !== null;
      if (partition.overflow) {
        nextPageContinuation = partition.overflow;
        deferredFootnoteIds = [...currentFootnoteIds, ...deferredFootnoteIds];
        currentFootnoteIds = [];
      }
      currentContinuationPartitioned = true;
      currentFootnoteHeight = this.measureFootnotesHeight(
        currentFootnoteIds,
        ownedDimensions.contentWidth,
        currentContinuation,
        currentPartialFootnotes
      );
    };
    const finishPage = (nextPageSectionIndex = pageSectionIndex, forceEmptyPage = false) => {
      const hasCurrentContinuation = (currentContinuation?.remainingElements.length ?? 0) > 0;
      if (!forceEmptyPage && currentContent.length === 0 && currentFootnoteIds.length === 0 && !hasCurrentContinuation) {
        adoptEmptyPageOwner(nextPageSectionIndex);
        return;
      }
      prepareCurrentContinuation();
      admitCurrentPage();
      let pageContinuation = currentContinuation;
      const ownedPageInSection = pageInSection();
      const ownedDimensions = dimensionsFor();
      const ownedDisplayedPageNumber = displayedPageNumber(
        pageSectionIndex,
        ownedPageInSection
      );
      const pageBands = this.getPageBands(
        ownedDimensions,
        pageSectionIndex,
        ownedPageInSection,
        ownedDisplayedPageNumber,
        pageNumber
      );
      const maxFootnoteHeight = noteBandLimit(pageBands.bodyHeight);
      pageContinuation = currentContinuation;
      currentFootnoteHeight = this.measureFootnotesHeight(
        currentFootnoteIds,
        ownedDimensions.contentWidth,
        pageContinuation,
        currentPartialFootnotes
      );
      if (currentContent.length === 0 && currentFootnoteIds.length > 0 && currentPartialFootnotes.length === 0) {
        const fittingIds = [];
        for (let index = 0; index < currentFootnoteIds.length; index++) {
          const footnoteId = currentFootnoteIds[index];
          const candidateIds = [...fittingIds, footnoteId];
          const candidateHeight = this.measureFootnotesHeight(
            candidateIds,
            ownedDimensions.contentWidth,
            pageContinuation
          );
          const guardedCandidateHeight = candidateHeight + FOOTNOTE_MEASUREMENT_GUARD_PT;
          if (guardedCandidateHeight <= maxFootnoteHeight) {
            fittingIds.push(footnoteId);
            currentFootnoteHeight = guardedCandidateHeight;
            continue;
          }
          const hasPageContinuation = (pageContinuation?.remainingElements.length ?? 0) > 0;
          if (fittingIds.length === 0 && !hasPageContinuation) {
            const source = this.footnoteRegistry.get(footnoteId);
            const split = source ? this.splitFootnoteToFit(
              source,
              maxFootnoteHeight,
              ownedDimensions.contentWidth,
              true
            ) : null;
            fittingIds.push(footnoteId);
            if (source && split && split.fits.length > 0 && split.overflow.length > 0) {
              currentPartialFootnotes.push({ footnoteId, fittingElements: split.fits });
              nextPageContinuation = {
                footnoteId,
                sourceAnchorId: source.dataset.sourceAnchorId,
                remainingElements: split.overflow
              };
              currentFootnoteHeight = maxFootnoteHeight;
            } else {
              currentFootnoteHeight = guardedCandidateHeight;
            }
            deferredFootnoteIds.push(...currentFootnoteIds.slice(index + 1));
          } else {
            deferredFootnoteIds.push(...currentFootnoteIds.slice(index));
          }
          break;
        }
        currentFootnoteIds = fittingIds;
      }
      const page = this.createPage(
        ownedDimensions,
        pageNumber,
        pageSectionIndex,
        ownedDisplayedPageNumber,
        currentContent,
        ownedPageInSection,
        currentFootnoteIds,
        currentFootnoteHeight,
        pageContinuation,
        currentPartialFootnotes.length > 0 ? currentPartialFootnotes : void 0,
        false,
        currentPageAdmitted,
        maxFootnoteHeight
      );
      pages.push(page);
      precedingDisplayedPageNumber = ownedDisplayedPageNumber;
      pageNumber++;
      currentContent = [];
      pageSectionIndex = nextPageSectionIndex;
      if (!sectionStartPages.has(pageSectionIndex)) {
        sectionStartPages.set(pageSectionIndex, pageNumber);
      }
      const newBands = this.getPageBands(
        dimensionsFor(),
        pageSectionIndex,
        pageInSection(),
        displayedPageNumber(),
        pageNumber
      );
      effectiveContentHeight = this.bodyBudgetPt(newBands.bodyHeight, pageNumber);
      remainingHeight = effectiveContentHeight;
      prevMarginBottomPt = 0;
      prevDroppedLeadingPt = 0;
      currentFootnoteIds = [];
      currentPageHasFootnoteReference = false;
      currentPartialFootnotes = [];
      currentContinuation = nextPageContinuation;
      nextPageContinuation = null;
      currentContinuationPartitioned = false;
      continuationRunsOn = false;
      currentPageAdmitted = false;
      if (deferredFootnoteIds.length > 0) {
        currentFootnoteIds = [...deferredFootnoteIds];
        deferredFootnoteIds = [];
      }
      const nextDimensions = dimensionsFor();
      currentFootnoteHeight = currentContinuation ? 0 : this.measureFootnotesHeight(currentFootnoteIds, nextDimensions.contentWidth);
    };
    const pageHasPayload = () => currentContent.length > 0 || currentFootnoteIds.length > 0 || (currentContinuation?.remainingElements.length ?? 0) > 0;
    const laterNotesClosed = () => nextPageContinuation !== null || deferredFootnoteIds.length > 0;
    const retriedKeepChains = /* @__PURE__ */ new Set();
    const releasedKeepPredecessors = /* @__PURE__ */ new Set();
    for (let i = 0; i < blocks.length; i++) {
      this.checkpoint();
      const sourceBlock = blocks[i];
      let block = sourceBlock;
      const allBlockFootnoteIds = this.extractFootnoteRefs(block.element);
      if (block.sectionIndex !== pageSectionIndex && currentPageHasFootnoteReference && (!this.footnoteLayoutLikeWord8 || allBlockFootnoteIds.length > 0)) {
        finishPage(block.sectionIndex);
      }
      const pageIsEmpty = currentContent.length === 0 && currentFootnoteIds.length === 0 && (currentContinuation?.remainingElements.length ?? 0) === 0;
      if (pageIsEmpty && block.sectionIndex !== pageSectionIndex) {
        adoptEmptyPageOwner(block.sectionIndex);
      }
      prepareCurrentContinuation();
      if (continuationRunsOn && currentContent.length === 0) {
        finishPage(block.sectionIndex);
        i--;
        continue;
      }
      if (currentFootnoteHeight > 0) {
        const ownerDimensions = dimensionsFor();
        const ownerBands = this.getPageBands(
          ownerDimensions,
          pageSectionIndex,
          pageInSection(),
          displayedPageNumber(),
          pageNumber
        );
        const ownerMaxFootnoteArea = ownerBands.bodyHeight * MAX_FOOTNOTE_AREA_RATIO;
        if (currentFootnoteHeight > ownerMaxFootnoteArea) {
          const fittingIds = [];
          let fittingHeight = 0;
          if ((currentContinuation?.remainingElements.length ?? 0) === 0 && currentPartialFootnotes.length === 0) {
            for (const footnoteId of currentFootnoteIds) {
              this.checkpoint();
              const candidateHeight = this.measureFootnotesHeight(
                [...fittingIds, footnoteId],
                ownerDimensions.contentWidth
              );
              if (candidateHeight + FOOTNOTE_MEASUREMENT_GUARD_PT > ownerMaxFootnoteArea) break;
              fittingIds.push(footnoteId);
              fittingHeight = candidateHeight;
            }
          }
          if (fittingIds.length > 0) {
            deferredFootnoteIds = [
              ...currentFootnoteIds.slice(fittingIds.length),
              ...deferredFootnoteIds
            ];
            currentFootnoteIds = fittingIds;
            currentFootnoteHeight = fittingHeight;
          } else {
            finishPage(block.sectionIndex);
            i--;
            continue;
          }
        }
      }
      const blockDimensions = dimensionsFor(block.sectionIndex);
      const noteWidth = dimensionsFor().contentWidth;
      block = measureOnPage([sourceBlock], dimensionsFor(), currentContent)[0];
      if (this.fragmentParagraphs && currentContent.length === 0 && block.heightPt > effectiveContentHeight) {
        const fitted = this.fitBlockPicturesToPage(block, blockDimensions, effectiveContentHeight);
        if (fitted) {
          blocks[i] = fitted;
          i--;
          continue;
        }
      }
      const nextBlockPageInSection = pageInSection(block.sectionIndex, pageNumber + 1);
      const freshBlockPageBodyHeight = this.getPageBands(
        blockDimensions,
        block.sectionIndex,
        nextBlockPageInSection,
        displayedPageNumber(block.sectionIndex, nextBlockPageInSection, pageNumber + 1),
        pageNumber + 1
      ).bodyHeight;
      const freshMeasured = measureOnPage([sourceBlock], blockDimensions, [], block.sectionIndex, pageNumber + 1)[0];
      const freshBlockHeight = Math.max(freshMeasured.heightPt, freshMeasured.frameExtentPt ?? 0) + this.effectiveBlockMarginTop(freshMeasured, 0, true, nextBlockPageInSection);
      if (block.isPageBreak) {
        finishPage(block.sectionIndex);
        continue;
      }
      if (block.pageBreakBefore && currentContent.length > 0) {
        finishPage(block.sectionIndex);
        i--;
        continue;
      }
      const previousBlock = blocks[i - 1];
      const startsKeepChain = !previousBlock || !previousBlock.keepWithNext || previousBlock.isPageBreak || block.pageBreakBefore;
      const pageHasOccupiedSpace = currentContent.length > 0 || currentFootnoteHeight > 0;
      if (!pageHasOccupiedSpace && block.keepWithNext && startsKeepChain) {
        const chain = this.getKeepWithNextChain(blocks, i);
        const last = chain[chain.length - 1];
        if (chain.length > 1 && this.fragmentParagraphs && last.keepLines && this.isWordParagraphElement(last.element) && this.collectNewFootnoteIds(chain, currentFootnoteIds).length > 0) {
          retriedKeepChains.add(sourceBlock);
          releasedKeepPredecessors.add(last);
        }
      }
      if (pageHasOccupiedSpace && block.keepWithNext && startsKeepChain && !retriedKeepChains.has(sourceBlock)) {
        const sourceChain = this.getKeepWithNextChain(blocks, i);
        const keepChain = measureOnPage(sourceChain, dimensionsFor(), currentContent);
        if (keepChain.length > 1) {
          const newChainFootnoteIds = this.collectNewFootnoteIds(
            keepChain,
            currentFootnoteIds
          );
          const chainNotesStart = (bodyPt, bandPt, payload, closed, ids = newChainFootnoteIds, width = noteWidth) => ids.length === 0 || this.footnoteRegistry.size === 0 || this.notesCanStartOnPage(
            ids,
            bandPt - bodyPt,
            width,
            payload,
            closed
          );
          const currentChain = this.measureKeepWithNextChainHeight(
            keepChain,
            prevMarginBottomPt,
            currentContent.length === 0,
            pageInSection(block.sectionIndex)
          );
          const currentChainHeight = Math.max(currentChain.flowHeight, currentChain.frameBottom);
          const currentAvailableHeight = remainingHeight - currentFootnoteHeight;
          const canDeferChainNote = this.fragmentParagraphs && keepChain[keepChain.length - 1].keepLines && this.isWordParagraphElement(keepChain[keepChain.length - 1].element) && newChainFootnoteIds.length > 0 && currentPageHasFootnoteReference && currentFootnoteIds.length > 0 && !laterNotesClosed();
          const chainFitsHere = currentChainHeight <= currentAvailableHeight && (canDeferChainNote || chainNotesStart(currentChainHeight, remainingHeight, {
            footnoteIds: currentFootnoteIds,
            continuation: currentContinuation,
            partialFootnotes: currentPartialFootnotes
          }, laterNotesClosed()));
          if (!chainFitsHere) {
            const marginTop = this.effectiveBlockMarginTop(
              block,
              prevMarginBottomPt,
              currentContent.length === 0,
              pageInSection(block.sectionIndex)
            );
            const unkept = this.tryFragmentParagraphGroup(block, blockDimensions, (head) => head.lastElementChild.dataset.keepWithNext !== "true" && marginTop + this.measureElement(head, blockDimensions, block.sectionIndex).heightPt <= currentAvailableHeight);
            if (unkept) {
              blocks.splice(i, 1, ...unkept);
              i--;
              continue;
            }
            const last = keepChain[keepChain.length - 1];
            const canRelaxChain = this.fragmentParagraphs && last.keepLines && this.isWordParagraphElement(last.element) && newChainFootnoteIds.length > 0;
            const precedingNoteIds = this.collectNewFootnoteIds(keepChain.slice(0, -1), currentFootnoteIds);
            const fragmentLast = (chain, measured, available, band, payload, closed, preceding, width = noteWidth) => {
              const last2 = chain[chain.length - 1];
              if (measured.frameBottom > available) return null;
              const beforeLastHeight = measured.flowHeight - last2.heightPt;
              return this.tryFragmentParagraph(
                last2,
                dimensionsFor(last2.sectionIndex),
                available - beforeLastHeight,
                0,
                (ids, headHeight) => chainNotesStart(
                  Math.max(beforeLastHeight + headHeight, measured.frameBottom),
                  band,
                  payload,
                  closed,
                  [.../* @__PURE__ */ new Set([...precedingNoteIds, ...ids])].filter((id) => !currentFootnoteIds.includes(id)),
                  width
                ),
                [...preceding, ...chain.slice(0, -1).map((item) => item.element)]
              );
            };
            const fragments = fragmentLast(keepChain, currentChain, currentAvailableHeight, remainingHeight, {
              footnoteIds: currentFootnoteIds,
              continuation: currentContinuation,
              partialFootnotes: currentPartialFootnotes
            }, laterNotesClosed(), pagePrefix(currentContent));
            if (fragments) {
              blocks.splice(i + keepChain.length - 1, 1, ...fragments);
              i--;
              continue;
            }
            const nextPageBands = this.getPageBands(
              dimensionsFor(block.sectionIndex),
              block.sectionIndex,
              pageInSection(block.sectionIndex, pageNumber + 1),
              displayedPageNumber(
                block.sectionIndex,
                pageInSection(block.sectionIndex, pageNumber + 1),
                pageNumber + 1
              ),
              pageNumber + 1
            );
            const freshChain = measureOnPage(sourceChain, blockDimensions, [], block.sectionIndex, pageNumber + 1);
            const freshChainMeasurement = this.measureKeepWithNextChainHeight(
              freshChain,
              0,
              true,
              pageInSection(block.sectionIndex, pageNumber + 1)
            );
            const freshChainBodyHeight = Math.max(freshChainMeasurement.flowHeight, freshChainMeasurement.frameBottom);
            if (freshChainBodyHeight <= nextPageBands.bodyHeight && (canRelaxChain || chainNotesStart(
              freshChainBodyHeight,
              nextPageBands.bodyHeight,
              { footnoteIds: [], continuation: null, partialFootnotes: [] },
              false,
              newChainFootnoteIds,
              blockDimensions.contentWidth
            )) || fragmentLast(
              freshChain,
              freshChainMeasurement,
              nextPageBands.bodyHeight,
              nextPageBands.bodyHeight,
              { footnoteIds: [], continuation: null, partialFootnotes: [] },
              false,
              pagePrefix([], block.sectionIndex, pageNumber + 1),
              blockDimensions.contentWidth
            ) !== null) {
              if (canRelaxChain) {
                retriedKeepChains.add(sourceBlock);
                releasedKeepPredecessors.add(sourceChain[sourceChain.length - 1]);
              }
              finishPage(block.sectionIndex);
              i--;
              continue;
            }
          }
        }
      }
      if (this.fragmentParagraphs && nextPageContinuation && currentContent.length > 0) {
        finishPage(block.sectionIndex);
        i--;
        continue;
      }
      const newFootnoteIds = this.collectNewFootnoteIds([block], currentFootnoteIds);
      let combinedFootnoteHeight = currentFootnoteHeight;
      let additionalFootnoteHeight = 0;
      if (newFootnoteIds.length > 0 && this.footnoteRegistry.size > 0) {
        const combinedFootnoteIds = [...currentFootnoteIds, ...newFootnoteIds];
        combinedFootnoteHeight = this.measureFootnotesHeight(
          combinedFootnoteIds,
          noteWidth,
          currentContinuation,
          currentPartialFootnotes
        );
        additionalFootnoteHeight = Math.max(
          0,
          combinedFootnoteHeight - currentFootnoteHeight
        );
      }
      const isFirstOnPage = currentContent.length === 0;
      const effectiveMarginTop = this.effectiveBlockMarginTop(
        block,
        prevMarginBottomPt,
        isFirstOnPage,
        pageInSection(block.sectionIndex)
      );
      const nextColumn = blocks[i + 1];
      if (block.element.dataset.paginationColumnTail === "true" && nextColumn && nextColumn.sectionIndex === block.sectionIndex && nextColumn.element.dataset.paginationColumns === "true" && block.heightPt + effectiveMarginTop <= remainingHeight - currentFootnoteHeight - additionalFootnoteHeight && !this.columnContainerOverflows(block.element, blockDimensions)) {
        const joined = block.element.cloneNode(true);
        for (const child of Array.from(nextColumn.element.children)) {
          const clone = child.cloneNode(true);
          if (clone.dataset.paginationColumnSpaceBefore) clone.style.marginTop = clone.dataset.paginationColumnSpaceBefore;
          joined.appendChild(clone);
        }
        blocks.splice(i, 2, this.measureElement(joined, blockDimensions, block.sectionIndex));
        i--;
        continue;
      }
      const columnFragments = this.reflowColumns(
        block,
        blockDimensions,
        remainingHeight - currentFootnoteHeight - additionalFootnoteHeight - effectiveMarginTop
      );
      if (columnFragments) {
        blocks.splice(i, 1, ...columnFragments);
        i--;
        continue;
      }
      const aboveNotes = currentFootnoteHeight > 0 || newFootnoteIds.length > 0;
      const ownHeight = newFootnoteIds.length > 0 && block.element.dataset.widowControl !== "false" ? block.heightPt : this.fitHeightPt(block, aboveNotes);
      const requiredHeight = Math.max(ownHeight, block.frameExtentPt ?? 0);
      const blockSpace = effectiveMarginTop + requiredHeight + additionalFootnoteHeight;
      const effectiveRemainingHeight = remainingHeight - currentFootnoteHeight;
      const bodyContentUsed = effectiveContentHeight - remainingHeight;
      const maxFootnoteArea = effectiveContentHeight * MAX_FOOTNOTE_AREA_RATIO;
      const notePayload = {
        footnoteIds: currentFootnoteIds,
        continuation: currentContinuation,
        partialFootnotes: currentPartialFootnotes
      };
      const noteBandWith = (bodyPt) => Math.min(
        maxFootnoteArea,
        effectiveContentHeight - bodyContentUsed - Math.max(
          bodyPt,
          effectiveMarginTop + (block.frameExtentPt ?? 0)
        )
      );
      const noteStartMemo = { packedHeights: /* @__PURE__ */ new Map(), startsFrom: /* @__PURE__ */ new Map(), failsUpTo: /* @__PURE__ */ new Map() };
      const headNotesStart = (footnoteIds, headHeightPt) => {
        const headIds = footnoteIds.filter((id) => !currentFootnoteIds.includes(id));
        return headIds.length === 0 || this.notesCanStartOnPage(
          headIds,
          noteBandWith(effectiveMarginTop + headHeightPt),
          noteWidth,
          notePayload,
          laterNotesClosed(),
          noteStartMemo
        );
      };
      if (effectiveMarginTop + ownHeight > effectiveRemainingHeight) {
        const fragments = this.tryFragmentParagraph(
          block,
          blockDimensions,
          effectiveRemainingHeight,
          effectiveMarginTop,
          headNotesStart,
          pagePrefix(currentContent),
          // A keep cannot be satisfied by a paragraph taller than a fresh page. Once it has
          // moved there, use the same line-safe split as a kept citation, retaining two lines
          // on either side when widow control applies. Unresolved notes still stay guarded.
          (block.keepLines || block.element.dataset.widowControl === "true") && isFirstOnPage && block.heightPt > freshBlockPageBodyHeight && allBlockFootnoteIds.every((id) => this.footnoteRegistry.has(id)),
          isFirstOnPage && currentFootnoteHeight === 0 && !currentContinuation && block.heightPt > freshBlockPageBodyHeight,
          currentFootnoteHeight > 0
        ) ?? this.tryFragmentTable(
          block,
          blockDimensions,
          effectiveRemainingHeight,
          effectiveMarginTop,
          headNotesStart
        );
        if (fragments) {
          blocks.splice(i, 1, ...fragments);
          i--;
          continue;
        }
        if (pageHasPayload() && block.element.dataset.paginationColumns === "true" && Array.from(block.element.querySelectorAll("table")).some((table) => !this.canFragmentColumnTable(table, block.element))) {
          block.element.dataset.docxColumnTableDeferred = "true";
          sourceBlock.element.dataset.docxColumnTableDeferred = "true";
        }
      }
      if (blockSpace <= effectiveRemainingHeight && (newFootnoteIds.length === 0 || !laterNotesClosed() && combinedFootnoteHeight + FOOTNOTE_MEASUREMENT_GUARD_PT <= maxFootnoteArea)) {
        markSectionPlaced(block.sectionIndex);
        const availablePt = effectiveRemainingHeight - effectiveMarginTop - additionalFootnoteHeight;
        currentContent.push(this.cloneBlockForPage(
          block,
          isFirstOnPage,
          pageInSection(block.sectionIndex),
          availablePt
        ));
        remainingHeight -= effectiveMarginTop + block.heightPt + block.marginBottomPt;
        prevMarginBottomPt = block.marginBottomPt;
        prevDroppedLeadingPt = this.droppedLeadingPt(block, availablePt);
        if (newFootnoteIds.length > 0) {
          currentFootnoteIds.push(...newFootnoteIds);
          currentFootnoteHeight = combinedFootnoteHeight;
        }
        currentPageHasFootnoteReference ||= allBlockFootnoteIds.length > 0;
      } else if (freshBlockHeight <= freshBlockPageBodyHeight) {
        const blockSpaceWithoutFootnotes = effectiveMarginTop + requiredHeight;
        if (newFootnoteIds.length > 0 && blockSpaceWithoutFootnotes <= effectiveRemainingHeight) {
          const table = this.blockTable(block.element);
          const turnHelps = noteBandWith(blockSpaceWithoutFootnotes) - currentFootnoteHeight < freshBlockPageBodyHeight * MAX_FOOTNOTE_AREA_RATIO;
          if ((this.fragmentParagraphs || table) && turnHelps && !this.notesCanStartOnPage(
            newFootnoteIds,
            noteBandWith(blockSpaceWithoutFootnotes),
            noteWidth,
            notePayload,
            laterNotesClosed(),
            noteStartMemo
          )) {
            const fragments = this.tryFragmentParagraph(
              block,
              blockDimensions,
              effectiveRemainingHeight,
              effectiveMarginTop,
              headNotesStart,
              pagePrefix(currentContent),
              block.keepLines && isFirstOnPage && currentFootnoteHeight === 0 && !currentContinuation,
              false,
              currentFootnoteHeight > 0
            ) ?? this.tryFragmentTable(
              block,
              blockDimensions,
              effectiveRemainingHeight,
              effectiveMarginTop,
              headNotesStart
            );
            if (fragments) {
              blocks.splice(i, 1, ...fragments);
              i--;
              continue;
            }
            const canMoveWhole = this.isWordParagraphElement(block.element) || table && this.notesCanStartOnPage(
              newFootnoteIds,
              freshBlockPageBodyHeight - freshBlockHeight,
              blockDimensions.contentWidth,
              { footnoteIds: [], continuation: null, partialFootnotes: [] },
              false
            );
            if (currentContent.length > 0 && canMoveWhole && (!blocks[i - 1]?.keepWithNext || releasedKeepPredecessors.has(sourceBlock))) {
              finishPage(block.sectionIndex);
              i--;
              continue;
            }
          }
          markSectionPlaced(block.sectionIndex);
          const availableForFootnotes = Math.min(
            maxFootnoteArea,
            effectiveContentHeight - bodyContentUsed - blockSpaceWithoutFootnotes
          );
          const nextPageMaxFootnoteArea = freshBlockPageBodyHeight * MAX_FOOTNOTE_AREA_RATIO;
          const deferralCannotHelp = availableForFootnotes >= nextPageMaxFootnoteArea;
          for (let noteIndex = 0; noteIndex < newFootnoteIds.length; noteIndex++) {
            this.checkpoint();
            const footnoteId = newFootnoteIds[noteIndex];
            const footnote = this.footnoteRegistry.get(footnoteId);
            if (!footnote) continue;
            if (laterNotesClosed()) {
              deferredFootnoteIds.push(...newFootnoteIds.slice(noteIndex));
              break;
            }
            const candidateIds = [...currentFootnoteIds, footnoteId];
            const candidateHeight = this.measureFootnotesHeight(
              candidateIds,
              noteWidth,
              currentContinuation,
              currentPartialFootnotes
            );
            const spaceLeftForFootnotes = availableForFootnotes - currentFootnoteHeight;
            if (candidateHeight + FOOTNOTE_MEASUREMENT_GUARD_PT <= availableForFootnotes) {
              currentFootnoteIds.push(footnoteId);
              currentFootnoteHeight = candidateHeight;
            } else {
              if (spaceLeftForFootnotes > MIN_FOOTNOTE_START_PT) {
                const payload = {
                  footnoteIds: currentFootnoteIds,
                  continuation: currentContinuation,
                  partialFootnotes: currentPartialFootnotes
                };
                let { fits, overflow, keptParagraph } = this.splitFootnoteToFit(
                  footnote,
                  availableForFootnotes,
                  noteWidth,
                  deferralCannotHelp,
                  payload
                );
                const firstPart = footnote.querySelector(":scope > .footnote-content")?.firstElementChild;
                const deferKeptEditorNote = !this.fragmentParagraphs && firstPart instanceof this.view.HTMLElement && firstPart.dataset.keepLines === "true";
                if (!deferKeptEditorNote && !(keptParagraph && this.compatibilityMode >= 15) && fits.length === 0 && !deferralCannotHelp && this.splitFootnoteToFit(footnote, keptParagraph ? nextPageMaxFootnoteArea - freshBlockHeight : nextPageMaxFootnoteArea, blockDimensions.contentWidth).fits.length === 0) {
                  ({ fits, overflow } = this.splitFootnoteToFit(
                    footnote,
                    availableForFootnotes,
                    noteWidth,
                    true,
                    payload
                  ));
                }
                if (fits.length > 0) {
                  currentFootnoteIds.push(footnoteId);
                  currentPartialFootnotes.push({
                    footnoteId,
                    fittingElements: fits
                  });
                  if (overflow.length > 0) {
                    nextPageContinuation = {
                      footnoteId,
                      sourceAnchorId: footnote.dataset.sourceAnchorId,
                      remainingElements: overflow
                    };
                  }
                  currentFootnoteHeight = this.measureFootnotesHeight(
                    currentFootnoteIds,
                    noteWidth,
                    currentContinuation,
                    currentPartialFootnotes
                  );
                  if (overflow.length > 0) {
                    deferredFootnoteIds.push(...newFootnoteIds.slice(noteIndex + 1));
                    break;
                  }
                } else {
                  deferredFootnoteIds.push(...newFootnoteIds.slice(noteIndex));
                  break;
                }
              } else {
                deferredFootnoteIds.push(...newFootnoteIds.slice(noteIndex));
                break;
              }
            }
          }
          const availablePt = remainingHeight - currentFootnoteHeight - effectiveMarginTop;
          currentContent.push(this.cloneBlockForPage(
            block,
            isFirstOnPage,
            pageInSection(block.sectionIndex),
            availablePt
          ));
          remainingHeight -= effectiveMarginTop + block.heightPt + block.marginBottomPt;
          prevMarginBottomPt = block.marginBottomPt;
          prevDroppedLeadingPt = this.droppedLeadingPt(block, availablePt);
          currentPageHasFootnoteReference ||= allBlockFootnoteIds.length > 0;
        } else {
          finishPage(block.sectionIndex, !pageHasPayload());
          i--;
          continue;
        }
      } else {
        if (pageHasPayload()) {
          finishPage(block.sectionIndex);
          i--;
          continue;
        }
        const tableFragments = this.trySplitSimpleOversizedTable(
          block,
          dimensionsFor(block.sectionIndex),
          block.sectionIndex
        );
        if (tableFragments) {
          blocks.splice(i, 1, ...tableFragments);
          i--;
          continue;
        }
        markSectionPlaced(block.sectionIndex);
        const oversized = this.cloneBlockForPage(
          block,
          true,
          pageInSection(block.sectionIndex)
        );
        oversized.setAttribute(OVERSIZED_BLOCK_ATTRIBUTE, "true");
        currentContent.push(oversized);
        deferredFootnoteIds.push(...newFootnoteIds);
        currentPageHasFootnoteReference ||= allBlockFootnoteIds.length > 0;
        finishPage(block.sectionIndex);
      }
    }
    finishPage();
    while (currentFootnoteIds.length > 0 || deferredFootnoteIds.length > 0 || (currentContinuation?.remainingElements.length ?? 0) > 0) {
      finishPage();
    }
    this.pendingFootnoteContinuation = nextPageContinuation;
    return pages;
  }
  /**
   * Strip block addressing from a header/footer node cloned into a page box.
   *
   * A running story is authored ONCE and cloned onto every page, so the clones all carry the same
   * `data-anchor` — on this document, 42 page boxes claiming one footer paragraph. Left editable,
   * committing any one of them writes back through that single shared anchor, and the per-page
   * page-number substitution makes it worse: each clone shows a DIFFERENT number, so a commit
   * writes that page's number into the story as literal text and destroys the PAGE field.
   *
   * Page-box header/footer content is presentation. The docked editing bands
   * (`editor-headerfooter.ts`) are the addressable affordance, and they exist precisely because a
   * cloned node cannot be uniquely addressed.
   */
  makeClonedStoryInert(root) {
    const nodes = [root, ...Array.from(root.querySelectorAll("*"))];
    for (const el of nodes) {
      el.removeAttribute("data-anchor");
      el.removeAttribute("data-committed-text");
      if (el.getAttribute("contenteditable") !== null) el.setAttribute("contenteditable", "false");
    }
  }
  /** Keep repeated note identities inert; resolve their return links after every page exists. */
  makeClonedMarginCommentInert(root) {
    this.makeClonedStoryInert(root);
    const nodes = [root, ...Array.from(root.querySelectorAll("*"))];
    for (const element of nodes) {
      element.removeAttribute("id");
      const href = element.getAttribute("href");
      if (element.localName === "a" && href?.startsWith("#")) {
        if (element instanceof this.view.HTMLAnchorElement && /^#comment-ref--?[0-9]+$/.test(href) && Array.from(element.classList).some((name) => name.endsWith("margin-backref")) && element.getAttribute("aria-disabled") !== "true") {
          element.dataset.paginationCommentReturn = String(this.commentReturnLinks.length);
          this.commentReturnLinks.push({
            href,
            ariaDisabled: element.getAttribute("aria-disabled"),
            tabIndex: element.getAttribute("tabindex")
          });
        }
        element.removeAttribute("href");
        element.setAttribute("aria-disabled", "true");
        element.tabIndex = -1;
      }
    }
  }
  /** A return link may target only one actual rendered reference, including on a later page. */
  activateCommentReturnLinks(pages) {
    if (this.commentReturnLinks.length === 0) return;
    const wanted = new Set(this.commentReturnLinks.map(({ href }) => href.slice(1)));
    const targets = /* @__PURE__ */ new Map();
    for (const element of Array.from(this.document.querySelectorAll('[id^="comment-ref-"]'))) {
      this.checkpoint();
      if (!wanted.has(element.id)) continue;
      targets.set(element.id, targets.has(element.id) ? null : element);
    }
    const pageElements = new Set(pages.map((page) => page.element));
    const eligible = /* @__PURE__ */ new Set();
    for (const [id, target] of targets) {
      this.checkpoint();
      if (!target) continue;
      let page = target;
      while (page && !pageElements.has(page)) page = page.parentElement;
      if (!page || target.closest(`.${this.cssPrefix}header, .${this.cssPrefix}footer, .${this.cssPrefix}comment-margin`)) continue;
      const sourceId = target.closest("[data-source-anchor-id]")?.dataset.sourceAnchorId;
      if (sourceId) {
        const story = this.storyForCanonicalAnchor(sourceId);
        if (story !== "body" && story !== "footnote" && story !== "endnote") continue;
      } else if (!target.closest(`.${this.cssPrefix}content, .${this.cssPrefix}footnotes`)) continue;
      const pageElement = page;
      if (this.view.getComputedStyle(target).visibility !== "visible") continue;
      const { visible } = measureRenderedSource(this.view, target, pageElement);
      if (visible.right <= visible.left || visible.bottom <= visible.top) continue;
      let transparent = false;
      for (let ancestor = target; ancestor; ancestor = ancestor.parentElement) {
        if (Number(this.view.getComputedStyle(ancestor).opacity) === 0) {
          transparent = true;
          break;
        }
        if (ancestor === pageElement) break;
      }
      if (!transparent) eligible.add(id);
    }
    for (const link of Array.from(this.containerElement.querySelectorAll("a[data-pagination-comment-return]"))) {
      this.checkpoint();
      const entry = this.commentReturnLinks[Number(link.dataset.paginationCommentReturn)];
      delete link.dataset.paginationCommentReturn;
      if (!entry) continue;
      const { href, ariaDisabled, tabIndex } = entry;
      if (!eligible.has(href.slice(1))) continue;
      link.setAttribute("href", href);
      if (ariaDisabled === null) link.removeAttribute("aria-disabled");
      else link.setAttribute("aria-disabled", ariaDisabled);
      if (tabIndex === null) link.removeAttribute("tabindex");
      else link.setAttribute("tabindex", tabIndex);
    }
    this.commentReturnLinks.length = 0;
  }
  /** Freeze inherited presentation before moving content out of its source ancestors. */
  preserveInheritedPresentation(content, computed = this.view.getComputedStyle(content)) {
    for (const property of [
      "font-family",
      "font-size",
      "font-style",
      "font-weight",
      "line-height",
      "color",
      "direction",
      "text-align",
      "letter-spacing",
      "word-spacing",
      "white-space"
    ]) {
      content.style.setProperty(property, computed.getPropertyValue(property));
    }
  }
  /** Keep the visible content of emptied paragraphs, cells and tables linked to its source. */
  promoteSourceContent(content, pageBox) {
    const section = content.closest("[data-pagination-section]")?.dataset.paginationSection;
    if (section !== void 0) content.dataset.paginationSection = section;
    this.preserveInheritedPresentation(content);
    const hosts = [];
    const ownerIds = /* @__PURE__ */ new Set();
    for (let host = content.parentElement; host && host !== pageBox; host = host.parentElement) {
      if (host.dataset.sourceAnchorId) {
        hosts.push(host);
        ownerIds.add(host.dataset.sourceAnchorId);
      }
      for (const id of host.getAttribute(DRAWING_HOST_ATTRIBUTE)?.split(" ") ?? []) ownerIds.add(id);
    }
    if (ownerIds.size > 0) content.setAttribute(DRAWING_HOST_ATTRIBUTE, [...ownerIds].join(" "));
    if (content.closest('td,th,[data-docx-frame-in-table-cell="true"]')) content.dataset.docxFrameInTableCell = "true";
    pageBox.appendChild(content);
    for (const host of hosts) {
      if (rendersOnlyItsLine(host)) host.setAttribute(HOSTS_PROMOTED_DRAWING_ATTRIBUTE, "true");
    }
  }
  /** Keep a raised inline text box's paint above the body band without moving its flow slot. */
  positionRaisedInlineTextBoxes(pageBox, contentArea, dims) {
    const paper = pageBox.getBoundingClientRect();
    const body = contentArea.getBoundingClientRect();
    const pixelsPerPoint = paper.width / dims.pageWidth;
    if (!(pixelsPerPoint > 0)) return;
    for (const box of Array.from(contentArea.querySelectorAll('[data-docx-textbox="true"]'))) {
      const rect = box.getBoundingClientRect();
      const style = this.view.getComputedStyle(box);
      if (box.dataset.docxDrawingAnchor || style.position !== "static" || style.display !== "inline-block" || style.transform !== "none" || !(rect.width > 0 && rect.height > 0) || rect.top >= body.top - 0.5 || rect.bottom > body.bottom + 0.5) continue;
      let eligible = true;
      for (let ancestor = box.parentElement; ancestor && ancestor !== contentArea; ancestor = ancestor.parentElement) {
        const inherited = this.view.getComputedStyle(ancestor);
        if (inherited.overflowX !== "visible" || inherited.overflowY !== "visible" || inherited.clipPath !== "none" || inherited.transform !== "none" || inherited.filter !== "none" || inherited.opacity !== "1" || inherited.visibility !== "visible") {
          eligible = false;
          break;
        }
      }
      if (!eligible) continue;
      const placeholder = box.cloneNode(false);
      for (const attribute of Array.from(placeholder.attributes)) {
        if (attribute.name !== "class" && attribute.name !== "style") placeholder.removeAttribute(attribute.name);
      }
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.style.visibility = "hidden";
      placeholder.style.width = `${rect.width / pixelsPerPoint}pt`;
      placeholder.style.height = `${rect.height / pixelsPerPoint}pt`;
      placeholder.style.boxSizing = "border-box";
      box.before(placeholder);
      this.promoteSourceContent(box, pageBox);
      box.dataset.docxRaisedInlineTextbox = "true";
      box.style.position = "absolute";
      box.style.left = `${(rect.left - paper.left) / pixelsPerPoint}pt`;
      box.style.top = `${(rect.top - paper.top) / pixelsPerPoint}pt`;
      box.style.width = `${rect.width / pixelsPerPoint}pt`;
      box.style.height = `${rect.height / pixelsPerPoint}pt`;
      box.style.boxSizing = "border-box";
      box.style.margin = "0";
    }
  }
  /** Measurement and paint read the same authored offset, before placement mutates inline styles. */
  frameHorizontalPosition(frame, dims, pageNumber, context, width) {
    if (frame.dataset.docxFrameOffset === void 0) {
      const style = this.view.getComputedStyle(frame);
      const offset = frame.closest("[data-docx-frame-exclusion]") ? style.marginLeft : style.left;
      frame.dataset.docxFrameOffset = String(pxToPt(parseFloat(offset) || 0));
    }
    const horizontal = this.horizontalAnchorReference(
      frame.dataset.docxFrameHAnchor === "text" ? "column" : frame.dataset.docxFrameHAnchor ?? "column",
      dims,
      pageNumber,
      context,
      this.horizontalSectionDimensions(frame, dims)
    );
    const alignment = frame.getAttribute("data-docx-frame-xalign");
    return this.resolveAnchorAxis(
      horizontal,
      width,
      alignment,
      alignment ? void 0 : Number(frame.dataset.docxFrameOffset),
      pageNumber
    );
  }
  /** Resolve legacy paragraph frames after their ordinary anchor paragraphs have flowed. */
  positionTextFrames(pageBox, dims, pageNumber) {
    const frames = Array.from(pageBox.querySelectorAll('[data-docx-text-frame="true"]'));
    const pageRect = pageBox.getBoundingClientRect();
    const pixelsPerPoint = pageRect.width / dims.pageWidth;
    if (!(pixelsPerPoint > 0)) return [];
    for (const frame of frames) {
      const placeholder = frame.closest('[data-docx-frame-container="true"]');
      if (!placeholder) continue;
      let following = placeholder.nextElementSibling;
      while (following instanceof this.view.HTMLElement && following.dataset.docxFrameContainer === "true") {
        following = following.nextElementSibling;
      }
      const paragraph = following instanceof this.view.HTMLElement ? following.matches("p,h1,h2,h3,h4,h5,h6") ? following : following.querySelector("p,h1,h2,h3,h4,h5,h6") : null;
      const anchorRect = (paragraph ?? placeholder).getBoundingClientRect();
      const rect = frame.getBoundingClientRect();
      const computed = this.view.getComputedStyle(frame);
      const inlineFlow = placeholder.dataset.docxFrameFlow === "true";
      const exclusion = frame.closest("[data-docx-frame-exclusion]");
      const context = {
        staticLeft: (anchorRect.left - pageRect.left) / pixelsPerPoint,
        staticTop: (anchorRect.top - pageRect.top) / pixelsPerPoint,
        paragraphLeft: (anchorRect.left - pageRect.left) / pixelsPerPoint,
        paragraphTop: (anchorRect.top - pageRect.top) / pixelsPerPoint,
        paragraphWidth: anchorRect.width / pixelsPerPoint,
        paragraphHeight: anchorRect.height / pixelsPerPoint,
        lineHeight: anchorRect.height / pixelsPerPoint
      };
      const vertical = this.verticalAnchorReference(
        frame.dataset.docxFrameVAnchor === "text" ? "paragraph" : frame.dataset.docxFrameVAnchor ?? "paragraph",
        dims,
        pageNumber,
        context
      );
      const yAlign = frame.getAttribute("data-docx-frame-yalign");
      const left = this.frameHorizontalPosition(frame, dims, pageNumber, context, rect.width / pixelsPerPoint);
      const top = inlineFlow || exclusion ? (rect.top - pageRect.top) / pixelsPerPoint : this.resolveAnchorAxis(
        vertical,
        rect.height / pixelsPerPoint,
        yAlign,
        yAlign ? void 0 : pxToPt(parseFloat(computed.top) || 0),
        pageNumber
      );
      const slot = exclusion ?? (inlineFlow ? placeholder : null);
      if (slot) {
        const reserved = slot.getBoundingClientRect();
        slot.style.boxSizing = "border-box";
        slot.style.height = `${reserved.height / pixelsPerPoint}pt`;
        slot.style.width = `${reserved.width / pixelsPerPoint}pt`;
      }
      this.promoteSourceContent(frame, pageBox);
      frame.style.position = "absolute";
      frame.style.left = `${left}pt`;
      frame.style.top = `${top}pt`;
      frame.style.margin = "0";
    }
    return frames;
  }
  /** Flow one source story through its declared, already positioned text-box frames. */
  flowLinkedTextBoxes() {
    if (!this.fragmentParagraphs) return;
    const stories = /* @__PURE__ */ new Map();
    for (const box of Array.from(this.containerElement.querySelectorAll('[data-docx-textbox-linked="true"]'))) {
      this.checkpoint();
      const story = box.dataset.docxTextboxStory;
      if (!story) throw new Error("A linked text box has no source story identity");
      const key = story + (box.dataset.docxTextboxRepeat === "true" ? "@" + box.closest(`.${this.cssPrefix}box`)?.dataset.pageNumber : "");
      const boxes = stories.get(key) ?? [];
      boxes.push(box);
      stories.set(key, boxes);
    }
    for (const boxes of stories.values()) {
      boxes.sort((a, b) => Number(a.dataset.docxTextboxSeq) - Number(b.dataset.docxTextboxSeq));
      const sequences = boxes.map((box) => box.dataset.docxTextboxSeq);
      if (sequences[0] !== "0" || sequences.some((sequence, index) => !/^\d+$/.test(sequence ?? "") || index > 0 && Number(sequence) <= Number(sequences[index - 1]))) {
        throw new Error("A linked text-box story has a missing or repeated frame sequence");
      }
      if (boxes.slice(1).some((box) => box.childNodes.length > 0)) {
        throw new Error("A linked text-box continuation unexpectedly owns source content");
      }
      const pending = Array.from(boxes[0].children);
      for (const paragraph of pending) this.preserveInheritedPresentation(paragraph);
      boxes[0].replaceChildren();
      let next = 0, relaxedKeepUntil = 0;
      for (let frameIndex = 0; frameIndex < boxes.length; frameIndex++) {
        const box = boxes[frameIndex];
        this.checkpoint();
        while (next < pending.length) {
          this.checkpoint();
          const paragraph = pending[next];
          let end = next + 1;
          if (next >= relaxedKeepUntil) {
            while (end < pending.length && pending[end - 1].dataset.keepWithNext === "true") end++;
          }
          const group = pending.slice(next, end);
          for (const item of group) box.appendChild(item);
          if (this.linkedTextBoxFits(box)) {
            next = end;
            continue;
          }
          if (group.length > 1) {
            for (const item of group) item.remove();
            const fitsLater = boxes.slice(frameIndex + 1).some((frame) => {
              this.checkpoint();
              for (const item of group) frame.appendChild(item);
              try {
                return this.linkedTextBoxFits(frame);
              } finally {
                for (const item of group) item.remove();
              }
            });
            if (fitsLater) break;
            relaxedKeepUntil = end;
            box.appendChild(paragraph);
            if (this.linkedTextBoxFits(box)) {
              next++;
              continue;
            }
          }
          const measureHead = (head) => {
            paragraph.replaceWith(head);
            try {
              return this.linkedTextBoxFits(box);
            } finally {
              head.replaceWith(paragraph);
            }
          };
          if (this.canRangeFragmentParagraph(
            paragraph,
            false,
            false,
            true,
            next < relaxedKeepUntil || next === pending.length - 1,
            true
          )) {
            const split = this.splitParagraphAtLargestFit(paragraph, measureHead, {
              preserveWidowLines: paragraph.dataset.widowControl !== "false"
            });
            if (split.kind === "split") {
              this.reconcileFragmentIdentities(split.head, split.tail);
              paragraph.replaceWith(split.head);
              pending[next] = split.tail;
              break;
            }
          }
          paragraph.remove();
          break;
        }
      }
      if (next < pending.length) {
        const last = boxes[boxes.length - 1];
        last.append(...pending.slice(next));
        last.dataset.docxTextboxOverflow = "true";
        const first = pending[next], anchored = "[data-source-anchor-id]";
        const hidden = first.matches(anchored) ? first : first.querySelector(anchored);
        if (hidden?.dataset.sourceAnchorId) this.linkedTextBoxOverflowAnchors.push(hidden.dataset.sourceAnchorId);
      }
    }
  }
  linkedTextBoxFits(box) {
    const last = box.lastElementChild;
    if (!last) return true;
    const style = this.view.getComputedStyle(box), rect = box.getBoundingClientRect();
    const scale = rect.width / parseFloat(style.width);
    if (!(scale > 0)) return false;
    const inset = (name) => (parseFloat(style.getPropertyValue(name)) || 0) * scale;
    const top = rect.top + inset("border-top-width") + inset("padding-top");
    const bottom = rect.bottom - inset("border-bottom-width") - inset("padding-bottom");
    const right = rect.right - inset("border-right-width") - inset("padding-right");
    const left = rect.left + inset("border-left-width") + inset("padding-left");
    const range = this.document.createRange();
    range.selectNodeContents(box);
    const ink = range.getBoundingClientRect(), block = last.getBoundingClientRect();
    if (ink.height > 0 && ink.top < top - 0.5 || Math.max(ink.bottom, block.bottom) > bottom + 0.5) return false;
    if (ink.right <= right + 0.5 && ink.left >= left - 0.5) return true;
    const outside = (rect2) => rect2.width > 0 && rect2.height > 0 && (rect2.right > right + 0.5 || rect2.left < left - 0.5);
    const walker = this.document.createTreeWalker(box, this.view.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      this.checkpoint();
      const text = node;
      for (const word of text.data.matchAll(/[^\s\u200B-\u200F\uFEFF]+/gu)) {
        range.setStart(text, word.index);
        range.setEnd(text, word.index + word[0].length);
        if (Array.from(range.getClientRects()).some(outside)) return false;
      }
    }
    return !Array.from(box.querySelectorAll("img,svg,canvas,[data-docx-shape],[data-docx-tab]")).some((element) => {
      if (element.hasAttribute("data-docx-tab") && this.view.getComputedStyle(element).borderBottomStyle === "none") return false;
      return outside(element.getBoundingClientRect());
    });
  }
  prepareSourceTextBoxSizes(section, dims) {
    const context = {
      staticLeft: 0,
      staticTop: 0,
      lineHeight: 0,
      paragraphLeft: 0,
      paragraphTop: 0,
      paragraphWidth: 0,
      paragraphHeight: 0
    };
    for (const box of Array.from(section.querySelectorAll('[data-docx-textbox-source-position="page-offset"]'))) {
      if (eligibleSourceTextBox(box, true)) this.sizeDrawingAnchor(box, dims, 1, context);
    }
  }
  sizeDrawingAnchor(anchor, dims, pageNumber, context) {
    const widthReference = this.horizontalAnchorReference(
      anchor.getAttribute("data-docx-anchor-width-relative") ?? "margin",
      dims,
      pageNumber,
      context
    );
    const widthPercent = this.anchorNumber(anchor, "width-percent");
    if (widthPercent !== void 0 && widthPercent > 0) {
      anchor.style.width = `${widthReference.size * widthPercent / 100}pt`;
    }
    const heightReference = this.verticalAnchorReference(
      anchor.getAttribute("data-docx-anchor-height-relative") ?? "margin",
      dims,
      pageNumber,
      context
    );
    const heightPercent = this.anchorNumber(anchor, "height-percent");
    if (heightPercent !== void 0 && heightPercent > 0 && anchor.dataset.docxAnchorAutofit !== "true") {
      anchor.style.height = `${heightReference.size * heightPercent / 100}pt`;
    }
  }
  prepareShapeClearance(section, dims) {
    const context = {
      staticLeft: 0,
      staticTop: 0,
      lineHeight: 0,
      paragraphLeft: 0,
      paragraphTop: 0,
      paragraphWidth: dims.contentWidth,
      paragraphHeight: 0
    };
    const bottoms = /* @__PURE__ */ new Map();
    const relaxed = /* @__PURE__ */ new Set();
    for (const anchor of Array.from(section.querySelectorAll('[data-docx-shape-anchor="true"]'))) {
      this.sizeDrawingAnchor(anchor, dims, 1, context);
      const width = parseFloat(anchor.style.width) || this.anchorNumber(anchor, "extent-width") || 0;
      const height = parseFloat(anchor.style.height) || this.anchorNumber(anchor, "extent-height") || 0;
      const exclusion = anchor.parentElement?.closest("[data-docx-shape-exclusion]");
      if (exclusion) {
        exclusion.style.width = `${width}pt`;
        exclusion.style.height = `${height}pt`;
      }
      if (anchor.dataset.docxAnchorWrap !== "wrapTopAndBottom") continue;
      const paragraph = anchor.closest("p,h1,h2,h3,h4,h5,h6");
      if (!paragraph) continue;
      const offset = anchor.dataset.docxAnchorVRelative === "paragraph" ? this.anchorNumber(anchor, "v-offset") ?? 0 : 0;
      const bottom = height + offset + (this.anchorNumber(anchor, "wrap-bottom") ?? 0);
      const impossible = dims.contentHeight > 0 && bottom >= dims.contentHeight && !paragraph.closest("[data-docx-textbox]");
      if (impossible) relaxed.add(paragraph);
      bottoms.set(paragraph, Math.max(bottoms.get(paragraph) ?? 0, impossible ? 0 : bottom));
    }
    for (const [paragraph, height] of bottoms) {
      const spacer = Array.from(paragraph.children).find((e) => e.hasAttribute("data-docx-shape-clearance"));
      if (!spacer) continue;
      spacer.toggleAttribute("data-docx-relaxed-clearance", relaxed.has(paragraph));
      spacer.style.height = `${Math.max(0, height)}pt`;
    }
  }
  /**
   * Resolves floating DrawingML objects after their anchor paragraphs have landed on a page.
   *
   * The converter deliberately carries the OOXML bases and offsets as data instead of flattening
   * them into CSS: page/margin/column bases belong to the page, while paragraph/line/character
   * bases belong to the laid-out anchor. Once both coordinate systems exist, promote the object
   * from the clipped text column into the page box and position it in one shared point space.
   */
  positionDrawingAnchors(pageBox, contentArea, dims, pageNumber) {
    const anchors = Array.from(
      contentArea.querySelectorAll('[data-docx-drawing-anchor="true"]')
    );
    if (anchors.length === 0) return;
    const pageRect = pageBox.getBoundingClientRect();
    const pixelsPerPoint = pageRect.width / dims.pageWidth;
    if (!(pixelsPerPoint > 0)) return;
    const sourceFrame = this.sourcePageFrame(pageBox, dims);
    for (const anchor of anchors) {
      const staticRect = anchor.getBoundingClientRect();
      const paragraph = anchor.closest("p, h1, h2, h3, h4, h5, h6");
      const paragraphRect = paragraph?.getBoundingClientRect() ?? staticRect;
      const toPageX = (x) => (x - pageRect.left) / pixelsPerPoint;
      const toPageY = (y) => (y - pageRect.top) / pixelsPerPoint;
      const context = {
        staticLeft: toPageX(staticRect.left),
        staticTop: toPageY(staticRect.top),
        lineHeight: paragraph ? (parseFloat(this.view.getComputedStyle(paragraph).lineHeight) || staticRect.height) / pixelsPerPoint : staticRect.height / pixelsPerPoint,
        paragraphLeft: toPageX(paragraphRect.left),
        paragraphTop: toPageY(paragraphRect.top),
        paragraphWidth: paragraphRect.width / pixelsPerPoint,
        paragraphHeight: paragraphRect.height / pixelsPerPoint
      };
      const sectionDimensions = this.horizontalSectionDimensions(anchor, dims);
      this.sizeDrawingAnchor(anchor, dims, pageNumber, context);
      const sizedRect = anchor.getBoundingClientRect();
      const width = sizedRect.width / pixelsPerPoint;
      const height = sizedRect.height / pixelsPerPoint;
      const horizontal = this.horizontalAnchorReference(
        anchor.getAttribute("data-docx-anchor-h-relative") ?? "column",
        dims,
        pageNumber,
        context,
        sectionDimensions
      );
      const vertical = this.verticalAnchorReference(
        anchor.getAttribute("data-docx-anchor-v-relative") ?? "paragraph",
        dims,
        pageNumber,
        context
      );
      const left = this.resolveAnchorAxis(
        horizontal,
        width,
        anchor.getAttribute("data-docx-anchor-h-align"),
        this.anchorNumber(anchor, "h-offset"),
        pageNumber
      );
      const top = this.resolveAnchorAxis(
        vertical,
        height,
        anchor.getAttribute("data-docx-anchor-v-align"),
        this.anchorNumber(anchor, "v-offset"),
        pageNumber
      );
      this.promoteSourceContent(anchor, pageBox);
      anchor.style.position = "absolute";
      anchor.style.left = `${left}pt`;
      anchor.style.top = `${top}pt`;
      anchor.style.margin = "0";
      const partialTextBoxInk = /* @__PURE__ */ new Map();
      for (const source of Array.from(anchor.querySelectorAll("[data-source-anchor-id]")))
        this.captureSourceTextClip(source, sourceFrame, paragraph, partialTextBoxInk);
    }
    const paintOrder = [...anchors].sort((a, b) => (this.anchorNumber(a, "order") ?? 0) - (this.anchorNumber(b, "order") ?? 0));
    paintOrder.forEach((anchor, index) => {
      anchor.style.zIndex = String(anchor.dataset.docxAnchorBehind === "true" ? index - paintOrder.length : index + 1);
    });
  }
  anchorNumber(anchor, suffix) {
    const raw = anchor.getAttribute(`data-docx-anchor-${suffix}`);
    if (raw === null) return void 0;
    const value = Number(raw);
    return Number.isFinite(value) ? value : void 0;
  }
  horizontalAnchorReference(relativeFrom, dims, pageNumber, context, columnDimensions = dims) {
    const leftMargin = { start: 0, size: dims.marginLeft };
    const rightMargin = {
      start: dims.marginLeft + dims.contentWidth,
      size: dims.marginRight
    };
    switch (relativeFrom) {
      case "page":
        return { start: 0, size: dims.pageWidth };
      case "character":
        return { start: context.staticLeft, size: 0 };
      case "leftMargin":
        return leftMargin;
      case "rightMargin":
        return rightMargin;
      case "insideMargin":
        return pageNumber % 2 === 1 ? leftMargin : rightMargin;
      case "outsideMargin":
        return pageNumber % 2 === 1 ? rightMargin : leftMargin;
      case "paragraph":
        return { start: context.paragraphLeft, size: context.paragraphWidth };
      case "column":
        return { start: columnDimensions.marginLeft, size: columnDimensions.contentWidth };
      case "margin":
      default:
        return { start: dims.marginLeft, size: dims.contentWidth };
    }
  }
  verticalAnchorReference(relativeFrom, dims, pageNumber, context) {
    const topMargin = { start: 0, size: dims.marginTop };
    const bottomMargin = {
      start: dims.marginTop + dims.contentHeight,
      size: dims.marginBottom
    };
    switch (relativeFrom) {
      case "page":
        return { start: 0, size: dims.pageHeight };
      case "paragraph":
        return { start: context.paragraphTop, size: context.paragraphHeight };
      case "line":
        return { start: context.staticTop, size: context.lineHeight };
      case "topMargin":
        return topMargin;
      case "bottomMargin":
        return bottomMargin;
      case "insideMargin":
        return pageNumber % 2 === 1 ? topMargin : bottomMargin;
      case "outsideMargin":
        return pageNumber % 2 === 1 ? bottomMargin : topMargin;
      case "margin":
      default:
        return { start: dims.marginTop, size: dims.contentHeight };
    }
  }
  resolveAnchorAxis(reference, objectSize, alignment, offset, pageNumber) {
    if (offset !== void 0) return reference.start + offset;
    let fraction = 0;
    if (alignment === "center") fraction = 0.5;
    else if (alignment === "right" || alignment === "bottom") fraction = 1;
    else if (alignment === "inside") fraction = pageNumber % 2 === 1 ? 0 : 1;
    else if (alignment === "outside") fraction = pageNumber % 2 === 1 ? 1 : 0;
    return reference.start + (reference.size - objectSize) * fraction;
  }
  /** Charge a physical page before any page-owned partitioning or DOM allocation. */
  admitPageAllocation() {
    const prospectivePageCount = this.createdPageCount + 1;
    this.pageCountCheckpoint?.(prospectivePageCount);
    this.createdPageCount = prospectivePageCount;
  }
  /**
   * Creates a page container element.
   */
  createPage(dims, pageNumber, sectionIndex, displayedPageNumber, content, pageInSection, footnoteIds = [], footnoteHeight = 0, continuation, partialFootnotes, isSectionFiller = false, pageAlreadyAdmitted = false, noteBandLimitPt) {
    if (!pageAlreadyAdmitted) this.admitPageAllocation();
    const pageBox = this.document.createElement("div");
    pageBox.className = `${this.cssPrefix}box`;
    pageBox.style.width = `${dims.pageWidth}pt`;
    pageBox.style.height = `${dims.pageHeight}pt`;
    pageBox.style.overflow = "hidden";
    pageBox.style.position = "relative";
    pageBox.style.isolation = "isolate";
    if (this.scale !== 1) {
      if (this.view.CSS?.supports("zoom", "1")) {
        pageBox.style.zoom = String(this.scale);
      } else {
        pageBox.style.transform = `scale(${this.scale})`;
        pageBox.style.transformOrigin = "top left";
        const heightReductionPt = dims.pageHeight * (1 - this.scale);
        const widthReductionPt = dims.pageWidth * (1 - this.scale);
        const heightReductionPx = ptToPx(heightReductionPt);
        const widthReductionPx = ptToPx(widthReductionPt);
        pageBox.style.marginRight = `-${widthReductionPx}px`;
        pageBox.style.marginBottom = `${this.pageGap - heightReductionPx}px`;
      }
    }
    pageBox.style.willChange = "transform";
    pageBox.style.contain = "layout paint";
    pageBox.dataset.pageNumber = String(pageNumber);
    pageBox.dataset.sectionIndex = String(sectionIndex);
    pageBox.dataset.displayedPageNumber = String(displayedPageNumber);
    if (isSectionFiller) pageBox.dataset.sectionFiller = "true";
    pageBox.dataset.pageInSection = String(pageInSection);
    const bands = this.getPageBands(dims, sectionIndex, pageInSection, displayedPageNumber, pageNumber);
    const prepared = this.prepareRunningStories(dims, sectionIndex, pageInSection, displayedPageNumber, pageNumber);
    const headerSource = isSectionFiller ? void 0 : prepared ? prepared.header : this.selectHeader(sectionIndex, pageInSection, displayedPageNumber);
    if (headerSource) {
      const headerDiv = this.document.createElement("div");
      headerDiv.className = `${this.cssPrefix}header`;
      headerDiv.dataset.hfType = this.storyKindFor(
        "header",
        sectionIndex,
        pageInSection,
        displayedPageNumber
      );
      headerDiv.style.position = "absolute";
      headerDiv.style.top = `${bands.headerTop}pt`;
      headerDiv.style.bottom = "auto";
      headerDiv.style.left = `${dims.marginLeft}pt`;
      headerDiv.style.width = `${dims.contentWidth}pt`;
      headerDiv.style.height = `${bands.headerHeight}pt`;
      headerDiv.style.overflowX = "visible";
      headerDiv.style.overflowY = "clip";
      headerDiv.style.boxSizing = "border-box";
      headerDiv.style.display = "flex";
      headerDiv.style.flexDirection = "column";
      headerDiv.style.justifyContent = "flex-start";
      for (const child of Array.from(headerSource.childNodes)) {
        const clonedheaderDiv = child.cloneNode(true);
        if (clonedheaderDiv.nodeType === 1) this.makeClonedStoryInert(clonedheaderDiv);
        headerDiv.appendChild(clonedheaderDiv);
      }
      pageBox.appendChild(headerDiv);
    }
    const contentAreaTop = bands.bodyTop;
    const contentAreaHeight = bands.bodyHeight;
    const contentArea = this.document.createElement("div");
    contentArea.className = `${this.cssPrefix}content`;
    contentArea.style.position = "absolute";
    contentArea.style.top = `${contentAreaTop}pt`;
    contentArea.style.left = `${dims.marginLeft}pt`;
    contentArea.style.width = `${dims.contentWidth}pt`;
    contentArea.style.height = `${contentAreaHeight}pt`;
    contentArea.style.overflowX = "visible";
    contentArea.style.overflowY = "clip";
    this.appendSectionContent(contentArea, [
      ...!isSectionFiller ? this.headerFramePrefix(dims, sectionIndex, pageInSection, displayedPageNumber, pageNumber) : [],
      ...content
    ], dims);
    pageBox.appendChild(contentArea);
    const hasContinuation = continuation && continuation.remainingElements.length > 0;
    if (!isSectionFiller && (footnoteIds.length > 0 || hasContinuation)) {
      this.addPageFootnotes(
        pageBox,
        footnoteIds,
        dims,
        bands,
        footnoteHeight,
        continuation,
        partialFootnotes,
        noteBandLimitPt
      );
    }
    const footerSource = isSectionFiller ? void 0 : prepared ? prepared.footer : this.selectFooter(sectionIndex, pageInSection, displayedPageNumber);
    const pageCommentIds = [];
    for (const marker of [pageBox, footerSource].flatMap((story) => Array.from(story?.querySelectorAll("[data-comment-id]") ?? []))) {
      if (marker.closest(`.${this.cssPrefix}comment-margin`)) continue;
      const id = marker.dataset.commentId;
      if (id && this.commentMarginRegistry.has(id) && !pageCommentIds.includes(id)) {
        pageCommentIds.push(id);
      }
    }
    let outsideCommentColumn;
    if (this.commentColumnPlacement !== "balloons" && pageCommentIds.length > 0) {
      const marginColumn = this.document.createElement("aside");
      marginColumn.className = `${this.cssPrefix}comment-margin`;
      marginColumn.style.position = "absolute";
      marginColumn.style.top = `${contentAreaTop}pt`;
      marginColumn.style.left = `${dims.marginLeft + dims.contentWidth + 3}pt`;
      marginColumn.style.width = `${Math.max(12, dims.marginRight - 6)}pt`;
      marginColumn.style.maxHeight = `${contentAreaHeight}pt`;
      marginColumn.style.overflowY = "auto";
      marginColumn.style.overflowX = "hidden";
      marginColumn.tabIndex = 0;
      marginColumn.setAttribute("aria-label", `Comments for page ${displayedPageNumber}`);
      marginColumn.dataset.pageNumber = String(pageNumber);
      marginColumn.style.boxSizing = "border-box";
      const placedThreadRoots = /* @__PURE__ */ new Set();
      for (const id of pageCommentIds) {
        const source = this.commentMarginRegistry.get(id);
        if (source) {
          const rootId = source.dataset.commentId ?? id;
          if (placedThreadRoots.has(rootId)) continue;
          placedThreadRoots.add(rootId);
          const clone = source.cloneNode(true);
          this.makeClonedMarginCommentInert(clone);
          marginColumn.appendChild(clone);
        }
      }
      if (this.commentColumnPlacement === "outside") {
        marginColumn.style.top = `${contentAreaTop * this.scale}pt`;
        marginColumn.style.left = "0";
        marginColumn.style.width = `${this.commentColumnWidthPt}pt`;
        marginColumn.style.transform = `scale(${this.scale})`;
        marginColumn.style.transformOrigin = "top left";
        marginColumn.dataset.pageMapExclude = "true";
        outsideCommentColumn = marginColumn;
      } else pageBox.appendChild(marginColumn);
    }
    if (footerSource) {
      const footerDiv = this.document.createElement("div");
      footerDiv.className = `${this.cssPrefix}footer`;
      footerDiv.dataset.hfType = this.storyKindFor(
        "footer",
        sectionIndex,
        pageInSection,
        displayedPageNumber
      );
      footerDiv.style.position = "absolute";
      footerDiv.style.top = "auto";
      footerDiv.style.bottom = `${dims.footerDistance}pt`;
      footerDiv.style.left = `${dims.marginLeft}pt`;
      footerDiv.style.width = `${dims.contentWidth}pt`;
      footerDiv.style.height = `${bands.footerHeight}pt`;
      footerDiv.style.overflowX = "visible";
      footerDiv.style.overflowY = "clip";
      footerDiv.style.boxSizing = "border-box";
      footerDiv.style.display = "flex";
      footerDiv.style.flexDirection = "column";
      footerDiv.style.justifyContent = "flex-end";
      for (const child of Array.from(footerSource.childNodes)) {
        const clonedfooterDiv = child.cloneNode(true);
        if (clonedfooterDiv.nodeType === 1) this.makeClonedStoryInert(clonedfooterDiv);
        footerDiv.appendChild(clonedfooterDiv);
      }
      pageBox.appendChild(footerDiv);
    }
    if (this.showPageNumbers && !isSectionFiller) {
      const pageNum = this.document.createElement("div");
      pageNum.className = `${this.cssPrefix}number`;
      pageNum.textContent = String(pageNumber);
      pageBox.appendChild(pageNum);
    }
    if (this.commentColumnPlacement === "outside" && this.commentMarginRegistry.size > 0) {
      const row = this.document.createElement("div");
      row.dataset.docxPageCommentsRow = "true";
      row.style.display = "flex";
      row.style.alignItems = "flex-start";
      row.style.width = "max-content";
      row.style.alignSelf = "flex-start";
      row.style.marginLeft = "auto";
      row.style.marginRight = "auto";
      row.style.gap = `${this.commentColumnGapPt * this.scale}pt`;
      pageBox.style.flexShrink = "0";
      const panel = this.document.createElement("div");
      panel.dataset.docxCommentPanel = "true";
      panel.style.position = "relative";
      panel.style.flexShrink = "0";
      panel.style.width = `${this.commentColumnWidthPt * this.scale}pt`;
      panel.style.height = `${dims.pageHeight * this.scale}pt`;
      if (outsideCommentColumn) panel.appendChild(outsideCommentColumn);
      else panel.setAttribute("aria-hidden", "true");
      row.append(pageBox, panel);
      this.containerElement.appendChild(row);
      if (!this.document.head.querySelector("style[data-docx-comment-column-print]")) {
        const printStyle = this.document.createElement("style");
        printStyle.dataset.docxCommentColumnPrint = "true";
        printStyle.textContent = "@media print { [data-docx-comment-panel] { display:none!important; } [data-docx-page-comments-row] { display:block!important; width:auto!important; } }";
        this.document.head.appendChild(printStyle);
      }
    } else this.containerElement.appendChild(pageBox);
    this.prepareFrameExclusions(pageBox, dims, pageNumber);
    this.positionTextFrames(pageBox, dims, pageNumber);
    this.positionDrawingAnchors(pageBox, pageBox, dims, pageNumber);
    const notesEl = pageBox.querySelector(`.${this.cssPrefix}footnotes`);
    if (notesEl) {
      this.prepareFootnoteText?.(notesEl);
      const notesHeightPt = pxToPt(notesEl.getBoundingClientRect().height);
      if (notesHeightPt > 0) {
        contentArea.style.height = `${Math.max(0, contentAreaHeight - notesHeightPt)}pt`;
      }
    }
    if ((!notesEl || notesEl.getBoundingClientRect().height === 0) && Array.from(contentArea.querySelectorAll(`[${OVERSIZED_BLOCK_ATTRIBUTE}]`)).some((block) => findOversizedExactRow(block))) contentArea.style.overflowY = "visible";
    alignExactLineBaselines(contentArea);
    if (notesEl) alignExactLineBaselines(notesEl);
    const paper = pageBox.getBoundingClientRect();
    const header = pageBox.querySelector(`.${this.cssPrefix}header`);
    const footer = pageBox.querySelector(`.${this.cssPrefix}footer`);
    preserveExactLineInk(
      contentArea,
      Math.max(paper.top, header?.getBoundingClientRect().bottom ?? paper.top),
      Math.min(
        paper.bottom,
        footer?.getBoundingClientRect().top ?? paper.bottom,
        notesEl?.getBoundingClientRect().top ?? paper.bottom
      ),
      paper
    );
    this.positionRaisedInlineTextBoxes(pageBox, contentArea, dims);
    return {
      pageNumber,
      sectionIndex,
      dimensions: dims,
      element: pageBox
    };
  }
};

// src/verification-request.ts
function serializeVerificationRequest(request) {
  if (request === null || typeof request !== "object" || Array.isArray(request)) {
    throw new RangeError("a verification request must be an object");
  }
  const { companionArtifacts, ...rest } = request;
  const wire = { ...rest };
  if (companionArtifacts !== void 0) {
    wire.companionArtifacts = companionArtifacts.map(encodeCompanion);
  }
  return JSON.stringify(wire);
}
function encodeCompanion(artifact) {
  const { bytes, ...rest } = artifact;
  const wire = { ...rest };
  if (bytes !== void 0) wire.bytesB64 = bytesToBase64(bytes);
  return wire;
}
function bytesToBase64(bytes) {
  if (typeof btoa === "function") {
    let binary = "";
    const chunkSize = 32768;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

// src/worker-proxy.ts
var WorkerOperationError = class extends Error {
  constructor(message, code) {
    super(message);
    this.name = "WorkerOperationError";
    this.code = code;
  }
};
function workerError(message, code) {
  return new WorkerOperationError(message || "Unknown error", code);
}
function requireField(response, field) {
  const value = response[field];
  if (value === void 0 || value === null) {
    throw workerError(
      `The worker's "${response.type ?? "unknown"}" response reported success without its ${String(field)}`,
      "missing_result"
    );
  }
  return value;
}
function checkTimeout(timeoutMs, name) {
  if (timeoutMs !== void 0 && !(Number.isFinite(timeoutMs) && timeoutMs > 0)) {
    throw new RangeError(`${name} must be a positive, finite number of milliseconds; got ${timeoutMs}`);
  }
  return timeoutMs;
}
function workerErrorCode(error) {
  return error instanceof WorkerOperationError ? error.code : void 0;
}
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
async function toBytes(document2) {
  if (document2 instanceof Uint8Array) {
    return new Uint8Array(document2);
  }
  const buffer = await document2.arrayBuffer();
  return new Uint8Array(buffer);
}
function deriveWasmBasePath() {
  if (typeof document !== "undefined") {
    const scripts = document.querySelectorAll('script[src*="docxodus"]');
    if (scripts.length > 0) {
      const src = scripts[0].src;
      const base = src.substring(0, src.lastIndexOf("/") + 1);
      return base + "wasm/";
    }
  }
  return "/wasm/";
}
async function createWorkerDocxodus(options) {
  if (options?.signal?.aborted) {
    throw new Error("Worker creation aborted");
  }
  const requestTimeoutMs = checkTimeout(options?.requestTimeoutMs, "requestTimeoutMs");
  const wasmBasePath = options?.wasmBasePath ?? deriveWasmBasePath();
  const workerScriptPath = new URL("./docxodus.worker.js", import.meta.url).href;
  const worker = new Worker(workerScriptPath, { type: "module" });
  const pendingRequests = /* @__PURE__ */ new Map();
  let isWorkerActive = true;
  let abortListener;
  const stopWorker = (message) => {
    if (!isWorkerActive) return;
    isWorkerActive = false;
    worker.terminate();
    for (const pending of pendingRequests.values()) {
      pending.reject(new Error(message));
    }
    pendingRequests.clear();
    if (abortListener && options?.signal) {
      options.signal.removeEventListener("abort", abortListener);
      abortListener = void 0;
    }
  };
  if (options?.signal) {
    abortListener = () => stopWorker("Worker creation or operation aborted");
    options.signal.addEventListener("abort", abortListener, { once: true });
  }
  let preparePromise = null;
  worker.onmessage = (event) => {
    const response = event.data;
    if (response.type === "ready") {
      return;
    }
    const pending = pendingRequests.get(response.id);
    if (pending) {
      pendingRequests.delete(response.id);
      if (response.success) {
        pending.resolve(response);
      } else {
        pending.reject(workerError(response.error, response.errorCode));
      }
    }
  };
  worker.onerror = (error) => {
    stopWorker(`Worker error: ${error.message}`);
  };
  worker.onmessageerror = () => {
    for (const pending of [...pendingRequests.values()]) {
      pending.reject(workerError(
        "A worker response could not be deserialized, so every request in flight was rejected",
        "message_error"
      ));
    }
  };
  function sendRequest(request, transfer, requestOptions) {
    return new Promise((resolve, reject) => {
      if (!isWorkerActive) {
        reject(new Error("Worker has been terminated"));
        return;
      }
      const signal = requestOptions?.signal;
      if (signal?.aborted) {
        reject(workerError(`The worker request "${request.type}" was aborted before it was sent`, "aborted"));
        return;
      }
      const timeoutMs = requestOptions?.timeoutMs ?? requestTimeoutMs;
      let timer;
      let onAbort;
      const finish = () => {
        pendingRequests.delete(request.id);
        if (timer !== void 0) clearTimeout(timer);
        if (onAbort) signal?.removeEventListener("abort", onAbort);
      };
      pendingRequests.set(request.id, {
        resolve: (value) => {
          finish();
          resolve(value);
        },
        reject: (error) => {
          finish();
          reject(error);
        }
      });
      const fail2 = (error) => pendingRequests.get(request.id)?.reject(error);
      if (timeoutMs !== void 0) {
        timer = setTimeout(() => fail2(workerError(
          `The worker request "${request.type}" timed out after ${timeoutMs} ms`,
          "timeout"
        )), timeoutMs);
      }
      if (signal) {
        onAbort = () => fail2(workerError(`The worker request "${request.type}" was aborted`, "aborted"));
        signal.addEventListener("abort", onAbort, { once: true });
      }
      try {
        if (transfer && transfer.length > 0) {
          worker.postMessage(request, transfer);
        } else {
          worker.postMessage(request);
        }
      } catch (error) {
        fail2(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
  try {
    await sendRequest({
      id: generateId(),
      type: "init",
      wasmBasePath
    });
  } catch (error) {
    stopWorker("Worker initialization failed");
    throw error;
  }
  const createApi = (requestOptions) => {
    const send = (request, transfer) => sendRequest(request, transfer, requestOptions);
    return {
      async generatePackageManifest(document2, limits) {
        const bytes = await toBytes(document2);
        const response = await send(
          {
            id: generateId(),
            type: "generatePackageManifest",
            documentBytes: bytes,
            limits,
            representation: "object"
          },
          [bytes.buffer]
        );
        return requireField(response, "manifest");
      },
      async verifyDeliverable(document2, baseline, request) {
        const bytes = await toBytes(document2);
        const baselineBytes = baseline === void 0 ? void 0 : await toBytes(baseline);
        const transfer = [bytes.buffer];
        if (baselineBytes !== void 0) transfer.push(baselineBytes.buffer);
        const response = await send(
          {
            id: generateId(),
            type: "verifyDeliverable",
            documentBytes: bytes,
            baselineBytes,
            requestJson: request === void 0 ? void 0 : serializeVerificationRequest(request)
          },
          transfer
        );
        return requireField(response, "verification");
      },
      async proveRedlineReversibility(baseline, intendedFinal, redline) {
        const baselineBytes = await toBytes(baseline);
        const intendedFinalBytes = await toBytes(intendedFinal);
        const redlineBytes = await toBytes(redline);
        const response = await send(
          {
            id: generateId(),
            type: "proveRedlineReversibility",
            baselineBytes,
            intendedFinalBytes,
            redlineBytes
          },
          [baselineBytes.buffer, intendedFinalBytes.buffer, redlineBytes.buffer]
        );
        return requireField(response, "proof");
      },
      async getSemanticChanges(left, right, settings) {
        const leftBytes = await toBytes(left);
        const rightBytes = await toBytes(right);
        const response = await send(
          {
            id: generateId(),
            type: "getSemanticChanges",
            leftBytes,
            rightBytes,
            settings
          },
          [leftBytes.buffer, rightBytes.buffer]
        );
        return requireField(response, "semanticChanges");
      },
      async createExternalAnnotationSet(document2, documentId) {
        const bytes = await toBytes(document2);
        const response = await send(
          { id: generateId(), type: "createExternalAnnotationSet", documentBytes: bytes, documentId },
          [bytes.buffer]
        );
        return requireField(response, "annotationSet");
      },
      async validateExternalAnnotations(document2, annotationSet) {
        const bytes = await toBytes(document2);
        const response = await send(
          { id: generateId(), type: "validateExternalAnnotations", documentBytes: bytes, annotationSet },
          [bytes.buffer]
        );
        return requireField(response, "validation");
      },
      async projectAnnotationsOntoHtml(html, annotationSet, projectionOptions) {
        const response = await send({
          id: generateId(),
          type: "projectAnnotationsOntoHtml",
          html,
          annotationSet,
          projectionOptions
        });
        return requireField(response, "html");
      },
      async convertDocxToHtmlWithExternalAnnotations(document2, annotationSet, conversionOptions2, projectionOptions) {
        const bytes = await toBytes(document2);
        const response = await send(
          {
            id: generateId(),
            type: "convertDocxToHtmlWithExternalAnnotations",
            documentBytes: bytes,
            annotationSet,
            conversionOptions: conversionOptions2,
            projectionOptions
          },
          [bytes.buffer]
        );
        return requireField(response, "html");
      },
      async exportToOpenContract(document2) {
        const bytes = await toBytes(document2);
        const response = await send(
          { id: generateId(), type: "exportToOpenContract", documentBytes: bytes },
          [bytes.buffer]
        );
        return requireField(response, "export");
      },
      async generatePackageManifestJson(document2, limits) {
        const bytes = await toBytes(document2);
        const response = await send(
          {
            id: generateId(),
            type: "generatePackageManifest",
            documentBytes: bytes,
            limits,
            representation: "json"
          },
          [bytes.buffer]
        );
        return requireField(response, "manifestJson");
      },
      async projectReviewProfile(document2, profile, maximumOutputBytes) {
        const bytes = await toBytes(document2);
        const response = await send(
          {
            id: generateId(),
            type: "projectReviewProfile",
            documentBytes: bytes,
            profile,
            maximumOutputBytes
          },
          [bytes.buffer]
        );
        if (!response.documentBytes || response.documentBytes.byteLength === 0) {
          throw new Error(`Failed to derive the ${profile} review profile`);
        }
        return response.documentBytes;
      },
      async convertDocxToHtml(document2, options2, maximumOutputBytes) {
        const bytes = await toBytes(document2);
        const response = await send(
          {
            id: generateId(),
            type: "convertDocxToHtml",
            documentBytes: bytes,
            options: options2,
            maximumOutputBytes
          },
          [bytes.buffer]
        );
        return requireField(response, "html");
      },
      async compareDocuments(original, modified, options2) {
        const originalBytes = await toBytes(original);
        const modifiedBytes = await toBytes(modified);
        const response = await send(
          {
            id: generateId(),
            type: "compareDocuments",
            originalBytes,
            modifiedBytes,
            options: options2
          },
          [originalBytes.buffer, modifiedBytes.buffer]
        );
        return requireField(response, "documentBytes");
      },
      async compareDocumentsToHtml(original, modified, options2) {
        const originalBytes = await toBytes(original);
        const modifiedBytes = await toBytes(modified);
        const response = await send(
          {
            id: generateId(),
            type: "compareDocumentsToHtml",
            originalBytes,
            modifiedBytes,
            options: options2
          },
          [originalBytes.buffer, modifiedBytes.buffer]
        );
        return requireField(response, "html");
      },
      async getRevisions(document2) {
        const bytes = await toBytes(document2);
        const response = await send(
          {
            id: generateId(),
            type: "getRevisions",
            documentBytes: bytes
          },
          [bytes.buffer]
        );
        return requireField(response, "revisions");
      },
      async getComments(document2) {
        const bytes = await toBytes(document2);
        const response = await send(
          { id: generateId(), type: "getComments", documentBytes: bytes },
          [bytes.buffer]
        );
        return requireField(response, "comments");
      },
      async getDocumentMetadata(document2) {
        const bytes = await toBytes(document2);
        const response = await send(
          {
            id: generateId(),
            type: "getDocumentMetadata",
            documentBytes: bytes
          },
          [bytes.buffer]
        );
        return requireField(response, "metadata");
      },
      async getVersion() {
        const response = await send({
          id: generateId(),
          type: "getVersion"
        });
        return requireField(response, "version");
      },
      prepare() {
        if (preparePromise) {
          return preparePromise;
        }
        preparePromise = send({
          id: generateId(),
          type: "prepare"
        }).then(() => void 0);
        preparePromise.catch(() => {
          preparePromise = null;
        });
        return preparePromise;
      },
      async openDocxSession(document2, settings) {
        const bytes = await toBytes(document2);
        const settingsJson = settings ? JSON.stringify(settings) : "";
        const openResponse = await send(
          {
            id: generateId(),
            type: "sessionOpen",
            documentBytes: bytes,
            settingsJson
          },
          [bytes.buffer]
        );
        const handle = requireField(openResponse, "handle");
        return {
          async setRevisionIdentities(identities) {
            await send({
              id: generateId(),
              type: "sessionSetRevisionIdentities",
              handle,
              identities
            });
          },
          async getRevisionAuthorNameStatus(author) {
            const res = await send({
              id: generateId(),
              type: "sessionGetRevisionAuthorNameStatus",
              handle,
              author
            });
            return requireField(res, "authorNameInfo");
          },
          async getAnchorLocations(anchorIds) {
            const res = await send({
              id: generateId(),
              type: "sessionGetAnchorLocations",
              handle,
              anchorIds
            });
            return requireField(res, "anchorLocations");
          },
          async getPackageManifest() {
            const res = await send({
              id: generateId(),
              type: "sessionGetPackageManifest",
              handle
            });
            return requireField(res, "manifest");
          },
          async getSemanticChanges() {
            const res = await send({
              id: generateId(),
              type: "sessionGetSemanticChanges",
              handle
            });
            return requireField(res, "semanticChanges");
          },
          async verifyDeliverable(request) {
            const res = await send({
              id: generateId(),
              type: "sessionVerifyDeliverable",
              handle,
              requestJson: request === void 0 ? void 0 : serializeVerificationRequest(request)
            });
            return requireField(res, "verification");
          },
          async addAnnotation(anchorId, span, annotation) {
            const res = await send({
              id: generateId(),
              type: "sessionAddAnnotation",
              handle,
              anchorId,
              spanJson: span ? JSON.stringify(span) : "",
              annotationJson: JSON.stringify(annotation)
            });
            return requireField(res, "result");
          },
          async removeAnnotation(annotationId) {
            const res = await send({
              id: generateId(),
              type: "sessionRemoveAnnotation",
              handle,
              annotationId
            });
            return requireField(res, "result");
          },
          async updateAnnotation(annotationId, update) {
            const res = await send({
              id: generateId(),
              type: "sessionUpdateAnnotation",
              handle,
              annotationId,
              updateJson: JSON.stringify(update)
            });
            return requireField(res, "result");
          },
          async moveAnnotation(annotationId, newAnchorId, newSpan) {
            const res = await send({
              id: generateId(),
              type: "sessionMoveAnnotation",
              handle,
              annotationId,
              newAnchorId,
              newSpanJson: newSpan ? JSON.stringify(newSpan) : ""
            });
            return requireField(res, "result");
          },
          async close() {
            await sendRequest(
              { id: generateId(), type: "sessionClose", handle },
              void 0,
              { timeoutMs: requestOptions?.timeoutMs }
            );
          }
        };
      },
      terminate() {
        stopWorker("Worker terminated");
      },
      withRequestOptions(more) {
        checkTimeout(more.timeoutMs, "timeoutMs");
        return createApi({ ...requestOptions, ...more });
      },
      isActive() {
        return isWorkerActive;
      }
    };
  };
  return createApi();
}

// src/font-runtime.ts
var BrowserFontError = class extends Error {
  constructor(kind, message, detail, cause) {
    super(message);
    this.name = "BrowserFontError";
    this.kind = kind;
    this.detail = detail;
    this.cause = cause;
  }
};
var TEXT_ENCODER = new TextEncoder();
var MAX_FAMILY_COUNT = 64;
var MAX_FAMILY_CHARACTERS = 256;
var MAX_FAMILY_STACK_CHARACTERS = 4096;
var FONT_LOAD_CONCURRENCY = 16;
var GENERIC_FAMILIES = /* @__PURE__ */ new Set([
  "cursive",
  "emoji",
  "fangsong",
  "fantasy",
  "math",
  "monospace",
  "sans-serif",
  "serif",
  "system-ui",
  "ui-monospace",
  "ui-rounded",
  "ui-sans-serif",
  "ui-serif"
]);
var FONT_STRETCH_PERCENT = /* @__PURE__ */ new Map([
  ["ultra-condensed", 50],
  ["extra-condensed", 62.5],
  ["condensed", 75],
  ["semi-condensed", 87.5],
  ["normal", 100],
  ["semi-expanded", 112.5],
  ["expanded", 125],
  ["extra-expanded", 150],
  ["ultra-expanded", 200]
]);
var FORMAT_MEDIA = /* @__PURE__ */ new Map([
  ["ttf", "font/ttf"],
  ["otf", "font/otf"],
  ["woff", "font/woff"],
  ["woff2", "font/woff2"]
]);
var FORMAT_HINT = /* @__PURE__ */ new Map([
  ["ttf", "truetype"],
  ["otf", "opentype"],
  ["woff", "woff"],
  ["woff2", "woff2"]
]);
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) {
    throw new BrowserFontError("invalid_response", "Web Crypto SHA-256 is unavailable.");
  }
  const owned = new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", owned.buffer);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
async function digestJson(value) {
  return sha256(TEXT_ENCODER.encode(canonicalJson(value)));
}
async function abortable(promise, signal) {
  if (signal.aborted) throw new DOMException("Font loading was aborted", "AbortError");
  let rejectAbort;
  const aborted = new Promise((_, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => rejectAbort?.(new DOMException("Font loading was aborted", "AbortError"));
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
async function forEachBounded(values, operation) {
  let cursor = 0;
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor++;
      await operation(values[index], index);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(FONT_LOAD_CONCURRENCY, values.length) },
    () => worker()
  ));
}
function cssEscape(source, start) {
  let cursor = start + 1;
  if (cursor >= source.length) return { value: "\uFFFD", end: cursor };
  if (source[cursor] === "\r" && source[cursor + 1] === "\n") return { value: "", end: cursor + 2 };
  if (source[cursor] === "\n" || source[cursor] === "\r" || source[cursor] === "\f") {
    return { value: "", end: cursor + 1 };
  }
  const hexStart = cursor;
  while (cursor < source.length && cursor - hexStart < 6 && /[0-9a-f]/i.test(source[cursor])) cursor++;
  if (cursor > hexStart) {
    const point = Number.parseInt(source.slice(hexStart, cursor), 16);
    if (/\s/.test(source[cursor] ?? "")) {
      if (source[cursor] === "\r" && source[cursor + 1] === "\n") cursor += 2;
      else cursor++;
    }
    return {
      value: point === 0 || point > 1114111 || point >= 55296 && point <= 57343 ? "\uFFFD" : String.fromCodePoint(point),
      end: cursor
    };
  }
  return { value: source[cursor], end: cursor + 1 };
}
function parseCssFontFamilyTokens(value) {
  if (!isWellFormedUnicode(value)) {
    throw new BrowserFontError(
      "invalid_response",
      "A computed font-family value contains an unpaired UTF-16 surrogate."
    );
  }
  const families = [];
  let familyCharacters = 0;
  let family = "";
  let quote = "";
  let quoted = false;
  let cursor = 0;
  const finish = () => {
    const normalized = normalizeFontFamilyName(family);
    if (normalized) {
      if (!isWellFormedUnicode(normalized) || normalized.length > MAX_FAMILY_CHARACTERS || /[\u0000-\u001f\u007f]/u.test(normalized)) {
        throw new BrowserFontError(
          "resource_limit",
          `A computed font family must contain at most ${MAX_FAMILY_CHARACTERS} bounded characters.`,
          "fontFamilyCharacters"
        );
      }
      if (families.length >= MAX_FAMILY_COUNT) {
        throw new BrowserFontError(
          "resource_limit",
          `A computed font-family stack may contain at most ${MAX_FAMILY_COUNT} families.`,
          "fontFamilyCount"
        );
      }
      familyCharacters += normalized.length;
      if (familyCharacters > MAX_FAMILY_STACK_CHARACTERS) {
        throw new BrowserFontError(
          "resource_limit",
          `A computed font-family stack may contain at most ${MAX_FAMILY_STACK_CHARACTERS} characters.`,
          "fontFamilyCharacters"
        );
      }
      families.push({
        name: normalized,
        kind: quoted || !GENERIC_FAMILIES.has(fontFamilyKey(normalized)) ? "named" : "generic"
      });
    }
    family = "";
    quoted = false;
  };
  while (cursor < value.length) {
    const character = value[cursor];
    if (character === "\\") {
      const escape = cssEscape(value, cursor);
      family += escape.value;
      cursor = escape.end;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      else family += character;
      cursor++;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      quoted = true;
      cursor++;
      continue;
    }
    if (character === ",") {
      finish();
      cursor++;
      continue;
    }
    family += character;
    cursor++;
  }
  finish();
  return families;
}
function parseCssFontFamily(value) {
  return parseCssFontFamilyTokens(value).map(({ name }) => name);
}
function faceStyle(value) {
  const key = value.trim().toLowerCase();
  if (key.startsWith("italic")) return "italic";
  if (key.startsWith("oblique")) return "oblique";
  return "normal";
}
function faceWeight(value) {
  if (value === "bold") return 700;
  if (value === "normal") return 400;
  const weight = Number.parseFloat(value);
  return Number.isFinite(weight) ? Math.max(1, Math.min(1e3, Math.round(weight))) : 400;
}
function faceStretch(value) {
  const key = value.trim().toLowerCase();
  const named = FONT_STRETCH_PERCENT.get(key);
  if (named !== void 0) return named;
  const percentage = /^([0-9]+(?:\.[0-9]+)?)%$/.exec(key);
  if (!percentage) return 100;
  const stretch = Number.parseFloat(percentage[1]);
  return Number.isFinite(stretch) && stretch > 0 ? stretch : 100;
}
function requestKey(request) {
  return canonicalJson({
    familyStack: request.familyStack,
    familyKinds: request.familyKinds,
    stretch: request.stretch,
    style: request.style,
    weight: request.weight
  });
}
function participatesInRendering(element, view) {
  const leaf = view.getComputedStyle(element);
  if (leaf.visibility === "hidden" || leaf.visibility === "collapse") return false;
  for (let current = element; current; current = current.parentElement) {
    const computed = current === element ? leaf : view.getComputedStyle(current);
    if (computed.display === "none" || computed.contentVisibility === "hidden") return false;
  }
  return true;
}
var MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
function mathAutoText(text, transform) {
  if (transform !== "math-auto" || Array.from(text).length !== 1) return text;
  const point = text.codePointAt(0);
  const exceptions = {
    104: 8462,
    305: 120484,
    567: 120485,
    1012: 120563,
    8711: 120571,
    8706: 120597,
    1013: 120598,
    977: 120599,
    1008: 120600,
    981: 120601,
    1009: 120602,
    982: 120603
  };
  const mapped = exceptions[point] ?? (point >= 65 && point <= 90 ? point + 119795 : point >= 97 && point <= 122 ? point + 119789 : point >= 913 && point <= 937 && point !== 930 ? point + 119633 : point >= 945 && point <= 969 ? point + 119627 : point);
  return String.fromCodePoint(mapped);
}
function* fontSamples(document2) {
  const walker = document2.createTreeWalker(document2.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement) yield { element: node.parentElement, text: node.nodeValue ?? "" };
  }
  for (const element of Array.from(document2.getElementsByTagNameNS(MATHML_NAMESPACE, "*"))) {
    if (element.localName === "msqrt" || element.localName === "mroot")
      yield { element, text: "\u221A", generated: true };
  }
}
function collectFontInventory(document2, limits) {
  const view = document2.defaultView;
  if (!view || !document2.body) throw new BrowserFontError("invalid_response", "The render document has no font realm.");
  const requests = /* @__PURE__ */ new Map();
  const uses = [];
  let sampledCodePoints = 0;
  let renderedTextNodeCount = 0;
  for (const { element, text, generated } of fontSamples(document2)) {
    if (!text || /^(?:script|style|template|noscript)$/i.test(element.localName)) continue;
    if (!participatesInRendering(element, view)) continue;
    if (!generated) renderedTextNodeCount++;
    const computed = view.getComputedStyle(element);
    const parsedFamilies = parseCssFontFamilyTokens(computed.fontFamily);
    if (parsedFamilies.length === 0) continue;
    const descriptor = {
      familyStack: parsedFamilies.map(({ name }) => name),
      familyKinds: parsedFamilies.map(({ kind }) => kind),
      style: faceStyle(computed.fontStyle),
      weight: faceWeight(computed.fontWeight),
      stretch: faceStretch(computed.fontStretch)
    };
    const key = requestKey(descriptor);
    let request = requests.get(key);
    if (!request) {
      if (requests.size >= limits.fontRequests) {
        throw new BrowserFontError(
          "resource_limit",
          `fontRequests limit exceeded (${requests.size + 1} > ${limits.fontRequests}).`,
          "fontRequests"
        );
      }
      request = { ...descriptor, sampleCodePoints: /* @__PURE__ */ new Set() };
      requests.set(key, request);
    }
    for (const character of mathAutoText(text, computed.textTransform)) {
      const scalar = character.codePointAt(0);
      const point = scalar >= 55296 && scalar <= 57343 ? 65533 : scalar;
      if (request.sampleCodePoints.has(point)) continue;
      sampledCodePoints++;
      if (sampledCodePoints > limits.fontSampleCodePoints) {
        throw new BrowserFontError(
          "resource_limit",
          `fontSampleCodePoints limit exceeded (${sampledCodePoints} > ${limits.fontSampleCodePoints}).`,
          "fontSampleCodePoints"
        );
      }
      request.sampleCodePoints.add(point);
    }
    uses.push({ element, requestKey: key, originalStyle: element.getAttribute("style"), ownsText: true });
  }
  const requestsByStack = /* @__PURE__ */ new Map();
  for (const [key, request] of requests) {
    const stackKey = JSON.stringify([request.familyStack, request.familyKinds]);
    const list = requestsByStack.get(stackKey) ?? [];
    list.push({ key, request });
    requestsByStack.set(stackKey, list);
  }
  const closestRequestKey = (descriptor) => {
    const candidates = requestsByStack.get(JSON.stringify([descriptor.familyStack, descriptor.familyKinds]));
    if (!candidates) return void 0;
    let best;
    for (const { key, request } of candidates) {
      const distance = (request.style === descriptor.style ? 0 : 1e4) + Math.abs(request.weight - descriptor.weight) + Math.abs(request.stretch - descriptor.stretch);
      if (!best || distance < best.distance || distance === best.distance && compareText(key, best.key) < 0) {
        best = { key, distance };
      }
    }
    return best?.key;
  };
  const used = new Set(uses.map((use) => use.element));
  for (const element of Array.from(document2.body.querySelectorAll("*"))) {
    if (!(element instanceof view.HTMLElement) && element.namespaceURI !== MATHML_NAMESPACE) continue;
    const fontElement = element;
    if (used.has(fontElement)) continue;
    if (/^(?:script|style|template|noscript)$/i.test(element.localName)) continue;
    if (!participatesInRendering(element, view)) continue;
    const computed = view.getComputedStyle(element);
    const parsedFamilies = parseCssFontFamilyTokens(computed.fontFamily);
    if (parsedFamilies.length === 0) continue;
    const descriptor = {
      familyStack: parsedFamilies.map(({ name }) => name),
      familyKinds: parsedFamilies.map(({ kind }) => kind),
      style: faceStyle(computed.fontStyle),
      weight: faceWeight(computed.fontWeight),
      stretch: faceStretch(computed.fontStretch)
    };
    const exactKey = requestKey(descriptor);
    const key = requests.has(exactKey) ? exactKey : closestRequestKey(descriptor);
    if (key === void 0) continue;
    uses.push({ element: fontElement, requestKey: key, originalStyle: element.getAttribute("style") });
  }
  const ordered = Array.from(requests, ([key, request]) => ({ key, request })).sort((left, right) => compareText(left.key, right.key));
  const idByKey = /* @__PURE__ */ new Map();
  const result = Object.freeze(ordered.map(({ key, request }, index) => {
    const id = `font-${String(index + 1).padStart(4, "0")}`;
    idByKey.set(key, id);
    return Object.freeze({
      id,
      familyStack: Object.freeze([...request.familyStack]),
      familyKinds: Object.freeze([...request.familyKinds]),
      style: request.style,
      weight: request.weight,
      stretch: request.stretch,
      sampleCodePoints: Object.freeze(Array.from(request.sampleCodePoints).sort((left, right) => left - right))
    });
  }));
  return {
    requests: result,
    uses: uses.map((use) => ({ ...use, requestKey: idByKey.get(use.requestKey) })),
    renderedTextNodeCount
  };
}
function inventoryDocumentFontRequests(document2, limits) {
  return [...collectFontInventory(document2, {
    ...limits,
    fontFiles: Number.MAX_SAFE_INTEGER,
    fontFileBytes: Number.MAX_SAFE_INTEGER,
    fontTotalBytes: Number.MAX_SAFE_INTEGER
  }).requests];
}
function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BrowserFontError("invalid_response", `${label} must be an object.`);
  }
  return value;
}
function exactKeys(record, allowed, label) {
  const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new BrowserFontError("invalid_response", `${label} contains unknown fields: ${unknown.sort(compareText).join(", ")}.`);
  }
}
function shortString(value, label, maximum = 512) {
  if (typeof value !== "string" || value.trim() === "" || value.length > maximum || !isWellFormedUnicode(value) || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new BrowserFontError("invalid_response", `${label} must be a non-empty string of at most ${maximum} characters.`);
  }
  return value;
}
function digestString(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new BrowserFontError("invalid_response", `${label} must be a lowercase SHA-256 digest.`);
  }
  return value;
}
function boundedNumber(value, label, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new BrowserFontError(
      "invalid_response",
      `${label} must be a finite number from ${minimum} through ${maximum}.`
    );
  }
  return value;
}
function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new BrowserFontError("invalid_response", `${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}
function canonicalBase64(value, expectedBytes, label) {
  const expectedCharacters = 4 * Math.ceil(expectedBytes / 3);
  if (typeof value !== "string" || value.length !== expectedCharacters || value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new BrowserFontError("invalid_response", `${label} must be canonical padded base64 without whitespace.`);
  }
  let decoded;
  try {
    decoded = globalThis.atob(value);
  } catch (cause) {
    throw new BrowserFontError("invalid_response", `${label} is not valid base64.`, String(cause));
  }
  if (decoded.length !== expectedBytes) {
    throw new BrowserFontError("invalid_response", `${label} byte length does not match its metadata.`);
  }
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 32768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  }
  if (globalThis.btoa(binary) !== value) {
    throw new BrowserFontError("invalid_response", `${label} is not canonical base64.`);
  }
  return bytes;
}
function readU32(bytes, offset) {
  if (bytes.byteLength < offset + 4) {
    throw new BrowserFontError("invalid_response", "A configured webfont has a truncated format header.");
  }
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}
function expandedFontByteLength(bytes, format, label, maximum) {
  if (format !== "woff" && format !== "woff2") return bytes.byteLength;
  const declaredLength = readU32(bytes, 8);
  if (declaredLength !== bytes.byteLength) {
    throw new BrowserFontError("invalid_response", `${label} declared length does not match its decoded bytes.`);
  }
  const expanded = readU32(bytes, 16);
  if (expanded === 0) {
    throw new BrowserFontError("invalid_response", `${label} declares an invalid expanded size.`);
  }
  if (expanded > maximum) {
    throw new BrowserFontError(
      "resource_limit",
      `fontFileBytes limit exceeded by ${label} expanded bytes (${expanded} > ${maximum}).`,
      "fontFileBytes"
    );
  }
  return expanded;
}
function fontSignatureMatches(bytes, format) {
  if (bytes.length < 4) return false;
  const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (format === "otf") return signature === "OTTO";
  if (format === "woff") return signature === "wOFF";
  if (format === "woff2") return signature === "wOF2";
  return bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0 || signature === "true";
}
function scalarArray(value, label, request) {
  if (!Array.isArray(value)) throw new BrowserFontError("invalid_response", `${label} must be an array.`);
  const requestPoints = new Set(request.sampleCodePoints);
  const result = value.map((point, index) => integer(point, `${label}[${index}]`, 0, 1114111));
  if (result.some((point) => point >= 55296 && point <= 57343) || result.some((point, index) => index > 0 && point <= result[index - 1]) || result.some((point) => !requestPoints.has(point))) {
    throw new BrowserFontError("invalid_response", `${label} must be sorted, distinct scalar values from the request sample.`);
  }
  return result;
}
function snapshotFields(value, allowed, label) {
  const record = requireObject(value, label);
  exactKeys(record, allowed, label);
  const snapshot = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(record, key)) snapshot[key] = record[key];
  }
  return Object.freeze(snapshot);
}
function snapshotResolverResponse(value, requestCount, limits) {
  const response = snapshotFields(value, [
    "schemaVersion",
    "resolverContract",
    "substitutionContractVersion",
    "substitutionContractDigest",
    "outcomes",
    "faces",
    "fallback"
  ], "font resolver response");
  const faceValues = response.faces;
  if (!Array.isArray(faceValues)) {
    throw new BrowserFontError("invalid_response", "font resolver response faces must be an array.");
  }
  if (faceValues.length > limits.fontFiles) {
    throw new BrowserFontError(
      "resource_limit",
      `fontFiles limit exceeded (${faceValues.length} > ${limits.fontFiles}).`,
      "fontFiles"
    );
  }
  const faceSnapshots = [];
  for (let index = 0; index < faceValues.length; index++) {
    const value2 = faceValues[index];
    const face = snapshotFields(value2, [
      "id",
      "resolvedFamily",
      "postscriptName",
      "version",
      "style",
      "weight",
      "stretch",
      "format",
      "mediaType",
      "byteLength",
      "sha256",
      "bytesBase64",
      "licenseEvidence",
      "source"
    ], `faces[${index}]`);
    const evidence = snapshotFields(
      face.licenseEvidence,
      ["kind", "identity", "noSubsetting"],
      `faces[${index}].licenseEvidence`
    );
    faceSnapshots.push(Object.freeze({ ...face, licenseEvidence: evidence }));
  }
  const faces = Object.freeze(faceSnapshots);
  const outcomeValues = response.outcomes;
  if (!Array.isArray(outcomeValues) || outcomeValues.length !== requestCount) {
    throw new BrowserFontError("invalid_response", "The font resolver must return exactly one outcome per request.");
  }
  const outcomeSnapshots = [];
  for (let index = 0; index < outcomeValues.length; index++) {
    const value2 = outcomeValues[index];
    const outcome = snapshotFields(value2, [
      "requestId",
      "status",
      "faceId",
      "requestedFamily",
      "resolvedFamily",
      "metricCompatible",
      "faceMatch",
      "glyphCoverage",
      "missingCodePoints"
    ], `outcomes[${index}]`);
    const missing = outcome.missingCodePoints;
    if (missing !== void 0 && !Array.isArray(missing)) {
      throw new BrowserFontError("invalid_response", `outcomes[${index}].missingCodePoints must be an array.`);
    }
    if (Array.isArray(missing) && missing.length > limits.fontSampleCodePoints) {
      throw new BrowserFontError(
        "resource_limit",
        `fontSampleCodePoints limit exceeded by outcomes[${index}].missingCodePoints.`,
        "fontSampleCodePoints"
      );
    }
    let missingSnapshot;
    if (Array.isArray(missing)) {
      const copied = [];
      for (let missingIndex = 0; missingIndex < missing.length; missingIndex++) {
        copied.push(missing[missingIndex]);
      }
      missingSnapshot = Object.freeze(copied);
    }
    outcomeSnapshots.push(Object.freeze({
      ...outcome,
      ...missingSnapshot ? { missingCodePoints: missingSnapshot } : {}
    }));
  }
  const outcomes = Object.freeze(outcomeSnapshots);
  return Object.freeze({ ...response, faces, outcomes });
}
async function validateResolverResponse(value, requests, limits, expectedContractDigest) {
  const record = snapshotResolverResponse(value, requests.length, limits);
  if (record.schemaVersion !== FONT_RESOLVER_SCHEMA_VERSION || record.resolverContract !== FONT_RESOLVER_CONTRACT_ID || record.substitutionContractVersion !== FONT_SUBSTITUTION_CONTRACT_VERSION || record.substitutionContractDigest !== expectedContractDigest) {
    throw new BrowserFontError("invalid_response", "The font resolver response uses a different contract identity.");
  }
  if (record.fallback !== void 0 && record.fallback !== "generic") {
    throw new BrowserFontError("invalid_response", "The font resolver fallback policy is invalid.");
  }
  const faceValues = record.faces;
  const faces = /* @__PURE__ */ new Map();
  let totalBytes = 0;
  let totalExpandedBytes = 0;
  for (const [index, face] of faceValues.entries()) {
    const id = shortString(face.id, `faces[${index}].id`, 128);
    if (faces.has(id)) throw new BrowserFontError("invalid_response", `Duplicate configured face id: ${id}.`);
    const format = face.format;
    if (format !== "ttf" && format !== "otf" && format !== "woff" && format !== "woff2") {
      throw new BrowserFontError("invalid_response", `faces[${index}].format is unsupported.`);
    }
    if (face.mediaType !== FORMAT_MEDIA.get(format)) {
      throw new BrowserFontError("invalid_response", `faces[${index}].mediaType does not match its format.`);
    }
    const byteLength = integer(face.byteLength, `faces[${index}].byteLength`, 1, limits.fontFileBytes);
    totalBytes += byteLength;
    if (totalBytes > limits.fontTotalBytes) {
      throw new BrowserFontError("resource_limit", `fontTotalBytes limit exceeded (${totalBytes} > ${limits.fontTotalBytes}).`, "fontTotalBytes");
    }
    const bytesBase64 = face.bytesBase64;
    const bytes = canonicalBase64(bytesBase64, byteLength, `faces[${index}].bytesBase64`);
    if (!fontSignatureMatches(bytes, format)) {
      throw new BrowserFontError("invalid_response", `faces[${index}] decoded signature does not match its format.`);
    }
    const expandedBytes = expandedFontByteLength(
      bytes,
      format,
      `faces[${index}]`,
      limits.fontFileBytes
    );
    totalExpandedBytes += expandedBytes;
    if (totalExpandedBytes > limits.fontTotalBytes) {
      throw new BrowserFontError(
        "resource_limit",
        `fontTotalBytes limit exceeded by expanded font bytes (${totalExpandedBytes} > ${limits.fontTotalBytes}).`,
        "fontTotalBytes"
      );
    }
    const expectedDigest = digestString(face.sha256, `faces[${index}].sha256`);
    if (await sha256(bytes) !== expectedDigest) {
      throw new BrowserFontError("invalid_response", `faces[${index}] bytes do not match sha256.`);
    }
    const evidence = face.licenseEvidence;
    if (evidence.kind !== "installable" && evidence.kind !== "previewPrint" && evidence.kind !== "editable" && evidence.kind !== "attested") {
      throw new BrowserFontError("invalid_response", `faces[${index}].licenseEvidence.kind is invalid.`);
    }
    if (evidence.noSubsetting !== true && evidence.noSubsetting !== false) {
      throw new BrowserFontError("invalid_response", `faces[${index}].licenseEvidence.noSubsetting must be boolean.`);
    }
    const style = face.style;
    if (style !== "normal" && style !== "italic" && style !== "oblique") {
      throw new BrowserFontError("invalid_response", `faces[${index}].style is invalid.`);
    }
    const licenseEvidence = Object.freeze({
      kind: evidence.kind,
      identity: digestString(evidence.identity, `faces[${index}].licenseEvidence.identity`),
      noSubsetting: evidence.noSubsetting
    });
    if (face.source !== void 0 && face.source !== "local" && face.source !== "document") {
      throw new BrowserFontError("invalid_response", `faces[${index}].source is invalid.`);
    }
    const resolved = Object.freeze({
      id,
      ...face.source === void 0 ? {} : { source: face.source },
      resolvedFamily: normalizeFontFamilyName(shortString(
        face.resolvedFamily,
        `faces[${index}].resolvedFamily`,
        MAX_FAMILY_CHARACTERS
      )),
      ...face.postscriptName === void 0 ? {} : { postscriptName: shortString(face.postscriptName, `faces[${index}].postscriptName`) },
      version: shortString(face.version, `faces[${index}].version`),
      style,
      weight: integer(face.weight, `faces[${index}].weight`, 1, 1e3),
      stretch: boundedNumber(face.stretch, `faces[${index}].stretch`, 50, 200),
      format,
      mediaType: FORMAT_MEDIA.get(format),
      byteLength,
      sha256: expectedDigest,
      bytesBase64,
      licenseEvidence
    });
    faces.set(id, { record: resolved, bytes });
  }
  const outcomeValues = record.outcomes;
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const seen = /* @__PURE__ */ new Set();
  const outcomes = [];
  for (const [index, outcome] of outcomeValues.entries()) {
    const requestId = shortString(outcome.requestId, `outcomes[${index}].requestId`, 128);
    const request = requestById.get(requestId);
    if (!request || seen.has(requestId)) {
      throw new BrowserFontError("invalid_response", `outcomes[${index}].requestId is unknown or duplicated.`);
    }
    seen.add(requestId);
    const status = outcome.status;
    if (status !== "resolved" && status !== "substituted" && status !== "missing" && status !== "unverified") {
      throw new BrowserFontError("invalid_response", `outcomes[${index}].status is invalid.`);
    }
    const faceId = outcome.faceId === void 0 ? void 0 : shortString(outcome.faceId, `outcomes[${index}].faceId`, 128);
    if ((status === "resolved" || status === "substituted") !== (faceId !== void 0)) {
      throw new BrowserFontError("invalid_response", `outcomes[${index}] has an inconsistent face selection.`);
    }
    const selectedFace = faceId === void 0 ? void 0 : faces.get(faceId)?.record;
    if (faceId && !selectedFace) throw new BrowserFontError("invalid_response", `outcomes[${index}] references an unknown face.`);
    const requestedFamily = outcome.requestedFamily === void 0 ? request.familyStack[0] : normalizeFontFamilyName(shortString(
      outcome.requestedFamily,
      `outcomes[${index}].requestedFamily`,
      MAX_FAMILY_CHARACTERS
    ));
    if (!request.familyStack.some((family) => fontFamilyKey(family) === fontFamilyKey(requestedFamily))) {
      throw new BrowserFontError("invalid_response", `outcomes[${index}].requestedFamily is not in the request stack.`);
    }
    const resolvedFamily = outcome.resolvedFamily === void 0 ? selectedFace?.resolvedFamily : normalizeFontFamilyName(shortString(
      outcome.resolvedFamily,
      `outcomes[${index}].resolvedFamily`,
      MAX_FAMILY_CHARACTERS
    ));
    if (selectedFace && (!resolvedFamily || fontFamilyKey(resolvedFamily) !== fontFamilyKey(selectedFace.resolvedFamily))) {
      throw new BrowserFontError("invalid_response", `outcomes[${index}].resolvedFamily does not match its face.`);
    }
    if (status === "resolved" && (request.familyKinds[0] !== "named" || fontFamilyKey(requestedFamily) !== fontFamilyKey(request.familyStack[0]) || !resolvedFamily || fontFamilyKey(resolvedFamily) !== fontFamilyKey(request.familyStack[0]))) {
      throw new BrowserFontError(
        "invalid_response",
        `outcomes[${index}] resolved status must match the request's primary family.`
      );
    }
    if (outcome.metricCompatible !== void 0 && typeof outcome.metricCompatible !== "boolean") {
      throw new BrowserFontError("invalid_response", `outcomes[${index}].metricCompatible must be boolean.`);
    }
    if (outcome.faceMatch !== void 0 && outcome.faceMatch !== "exact" && outcome.faceMatch !== "synthesized") {
      throw new BrowserFontError("invalid_response", `outcomes[${index}].faceMatch is invalid.`);
    }
    if (outcome.glyphCoverage !== void 0 && outcome.glyphCoverage !== "complete" && outcome.glyphCoverage !== "partial" && outcome.glyphCoverage !== "unverified") {
      throw new BrowserFontError("invalid_response", `outcomes[${index}].glyphCoverage is invalid.`);
    }
    const missingCodePoints = outcome.missingCodePoints === void 0 ? void 0 : scalarArray(outcome.missingCodePoints, `outcomes[${index}].missingCodePoints`, request);
    const missingCodePointCount = missingCodePoints?.length ?? 0;
    if (outcome.glyphCoverage === "complete" && missingCodePointCount > 0) {
      throw new BrowserFontError(
        "invalid_response",
        `outcomes[${index}] complete coverage cannot name missing code points.`
      );
    }
    if (outcome.glyphCoverage === "partial" && missingCodePointCount === 0 || missingCodePointCount > 0 && outcome.glyphCoverage !== "partial") {
      throw new BrowserFontError(
        "invalid_response",
        `outcomes[${index}] partial coverage must exactly match a non-empty missing-code-point list.`
      );
    }
    if (selectedFace && missingCodePointCount === 0 && outcome.glyphCoverage !== "complete") {
      throw new BrowserFontError(
        "invalid_response",
        `outcomes[${index}] must declare complete coverage when no code points are missing.`
      );
    }
    if (outcome.faceMatch === "exact" && selectedFace && (selectedFace.style !== request.style || selectedFace.weight !== request.weight || selectedFace.stretch !== request.stretch)) {
      throw new BrowserFontError(
        "invalid_response",
        `outcomes[${index}] claims an exact face with different style, weight, or stretch.`
      );
    }
    if (status === "missing" || status === "unverified") {
      const hasSelectionMetadata = outcome.resolvedFamily !== void 0 || outcome.metricCompatible !== void 0 || outcome.faceMatch !== void 0 || outcome.missingCodePoints !== void 0 || outcome.glyphCoverage !== void 0 && outcome.glyphCoverage !== "unverified";
      if (hasSelectionMetadata) {
        throw new BrowserFontError(
          "invalid_response",
          `outcomes[${index}] cannot attach selection metadata to ${status} status.`
        );
      }
    }
    outcomes.push(Object.freeze({
      requestId,
      status,
      ...faceId ? { faceId } : {},
      requestedFamily,
      ...resolvedFamily ? { resolvedFamily } : {},
      ...outcome.metricCompatible === void 0 ? {} : { metricCompatible: outcome.metricCompatible },
      ...outcome.faceMatch === void 0 ? {} : { faceMatch: outcome.faceMatch },
      ...outcome.glyphCoverage === void 0 ? {} : { glyphCoverage: outcome.glyphCoverage },
      ...missingCodePoints === void 0 ? {} : { missingCodePoints: Object.freeze(missingCodePoints) }
    }));
  }
  const referencedFaces = new Set(outcomes.flatMap((outcome) => outcome.faceId ? [outcome.faceId] : []));
  if (Array.from(faces.keys()).some((id) => !referencedFaces.has(id))) {
    throw new BrowserFontError("invalid_response", "The font resolver returned an unreferenced face.");
  }
  outcomes.sort((left, right) => compareText(left.requestId, right.requestId));
  const faceRecords = Array.from(faces.values(), ({ record: record2 }) => record2).sort((left, right) => compareText(left.id, right.id));
  return {
    response: Object.freeze({
      schemaVersion: FONT_RESOLVER_SCHEMA_VERSION,
      resolverContract: FONT_RESOLVER_CONTRACT_ID,
      substitutionContractVersion: FONT_SUBSTITUTION_CONTRACT_VERSION,
      substitutionContractDigest: expectedContractDigest,
      ...record.fallback === "generic" ? { fallback: "generic" } : {},
      outcomes: Object.freeze(outcomes),
      faces: Object.freeze(faceRecords)
    }),
    faces
  };
}
function cssString(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\n\r\f]/g, (character) => `\\${character.codePointAt(0).toString(16)} `)}"`;
}
function serializeFamilyStack(families, kinds = families.map(() => "named")) {
  return families.map((family, index) => kinds[index] === "generic" ? fontFamilyKey(family) : cssString(family)).join(", ");
}
function fontSpecification(request, families, kinds) {
  const stretch = Array.from(FONT_STRETCH_PERCENT).find(([, value]) => value === request.stretch)?.[0];
  return `${request.style} ${request.weight}${stretch ? ` ${stretch}` : ""} 12px ${serializeFamilyStack(families, kinds)}`;
}
function responseIdentityMaterial(response) {
  return {
    schemaVersion: response.schemaVersion,
    resolverContract: response.resolverContract,
    substitutionContractVersion: response.substitutionContractVersion,
    substitutionContractDigest: response.substitutionContractDigest,
    ...response.fallback ? { fallback: response.fallback } : {},
    outcomes: response.outcomes,
    faces: response.faces.map(({ bytesBase64: _bytes, ...face }) => face)
  };
}
async function syntheticFamily(resolverDigest, faceId) {
  const mapping = await digestJson({
    faceId,
    resolverDigest
  });
  return `__DocxodusConfigured_${resolverDigest.slice(0, 16)}_${mapping.slice(0, 16)}`;
}
function restoreUse(use) {
  if (use.originalStyle === null) use.element.removeAttribute("style");
  else use.element.setAttribute("style", use.originalStyle);
}
function faceRule(family, face) {
  return `@font-face{font-family:${cssString(family)};src:url("data:${face.mediaType};base64,${face.bytesBase64}") format("${FORMAT_HINT.get(face.format)}");font-style:${face.style};font-weight:${face.weight};font-stretch:${face.stretch}%;font-display:block}`;
}
function baseResolution(request) {
  return {
    requestId: request.id,
    requestedFamily: request.familyStack[0],
    requestedFamilies: [...request.familyStack],
    requestedFamilyKinds: [...request.familyKinds],
    requestedStyle: request.style,
    requestedWeight: request.weight,
    requestedStretch: request.stretch,
    sampleCodePointCount: request.sampleCodePoints.length
  };
}
var FONT_AVAILABILITY_SAMPLE = "MWmwilAaGg0189";
var FONT_AVAILABILITY_FALLBACKS = ["monospace", "serif", "sans-serif"];
function familyAvailable(document2, family, kind) {
  if (kind === "generic") return true;
  const context = document2.createElement("canvas").getContext("2d");
  if (!context) return true;
  const token = serializeFamilyStack([family], ["named"]);
  for (const fallback of FONT_AVAILABILITY_FALLBACKS) {
    context.font = `72px ${fallback}`;
    const baseline = context.measureText(FONT_AVAILABILITY_SAMPLE).width;
    context.font = `72px ${token}, ${fallback}`;
    if (context.measureText(FONT_AVAILABILITY_SAMPLE).width !== baseline) return true;
  }
  return false;
}
function requestedFamilyAvailable(document2, request) {
  const index = request.familyStack.findIndex((_, position) => request.familyKinds[position] === "named");
  if (index < 0) return true;
  return familyAvailable(document2, request.familyStack[index], "named");
}
async function observedFonts(document2, inventory, pending, signal, contractDigest) {
  const probes = /* @__PURE__ */ new Map();
  if (document2.fonts) {
    await forEachBounded(inventory.requests, async (request) => {
      const sample = String.fromCodePoint(...request.sampleCodePoints.slice(0, 4096)) || " ";
      const specification = fontSpecification(request, request.familyStack, request.familyKinds);
      try {
        await abortable(document2.fonts.load(specification, sample), signal);
        probes.set(request.id, requestedFamilyAvailable(document2, request));
      } catch (error) {
        if (signal.aborted) throw error;
        probes.set(request.id, false);
      } finally {
        pending.delete(`request:${request.id}`);
      }
    });
    await abortable(document2.fonts.ready.then(() => void 0), signal);
  } else {
    inventory.requests.forEach((request) => pending.delete(`request:${request.id}`));
  }
  pending.delete("document.fonts.ready");
  const resolutions = [];
  for (const request of inventory.requests) {
    resolutions.push({
      ...baseResolution(request),
      sampleDigest: await digestJson(request.sampleCodePoints),
      status: probes.get(request.id) === false ? "missing" : "unverified",
      source: "browser",
      glyphCoverage: "unverified",
      verified: false
    });
  }
  const resolutionDigest = await digestJson({ contractDigest, requests: inventory.requests, resolutions });
  return {
    identity: {
      resolverContract: FONT_RESOLVER_CONTRACT_ID,
      substitutionContractVersion: FONT_SUBSTITUTION_CONTRACT_VERSION,
      substitutionContractDigest: contractDigest,
      resolutionDigest
    },
    resolutions,
    renderedTextNodeCount: inventory.renderedTextNodeCount,
    resolverConfigured: false
  };
}
async function configuredFonts(document2, inventory, resolver, limits, pending, signal, contractDigest) {
  const resolverRequests = Object.freeze(inventory.requests.map((request) => Object.freeze({
    id: request.id,
    familyStack: Object.freeze([...request.familyStack]),
    familyKinds: Object.freeze([...request.familyKinds]),
    style: request.style,
    weight: request.weight,
    stretch: request.stretch,
    sampleCodePoints: Object.freeze([...request.sampleCodePoints])
  })));
  const view = document2.defaultView;
  if (!view) throw new BrowserFontError("invalid_response", "The render document has no font realm.");
  let validated;
  const successfulFaces = /* @__PURE__ */ new Set();
  const faceLoadFailures = /* @__PURE__ */ new Map();
  const rejectedFaceIds = /* @__PURE__ */ new Set();
  while (true) {
    const resolverRequest = Object.freeze({
      schemaVersion: FONT_RESOLVER_SCHEMA_VERSION,
      requests: resolverRequests,
      ...rejectedFaceIds.size ? { rejectedFaceIds: Object.freeze([...rejectedFaceIds]) } : {}
    });
    pending.add("resolver");
    let responseValue;
    try {
      responseValue = await abortable(resolver(resolverRequest, signal), signal);
    } catch (cause) {
      if (signal.aborted) throw cause;
      throw new BrowserFontError(
        "invalid_response",
        `The configured font resolver failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        void 0,
        cause
      );
    } finally {
      pending.delete("resolver");
    }
    validated = await validateResolverResponse(responseValue, inventory.requests, limits, contractDigest);
    successfulFaces.clear();
    faceLoadFailures.clear();
    for (const id of validated.faces.keys()) pending.add(`face:${id}`);
    await forEachBounded(Array.from(validated.faces), async ([id, face]) => {
      try {
        const candidate = new view.FontFace("__DocxodusValidation", new Uint8Array(face.bytes).buffer, {
          style: face.record.style,
          weight: String(face.record.weight),
          stretch: `${face.record.stretch}%`
        });
        await abortable(candidate.load(), signal);
        successfulFaces.add(id);
      } catch (error) {
        if (signal.aborted) throw error;
        faceLoadFailures.set(id, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
      } finally {
        pending.delete(`face:${id}`);
      }
    });
    const rejected = [...validated.faces].filter(([id, face]) => face.record.source === "local" && !successfulFaces.has(id));
    if (validated.response.fallback !== "generic" || !rejected.length) break;
    for (const [id] of rejected) {
      if (rejectedFaceIds.has(id)) throw new BrowserFontError("invalid_response", "The resolver returned a rejected local face again.");
      rejectedFaceIds.add(id);
    }
    if (rejectedFaceIds.size > limits.fontFiles) throw new BrowserFontError(
      "resource_limit",
      "Local font decode retries exceed fontFiles limit.",
      "fontFiles"
    );
  }
  const resolverDigest = await digestJson({
    requests: inventory.requests,
    response: responseIdentityMaterial(validated.response)
  });
  const outcomeById = new Map(validated.response.outcomes.map((outcome) => [outcome.requestId, outcome]));
  const successfulRequests = new Set(validated.response.outcomes.filter((outcome) => outcome.faceId && successfulFaces.has(outcome.faceId)).map((outcome) => outcome.requestId));
  const syntheticByRequest = /* @__PURE__ */ new Map();
  const syntheticByFaceId = /* @__PURE__ */ new Map();
  for (const outcome of validated.response.outcomes) {
    if (!outcome.faceId || !successfulFaces.has(outcome.faceId)) continue;
    let synthetic = syntheticByFaceId.get(outcome.faceId);
    if (!synthetic) {
      synthetic = await syntheticFamily(resolverDigest, outcome.faceId);
      syntheticByFaceId.set(outcome.faceId, synthetic);
    }
    syntheticByRequest.set(outcome.requestId, synthetic);
  }
  const installedMappings = /* @__PURE__ */ new Set();
  const style = document2.createElement("style");
  style.id = "docxodus-configured-fonts";
  const rebuildStyle = () => {
    const rules = [];
    installedMappings.clear();
    for (const outcome of validated.response.outcomes) {
      const synthetic = syntheticByRequest.get(outcome.requestId);
      const face = outcome.faceId ? validated.faces.get(outcome.faceId)?.record : void 0;
      if (!synthetic || !face || !successfulRequests.has(outcome.requestId)) continue;
      const mapping = `${synthetic}\0${face.id}`;
      if (installedMappings.has(mapping)) continue;
      installedMappings.add(mapping);
      rules.push(faceRule(synthetic, face));
    }
    style.textContent = rules.sort(compareText).join("\n");
  };
  rebuildStyle();
  if (style.textContent) document2.head.appendChild(style);
  const usesByRequest = /* @__PURE__ */ new Map();
  for (const use of inventory.uses) {
    const list = usesByRequest.get(use.requestKey) ?? [];
    list.push(use);
    usesByRequest.set(use.requestKey, list);
  }
  const fallbackRequest = (request) => {
    if (validated.response.fallback !== "generic") return request;
    const families = request.familyStack.filter((_, index) => request.familyKinds[index] === "generic");
    if (!families.length) families.push("serif");
    return { ...request, familyStack: families, familyKinds: families.map(() => "generic") };
  };
  const applyFamily = (request, synthetic) => {
    const fallback = fallbackRequest(request);
    for (const use of usesByRequest.get(request.id) ?? []) {
      if (!synthetic && validated.response.fallback !== "generic") {
        restoreUse(use);
        continue;
      }
      use.element.style.setProperty(
        "font-family",
        (synthetic ? `${cssString(synthetic)}, ` : "") + serializeFamilyStack(fallback.familyStack, fallback.familyKinds),
        "important"
      );
    }
  };
  for (const request of inventory.requests) {
    if (syntheticByRequest.has(request.id) || validated.response.fallback === "generic") {
      applyFamily(request, syntheticByRequest.get(request.id));
    }
  }
  const fallbackAvailable = /* @__PURE__ */ new Map();
  const requestLoadFailures = /* @__PURE__ */ new Map();
  if (document2.fonts) {
    await forEachBounded(inventory.requests, async (request) => {
      const synthetic = syntheticByRequest.get(request.id);
      try {
        if (synthetic) {
          const sample = String.fromCodePoint(...request.sampleCodePoints.slice(0, 4096)) || " ";
          const loaded = await abortable(document2.fonts.load(
            fontSpecification(request, [synthetic]),
            sample
          ), signal);
          if (loaded.length === 0) {
            requestLoadFailures.set(request.id, "The face decoded, but the browser did not apply it to the requested style.");
            successfulRequests.delete(request.id);
            syntheticByRequest.delete(request.id);
            applyFamily(request);
          }
        } else {
          const fallback = fallbackRequest(request);
          const specification = fontSpecification(fallback, fallback.familyStack, fallback.familyKinds);
          const sample = String.fromCodePoint(...request.sampleCodePoints.slice(0, 4096)) || " ";
          await abortable(document2.fonts.load(specification, sample), signal);
          fallbackAvailable.set(request.id, requestedFamilyAvailable(document2, fallbackRequest(request)));
        }
      } catch (error) {
        if (signal.aborted) throw error;
        requestLoadFailures.set(request.id, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
        fallbackAvailable.set(request.id, false);
        successfulRequests.delete(request.id);
        syntheticByRequest.delete(request.id);
        applyFamily(request);
      } finally {
        pending.delete(`request:${request.id}`);
      }
    });
    rebuildStyle();
    if (!style.textContent) style.remove();
    await abortable(document2.fonts.ready.then(() => void 0), signal);
  } else {
    inventory.requests.forEach((request) => pending.delete(`request:${request.id}`));
  }
  pending.delete("document.fonts.ready");
  const resolutions = [];
  for (const request of inventory.requests) {
    const outcome = outcomeById.get(request.id);
    const selected = outcome.faceId ? validated.faces.get(outcome.faceId)?.record : void 0;
    const loadFailed = selected !== void 0 && !successfulRequests.has(request.id);
    const loadFailureDetail = loadFailed ? outcome.faceId && faceLoadFailures.get(outcome.faceId) || requestLoadFailures.get(request.id) : void 0;
    const browserFallbackAvailable = !selected && outcome.status === "missing" ? fallbackAvailable.get(request.id) === true : void 0;
    const glyphCoverage = selected ? outcome.glyphCoverage : "unverified";
    const verified = !loadFailed && outcome.status === "resolved" && selected !== void 0 && outcome.faceMatch === "exact" && glyphCoverage === "complete";
    resolutions.push({
      ...baseResolution(request),
      sampleDigest: await digestJson(request.sampleCodePoints),
      ...outcome.resolvedFamily ? { resolvedFamily: outcome.resolvedFamily } : {},
      ...selected?.postscriptName ? { resolvedFace: selected.postscriptName } : selected ? { resolvedFace: selected.id } : {},
      // A browser-generic fallback can make document.fonts.check() succeed, but
      // it cannot turn an explicit resolver miss into a verified resolution.
      status: loadFailed ? "load_failed" : outcome.status,
      source: selected ? selected.source ?? (selected.licenseEvidence.kind === "attested" ? "attested" : "configured") : "browser",
      ...selected ? {
        format: selected.format,
        fileSha256: selected.sha256,
        version: selected.version,
        licenseEvidence: { ...selected.licenseEvidence }
      } : {},
      ...outcome.faceMatch ? { faceMatch: outcome.faceMatch } : {},
      ...outcome.metricCompatible === void 0 ? {} : { metricCompatible: outcome.metricCompatible },
      ...glyphCoverage ? { glyphCoverage } : {},
      ...outcome.missingCodePoints ? { missingCodePointCount: outcome.missingCodePoints.length } : {},
      ...browserFallbackAvailable === void 0 ? {} : { browserFallbackAvailable },
      ...loadFailureDetail ? { loadFailureDetail } : {},
      verified
    });
  }
  const resolutionDigest = await digestJson({ resolverDigest, resolutions });
  return {
    identity: {
      resolverContract: FONT_RESOLVER_CONTRACT_ID,
      substitutionContractVersion: FONT_SUBSTITUTION_CONTRACT_VERSION,
      substitutionContractDigest: contractDigest,
      resolutionDigest,
      resolverDigest
    },
    resolutions,
    renderedTextNodeCount: inventory.renderedTextNodeCount,
    resolverConfigured: true
  };
}
function createBrowserFontTask(document2, resolver, limits) {
  for (const element of Array.from(document2.querySelectorAll(`[${FONT_REQUEST_ATTRIBUTE}]`)))
    element.removeAttribute(FONT_REQUEST_ATTRIBUTE);
  const inventory = collectFontInventory(document2, limits);
  for (const use of inventory.uses) if (use.ownsText)
    use.element.setAttribute(FONT_REQUEST_ATTRIBUTE, use.requestKey);
  const pending = new Set(inventory.requests.map((request) => `request:${request.id}`));
  if (document2.fonts) pending.add("document.fonts.ready");
  return {
    pending: () => Array.from(pending, (item) => `font:${item}`).sort(compareText),
    async wait(signal) {
      const contractDigest = await digestJson(FONT_SUBSTITUTION_CONTRACT_MATERIAL);
      return resolver ? configuredFonts(document2, inventory, resolver, limits, pending, signal, contractDigest) : observedFonts(document2, inventory, pending, signal, contractDigest);
    }
  };
}

// src/export-browser.ts
var LIMITS_CONTRACT = export_resource_limits_v1_default;
var DEFAULT_EXPORT_RESOURCE_LIMITS = Object.freeze({ ...LIMITS_CONTRACT.defaults });
var HARD_EXPORT_RESOURCE_LIMITS = Object.freeze({ ...LIMITS_CONTRACT.hardCeilings });
var DEFAULT_EXPORT_TIMEOUT_MS = LIMITS_CONTRACT.timeoutMs.default;
var HARD_EXPORT_TIMEOUT_MS = LIMITS_CONTRACT.timeoutMs.hardCeiling;
function normalizeMarkupVisibility(value) {
  if (value === void 0) return Object.freeze({});
  const keys = ["formatting", "insertionsAndDeletions", "comments"];
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key)))
    throw new TypeError("markupVisibility must contain only formatting, insertionsAndDeletions, and comments flags.");
  const result = {};
  for (const key of keys) {
    const flag = value[key];
    if (flag !== void 0 && typeof flag !== "boolean")
      throw new TypeError(`markupVisibility.${key} must be boolean.`);
    if (flag === false) result[key] = false;
  }
  return Object.freeze(result);
}
var DocxodusExportError = class extends Error {
  constructor(code, phase, message, remediation, options = {}) {
    super(message);
    this.name = "DocxodusExportError";
    this.code = code;
    this.phase = phase;
    this.remediation = remediation;
    this.detail = options.detail;
    this.pending = options.pending;
    this.partUri = options.partUri;
    this.anchorId = options.anchorId;
    this.resource = options.resource;
    this.cause = options.cause;
    this.report = options.report;
  }
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      severity: "error",
      phase: this.phase,
      message: this.message,
      remediation: this.remediation,
      ...this.detail === void 0 ? {} : { detail: this.detail },
      ...this.pending === void 0 ? {} : { pending: [...this.pending] },
      ...this.partUri === void 0 ? {} : { partUri: this.partUri },
      ...this.anchorId === void 0 ? {} : { anchorId: this.anchorId },
      ...this.resource === void 0 ? {} : { resource: this.resource },
      ...this.report === void 0 ? {} : { report: this.report }
    };
  }
};
var RECONSTRUCTIBLE_ERROR_CODES = /* @__PURE__ */ new Set([
  "invalid_argument",
  "invalid_document",
  "source_digest_mismatch",
  "document_version_unrepresentable",
  "conversion_failure",
  "browser_launch_failure",
  "resource_policy_failure",
  "readiness_timeout",
  "operation_cancelled",
  "pagination_failure",
  "pdf_write_failure",
  "output_write_failure",
  "output_verification_failure",
  "resource_limit",
  "unsupported_runtime",
  "filesystem_failure"
]);
var RECONSTRUCTIBLE_PHASES = /* @__PURE__ */ new Set([
  "input_validation",
  "package_preflight",
  "browser_launch",
  "wasm_initialization",
  "docx_conversion",
  "font_loading",
  "image_decoding",
  "chart_svg_materialization",
  "pagination",
  "running_story_placement",
  "page_tree_stability",
  "pdf_print",
  "output_verification",
  "output_write",
  "filesystem_commit",
  "cleanup"
]);
function reconstructDocxodusExportError(value) {
  if (!value || typeof value !== "object") return void 0;
  const record = value;
  if (typeof record.code !== "string" || !RECONSTRUCTIBLE_ERROR_CODES.has(record.code)) {
    return void 0;
  }
  if (typeof record.phase !== "string" || !RECONSTRUCTIBLE_PHASES.has(record.phase)) {
    return void 0;
  }
  if (typeof record.message !== "string" || typeof record.remediation !== "string") return void 0;
  return new DocxodusExportError(
    record.code,
    record.phase,
    record.message,
    record.remediation,
    {
      detail: typeof record.detail === "string" ? record.detail : void 0,
      partUri: typeof record.partUri === "string" ? record.partUri : void 0,
      anchorId: typeof record.anchorId === "string" ? record.anchorId : void 0,
      resource: typeof record.resource === "string" ? record.resource : void 0
    }
  );
}
var PageTreeInstabilityError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "PageTreeInstabilityError";
  }
};
var REPORT_SCHEMA = "https://docxodus.dev/schemas/render/render-report/v2";
var TEXT_ENCODER2 = new TextEncoder();
var ALLOWED_REVIEW_PROFILES = /* @__PURE__ */ new Set(["final", "original", "markup"]);
var ALLOWED_COMMENT_PROFILES = /* @__PURE__ */ new Set(["hidden", "inline", "endnotes", "margin"]);
var ALLOWED_MARKUP_PRESENTATIONS = /* @__PURE__ */ new Set(["docxodus", "word"]);
var ALLOWED_COMMENT_COLUMN_PLACEMENTS = /* @__PURE__ */ new Set(["margin", "balloons"]);
var ALLOWED_BALLOON_OVERFLOWS = /* @__PURE__ */ new Set(["truncate", "appendix"]);
var ALLOWED_UNSUPPORTED_POLICIES = /* @__PURE__ */ new Set(["warn", "strict"]);
var PACKAGE_LIMIT_FINDINGS = /* @__PURE__ */ new Set([
  "entry_count_limit_exceeded",
  "entry_expansion_limit_exceeded",
  "entry_uri_limit_exceeded",
  "compression_ratio_limit_exceeded",
  "total_expansion_limit_exceeded",
  "xml_size_limit_exceeded"
]);
var RUNTIME_ASSET_GRAPH_MAX_BYTES = 1024 * 1024;
var RUNTIME_ASSET_COUNT_MAX = 1e4;
var RUNTIME_ASSET_BYTES_MAX = 64 * 1024 * 1024;
var RUNTIME_ASSET_TOTAL_BYTES_MAX = 1024 * 1024 * 1024;
function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
var STANDALONE_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'none'",
  "font-src data:",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src data:",
  "media-src data:",
  "object-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'"
].join("; ");
var RENDER_CSP = `${STANDALONE_CSP}; navigate-to 'none'`;
function fail(code, phase, message, remediation, options = {}) {
  throw new DocxodusExportError(code, phase, message, remediation, options);
}
function normalizeOptions(options) {
  if (!options || typeof options !== "object") {
    fail(
      "invalid_argument",
      "input_validation",
      "Export options are required.",
      "Supply explicit reviewProfile and commentProfile values."
    );
  }
  let markupVisibility;
  try {
    markupVisibility = normalizeMarkupVisibility(options.markupVisibility);
  } catch (error) {
    fail(
      "invalid_argument",
      "input_validation",
      error.message,
      "Supply boolean formatting, insertionsAndDeletions, and comments flags, or omit markupVisibility."
    );
  }
  const additionalCss = options.additionalCss === void 0 ? "" : options.additionalCss;
  if (typeof additionalCss !== "string") {
    fail(
      "invalid_argument",
      "input_validation",
      "additionalCss must be a string.",
      "Supply stylesheet text, or omit additionalCss."
    );
  }
  try {
    assertWellFormedUnicode(additionalCss);
  } catch {
    fail(
      "invalid_argument",
      "input_validation",
      "additionalCss contains an unpaired UTF-16 surrogate.",
      "Supply well-formed Unicode stylesheet text that can be encoded as strict UTF-8."
    );
  }
  if (!ALLOWED_REVIEW_PROFILES.has(options.reviewProfile)) {
    fail(
      "invalid_argument",
      "input_validation",
      "reviewProfile is invalid.",
      "Use final, original, or markup."
    );
  }
  if (!ALLOWED_COMMENT_PROFILES.has(options.commentProfile)) {
    fail(
      "invalid_argument",
      "input_validation",
      "commentProfile is invalid.",
      "Use hidden, inline, endnotes, or margin."
    );
  }
  const reviewProfileAlreadyApplied = options.reviewProfileAlreadyApplied ?? false;
  if (typeof reviewProfileAlreadyApplied !== "boolean") {
    fail(
      "invalid_argument",
      "input_validation",
      "reviewProfileAlreadyApplied must be boolean.",
      "Omit it or pass true only for exact policy-derived final/original bytes."
    );
  }
  if (reviewProfileAlreadyApplied && options.reviewProfile === "markup") {
    fail(
      "invalid_argument",
      "input_validation",
      "reviewProfileAlreadyApplied is invalid with the markup profile.",
      "Use unchanged source bytes for markup, or choose final/original."
    );
  }
  const markupPresentation = options.markupPresentation ?? "docxodus";
  if (!ALLOWED_MARKUP_PRESENTATIONS.has(markupPresentation)) {
    fail(
      "invalid_argument",
      "input_validation",
      "markupPresentation is invalid.",
      "Use docxodus or word."
    );
  }
  if (markupPresentation !== "docxodus" && options.reviewProfile !== "markup") {
    fail(
      "invalid_argument",
      "input_validation",
      "markupPresentation applies only to the markup profile.",
      "Omit markupPresentation, or use reviewProfile markup."
    );
  }
  const commentColumnPlacement = options.commentColumnPlacement ?? "margin";
  if (!ALLOWED_COMMENT_COLUMN_PLACEMENTS.has(commentColumnPlacement)) {
    fail("invalid_argument", "input_validation", "commentColumnPlacement is invalid.", "Use margin or balloons.");
  }
  if (commentColumnPlacement === "balloons" && options.commentProfile === "inline") {
    fail(
      "invalid_argument",
      "input_validation",
      "Inline comments sit in the text, where no balloon can show them.",
      "Choose commentProfile margin to put comments in balloons, endnotes to list them after the text, or hidden to leave them out; or keep commentColumnPlacement margin."
    );
  }
  if (commentColumnPlacement === "balloons" && options.reviewProfile === "markup" && markupPresentation !== "word") {
    fail(
      "invalid_argument",
      "input_validation",
      "The balloon layout with the markup profile needs the Word presentation.",
      "Set markupPresentation to word, or keep the margin placement."
    );
  }
  const balloonOverflow = options.balloonOverflow ?? "truncate";
  if (!ALLOWED_BALLOON_OVERFLOWS.has(balloonOverflow)) {
    fail("invalid_argument", "input_validation", "balloonOverflow is invalid.", "Use truncate or appendix.");
  }
  if (balloonOverflow === "appendix" && commentColumnPlacement !== "balloons") {
    fail(
      "invalid_argument",
      "input_validation",
      "balloonOverflow appendix needs the balloon layout.",
      "Set commentColumnPlacement to balloons, or omit balloonOverflow."
    );
  }
  const markupMode = options.markupMode ?? "mixed";
  if (!MARKUP_MODES.includes(markupMode)) {
    fail("invalid_argument", "input_validation", "markupMode is invalid.", "Use mixed or inline.");
  }
  if (markupMode !== "mixed" && commentColumnPlacement !== "balloons") {
    fail(
      "invalid_argument",
      "input_validation",
      "markupMode inline needs the balloon layout.",
      "Set commentColumnPlacement to balloons, or omit markupMode."
    );
  }
  const unsupportedContent = options.unsupportedContent ?? "warn";
  if (!ALLOWED_UNSUPPORTED_POLICIES.has(unsupportedContent)) {
    fail(
      "invalid_argument",
      "input_validation",
      "unsupportedContent is invalid.",
      "Use warn or strict."
    );
  }
  const documentVersion = options.documentVersion ?? 0;
  if (!Number.isSafeInteger(documentVersion) || documentVersion < 0) {
    fail(
      "document_version_unrepresentable",
      "input_validation",
      "documentVersion must be a non-negative JavaScript safe integer.",
      "Use a value between 0 and Number.MAX_SAFE_INTEGER."
    );
  }
  if (options.expectedSourceDigest !== void 0 && !/^[0-9a-f]{64}$/.test(options.expectedSourceDigest)) {
    fail(
      "invalid_argument",
      "input_validation",
      "expectedSourceDigest must be a lower-case SHA-256 hex digest.",
      "Supply exactly 64 lower-case hexadecimal characters."
    );
  }
  const title = options.title ?? "";
  if (typeof title !== "string") {
    fail(
      "invalid_argument",
      "input_validation",
      "title must be a string.",
      "Supply a plain document title or omit it for the normative empty title."
    );
  }
  try {
    assertWellFormedUnicode(title);
  } catch {
    fail(
      "invalid_argument",
      "input_validation",
      "title contains an unpaired UTF-16 surrogate.",
      "Supply well-formed Unicode text that can be encoded as strict UTF-8."
    );
  }
  if (options.strictFonts !== void 0 && typeof options.strictFonts !== "boolean") {
    fail(
      "invalid_argument",
      "input_validation",
      "strictFonts must be boolean.",
      "Pass true or false."
    );
  }
  if (options.fontResolver !== void 0 && typeof options.fontResolver !== "function") {
    fail(
      "invalid_argument",
      "input_validation",
      "fontResolver must be a function.",
      "Pass a FontResolver conforming to the versioned resolver contract, or omit it."
    );
  }
  if (options.signal !== void 0 && (typeof options.signal !== "object" || typeof options.signal.addEventListener !== "function" || typeof options.signal.removeEventListener !== "function" || typeof options.signal.aborted !== "boolean")) {
    fail(
      "invalid_argument",
      "input_validation",
      "signal must be an AbortSignal.",
      "Pass a standards-compliant AbortSignal or omit it."
    );
  }
  let wasmBasePath;
  try {
    if (options.wasmBasePath !== void 0 && (typeof options.wasmBasePath !== "string" || options.wasmBasePath.length === 0)) {
      throw new TypeError("empty or non-string path");
    }
    const resolved = new URL(options.wasmBasePath ?? "./wasm/", import.meta.url);
    if (!(/* @__PURE__ */ new Set(["http:", "https:", "file:"])).has(resolved.protocol)) {
      throw new TypeError("unsupported runtime URL scheme");
    }
    wasmBasePath = resolved.href;
  } catch {
    fail(
      "invalid_argument",
      "input_validation",
      "wasmBasePath must be a valid non-empty URL string.",
      "Point it only at the closed, hash-verified Docxodus runtime asset directory."
    );
  }
  const limits = { ...DEFAULT_EXPORT_RESOURCE_LIMITS };
  if (options.limits !== void 0 && (!options.limits || typeof options.limits !== "object" || Array.isArray(options.limits))) {
    fail(
      "invalid_argument",
      "input_validation",
      "limits must be an object.",
      "Supply only lower integer values from ExportResourceLimits."
    );
  }
  for (const [name, value] of Object.entries(options.limits ?? {})) {
    if (!(name in limits)) {
      fail(
        "invalid_argument",
        "input_validation",
        `Unknown export limit: ${name}.`,
        "Use a key from ExportResourceLimits."
      );
    }
    const key = name;
    if (!Number.isSafeInteger(value) || value <= 0) {
      fail(
        "invalid_argument",
        "input_validation",
        `Export limit ${name} must be a positive safe integer.`,
        "Supply a positive integer no greater than the published default."
      );
    }
    if (value > DEFAULT_EXPORT_RESOURCE_LIMITS[key]) {
      fail(
        "invalid_argument",
        "input_validation",
        `Export limit ${name} may only lower the default.`,
        `Use ${DEFAULT_EXPORT_RESOURCE_LIMITS[key]} or less.`
      );
    }
    limits[key] = value;
  }
  const timeoutMs = options.timeoutMs ?? LIMITS_CONTRACT.timeoutMs.default;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > LIMITS_CONTRACT.timeoutMs.hardCeiling) {
    fail(
      "invalid_argument",
      "input_validation",
      "timeoutMs is outside the supported range.",
      `Use an integer from 1 through ${LIMITS_CONTRACT.timeoutMs.hardCeiling}.`
    );
  }
  return Object.freeze({
    documentVersion,
    expectedSourceDigest: options.expectedSourceDigest,
    reviewProfile: options.reviewProfile,
    reviewProfileAlreadyApplied,
    markupPresentation,
    markupVisibility,
    commentProfile: options.commentProfile,
    commentColumnPlacement,
    balloonOverflow,
    markupMode,
    title,
    additionalCss,
    unsupportedContent,
    strictFonts: options.strictFonts ?? false,
    ...options.fontResolver ? { fontResolver: options.fontResolver } : {},
    timeoutMs,
    limits: Object.freeze(limits),
    wasmBasePath,
    signal: options.signal
  });
}
async function ownedBytes(document2, maximum, signal) {
  if (signal?.aborted) {
    fail(
      "operation_cancelled",
      "input_validation",
      "Export was cancelled before input snapshotting.",
      "Retry with a non-aborted signal."
    );
  }
  if (document2 instanceof Uint8Array) {
    enforceLimit(document2.byteLength, maximum, "compressedDocxBytes", "input_validation");
    return new Uint8Array(document2);
  }
  if (typeof File !== "undefined" && document2 instanceof File) {
    enforceLimit(document2.size, maximum, "compressedDocxBytes", "input_validation");
    const bytes = new Uint8Array(await document2.arrayBuffer());
    if (signal?.aborted) {
      fail(
        "operation_cancelled",
        "input_validation",
        "Export was cancelled while reading the input File.",
        "Retry with a non-aborted signal."
      );
    }
    enforceLimit(bytes.byteLength, maximum, "compressedDocxBytes", "input_validation");
    return bytes;
  }
  fail(
    "invalid_argument",
    "input_validation",
    "document must be a File or Uint8Array.",
    "Pass immutable DOCX bytes or a browser File."
  );
}
function monotonicNow() {
  return globalThis.performance?.now() ?? Date.now();
}
function checkpointWordText(state) {
  if (state.signal?.aborted)
    fail(
      "operation_cancelled",
      state.phase,
      "Export was cancelled during text layout.",
      "Retry with a non-aborted signal."
    );
  if (monotonicNow() >= state.deadline)
    fail(
      "readiness_timeout",
      state.phase,
      "Export timed out during text layout.",
      "Increase timeoutMs or reduce document complexity."
    );
}
async function runPhase(state, phase, pending, operation) {
  state.phase = phase;
  const started = monotonicNow();
  if (state.signal?.aborted) {
    fail(
      "operation_cancelled",
      phase,
      `Export was cancelled during ${phase}.`,
      "Retry with a non-aborted signal.",
      { pending }
    );
  }
  const remaining = state.deadline - monotonicNow();
  if (remaining <= 0) {
    fail(
      "readiness_timeout",
      phase,
      `Export timed out during ${phase}.`,
      "Increase timeoutMs or remove the pending resource.",
      { pending }
    );
  }
  let timer;
  let abortListener;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new DocxodusExportError(
        "readiness_timeout",
        phase,
        `Export timed out during ${phase}.`,
        "Increase timeoutMs or remove the pending resource.",
        { pending }
      )), remaining);
    });
    const cancellation = new Promise((_, reject) => {
      if (!state.signal) return;
      abortListener = () => reject(new DocxodusExportError(
        "operation_cancelled",
        phase,
        `Export was cancelled during ${phase}.`,
        "Retry with a non-aborted signal.",
        { pending }
      ));
      state.signal.addEventListener("abort", abortListener, { once: true });
    });
    const result = await Promise.race([Promise.resolve().then(operation), timeout, cancellation]);
    if (state.signal?.aborted) {
      fail(
        "operation_cancelled",
        phase,
        `Export was cancelled during ${phase}.`,
        "Retry with a non-aborted signal.",
        { pending }
      );
    }
    if (monotonicNow() >= state.deadline) {
      fail(
        "readiness_timeout",
        phase,
        `Export timed out during ${phase}.`,
        "Increase timeoutMs or remove the pending resource.",
        { pending }
      );
    }
    state.readiness.push({
      phase,
      status: "complete",
      elapsedMs: Math.max(0, monotonicNow() - started),
      pending: []
    });
    return result;
  } catch (error) {
    state.readiness.push({
      phase,
      status: error instanceof DocxodusExportError && error.code === "operation_cancelled" ? "cancelled" : "failed",
      elapsedMs: Math.max(0, monotonicNow() - started),
      pending: [...pending]
    });
    throw error;
  } finally {
    if (timer !== void 0) clearTimeout(timer);
    if (abortListener && state.signal) state.signal.removeEventListener("abort", abortListener);
  }
}
function utf8Bytes(value) {
  return TEXT_ENCODER2.encode(value);
}
function utf8ByteLength(value) {
  let length = 0;
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit < 128) length++;
    else if (unit < 2048) length += 2;
    else if (unit >= 55296 && unit <= 56319 && value.charCodeAt(index + 1) >= 56320 && value.charCodeAt(index + 1) <= 57343) {
      length += 4;
      index++;
    } else length += 3;
  }
  return length;
}
function preflightConvertedHtml(source, options) {
  enforceLimit(
    utf8ByteLength(source),
    options.limits.htmlOutputBytes,
    "htmlOutputBytes",
    "docx_conversion"
  );
  let prospectiveNodes = 2;
  let inText = false;
  for (let index = 0; index < source.length; index++) {
    if (source[index] !== "<") {
      if (!inText && !/\s/.test(source[index])) {
        prospectiveNodes++;
        inText = true;
      }
      continue;
    }
    inText = false;
    const next = source[index + 1];
    if (next && next !== "/" && next !== "!" && next !== "?") prospectiveNodes++;
    if (prospectiveNodes > options.limits.domNodes) {
      fail(
        "resource_limit",
        "docx_conversion",
        `domNodes limit exceeded before HTML attachment (${prospectiveNodes} > ${options.limits.domNodes}).`,
        "Use a smaller document or a lower-complexity conversion profile."
      );
    }
  }
}
function countDomNodes(document2, maximum, phase) {
  const walker = document2.createTreeWalker(document2, 4294967295);
  let count = 0;
  while (walker.nextNode()) {
    count++;
    if (count > maximum) {
      fail(
        "resource_limit",
        phase,
        `domNodes limit exceeded (${count} > ${maximum}).`,
        "Use a smaller document or a lower-complexity conversion profile."
      );
    }
  }
  return count;
}
async function sha2562(bytes) {
  if (!globalThis.crypto?.subtle) {
    fail(
      "unsupported_runtime",
      "output_verification",
      "Web Crypto SHA-256 is unavailable.",
      "Run the exporter in a secure, standards-compliant browser context."
    );
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    bytes
  );
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
async function boundedResponseBytes(response, maximum, label) {
  const declared = response.headers.get("content-length");
  if (declared !== null && /^(?:0|[1-9]\d*)$/.test(declared) && BigInt(declared) > BigInt(maximum)) {
    fail(
      "unsupported_runtime",
      "wasm_initialization",
      `${label} exceeds its admitted byte length.`,
      "Deploy the closed, bounded runtime asset graph generated with this package."
    );
  }
  if (!response.body) {
    const bytes2 = new Uint8Array(await response.arrayBuffer());
    if (bytes2.byteLength > maximum) {
      fail(
        "unsupported_runtime",
        "wasm_initialization",
        `${label} exceeds its admitted byte length.`,
        "Deploy the closed, bounded runtime asset graph generated with this package."
      );
    }
    return bytes2;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        fail(
          "unsupported_runtime",
          "wasm_initialization",
          `${label} exceeds its admitted byte length.`,
          "Deploy the closed, bounded runtime asset graph generated with this package."
        );
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
var hostVerifiedAssetManifestSha256;
function attestHostVerifiedRuntimeAssets(manifestSha256) {
  if (typeof manifestSha256 !== "string" || !/^[0-9a-f]{64}$/.test(manifestSha256)) {
    fail(
      "unsupported_runtime",
      "wasm_initialization",
      "The host runtime asset attestation is not a SHA-256 digest.",
      "Use the bootstrap module @docxodus/export generates."
    );
  }
  if (hostVerifiedAssetManifestSha256 !== void 0 && hostVerifiedAssetManifestSha256 !== manifestSha256) {
    fail(
      "unsupported_runtime",
      "wasm_initialization",
      "The host runtime asset attestation may be set only once.",
      "Load one host bootstrap module per page."
    );
  }
  hostVerifiedAssetManifestSha256 = manifestSha256;
}
async function loadRuntimeAssetIdentity(wasmBasePath, signal) {
  const manifestUrl = new URL("./export-assets.json", import.meta.url);
  const response = await globalThis.fetch(manifestUrl, {
    cache: "no-store",
    credentials: "same-origin",
    signal
  });
  if (!response.ok) {
    fail(
      "unsupported_runtime",
      "wasm_initialization",
      `The runtime asset graph could not be loaded (${response.status}).`,
      "Deploy export-assets.json beside the browser export bundle."
    );
  }
  const graphBytes = await boundedResponseBytes(
    response,
    RUNTIME_ASSET_GRAPH_MAX_BYTES,
    "Runtime asset graph"
  );
  let graphText;
  try {
    graphText = new TextDecoder("utf-8", { fatal: true }).decode(graphBytes);
  } catch {
    fail(
      "unsupported_runtime",
      "wasm_initialization",
      "The runtime asset graph is not strict UTF-8.",
      "Regenerate export-assets.json without malformed byte sequences."
    );
  }
  const manifest = strictJsonParse(graphText, (detail) => fail(
    "unsupported_runtime",
    "wasm_initialization",
    "The runtime asset graph is malformed.",
    "Deploy the versioned export-assets.json generated with this bundle.",
    { detail }
  ));
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) || Object.keys(manifest).some((key) => !["schema", "schemaVersion", "packageVersion", "assets"].includes(key)) || manifest.schema !== "https://docxodus.dev/schemas/export/export-assets/v1" || manifest.schemaVersion !== 1 || typeof manifest.packageVersion !== "string" || manifest.packageVersion.length === 0 || !Array.isArray(manifest.assets) || manifest.assets.length === 0 || manifest.assets.length > RUNTIME_ASSET_COUNT_MAX) {
    fail(
      "unsupported_runtime",
      "wasm_initialization",
      "The runtime asset graph is malformed.",
      "Deploy the versioned export-assets.json generated with this bundle."
    );
  }
  try {
    assertWellFormedUnicode(manifest.packageVersion);
  } catch {
    fail(
      "unsupported_runtime",
      "wasm_initialization",
      "The runtime asset graph packageVersion is not well-formed Unicode.",
      "Regenerate export-assets.json from valid package metadata."
    );
  }
  let aggregateAssetBytes = 0;
  const paths = /* @__PURE__ */ new Set();
  const assets = manifest.assets.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      fail(
        "unsupported_runtime",
        "wasm_initialization",
        `Runtime asset entry ${index} is malformed.`,
        "Regenerate the package runtime asset graph."
      );
    }
    const record = entry;
    if (Object.keys(record).some((key) => !["path", "mediaType", "byteLength", "sha256"].includes(key)) || typeof record.path !== "string" || typeof record.mediaType !== "string" || !Number.isSafeInteger(record.byteLength) || record.byteLength < 0 || record.byteLength > RUNTIME_ASSET_BYTES_MAX || typeof record.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(record.sha256)) {
      fail(
        "unsupported_runtime",
        "wasm_initialization",
        `Runtime asset entry ${index} has invalid identity fields.`,
        "Regenerate the package runtime asset graph."
      );
    }
    const path = record.path;
    const segments = path.split("/");
    const extension = path.slice(path.lastIndexOf("."));
    const expectedMediaType = {
      ".css": "text/css",
      ".dat": "application/octet-stream",
      ".js": "text/javascript",
      ".json": "application/json",
      ".wasm": "application/wasm"
    };
    if (!path.startsWith("./") || path.includes("\\") || path.includes("?") || path.includes("#") || segments.some((segment, segmentIndex) => segmentIndex > 0 && (segment === "" || segment === "." || segment === "..")) || paths.has(path) || expectedMediaType[extension] !== record.mediaType) {
      fail(
        "unsupported_runtime",
        "wasm_initialization",
        `Runtime asset entry ${index} has a non-canonical or duplicate path.`,
        "Regenerate the package runtime asset graph."
      );
    }
    paths.add(path);
    aggregateAssetBytes += record.byteLength;
    if (aggregateAssetBytes > RUNTIME_ASSET_TOTAL_BYTES_MAX) {
      fail(
        "unsupported_runtime",
        "wasm_initialization",
        "The runtime asset graph exceeds its aggregate byte ceiling.",
        "Deploy a bounded Docxodus runtime package."
      );
    }
    return {
      path,
      mediaType: record.mediaType,
      byteLength: record.byteLength,
      sha256: record.sha256
    };
  });
  for (let index = 1; index < assets.length; index++) {
    if (compareCodeUnits(assets[index - 1].path, assets[index].path) >= 0) {
      fail(
        "unsupported_runtime",
        "wasm_initialization",
        "Runtime asset entries are not in canonical path order.",
        "Regenerate export-assets.json with the package asset generator."
      );
    }
  }
  const materializer = assets.find((entry) => entry.path === "./export-browser.bundle.js");
  if (!materializer || !paths.has("./docxodus.worker.js") || !paths.has("./wasm/_framework/dotnet.js")) {
    fail(
      "unsupported_runtime",
      "wasm_initialization",
      "The runtime asset graph does not identify the browser materializer.",
      "Regenerate export-assets.json from the complete runtime package."
    );
  }
  const materializerResponse = await globalThis.fetch(import.meta.url, {
    cache: "no-store",
    credentials: "same-origin",
    signal
  });
  if (!materializerResponse.ok) {
    fail(
      "unsupported_runtime",
      "wasm_initialization",
      `The loaded browser materializer could not be verified (${materializerResponse.status}).`,
      "Serve the browser export bundle from a readable same-origin URL."
    );
  }
  const materializerBytes = await boundedResponseBytes(
    materializerResponse,
    materializer.byteLength,
    "Browser materializer"
  );
  const materializerDigest = await sha2562(materializerBytes);
  if (materializerDigest !== materializer.sha256) {
    fail(
      "unsupported_runtime",
      "wasm_initialization",
      "The loaded browser materializer does not match export-assets.json.",
      "Deploy the bundle and asset graph from the same Docxodus build."
    );
  }
  const hostVerified = hostVerifiedAssetManifestSha256 !== void 0 && await sha2562(graphBytes) === hostVerifiedAssetManifestSha256;
  const verifiedRuntimeAssets = hostVerified ? [] : assets.filter((entry) => entry.path === "./docxodus.worker.js" || entry.path.startsWith("./wasm/_framework/"));
  const resolvedWasmBasePath = new URL(
    wasmBasePath.endsWith("/") ? wasmBasePath : `${wasmBasePath}/`,
    import.meta.url
  );
  const verifications = await Promise.all(verifiedRuntimeAssets.map(async (asset) => {
    const url = asset.path === "./docxodus.worker.js" ? new URL("./docxodus.worker.js", import.meta.url) : new URL(asset.path.slice("./wasm/".length), resolvedWasmBasePath);
    try {
      const assetResponse = await globalThis.fetch(url, {
        cache: "force-cache",
        credentials: "same-origin",
        signal
      });
      if (!assetResponse.ok) {
        return () => fail(
          "unsupported_runtime",
          "wasm_initialization",
          `Runtime asset ${asset.path} could not be verified (${assetResponse.status}).`,
          "Deploy every runtime asset named by export-assets.json."
        );
      }
      const bytes = await boundedResponseBytes(assetResponse, asset.byteLength, `Runtime asset ${asset.path}`);
      if (bytes.byteLength !== asset.byteLength || await sha2562(bytes) !== asset.sha256) {
        return () => fail(
          "unsupported_runtime",
          "wasm_initialization",
          `Runtime asset ${asset.path} does not match export-assets.json.`,
          "Deploy the worker, WASM directory, browser bundle, and asset graph from one build."
        );
      }
      return void 0;
    } catch (error) {
      return () => {
        throw error;
      };
    }
  }));
  for (const raise of verifications) raise?.();
  return {
    packageVersion: manifest.packageVersion,
    graphDigest: await sha2562(utf8Bytes(canonicalJson({
      schemaVersion: manifest.schemaVersion,
      packageVersion: manifest.packageVersion,
      assets
    }))),
    materializerDigest,
    assetCount: assets.length,
    verifiedRuntimeAssetCount: verifiedRuntimeAssets.length
  };
}
async function canonicalMaterialDigest(domain, value) {
  if (!/^[\x20-\x7e]+$/.test(domain)) {
    throw new TypeError("Canonical digest domain tags must be printable ASCII");
  }
  const domainBytes = utf8Bytes(domain);
  const materialBytes = utf8Bytes(canonicalJson(value));
  const input = new Uint8Array(domainBytes.byteLength + 1 + materialBytes.byteLength);
  input.set(domainBytes, 0);
  input[domainBytes.byteLength] = 0;
  input.set(materialBytes, domainBytes.byteLength + 1);
  return sha2562(input);
}
function constantTimeDigestEqual(left, right) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}
function manifestFailure(path, detail) {
  fail(
    "invalid_document",
    "package_preflight",
    `DOCX preflight returned a manifest that violates schema v1 at ${path}.`,
    "Use the matching hardened #493 package-manifest producer and consumer.",
    { detail }
  );
}
function strictJsonParse(source, onFailure = (detail) => manifestFailure("$", detail)) {
  let cursor = 0;
  const whitespace = () => {
    while (cursor < source.length && /[\u0009\u000a\u000d\u0020]/.test(source[cursor])) cursor++;
  };
  const parseStringToken = () => {
    const start = cursor;
    if (source[cursor++] !== '"') throw new SyntaxError(`Expected string at ${start}`);
    while (cursor < source.length) {
      const character = source[cursor++];
      if (character === '"') return JSON.parse(source.slice(start, cursor));
      if (character.charCodeAt(0) < 32) throw new SyntaxError(`Control character at ${cursor - 1}`);
      if (character !== "\\") continue;
      if (cursor >= source.length) throw new SyntaxError("Unterminated JSON escape");
      const escape = source[cursor++];
      if (escape === "u") {
        if (!/^[0-9a-fA-F]{4}$/.test(source.slice(cursor, cursor + 4))) {
          throw new SyntaxError(`Invalid Unicode escape at ${cursor - 2}`);
        }
        cursor += 4;
      } else if (!'"\\/bfnrt'.includes(escape)) {
        throw new SyntaxError(`Invalid JSON escape at ${cursor - 2}`);
      }
    }
    throw new SyntaxError("Unterminated JSON string");
  };
  const parseValue = (depth) => {
    if (depth > 128) throw new SyntaxError("JSON nesting is too deep");
    whitespace();
    const character = source[cursor];
    if (character === '"') {
      parseStringToken();
      return;
    }
    if (character === "{") {
      cursor++;
      whitespace();
      const keys = /* @__PURE__ */ new Set();
      if (source[cursor] === "}") {
        cursor++;
        return;
      }
      while (cursor < source.length) {
        whitespace();
        const key = parseStringToken();
        if (keys.has(key)) throw new SyntaxError(`Duplicate JSON property ${JSON.stringify(key)}`);
        keys.add(key);
        whitespace();
        if (source[cursor++] !== ":") throw new SyntaxError(`Expected colon at ${cursor - 1}`);
        parseValue(depth + 1);
        whitespace();
        const separator = source[cursor++];
        if (separator === "}") return;
        if (separator !== ",") throw new SyntaxError(`Expected object separator at ${cursor - 1}`);
      }
      throw new SyntaxError("Unterminated JSON object");
    }
    if (character === "[") {
      cursor++;
      whitespace();
      if (source[cursor] === "]") {
        cursor++;
        return;
      }
      while (cursor < source.length) {
        parseValue(depth + 1);
        whitespace();
        const separator = source[cursor++];
        if (separator === "]") return;
        if (separator !== ",") throw new SyntaxError(`Expected array separator at ${cursor - 1}`);
      }
      throw new SyntaxError("Unterminated JSON array");
    }
    const rest = source.slice(cursor);
    const literal = /^(?:true|false|null)/.exec(rest)?.[0] ?? /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest)?.[0];
    if (!literal) throw new SyntaxError(`Invalid JSON value at ${cursor}`);
    cursor += literal.length;
  };
  try {
    parseValue(0);
    whitespace();
    if (cursor !== source.length) throw new SyntaxError(`Trailing JSON data at ${cursor}`);
    return JSON.parse(source);
  } catch (error) {
    return onFailure(error instanceof Error ? error.message : String(error));
  }
}
function recordAt(value, path, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    manifestFailure(path, "expected an object");
  }
  const record = value;
  const allowed = /* @__PURE__ */ new Set([...required, ...optional]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) manifestFailure(`${path}.${key}`, "unknown property");
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      manifestFailure(`${path}.${key}`, "missing required property");
    }
  }
  return record;
}
function arrayAt(value, path) {
  if (!Array.isArray(value)) manifestFailure(path, "expected an array");
  return value;
}
function stringAt(value, path, allowEmpty = true) {
  if (typeof value !== "string" || !allowEmpty && value.length === 0) {
    manifestFailure(path, "expected a string");
  }
  try {
    assertWellFormedUnicode(value);
  } catch (error) {
    manifestFailure(path, error instanceof Error ? error.message : String(error));
  }
  return value;
}
function integerAt(value, path, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    manifestFailure(path, `expected a safe integer >= ${minimum}`);
  }
  return value;
}
function booleanAt(value, path) {
  if (typeof value !== "boolean") manifestFailure(path, "expected a boolean");
  return value;
}
function enumAt(value, path, allowed) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    manifestFailure(path, `expected one of ${allowed.join(", ")}`);
  }
  return value;
}
function digestAt(value, path, nullable) {
  if (value === null && nullable) return;
  const digest = recordAt(value, path, ["algorithm", "value"]);
  if (digest.algorithm !== "SHA-256") manifestFailure(`${path}.algorithm`, "expected SHA-256");
  if (typeof digest.value !== "string" || !/^[0-9a-f]{64}$/.test(digest.value)) {
    manifestFailure(`${path}.value`, "expected 64 lower-case hexadecimal digits");
  }
}
function decimalAt(value, path) {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)$/.test(value)) {
    manifestFailure(path, "expected a canonical non-negative base-10 integer string");
  }
  return BigInt(value);
}
function validatePackageManifestJson(source) {
  const value = strictJsonParse(source);
  const manifest = recordAt(value, "$", [
    "schema",
    "schemaVersion",
    "packageKind",
    "isValid",
    "rawPackageBytesDigest",
    "orderedOpcContentDigest",
    "normalizedSemanticDigest",
    "entries",
    "contentTypes",
    "relationships",
    "facts",
    "findings"
  ]);
  if (manifest.schema !== "https://docxodus.dev/schemas/verification/package-manifest/v1") {
    manifestFailure("$.schema", "unexpected package-manifest discriminator");
  }
  if (manifest.schemaVersion !== 1) manifestFailure("$.schemaVersion", "expected 1");
  enumAt(manifest.packageKind, "$.packageKind", [
    "opc",
    "zip",
    "zip-encrypted",
    "ole-encrypted",
    "ole",
    "malformed"
  ]);
  booleanAt(manifest.isValid, "$.isValid");
  digestAt(manifest.rawPackageBytesDigest, "$.rawPackageBytesDigest", false);
  digestAt(manifest.orderedOpcContentDigest, "$.orderedOpcContentDigest", true);
  digestAt(manifest.normalizedSemanticDigest, "$.normalizedSemanticDigest", true);
  for (const [index, item] of arrayAt(manifest.entries, "$.entries").entries()) {
    const path = `$.entries[${index}]`;
    const entry = recordAt(item, path, [
      "uri",
      "occurrence",
      "contentType",
      "contentTypeSource",
      "size",
      "compressedSize",
      "rawBytesDigest",
      "normalizedXmlDigest",
      "isXml",
      "isEncrypted"
    ]);
    stringAt(entry.uri, `${path}.uri`, false);
    integerAt(entry.occurrence, `${path}.occurrence`);
    if (entry.contentType !== null) stringAt(entry.contentType, `${path}.contentType`, false);
    enumAt(entry.contentTypeSource, `${path}.contentTypeSource`, [
      "override",
      "default",
      "implicit",
      "unresolved"
    ]);
    decimalAt(entry.size, `${path}.size`);
    decimalAt(entry.compressedSize, `${path}.compressedSize`);
    digestAt(entry.rawBytesDigest, `${path}.rawBytesDigest`, true);
    digestAt(entry.normalizedXmlDigest, `${path}.normalizedXmlDigest`, true);
    booleanAt(entry.isXml, `${path}.isXml`);
    if (entry.isEncrypted !== null) booleanAt(entry.isEncrypted, `${path}.isEncrypted`);
  }
  for (const [index, item] of arrayAt(manifest.contentTypes, "$.contentTypes").entries()) {
    const path = `$.contentTypes[${index}]`;
    const declaration = recordAt(item, path, ["kind", "key", "contentType", "occurrence"]);
    enumAt(declaration.kind, `${path}.kind`, ["default", "override"]);
    stringAt(declaration.key, `${path}.key`, false);
    stringAt(declaration.contentType, `${path}.contentType`, false);
    integerAt(declaration.occurrence, `${path}.occurrence`);
  }
  for (const [index, item] of arrayAt(manifest.relationships, "$.relationships").entries()) {
    const path = `$.relationships[${index}]`;
    const relationship = recordAt(item, path, [
      "ownerUri",
      "id",
      "type",
      "target",
      "targetMode",
      "resolvedTargetUri",
      "isTargetPresent"
    ]);
    stringAt(relationship.ownerUri, `${path}.ownerUri`, false);
    stringAt(relationship.id, `${path}.id`, false);
    stringAt(relationship.type, `${path}.type`, false);
    stringAt(relationship.target, `${path}.target`, false);
    enumAt(relationship.targetMode, `${path}.targetMode`, ["Internal", "External"]);
    if (relationship.resolvedTargetUri !== null) {
      stringAt(relationship.resolvedTargetUri, `${path}.resolvedTargetUri`, false);
    }
    if (relationship.isTargetPresent !== null) {
      booleanAt(relationship.isTargetPresent, `${path}.isTargetPresent`);
    }
  }
  const facts = recordAt(manifest.facts, "$.facts", [
    "mainDocumentUri",
    "isStrictOoxml",
    "isMacroEnabled",
    "hasCoreProperties",
    "hasExtendedProperties",
    "hasCustomProperties",
    "sectionCount",
    "paragraphCount",
    "tableCount",
    "headerPartCount",
    "footerPartCount",
    "footnoteCount",
    "endnoteCount",
    "styleCount",
    "numberingDefinitionCount",
    "themePartCount",
    "mediaPartCount",
    "customXmlPartCount",
    "drawingCount",
    "altChunkCount",
    "fieldCount",
    "revisions",
    "annotations"
  ]);
  if (facts.mainDocumentUri !== null) stringAt(facts.mainDocumentUri, "$.facts.mainDocumentUri", false);
  for (const name of [
    "isStrictOoxml",
    "isMacroEnabled",
    "hasCoreProperties",
    "hasExtendedProperties",
    "hasCustomProperties"
  ]) booleanAt(facts[name], `$.facts.${name}`);
  for (const name of [
    "sectionCount",
    "paragraphCount",
    "tableCount",
    "headerPartCount",
    "footerPartCount",
    "footnoteCount",
    "endnoteCount",
    "styleCount",
    "numberingDefinitionCount",
    "themePartCount",
    "mediaPartCount",
    "customXmlPartCount",
    "drawingCount",
    "altChunkCount",
    "fieldCount"
  ]) integerAt(facts[name], `$.facts.${name}`);
  const revisions = recordAt(facts.revisions, "$.facts.revisions", [
    "insertions",
    "deletions",
    "moveFrom",
    "moveTo",
    "propertyChanges",
    "runPropertyChanges",
    "structuralChanges",
    "otherChanges",
    "total"
  ]);
  for (const name of Object.keys(revisions)) integerAt(revisions[name], `$.facts.revisions.${name}`);
  const annotations = recordAt(facts.annotations, "$.facts.annotations", [
    "comments",
    "commentReplies",
    "threadedCommentMetadata",
    "resolvedComments",
    "people",
    "docxodusAnnotations"
  ]);
  for (const name of Object.keys(annotations)) integerAt(annotations[name], `$.facts.annotations.${name}`);
  for (const [index, item] of arrayAt(manifest.findings, "$.findings").entries()) {
    const path = `$.findings[${index}]`;
    const finding = recordAt(item, path, ["code", "severity", "message", "location"]);
    stringAt(finding.code, `${path}.code`, false);
    enumAt(finding.severity, `${path}.severity`, ["info", "warning", "error"]);
    stringAt(finding.message, `${path}.message`, false);
    if (finding.location !== null) {
      const location = recordAt(finding.location, `${path}.location`, [
        "entryUri",
        "ownerUri",
        "relationshipId",
        "targetUri",
        "propertyPath"
      ]);
      for (const name of Object.keys(location)) {
        if (location[name] !== null) stringAt(location[name], `${path}.location.${name}`);
      }
    }
  }
  return manifest;
}
function addWarning(state, warning) {
  enforceDiagnosticAdmission(state, 1);
  state.warnings.push(warning);
}
function addResource(state, resource) {
  enforceDiagnosticAdmission(state, 1);
  state.resources.push(resource);
}
function addUnsupportedContent(state, outcome) {
  enforceDiagnosticAdmission(state, 1);
  state.unsupportedContent.push(outcome);
}
function enforceDiagnosticAdmission(state, additional) {
  const current = state.warnings.length + state.resources.length + state.unsupportedContent.length + state.fonts.length;
  if (current + additional > state.limits.renderDiagnostics) {
    fail(
      "resource_limit",
      state.phase,
      `renderDiagnostics limit exceeded (${current + additional} > ${state.limits.renderDiagnostics}).`,
      "Use a smaller document or a versioned deployment policy with a higher diagnostic ceiling."
    );
  }
}
function enforceLimit(actual, maximum, name, phase) {
  if (actual > maximum) {
    fail(
      "resource_limit",
      phase,
      `${name} limit exceeded (${actual} > ${maximum}).`,
      `Use a smaller document or raise the deployment ceiling in a versioned limits contract.`
    );
  }
}
function inspectionLimits(options) {
  return {
    opcEntries: options.limits.opcEntries,
    expandedOpcBytes: options.limits.expandedOpcBytes,
    xmlPartBytes: options.limits.xmlPartBytes,
    opcUriCharacters: options.limits.opcUriCharacters,
    opcCompressionRatio: options.limits.opcCompressionRatio
  };
}
function isUnrenderedPackageFinding(manifest, finding) {
  const thumbnail = finding.code === "missing_target";
  if (!thumbnail && finding.code !== "malformed_xml") return false;
  const uri = thumbnail ? finding.location?.targetUri : finding.location?.entryUri;
  if (!uri) return false;
  const references = manifest.relationships.filter((relationship) => relationship.targetMode === "Internal" && relationship.resolvedTargetUri === uri);
  if (!thumbnail) {
    const entry = manifest.entries.find((entry2) => entry2.uri === uri);
    if (!entry || uri === "/[Content_Types].xml" || uri.endsWith(".rels") || entry.contentType === "application/vnd.openxmlformats-package.relationships+xml") return false;
    if (references.length === 0) return uri !== manifest.facts.mainDocumentUri;
    if (entry.contentType !== "application/vnd.openxmlformats-officedocument.custom-properties+xml") return false;
  }
  if (thumbnail && !references.some((relationship) => relationship.ownerUri === finding.location?.ownerUri && relationship.id === finding.location?.relationshipId)) return false;
  return references.length > 0 && references.every((relationship) => relationship.ownerUri === "/" && (thumbnail ? relationship.type === "http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail" : relationship.type === "http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" || relationship.type === "http://purl.oclc.org/ooxml/officeDocument/relationships/custom-properties"));
}
async function preflightManifest(manifest, bytes, options, state, isSourcePackage) {
  const sourceDigest = manifest.rawPackageBytesDigest.value;
  const recomputedDigest = await sha2562(bytes);
  if (!constantTimeDigestEqual(sourceDigest, recomputedDigest)) {
    fail(
      "invalid_document",
      "package_preflight",
      "The #493 source digest does not match the exact bytes supplied to export.",
      "Use a matching package-manifest producer and immutable source snapshot.",
      {
        detail: `manifest=${sourceDigest}; recomputed=${recomputedDigest}`
      }
    );
  }
  if (isSourcePackage && options.expectedSourceDigest && !constantTimeDigestEqual(options.expectedSourceDigest, sourceDigest)) {
    fail(
      "source_digest_mismatch",
      "package_preflight",
      "The source digest does not match expectedSourceDigest.",
      "Render the exact verified source bytes or update the expected digest.",
      {
        detail: `expected=${options.expectedSourceDigest}; actual=${sourceDigest}`
      }
    );
  }
  for (const finding2 of manifest.findings) {
    if (finding2.severity === "info") continue;
    addWarning(state, {
      code: finding2.code,
      severity: "warning",
      phase: "package_preflight",
      message: finding2.message,
      remediation: "Inspect the named package part before relying on export fidelity.",
      ...finding2.location?.entryUri ? { partUri: finding2.location.entryUri } : {},
      ...finding2.location?.targetUri ? { resource: finding2.location.targetUri } : {}
    });
  }
  const packageLimitFinding = manifest.findings.find((finding2) => PACKAGE_LIMIT_FINDINGS.has(finding2.code));
  if (packageLimitFinding) {
    fail(
      "resource_limit",
      "package_preflight",
      packageLimitFinding.message,
      "Use a smaller package or raise the corresponding versioned package-inspection ceiling.",
      { detail: packageLimitFinding.code }
    );
  }
  enforceLimit(bytes.byteLength, options.limits.compressedDocxBytes, "compressedDocxBytes", "package_preflight");
  enforceLimit(manifest.entries.length, options.limits.opcEntries, "opcEntries", "package_preflight");
  let expandedBytes = 0n;
  const expandedLimit = BigInt(options.limits.expandedOpcBytes);
  const xmlLimit = BigInt(options.limits.xmlPartBytes);
  const ratioLimit = BigInt(options.limits.opcCompressionRatio);
  for (const [index, entry] of manifest.entries.entries()) {
    if (entry.uri.length > options.limits.opcUriCharacters) {
      fail(
        "resource_limit",
        "package_preflight",
        `opcUriCharacters limit exceeded for entry ${index} (${entry.uri.length} > ${options.limits.opcUriCharacters}).`,
        "Use a package with shorter canonical OPC part names.",
        { partUri: entry.uri }
      );
    }
    const size = decimalAt(entry.size, `$.entries[${index}].size`);
    const compressedSize = decimalAt(entry.compressedSize, `$.entries[${index}].compressedSize`);
    expandedBytes += size;
    if (expandedBytes > expandedLimit) {
      fail(
        "resource_limit",
        "package_preflight",
        `expandedOpcBytes limit exceeded (${expandedBytes.toString()} > ${expandedLimit.toString()}).`,
        "Use a smaller package or lower-expansion resources."
      );
    }
    if (entry.isXml && size > xmlLimit) {
      fail(
        "resource_limit",
        "package_preflight",
        `xmlPartBytes limit exceeded (${size.toString()} > ${xmlLimit.toString()}).`,
        "Split or reduce the XML part before export.",
        { partUri: entry.uri }
      );
    }
    if (compressedSize === 0n && size > 0n || compressedSize > 0n && size > compressedSize * ratioLimit) {
      fail(
        "resource_limit",
        "package_preflight",
        `opcCompressionRatio limit exceeded for ${entry.uri}.`,
        "Repackage the document without a suspiciously high expansion ratio.",
        { partUri: entry.uri }
      );
    }
  }
  const errors = manifest.findings.filter((finding2) => finding2.severity === "error");
  const finding = errors.find((finding2) => options.unsupportedContent === "strict" || !isUnrenderedPackageFinding(manifest, finding2));
  const renderable = manifest.isValid || errors.length > 0 && !finding;
  if (manifest.packageKind !== "opc" || !renderable || !manifest.facts.mainDocumentUri) {
    fail(
      "invalid_document",
      "package_preflight",
      `The input is not a valid DOCX OPC package (${manifest.packageKind}).`,
      "Repair or decrypt the document before export.",
      {
        ...finding ? { detail: `${finding.code}: ${finding.message}` } : {},
        ...finding?.location?.entryUri ? { partUri: finding.location.entryUri } : {},
        ...finding?.location?.targetUri ? { resource: finding.location.targetUri } : {}
      }
    );
  }
  const mainRelationship = manifest.relationships.find((relationship) => relationship.ownerUri === "/" && relationship.targetMode === "Internal" && relationship.type.endsWith("/officeDocument"));
  if (!mainRelationship || mainRelationship.resolvedTargetUri !== manifest.facts.mainDocumentUri || mainRelationship.isTargetPresent !== true || !manifest.entries.some((entry) => entry.uri === manifest.facts.mainDocumentUri)) {
    fail(
      "invalid_document",
      "package_preflight",
      "The manifest's main-document identity is incomplete or inconsistent.",
      "Repair the package-level officeDocument relationship and target part."
    );
  }
  if (options.reviewProfileAlreadyApplied && manifest.facts.revisions.total !== 0) {
    fail(
      "invalid_argument",
      "package_preflight",
      "reviewProfileAlreadyApplied input still contains native tracked revisions.",
      "Supply the exact already-accepted/rejected package or set reviewProfileAlreadyApplied to false."
    );
  }
  const externalAutomatic = manifest.relationships.filter((relationship) => relationship.targetMode === "External" && !relationship.type.toLowerCase().endsWith("/hyperlink"));
  for (const relationship of externalAutomatic) {
    const warning = {
      code: "external_automatic_resource_omitted",
      severity: "warning",
      phase: "package_preflight",
      message: "An external automatic resource is not fetched by standalone export.",
      remediation: "Embed the resource in the DOCX package before export.",
      partUri: relationship.ownerUri,
      resource: relationship.target
    };
    if (options.unsupportedContent !== "strict") addWarning(state, warning);
    addResource(state, { kind: "external_link", status: "omitted", resource: relationship.target });
  }
  if (externalAutomatic.length > 0 && options.unsupportedContent === "strict") {
    fail(
      "resource_policy_failure",
      "package_preflight",
      "Strict export rejected an external automatic resource.",
      "Embed all automatic resources or use unsupportedContent: warn."
    );
  }
  if (manifest.facts.isMacroEnabled) {
    const warning = {
      code: "macro_content_not_exported",
      severity: "warning",
      phase: "package_preflight",
      message: "Macro content is not active or embedded in standalone HTML.",
      remediation: "Remove macros or use warn policy for a static visual export."
    };
    if (options.unsupportedContent !== "strict") addWarning(state, warning);
    if (options.unsupportedContent === "strict") {
      fail("resource_policy_failure", "package_preflight", warning.message, warning.remediation);
    }
  }
  if (manifest.facts.altChunkCount > 0) {
    const warning = {
      code: "altchunk_not_supported",
      severity: "warning",
      phase: "package_preflight",
      message: "Arbitrary altChunk content is not a supported standalone export input.",
      remediation: "Materialize altChunk content into ordinary WordprocessingML before export."
    };
    if (options.unsupportedContent !== "strict") addWarning(state, warning);
    if (options.unsupportedContent === "strict") {
      fail("resource_policy_failure", "package_preflight", warning.message, warning.remediation);
    }
  }
}
function conversionOptions(options) {
  const commentRenderMode = {
    hidden: -1 /* Disabled */,
    inline: 1 /* Inline */,
    endnotes: 0 /* EndnoteStyle */,
    margin: 2 /* Margin */
  }[options.markupVisibility.comments === false ? "hidden" : options.commentProfile];
  return {
    pageTitle: options.title,
    cssPrefix: "docx-",
    fabricateClasses: true,
    additionalCss: options.additionalCss,
    commentRenderMode,
    commentCssClassPrefix: "comment-",
    paginationMode: 1 /* Paginated */,
    paginationScale: 1,
    paginationCssClassPrefix: "page-",
    renderAnnotations: true,
    renderFootnotesAndEndnotes: true,
    renderHeadersAndFooters: true,
    renderTrackedChanges: options.reviewProfile === "markup",
    showFormattingChanges: options.markupVisibility.formatting !== false,
    showInsertionsAndDeletions: options.markupVisibility.insertionsAndDeletions !== false,
    // The balloon layout reads what the Word presentation records for balloons, in every profile.
    revisionPresentation: options.markupPresentation === "word" || options.commentColumnPlacement === "balloons" ? 1 /* Word */ : 0 /* Docxodus */,
    showDeletedContent: true,
    renderMoveOperations: true,
    renderUnsupportedContentPlaceholders: true,
    stampAnchors: true
  };
}
function bootstrapHtml(title = "") {
  const safeTitle = title.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${RENDER_CSP}"><title>${safeTitle}</title></head><body></body></html>`;
}
async function createIsolatedFrame(hostDocument, state, html = bootstrapHtml(), phase = "browser_launch") {
  if (!hostDocument.defaultView || !hostDocument.documentElement) {
    fail(
      "unsupported_runtime",
      "browser_launch",
      "An attached browser document is required.",
      "Call the browser exporter from a live Window, not a worker or detached document."
    );
  }
  const frame = hostDocument.createElement("iframe");
  frame.dataset.docxodusExportRealm = "v1";
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("tabindex", "-1");
  frame.sandbox.add("allow-same-origin");
  frame.style.position = "fixed";
  frame.style.left = "-100000px";
  frame.style.top = "0";
  frame.style.width = "1600px";
  frame.style.height = "1200px";
  frame.style.border = "0";
  frame.style.pointerEvents = "none";
  const loaded = new Promise((resolve, reject) => {
    frame.addEventListener("load", () => resolve(), { once: true });
    frame.addEventListener("error", () => reject(new Error("isolated frame failed to load")), { once: true });
  });
  frame.srcdoc = html;
  (hostDocument.body ?? hostDocument.documentElement).appendChild(frame);
  try {
    await runPhase(state, phase, ["isolated browsing context"], () => loaded);
  } catch (error) {
    frame.remove();
    throw error;
  }
  if (!frame.contentDocument?.defaultView) {
    frame.remove();
    fail(
      "browser_launch_failure",
      "browser_launch",
      "The isolated export frame is inaccessible.",
      "Allow same-origin srcdoc frames while retaining the script-free sandbox."
    );
  }
  return frame;
}
var STANDALONE_DATA_MEDIA_TYPES = /* @__PURE__ */ new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/bmp",
  "image/webp",
  "image/tiff",
  "image/x-icon",
  "image/svg+xml",
  "font/woff",
  "font/woff2",
  "font/ttf",
  "font/otf",
  "application/font-woff",
  "application/vnd.ms-fontobject"
]);
function dataUrlInfo(value) {
  if (!value.startsWith("data:")) return void 0;
  const comma = value.indexOf(",");
  if (comma < 0) return void 0;
  const metadata = value.slice(5, comma);
  const segments = metadata.split(";");
  const mediaType = (segments.shift() ?? "").toLowerCase();
  if (mediaType === "" && value === "data:,") return { mediaType: "", byteLength: 0 };
  if (!STANDALONE_DATA_MEDIA_TYPES.has(mediaType)) return void 0;
  if (segments.some((segment) => segment.toLowerCase() !== "base64")) return void 0;
  if (!segments.some((segment) => segment.toLowerCase() === "base64")) return void 0;
  const payload = value.slice(comma + 1);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)) {
    return void 0;
  }
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return { mediaType, byteLength: payload.length / 4 * 3 - padding };
}
function automaticUrlAllowed(value, allowFragment = false) {
  const trimmed = value.trim();
  return trimmed === "" || dataUrlInfo(trimmed) !== void 0 || allowFragment && trimmed.startsWith("#");
}
function standaloneSrcsetAllowed(value) {
  const match = /^\s*(data:\S+?)(?:\s+(?:\d+(?:\.\d+)?x|\d+w))?\s*$/i.exec(value);
  return !!match && dataUrlInfo(match[1]) !== void 0;
}
var SVG_URL_PRESENTATION_ATTRIBUTES = /* @__PURE__ */ new Set([
  "clip-path",
  "cursor",
  "fill",
  "filter",
  "marker",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "stroke"
]);
function estimateDataUrlBytes(value) {
  return dataUrlInfo(value.trim())?.byteLength;
}
function policyWarning(state, options, warning) {
  if (options.unsupportedContent === "strict") {
    fail("resource_policy_failure", warning.phase, warning.message, warning.remediation, {
      detail: warning.detail,
      partUri: warning.partUri,
      anchorId: warning.anchorId,
      resource: warning.resource
    });
  }
  addWarning(state, { ...warning, severity: "warning" });
}
function consumeCssEscape(source, start) {
  let cursor = start + 1;
  if (cursor >= source.length) return { value: "\uFFFD", end: cursor };
  if (source[cursor] === "\r" && source[cursor + 1] === "\n") {
    return { value: "", end: cursor + 2 };
  }
  if (source[cursor] === "\n" || source[cursor] === "\r" || source[cursor] === "\f") {
    return { value: "", end: cursor + 1 };
  }
  const hexStart = cursor;
  while (cursor < source.length && cursor - hexStart < 6 && /[0-9a-f]/i.test(source[cursor])) {
    cursor++;
  }
  if (cursor > hexStart) {
    const point = Number.parseInt(source.slice(hexStart, cursor), 16);
    if (/\s/.test(source[cursor] ?? "")) {
      if (source[cursor] === "\r" && source[cursor + 1] === "\n") cursor += 2;
      else cursor++;
    }
    return {
      value: point === 0 || point > 1114111 || point >= 55296 && point <= 57343 ? "\uFFFD" : String.fromCodePoint(point),
      end: cursor
    };
  }
  return { value: source[cursor], end: cursor + 1 };
}
function consumeCssName(source, start) {
  let value = "";
  let cursor = start;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === "\\") {
      const escape = consumeCssEscape(source, cursor);
      value += escape.value;
      cursor = escape.end;
    } else if (/[a-z0-9_-]/i.test(character) || character.charCodeAt(0) >= 128) {
      value += character;
      cursor++;
    } else {
      break;
    }
  }
  return { value, end: cursor };
}
function consumeCssComment(source, start) {
  const end = source.indexOf("*/", start + 2);
  return end < 0 ? source.length : end + 2;
}
function consumeCssString(source, start) {
  const quote = source[start];
  let cursor = start + 1;
  while (cursor < source.length) {
    if (source[cursor] === quote) return cursor + 1;
    if (source[cursor] === "\n" || source[cursor] === "\r" || source[cursor] === "\f") {
      return cursor;
    }
    if (source[cursor] === "\\") cursor = consumeCssEscape(source, cursor).end;
    else cursor++;
  }
  return cursor;
}
function consumeCssFunction(source, openParenthesis) {
  let depth = 0;
  let cursor = openParenthesis;
  while (cursor < source.length) {
    if (source.startsWith("/*", cursor)) {
      cursor = consumeCssComment(source, cursor);
    } else if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = consumeCssString(source, cursor);
    } else if (source[cursor] === "\\") {
      cursor = consumeCssEscape(source, cursor).end;
    } else if (source[cursor] === "(") {
      depth++;
      cursor++;
    } else if (source[cursor] === ")") {
      depth--;
      cursor++;
      if (depth === 0) return cursor;
    } else {
      cursor++;
    }
  }
  return cursor;
}
function decodeCssEscapedText(source, stripComments) {
  let decoded = "";
  for (let cursor = 0; cursor < source.length; ) {
    if (stripComments && source.startsWith("/*", cursor)) {
      cursor = consumeCssComment(source, cursor);
    } else if (source[cursor] === "\\") {
      const escape = consumeCssEscape(source, cursor);
      decoded += escape.value;
      cursor = escape.end;
    } else {
      decoded += source[cursor++];
    }
  }
  return decoded;
}
function decodeCssUrlComponent(source) {
  const trimmed = source.trim();
  if (trimmed.length >= 2 && (trimmed[0] === '"' || trimmed[0] === "'") && trimmed.at(-1) === trimmed[0]) {
    return decodeCssEscapedText(trimmed.slice(1, -1), false);
  }
  return decodeCssEscapedText(trimmed, true).trim();
}
function cssSecurityTokens(css) {
  const tokens = [];
  const functionStack = [];
  for (let cursor = 0; cursor < css.length; ) {
    if (css.startsWith("/*", cursor)) {
      cursor = consumeCssComment(css, cursor);
      continue;
    }
    if (css[cursor] === '"' || css[cursor] === "'") {
      const end = consumeCssString(css, cursor);
      const context = functionStack.at(-1);
      const isImageSource = context === "image-set" || context === "-webkit-image-set";
      if (isImageSource && end > cursor && css[end - 1] === css[cursor]) {
        tokens.push({
          kind: "url",
          start: cursor,
          end,
          value: decodeCssEscapedText(css.slice(cursor + 1, end - 1), false)
        });
      }
      cursor = Math.max(end, cursor + 1);
      continue;
    }
    if (css[cursor] === "@") {
      const name = consumeCssName(css, cursor + 1);
      if (name.value.toLowerCase() === "import") {
        let end = name.end;
        let depth = 0;
        while (end < css.length) {
          if (css.startsWith("/*", end)) end = consumeCssComment(css, end);
          else if (css[end] === '"' || css[end] === "'") end = consumeCssString(css, end);
          else if (css[end] === "(") {
            depth++;
            end++;
          } else if (css[end] === ")") {
            depth = Math.max(0, depth - 1);
            end++;
          } else if (css[end] === ";" && depth === 0) {
            end++;
            break;
          } else end++;
        }
        tokens.push({ kind: "import", start: cursor, end, value: css.slice(cursor, end) });
        cursor = end;
        continue;
      }
    }
    if (css[cursor] === "\\" || /[a-z_-]/i.test(css[cursor]) || css.charCodeAt(cursor) >= 128) {
      const name = consumeCssName(css, cursor);
      if (name.value.toLowerCase() === "url" && css[name.end] === "(") {
        let end = name.end + 1;
        while (end < css.length) {
          if (css.startsWith("/*", end)) end = consumeCssComment(css, end);
          else if (css[end] === '"' || css[end] === "'") end = consumeCssString(css, end);
          else if (css[end] === "\\") end = consumeCssEscape(css, end).end;
          else if (css[end++] === ")") break;
        }
        const innerEnd = css[end - 1] === ")" ? end - 1 : end;
        tokens.push({
          kind: "url",
          start: cursor,
          end,
          value: decodeCssUrlComponent(css.slice(name.end + 1, innerEnd))
        });
        cursor = end;
        continue;
      }
      if (css[name.end] === "(") {
        const functionName = name.value.toLowerCase();
        const isImageSource = functionStack.some(
          (context) => context === "image-set" || context === "-webkit-image-set"
        );
        if (isImageSource && (functionName === "var" || functionName === "env" || functionName === "if")) {
          const end = consumeCssFunction(css, name.end);
          tokens.push({
            kind: "substitution",
            start: cursor,
            end,
            value: css.slice(cursor, end)
          });
          cursor = end;
          continue;
        }
        functionStack.push(functionName);
        cursor = name.end + 1;
        continue;
      }
      cursor = Math.max(name.end, cursor + 1);
      continue;
    }
    if (css[cursor] === "(") {
      functionStack.push("");
      cursor++;
      continue;
    }
    if (css[cursor] === ")") {
      functionStack.pop();
      cursor++;
      continue;
    }
    cursor++;
  }
  return tokens;
}
function sanitizeCss(css, state, options, resourceLabel) {
  let candidate = css;
  for (let pass = 0; pass < 8; pass++) {
    const tokens = cssSecurityTokens(candidate);
    const actionable = tokens.filter((token) => token.kind !== "url" || !automaticUrlAllowed(token.value, true));
    if (actionable.length === 0) return candidate;
    let cursor = 0;
    let sanitized = "";
    for (const token of tokens) {
      sanitized += candidate.slice(cursor, token.start);
      if (token.kind === "import") {
        policyWarning(state, options, {
          code: "css_import_omitted",
          phase: "docx_conversion",
          message: "A CSS import was removed from standalone output.",
          remediation: "Inline the stylesheet and all of its resources.",
          resource: `${resourceLabel}: ${token.value.slice(0, 160)}`
        });
        sanitized += ";";
      } else if (token.kind === "url" && automaticUrlAllowed(token.value, true)) {
        sanitized += candidate.slice(token.start, token.end);
      } else {
        policyWarning(state, options, {
          code: "external_css_resource_omitted",
          phase: "docx_conversion",
          message: "An automatic CSS resource was removed from standalone output.",
          remediation: "Embed the resource as a data URL in the DOCX conversion output.",
          resource: token.value
        });
        sanitized += 'url("data:,")';
      }
      cursor = token.end;
    }
    candidate = sanitized + candidate.slice(cursor);
  }
  policyWarning(state, options, {
    code: "external_css_resource_omitted",
    phase: "docx_conversion",
    message: "CSS could not be proven free of automatic external resources.",
    remediation: "Remove dynamic CSS resource substitutions and inline all resources.",
    resource: resourceLabel
  });
  return "";
}
function sanitizeConvertedDocument(target, convertedHtml, state, options) {
  const view = target.defaultView;
  if (!view) {
    fail(
      "browser_launch_failure",
      "browser_launch",
      "The export realm has no defaultView.",
      "Use an attached same-origin browser frame."
    );
  }
  const parsed = new view.DOMParser().parseFromString(convertedHtml, "text/html");
  const parserError = parsed.querySelector("parsererror");
  if (parserError || !parsed.body) {
    fail(
      "conversion_failure",
      "docx_conversion",
      "Converted HTML could not be parsed.",
      "Inspect converter diagnostics and the source package."
    );
  }
  for (const element of Array.from(parsed.querySelectorAll("script, iframe, object, embed, video, audio, source, track, link, base"))) {
    policyWarning(state, options, {
      code: "active_or_external_content_omitted",
      phase: "docx_conversion",
      message: `A ${element.localName} element was removed from standalone output.`,
      remediation: "Represent the content as supported static WordprocessingML."
    });
    element.remove();
  }
  for (const meta of Array.from(parsed.querySelectorAll("meta[http-equiv]"))) {
    meta.remove();
  }
  for (const style of Array.from(parsed.querySelectorAll("style"))) {
    style.textContent = sanitizeCss(style.textContent ?? "", state, options, "stylesheet");
  }
  const urlAttributes = /* @__PURE__ */ new Set([
    "src",
    "poster",
    "data",
    "action",
    "formaction",
    "background",
    "xlink:href"
  ]);
  for (const element of Array.from(parsed.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === "style") {
        element.setAttribute("style", sanitizeCss(attribute.value, state, options, "inline style"));
        continue;
      }
      if (name === "srcset") {
        if (!standaloneSrcsetAllowed(attribute.value)) {
          element.removeAttribute(attribute.name);
          policyWarning(state, options, {
            code: "srcset_omitted",
            phase: "docx_conversion",
            message: "A responsive image source set was removed because every candidate could not be proven standalone.",
            remediation: "Embed one image as a data URL in src.",
            resource: attribute.value
          });
        }
        continue;
      }
      if (SVG_URL_PRESENTATION_ATTRIBUTES.has(name) && cssSecurityTokens(attribute.value).length > 0) {
        element.setAttribute(
          attribute.name,
          sanitizeCss(attribute.value, state, options, `SVG ${attribute.name}`)
        );
        continue;
      }
      if (name === "href" && element.localName === "a") {
        const href = attribute.value.trim();
        if (href.startsWith("#") || /^(?:https?|mailto|tel):/i.test(href)) {
          if (!href.startsWith("#")) {
            element.setAttribute("rel", "noopener noreferrer");
            addResource(state, { kind: "external_link", status: "allowed_user_link", resource: href });
          }
          continue;
        }
        element.removeAttribute(attribute.name);
        policyWarning(state, options, {
          code: "unsafe_hyperlink_omitted",
          phase: "docx_conversion",
          message: "A hyperlink with an unsupported scheme was removed.",
          remediation: "Use an HTTPS, HTTP, mailto, tel, or document-fragment target.",
          resource: href
        });
        continue;
      }
      if (name === "ping" && element.localName === "a") {
        element.removeAttribute(attribute.name);
        policyWarning(state, options, {
          code: "hyperlink_ping_omitted",
          phase: "docx_conversion",
          message: "A hyperlink ping target was removed from standalone output.",
          remediation: "Use an ordinary user-activated hyperlink without background tracking requests.",
          resource: attribute.value
        });
        continue;
      }
      if (name === "href" && element.localName !== "a" || urlAttributes.has(name)) {
        const allowFragment = element.namespaceURI === "http://www.w3.org/2000/svg";
        if (!automaticUrlAllowed(attribute.value, allowFragment)) {
          element.removeAttribute(attribute.name);
          policyWarning(state, options, {
            code: "external_automatic_resource_omitted",
            phase: "docx_conversion",
            message: "An automatic external resource was removed from standalone output.",
            remediation: "Embed the resource as a data URL before export.",
            resource: attribute.value
          });
        }
      }
    }
    if (element.localName === "form") {
      element.removeAttribute("action");
      element.addEventListener("submit", (event) => event.preventDefault());
    }
  }
  countDomNodes(parsed, options.limits.domNodes, "docx_conversion");
  const admittedResources = automaticResourceCount(parsed);
  enforceLimit(
    admittedResources.count,
    options.limits.automaticResources,
    "automaticResources",
    "docx_conversion"
  );
  enforceLimit(
    admittedResources.bytes,
    options.limits.automaticResourceBytes,
    "automaticResourceBytes",
    "docx_conversion"
  );
  target.documentElement.lang = parsed.documentElement.lang || "en-US";
  target.title = options.title;
  for (const style of Array.from(parsed.head.querySelectorAll("style"))) {
    target.head.appendChild(target.importNode(style, true));
  }
  target.body.replaceChildren(...Array.from(parsed.body.childNodes, (node) => target.importNode(node, true)));
  for (const name of ["data-docx-compatibility-mode", "data-docx-wordperfect-justification"]) {
    const value = parsed.body.getAttribute(name);
    if (value === null) target.body.removeAttribute(name);
    else target.body.setAttribute(name, value);
  }
}
function inventoryUnsupportedContent(placeholders, state, options, phase) {
  for (const placeholder of placeholders) {
    const outcome = {
      contentType: placeholder.dataset.contentType ?? "Other",
      ...placeholder.dataset.elementName ? { elementName: placeholder.dataset.elementName } : {},
      ...placeholder.closest("[data-source-anchor-id]")?.dataset.sourceAnchorId ? { anchorId: placeholder.closest("[data-source-anchor-id]").dataset.sourceAnchorId } : {},
      action: "placeholder"
    };
    addUnsupportedContent(state, outcome);
    policyWarning(state, options, {
      code: "unsupported_content_placeholder",
      phase,
      message: `${outcome.contentType} is represented by a visible placeholder.`,
      remediation: "Replace it with a supported static representation for faithful export.",
      ...outcome.anchorId ? { anchorId: outcome.anchorId } : {}
    });
  }
}
function inventoryConvertedContent(document2, state, options) {
  inventoryUnsupportedContent(Array.from(document2.querySelectorAll(
    "[data-content-type]:not([data-docx-frame-pending])"
  )), state, options, "docx_conversion");
  for (const image of Array.from(document2.querySelectorAll("img"))) {
    const source = image.getAttribute("src") ?? "";
    const metadata = /^data:([^;,]+)/i.exec(source);
    addResource(state, {
      kind: "image",
      status: "embedded",
      resource: image.alt || void 0,
      mediaType: metadata?.[1],
      byteLength: estimateDataUrlBytes(source)
    });
  }
  for (const svg of Array.from(document2.querySelectorAll("svg"))) {
    addResource(state, {
      kind: svg.classList.contains("chart") || svg.closest("[class*='chart']") ? "chart" : "svg",
      status: "inline"
    });
  }
}
async function awaitFonts(document2) {
  if (document2.fonts) await document2.fonts.ready;
}
function revealMeasurementStaging(document2) {
  const roots = Array.from(
    document2.querySelectorAll("#pagination-staging, .page-staging")
  );
  const saved = roots.map((root) => ({
    root,
    value: root.style.getPropertyValue("visibility"),
    priority: root.style.getPropertyPriority("visibility")
  }));
  for (const root of roots) root.style.setProperty("visibility", "visible", "important");
  return () => {
    for (const { root, value, priority } of saved) {
      if (value) root.style.setProperty("visibility", value, priority);
      else root.style.removeProperty("visibility");
    }
  };
}
function recordFontResolution(result, state, options) {
  enforceLimit(result.resolutions.length, state.limits.fontRequests, "fontRequests", "font_loading");
  enforceDiagnosticAdmission(state, result.resolutions.length);
  state.fontIdentity = { ...result.identity };
  state.fonts.push(...result.resolutions.map((resolution) => ({
    ...resolution,
    requestedFamilies: [...resolution.requestedFamilies],
    requestedFamilyKinds: [...resolution.requestedFamilyKinds],
    ...resolution.licenseEvidence ? { licenseEvidence: { ...resolution.licenseEvidence } } : {}
  })));
  if (result.renderedTextNodeCount > 0 && result.resolutions.length === 0) {
    fail(
      "resource_policy_failure",
      "font_loading",
      "Rendered text was present, but the canonical font inventory was unexpectedly empty.",
      "Report this font inventory invariant failure before relying on the output."
    );
  }
  for (const resolution of result.resolutions) {
    const severity = "warning";
    if (resolution.status === "missing") {
      addWarning(state, {
        code: "font_unavailable",
        severity,
        phase: "font_loading",
        message: `No configured face resolved the required font family: ${resolution.requestedFamily}.`,
        remediation: "Install or explicitly supply the required font before export.",
        resource: resolution.requestedFamily
      });
    }
    if (resolution.status === "load_failed") {
      addWarning(state, {
        code: "font_load_failed",
        severity,
        phase: "font_loading",
        message: `The configured font face for ${resolution.requestedFamily} could not be decoded or loaded.`,
        remediation: "Replace the configured font with a valid browser-supported face.",
        resource: resolution.requestedFamily,
        ...resolution.loadFailureDetail ? { detail: resolution.loadFailureDetail } : {}
      });
    }
    if (resolution.status === "substituted") {
      addWarning(state, {
        code: "font_substituted",
        severity,
        phase: "font_loading",
        message: `${resolution.requestedFamily} was resolved to ${resolution.resolvedFamily ?? "a configured substitute"}.`,
        remediation: "Supply an exact configured family when substitution is not acceptable.",
        resource: resolution.requestedFamily
      });
    }
    if (resolution.faceMatch === "synthesized") {
      addWarning(state, {
        code: "font_face_synthesized",
        severity,
        phase: "font_loading",
        message: `The requested style, weight, or stretch for ${resolution.requestedFamily} requires synthesis.`,
        remediation: "Supply an exact configured face for this style, weight, and stretch.",
        resource: resolution.requestedFamily
      });
    }
    if (resolution.metricCompatible === false) {
      addWarning(state, {
        code: "font_metric_mismatch",
        severity,
        phase: "font_loading",
        message: `The substitute selected for ${resolution.requestedFamily} is not metrically compatible.`,
        remediation: "Supply the exact family or review PageMap and line wrapping before publication.",
        resource: resolution.requestedFamily
      });
    }
    if (resolution.glyphCoverage === "partial") {
      addWarning(state, {
        code: "font_glyph_coverage_partial",
        severity,
        phase: "font_loading",
        message: `The configured face for ${resolution.requestedFamily} covers only part of the rendered text.`,
        remediation: "Supply a face with complete glyph coverage for the reported sample.",
        resource: resolution.requestedFamily
      });
    }
  }
  if (result.resolutions.some((resolution) => resolution.status === "unverified" || !result.resolverConfigured && resolution.source === "browser")) {
    addWarning(state, {
      code: "font_environment_unverified",
      severity: "warning",
      phase: "font_loading",
      message: "The browser loaded the requested CSS font families, but their exact files and substitutions are not attestable.",
      remediation: "Use an explicit verified font resolver when exact font identity is required."
    });
  }
  const strictFailures = result.resolutions.filter((resolution) => !resolution.verified);
  if (options.strictFonts && strictFailures.length > 0) {
    fail(
      "resource_policy_failure",
      "font_loading",
      "Strict font policy rejected a non-exact, unverified, or incompletely covered font outcome.",
      "Supply exact verified faces with complete glyph coverage or disable strictFonts.",
      {
        detail: strictFailures.map(({ requestId, status }) => `${requestId}:${status}`).join(", ")
      }
    );
  }
}
function rethrowBrowserFontError(error) {
  if (error instanceof BrowserFontError) {
    if (error.cause instanceof DocxodusExportError) {
      const original = error.cause;
      fail(original.code, original.phase, original.message, original.remediation, {
        detail: original.detail,
        partUri: original.partUri,
        anchorId: original.anchorId,
        resource: original.resource,
        cause: error
      });
    }
    fail(
      error.kind === "resource_limit" ? "resource_limit" : "resource_policy_failure",
      "font_loading",
      error.message,
      error.kind === "resource_limit" ? "Lower the number or size of configured fonts or raise the versioned font limit." : "Return one canonical, digest-verified resolver outcome for every font request.",
      { detail: error.detail, cause: error }
    );
  }
  throw error;
}
function visualResourceLabel(element, kind, index) {
  const anchor = element.closest("[data-source-anchor-id]")?.getAttribute("data-source-anchor-id");
  if (anchor) return `${kind}:${boundedText(anchor)}`;
  const alt = element instanceof HTMLImageElement ? element.alt.trim() : "";
  return alt ? `${kind}:${boundedText(alt)}` : `${kind}-${index + 1}`;
}
function boundedText(value, maximum = 80) {
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return clean.length > maximum ? `${clean.slice(0, maximum - 1)}\u2026` : clean;
}
function visualResourceFailure(element, kind, index) {
  const anchorId = element.closest("[data-source-anchor-id]")?.getAttribute("data-source-anchor-id") ?? void 0;
  return {
    identity: element.getAttribute("data-docx-visual-resource-id"),
    resource: visualResourceLabel(element, kind, index),
    ...anchorId ? { anchorId } : {}
  };
}
function identifyVisualResources(document2) {
  document2.querySelectorAll("img, svg").forEach((element, index) => element.setAttribute("data-docx-visual-resource-id", String(index + 1)));
}
async function decodeImages(document2) {
  const images = Array.from(document2.images);
  await Promise.all(images.map((image) => typeof image.decode === "function" ? image.decode().catch(() => void 0) : Promise.resolve()));
  return images.flatMap((image, index) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 ? [] : [visualResourceFailure(image, "image", index)]);
}
function validateInlineSvg(document2) {
  return Array.from(document2.querySelectorAll("svg")).flatMap((svg, index) => svg.hasAttribute("viewBox") || Number.parseFloat(svg.getAttribute("width") ?? "") > 0 && Number.parseFloat(svg.getAttribute("height") ?? "") > 0 ? [] : [visualResourceFailure(svg, "svg", index)]);
}
function admitVisualResourceFailures(state, options, failures, kind, warning) {
  for (const failure of failures) {
    const { identity, ...diagnostic } = failure;
    if (identity !== null) state.omittedVisualResourceIds.push(identity);
    addResource(state, { kind, status: "omitted", resource: failure.resource });
    policyWarning(state, options, { ...warning, ...diagnostic });
  }
}
function assertVisualResourcesIntact(failures, alreadyOmitted, what) {
  const regressions = failures.filter((failure) => failure.identity === null || !alreadyOmitted.has(failure.identity));
  if (regressions.length === 0) return;
  throw new Error(
    `${regressions.length} ${what} that materialized successfully did not survive serialization: ${regressions.slice(0, 8).map((failure) => failure.resource).join(", ")}`
  );
}
function normalizeFragmentTargets(document2, pages, state, options) {
  const firstFootnote = /* @__PURE__ */ new Set();
  for (const item of Array.from(document2.querySelectorAll(
    ".page-footnotes [data-footnote-id]"
  ))) {
    const id = item.dataset.footnoteId;
    if (id && !firstFootnote.has(id)) {
      item.id = `fn-${id}`;
      firstFootnote.add(id);
    }
  }
  const globalTargets = /* @__PURE__ */ new Map();
  const pageTargets = /* @__PURE__ */ new Map();
  const occurrences = /* @__PURE__ */ new Map();
  for (const page of pages) {
    const localTargets = /* @__PURE__ */ new Map();
    pageTargets.set(page, localTargets);
    for (const element of Array.from(page.querySelectorAll("[id]"))) {
      const original = element.id;
      const occurrence = occurrences.get(original) ?? 0;
      occurrences.set(original, occurrence + 1);
      const resolved = occurrence === 0 ? original : `${original}--page-${page.dataset.pageNumber ?? "0"}-${occurrence}`;
      element.id = resolved;
      if (!localTargets.has(original)) localTargets.set(original, resolved);
      if (!globalTargets.has(original)) globalTargets.set(original, resolved);
    }
  }
  for (const link of Array.from(document2.querySelectorAll("a[href^='#']"))) {
    const original = link.getAttribute("href").slice(1);
    let page = link.closest(".page-box");
    const target = (page ? pageTargets.get(page)?.get(original) : void 0) ?? globalTargets.get(original);
    if (target) {
      link.setAttribute("href", `#${target}`);
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.tabIndex = -1;
      policyWarning(state, options, {
        code: "fragment_target_unavailable",
        phase: "running_story_placement",
        message: `Fragment target #${original} is unavailable in the final page tree.`,
        remediation: "Repair the bookmark/note target or use warn policy to retain an inert label.",
        resource: `#${original}`
      });
    }
  }
  const ids = Array.from(document2.querySelectorAll("[id]"), (element) => element.id);
  if (new Set(ids).size !== ids.length) {
    fail(
      "output_verification_failure",
      "running_story_placement",
      "The final standalone document contains duplicate fragment IDs.",
      "Report the source document and duplicate target to Docxodus."
    );
  }
}
function namePageForPrint(page) {
  const sectionIndex = Number.parseInt(page.dataset.sectionIndex ?? "0", 10);
  const width = Number.parseFloat(page.style.width);
  const height = Number.parseFloat(page.style.height);
  const name = `docxodus-section-${sectionIndex}`;
  page.style.setProperty("page", name);
  page.dataset.pageWidthPt = String(width);
  page.dataset.pageHeightPt = String(height);
  return { name, width, height };
}
function standaloneStyle(pages) {
  const namedPages = /* @__PURE__ */ new Map();
  for (const page of pages) {
    const { name, width, height } = namePageForPrint(page);
    if (!namedPages.has(name)) namedPages.set(name, { width, height });
  }
  const rules = Array.from(namedPages, ([name, dimensions]) => `@page ${name} { size: ${dimensions.width}pt ${dimensions.height}pt; margin: 0; }`).join("\n");
  return `
@page { margin: 0; }
${rules}
html, body { margin: 0; padding: 0; }
#pagination-container.page-container { min-height: 0 !important; }
@media screen {
  html, body { background: #e5e7eb; }
  #pagination-container.page-container {
    display: flex !important;
    flex-direction: column;
    align-items: center;
    gap: 20px !important;
    padding: 20px !important;
    background: transparent !important;
  }
  .page-box { box-shadow: 0 2px 8px rgba(0, 0, 0, .18); }
}
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: transparent !important; }
  #pagination-container.page-container {
    display: block !important;
    gap: 0 !important;
    padding: 0 !important;
    background: transparent !important;
  }
  .page-box {
    zoom: 1 !important;
    transform: none !important;
    margin: 0 !important;
    box-shadow: none !important;
    break-after: page;
    page-break-after: always;
  }
  .page-box:last-child { break-after: auto; page-break-after: auto; }
}`;
}
function releasePageBox(page) {
  for (const property of [
    "zoom",
    "transform",
    "transform-origin",
    "margin-right",
    "margin-bottom",
    "box-shadow",
    "will-change",
    "contain"
  ]) page.style.removeProperty(property);
}
function clipPositionedPageContent(page) {
  const positioned = Array.from(page.children).filter((element) => element instanceof page.ownerDocument.defaultView.HTMLElement && element.matches('[data-docx-drawing-anchor="true"], [data-docx-text-frame="true"], [data-docx-raised-inline-textbox="true"]'));
  if (positioned.length === 0) return;
  const layer = page.ownerDocument.createElement("div");
  layer.className = "page-drawing-layer";
  layer.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none";
  for (const element of positioned) {
    const pointerEvents = page.ownerDocument.defaultView.getComputedStyle(element).pointerEvents;
    element.style.pointerEvents = pointerEvents;
    layer.append(element);
  }
  page.append(layer);
}
function finalizePageTree(document2, pages, state, options) {
  document2.querySelector("#pagination-staging, .page-staging")?.remove();
  for (const element of Array.from(document2.querySelectorAll("*"))) {
    element.removeAttribute("contenteditable");
    element.removeAttribute("data-anchor");
    element.removeAttribute("data-committed-text");
    element.removeAttribute("draggable");
    element.style.removeProperty("will-change");
    element.style.removeProperty("contain");
  }
  for (const page of pages) {
    releasePageBox(page);
    clipPositionedPageContent(page);
  }
  normalizeFragmentTargets(document2, pages, state, options);
  document2.documentElement.dataset.docxodusStandalone = "v1";
  const policy = document2.querySelector(
    "meta[http-equiv='Content-Security-Policy' i]"
  );
  if (!policy) {
    fail(
      "output_verification_failure",
      "running_story_placement",
      "The standalone document lost its Content Security Policy.",
      "Report the materializer defect; finalization must retain the closed policy."
    );
  }
  policy.content = STANDALONE_CSP;
  const style = document2.createElement("style");
  style.id = "docxodus-standalone-style";
  style.textContent = standaloneStyle(pages);
  document2.head.appendChild(style);
}
function findClippedContent(document2) {
  for (const column of Array.from(document2.querySelectorAll(".page-comment-margin"))) {
    if (column.scrollHeight > column.clientHeight + 1) {
      fail(
        "pagination_failure",
        "running_story_placement",
        "A margin comment is clipped in the final page tree.",
        "Report the unsupported comment structure; overflowing threads must continue after the document."
      );
    }
  }
  for (const footnotes of Array.from(document2.querySelectorAll(".page-footnotes"))) {
    if (footnotes.scrollHeight <= footnotes.clientHeight + 1) continue;
    const boundary = footnotes.getBoundingClientRect().bottom;
    const hasVisibleOverflow = Array.from(measureLaidOutBottoms(footnotes).values()).some((bottom) => bottom > boundary + 1);
    if (hasVisibleOverflow) {
      fail(
        "pagination_failure",
        "running_story_placement",
        "A footnote continuation is clipped in the final page tree.",
        "Report the unsupported note structure; eligible text paragraphs are continued losslessly."
      );
    }
  }
  const clipped = [];
  for (const content of Array.from(document2.querySelectorAll(".page-content"))) {
    if (content.scrollHeight > content.clientHeight + 1) {
      const pageNumber = content.closest(".page-box")?.dataset.pageNumber ?? "unknown";
      const boundary = content.getBoundingClientRect().bottom;
      const overflowing = Array.from(measureLaidOutBottoms(content), ([element, bottom]) => ({
        element,
        bottom
      })).filter(({ element, bottom }) => bottom > boundary + 1 && !isPreservedExactLineInk(element, content) && !findOversizedExactRow(element)).sort((left, right) => right.bottom - left.bottom);
      if (overflowing.length === 0) continue;
      const overflow = overflowing.slice(0, 3).map(({ element, bottom }) => `${element.localName}${element.className ? `.${String(element.className).trim().replace(/\s+/g, ".")}` : ""} (+${(bottom - boundary).toFixed(1)}px)`);
      clipped.push({
        pageNumber: Number.parseInt(pageNumber, 10),
        overflowPx: overflowing[0].bottom - boundary,
        message: `Page ${pageNumber} body content is clipped (${content.scrollHeight}px scroll height in a ${content.clientHeight}px band; ${overflow.join(", ")}).`
      });
    }
  }
  return clipped;
}
var MAX_BODY_REFLOW_ROUNDS = 3;
var BodyReflowRequest = class extends Error {
  constructor() {
    super("body reflow requested");
    this.name = "BodyReflowRequest";
  }
};
function treeSignature(document2, pages) {
  const geometry = pages.map((page) => {
    const rect = page.getBoundingClientRect();
    return [
      page.dataset.pageNumber,
      page.dataset.sectionIndex,
      rect.width.toFixed(3),
      rect.height.toFixed(3),
      page.scrollWidth,
      page.scrollHeight
    ];
  });
  const fragments = Array.from(
    document2.querySelectorAll(".page-box [data-source-anchor-id]"),
    (element) => {
      const rect = element.getBoundingClientRect();
      const style = document2.defaultView.getComputedStyle(element);
      return [
        element.dataset.sourceAnchorId,
        element.dataset.pageNumber,
        element.dataset.fragmentIndex,
        rect.left.toFixed(3),
        rect.top.toFixed(3),
        rect.width.toFixed(3),
        rect.height.toFixed(3),
        style.display,
        style.visibility
      ];
    }
  );
  return canonicalJson({
    fragments,
    geometry,
    nodes: document2.querySelectorAll("*").length,
    textLength: document2.body.textContent?.length ?? 0
  });
}
async function animationFrame(document2) {
  const view = document2.defaultView;
  if (!view) throw new Error("render document has no defaultView");
  await new Promise((resolve) => view.requestAnimationFrame(() => resolve()));
}
async function awaitStableTree(document2, pages) {
  const view = document2.defaultView;
  if (!view) throw new Error("render document has no defaultView");
  let mutations = 0;
  let resizes = 0;
  const mutationObserver = new view.MutationObserver((records) => {
    mutations += records.length;
  });
  const resizeObserver = typeof view.ResizeObserver === "function" ? new view.ResizeObserver((records) => {
    resizes += records.length;
  }) : void 0;
  mutationObserver.observe(document2.documentElement, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true
  });
  for (const page of pages) resizeObserver?.observe(page);
  try {
    await animationFrame(document2);
    await animationFrame(document2);
    const first = treeSignature(document2, pages);
    mutations = 0;
    resizes = 0;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
    await animationFrame(document2);
    await animationFrame(document2);
    const second = treeSignature(document2, pages);
    if (first !== second || mutations !== 0 || resizes !== 0) {
      throw new PageTreeInstabilityError(
        `Final page tree changed during the quiet interval (mutations=${mutations}, resizes=${resizes})`
      );
    }
    return second;
  } finally {
    mutationObserver.disconnect();
    resizeObserver?.disconnect();
  }
}
function checkpointAttemptState(state) {
  return {
    readiness: state.readiness.length,
    warnings: state.warnings.length,
    fonts: state.fonts.length,
    resources: state.resources.length,
    omittedVisualResourceIds: state.omittedVisualResourceIds.length,
    unsupportedContent: state.unsupportedContent.length
  };
}
function restoreAttemptState(state, checkpoint) {
  state.readiness.length = checkpoint.readiness;
  state.warnings.length = checkpoint.warnings;
  state.fonts.length = checkpoint.fonts;
  state.resources.length = checkpoint.resources;
  state.omittedVisualResourceIds.length = checkpoint.omittedVisualResourceIds;
  state.unsupportedContent.length = checkpoint.unsupportedContent;
}
function serializeDocument(document2) {
  return `<!doctype html>
${document2.documentElement.outerHTML}`;
}
function automaticResourceCount(document2) {
  let count = 0;
  let bytes = 0;
  const add = (value) => {
    count++;
    bytes += estimateDataUrlBytes(value) ?? 0;
  };
  const addCssUrls = (value) => {
    for (const token of cssSecurityTokens(value)) {
      if (token.kind === "url" || token.kind === "substitution") add(token.value);
    }
  };
  for (const element of Array.from(document2.querySelectorAll("*"))) {
    for (const name of ["src", "poster", "background", "data"]) {
      const value = element.getAttribute(name);
      if (value) add(value);
    }
    const srcset = element.getAttribute("srcset");
    if (srcset) add(srcset.replace(/\s+(?:\d+(?:\.\d+)?x|\d+w)\s*$/i, ""));
    const isSvg = element.namespaceURI === "http://www.w3.org/2000/svg";
    if (isSvg) {
      for (const name of ["href", "xlink:href"]) {
        const value = element.getAttribute(name);
        if (value) add(value);
      }
      for (const name of SVG_URL_PRESENTATION_ATTRIBUTES) {
        const value = element.getAttribute(name);
        if (value) addCssUrls(value);
      }
    }
    const inlineStyle = element.getAttribute("style");
    if (inlineStyle) addCssUrls(inlineStyle);
  }
  for (const style of Array.from(document2.querySelectorAll("style"))) {
    addCssUrls(style.textContent ?? "");
  }
  return { count, bytes };
}
function presentationFields(options) {
  return {
    ...options.markupPresentation === "word" ? { markupPresentation: "word" } : {},
    ...Object.keys(options.markupVisibility).length ? { markupVisibility: options.markupVisibility } : {},
    ...options.commentColumnPlacement === "balloons" ? { commentColumnPlacement: "balloons" } : {},
    ...options.balloonOverflow === "appendix" ? { balloonOverflow: "appendix" } : {},
    ...options.markupMode === "inline" ? { markupMode: "inline" } : {},
    ...options.additionalCss ? { additionalCss: options.additionalCss } : {}
  };
}
async function layoutDigestForOptions(options) {
  const layoutContract = {
    title: options.title,
    reviewProfile: options.reviewProfile,
    reviewProfileAlreadyApplied: options.reviewProfileAlreadyApplied,
    // Absent for the default, so default layouts keep the digest they had before the option.
    ...presentationFields(options),
    commentProfile: options.commentProfile,
    pagination: {
      mode: "paginated",
      scale: 1,
      pageGap: 0,
      showPageNumbers: false,
      fragmentParagraphs: true,
      cssPrefix: "page-"
    }
  };
  return canonicalMaterialDigest("docxodus:layout-options:v1", layoutContract);
}
async function runtimePolicyDigestForOptions(options, runtimeAssets) {
  return canonicalMaterialDigest("docxodus:runtime-policy:v1", {
    assetGraphDigest: runtimeAssets.graphDigest,
    assetPackageVersion: runtimeAssets.packageVersion,
    isolation: {
      attachedSameOriginFrame: true,
      scripts: "denied",
      automaticNetwork: "denied",
      sandbox: ["allow-same-origin"]
    },
    limits: options.limits,
    strictFonts: options.strictFonts,
    timeoutMs: options.timeoutMs,
    unsupportedContent: options.unsupportedContent
  });
}
function observedRuntimeFacts(document2) {
  const view = document2.defaultView;
  if (!view) {
    fail(
      "unsupported_runtime",
      "browser_launch",
      "The render document has no browser identity.",
      "Use an attached browser document."
    );
  }
  return {
    runtimeKind: "browser",
    locale: view.navigator.language || "und",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    viewport: [view.innerWidth, view.innerHeight],
    deviceScaleFactor: view.devicePixelRatio,
    media: {
      colorScheme: view.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : view.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "no-preference",
      reducedMotion: view.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduce" : "no-preference",
      forcedColors: view.matchMedia("(forced-colors: active)").matches ? "active" : "none",
      printMedia: true
    },
    networkIsolation: "contextRestricted"
  };
}
async function rendererIdentity(document2, layoutDigest, runtimePolicyDigest, runtimeAssets, runtimeVersion, fonts, fontIdentity) {
  const view = document2.defaultView;
  if (!view) {
    fail(
      "unsupported_runtime",
      "browser_launch",
      "The render document has no browser identity.",
      "Use an attached browser document."
    );
  }
  const fontRecords = fonts.map((font) => ({ ...font })).sort((left, right) => compareCodeUnits(canonicalJson(left), canonicalJson(right)));
  const fontDigest = fontIdentity.resolutionDigest;
  const observed = observedRuntimeFacts(document2);
  const fingerprint = {
    contract: "docxodus-standalone-browser-v1",
    verification: "browserObserved",
    runtimeAssets,
    runtimeVersion,
    paginatorContractVersion: 1,
    pageMapSchemaVersion: 1,
    renderReportSchemaVersion: 2,
    layoutDigest,
    runtimePolicyDigest,
    fontConfigurationDigest: fontDigest,
    fonts: fontRecords,
    observed
  };
  return {
    rendererFingerprint: await canonicalMaterialDigest(
      "docxodus:renderer-fingerprint:v1",
      fingerprint
    ),
    observed,
    fontIdentity
  };
}
function reportPages(pageMap) {
  return pageMap.pages.map((page) => ({ ...page }));
}
function storyForAnchor(anchorId) {
  const first = anchorId.indexOf(":");
  const second = first < 0 ? -1 : anchorId.indexOf(":", first + 1);
  const scope = first >= 0 && second > first ? anchorId.slice(first + 1, second) : "body";
  if (scope.startsWith("hdr")) return "header";
  if (scope.startsWith("ftr")) return "footer";
  if (scope === "fn") return "footnote";
  if (scope === "en") return "endnote";
  if (scope === "cmt") return "comment";
  return "body";
}
function assertStandaloneResourceAudit(document2) {
  if (document2.querySelector(
    "script, iframe, object, embed, video, audio, source, track, link, base, meta[http-equiv='refresh' i]"
  )) {
    throw new Error("offline output contains active or external-loading content");
  }
  const meta = document2.querySelector(
    "meta[http-equiv='Content-Security-Policy' i]"
  );
  if (!meta || meta.content !== STANDALONE_CSP) {
    throw new Error("offline output CSP is missing or changed");
  }
  for (const element of Array.from(document2.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on")) throw new Error(`offline output retained ${attribute.name}`);
      if (name === "style") {
        const unsafe = cssSecurityTokens(attribute.value).find((token) => token.kind !== "url" || !automaticUrlAllowed(token.value, true));
        if (unsafe) throw new Error(`offline inline style retained ${unsafe.kind}`);
      }
      if (name === "srcset" && !standaloneSrcsetAllowed(attribute.value)) {
        throw new Error("offline output retained an unsafe srcset");
      }
      if (name === "href" && element.localName === "a") {
        const href = attribute.value.trim();
        if (!href.startsWith("#") && !/^(?:https?|mailto|tel):/i.test(href)) {
          throw new Error(`offline output retained unsafe hyperlink ${href}`);
        }
      } else if (name === "ping" && element.localName === "a") {
        throw new Error("offline output retained a hyperlink ping target");
      } else if (["src", "poster", "data", "action", "formaction", "background", "xlink:href", "href"].includes(name)) {
        const allowFragment = element.namespaceURI === "http://www.w3.org/2000/svg";
        if (!automaticUrlAllowed(attribute.value, allowFragment)) {
          throw new Error(`offline output retained automatic URL ${attribute.value}`);
        }
      }
    }
    if (element.localName === "style") {
      const unsafe = cssSecurityTokens(element.textContent ?? "").find((token) => token.kind !== "url" || !automaticUrlAllowed(token.value, true));
      if (unsafe) throw new Error(`offline stylesheet retained ${unsafe.kind}`);
    }
  }
}
async function verifyOfflineReopen(hostDocument, html, expectedPageMap, state) {
  const frame = await createIsolatedFrame(hostDocument, state, html, "output_verification");
  try {
    const reopened = frame.contentDocument;
    const pages = Array.from(reopened.querySelectorAll(".page-box"));
    await awaitFonts(reopened);
    const omitted = new Set(state.omittedVisualResourceIds);
    assertVisualResourcesIntact(
      await decodeImages(reopened),
      omitted,
      "embedded images"
    );
    assertVisualResourcesIntact(
      validateInlineSvg(reopened),
      omitted,
      "inline SVG elements"
    );
    await awaitStableTree(reopened, pages);
    countDomNodes(reopened, state.limits.domNodes, "output_verification");
    const resources = automaticResourceCount(reopened);
    enforceLimit(
      resources.count,
      state.limits.automaticResources,
      "automaticResources",
      "output_verification"
    );
    enforceLimit(
      resources.bytes,
      state.limits.automaticResourceBytes,
      "automaticResourceBytes",
      "output_verification"
    );
    assertStandaloneResourceAudit(reopened);
    if (pages.length !== expectedPageMap.pages.length) {
      throw new Error(`offline page count changed (${pages.length} != ${expectedPageMap.pages.length})`);
    }
    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];
      const expected = expectedPageMap.pages[index];
      const rect = page.getBoundingClientRect();
      const widthPt = rect.width * 72 / 96;
      const heightPt = rect.height * 72 / 96;
      if (Math.abs(widthPt - expected.width) > 0.1 || Math.abs(heightPt - expected.height) > 0.1 || Number.parseInt(page.dataset.pageNumber ?? "0", 10) !== expected.pageNumber || Number.parseInt(page.dataset.pageInSection ?? "0", 10) !== expected.pageInSection || Number.parseInt(page.dataset.sectionIndex ?? "0", 10) !== expected.sectionIndex || reopened.defaultView.getComputedStyle(page).page !== expected.pageName) {
        throw new Error(`offline geometry changed on page ${expected.pageNumber}`);
      }
    }
    const actualFragments = [];
    const expectedByPageNumber = new Map(
      expectedPageMap.pages.map((candidate) => [candidate.pageNumber, candidate])
    );
    for (const page of pages) {
      const pageNumber = Number.parseInt(page.dataset.pageNumber ?? "0", 10);
      const expectedPage = expectedByPageNumber.get(pageNumber);
      if (!expectedPage) throw new Error(`offline output added page ${pageNumber}`);
      const pageRect = page.getBoundingClientRect();
      const pointPerRenderedX = expectedPage.width / pageRect.width;
      const pointPerRenderedY = expectedPage.height / pageRect.height;
      for (const element of Array.from(
        page.querySelectorAll("[data-source-anchor-id][data-page-fragment-id]")
      )) {
        const style = reopened.defaultView.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const { rect, visible } = measureRenderedSource(reopened.defaultView, element, page, pageRect);
        if (rect.width <= 0 || rect.height <= 0 || visible.right <= visible.left || visible.bottom <= visible.top) continue;
        const anchorId = element.dataset.sourceAnchorId;
        actualFragments.push({
          fragmentId: element.dataset.pageFragmentId,
          anchorId,
          fragmentIndex: Number.parseInt(element.dataset.fragmentIndex ?? "-1", 10),
          pageNumber,
          geometry: {
            x: (visible.left - pageRect.left) * pointPerRenderedX,
            y: (visible.top - pageRect.top) * pointPerRenderedY,
            width: (visible.right - visible.left) * pointPerRenderedX,
            height: (visible.bottom - visible.top) * pointPerRenderedY
          },
          story: storyForAnchor(anchorId),
          inTableCell: element.matches("td,th") || element.closest('td,th,[data-docx-frame-in-table-cell="true"]') !== null
        });
      }
    }
    if (actualFragments.length !== expectedPageMap.fragments.length) {
      throw new Error(
        `offline fragment inventory changed (${actualFragments.length} != ${expectedPageMap.fragments.length})`
      );
    }
    for (let index = 0; index < actualFragments.length; index++) {
      const actual = actualFragments[index];
      const expected = expectedPageMap.fragments[index];
      if (actual.fragmentId !== expected.fragmentId || actual.anchorId !== expected.anchorId || actual.fragmentIndex !== expected.fragmentIndex || actual.pageNumber !== expected.pageNumber || actual.story !== expected.story || actual.inTableCell !== expected.inTableCell || Math.abs(actual.geometry.x - expected.geometry.x) > 0.1 || Math.abs(actual.geometry.y - expected.geometry.y) > 0.1 || Math.abs(actual.geometry.width - expected.geometry.width) > 0.1 || Math.abs(actual.geometry.height - expected.geometry.height) > 0.1) {
        throw new Error(`offline PageMap fragment changed at index ${index}`);
      }
    }
  } finally {
    frame.remove();
  }
}
function reportBase(manifest, sourceBytes, derivedManifest, derivedBytes, options, layoutDigest, runtimePolicyDigest, state, fontIdentity) {
  return {
    schema: REPORT_SCHEMA,
    schemaVersion: 2,
    source: {
      rawPackageBytesDigest: manifest.rawPackageBytesDigest.value.toLowerCase(),
      byteLength: sourceBytes.byteLength,
      documentVersion: options.documentVersion
    },
    ...derivedManifest && derivedBytes ? {
      derivedProfileSource: {
        rawPackageBytesDigest: derivedManifest.rawPackageBytesDigest.value,
        byteLength: derivedBytes.byteLength
      }
    } : {},
    options: {
      reviewProfile: options.reviewProfile,
      reviewProfileAlreadyApplied: options.reviewProfileAlreadyApplied,
      ...presentationFields(options),
      commentProfile: options.commentProfile,
      title: options.title,
      outputs: ["html"],
      layoutDigest,
      runtimePolicyDigest,
      policy: {
        unsupportedContent: options.unsupportedContent,
        strictFonts: options.strictFonts,
        timeoutMs: options.timeoutMs,
        limits: { ...options.limits }
      }
    },
    readiness: state.readiness.map((outcome) => ({ ...outcome, pending: [...outcome.pending] })),
    fonts: state.fonts.map((font) => ({ ...font })),
    fontObservation: { status: "unavailable", reason: "browser_api_unavailable" },
    resources: state.resources.map((resource) => ({ ...resource })),
    unsupportedContent: state.unsupportedContent.map((outcome) => ({ ...outcome })),
    warnings: state.warnings.map((warning) => ({ ...warning })),
    ...fontIdentity ? { fontIdentity: { ...fontIdentity } } : {}
  };
}
function failureReport(manifest, sourceBytes, derivedManifest, derivedBytes, options, layoutDigest, runtimePolicyDigest, rendererFingerprint, observed, fontIdentity, state, error, pageMapWasMaterialized, htmlWasMaterialized, pages) {
  const unavailable = [];
  if (!rendererFingerprint) unavailable.push({
    field: "environment.rendererFingerprint",
    reasonCode: "notReached",
    detail: `Failure occurred during ${error.phase} before renderer identity completed.`
  });
  unavailable.push(
    {
      field: "bindings.pageMapDigest",
      reasonCode: pageMapWasMaterialized ? "discardedOnFailure" : "notReached",
      detail: pageMapWasMaterialized ? "The materialized PageMap is discarded because the render did not complete." : "PageMap materialization was not reached."
    },
    {
      field: "bindings.htmlDigest",
      reasonCode: htmlWasMaterialized ? "discardedOnFailure" : "notReached",
      detail: htmlWasMaterialized ? "The selected HTML payload is discarded because the render did not complete." : "Standalone HTML materialization was not reached."
    },
    {
      field: "bindings.pdfDigest",
      reasonCode: "notRequested",
      detail: "PDF output was not selected by the browser materializer."
    }
  );
  return {
    ...reportBase(
      manifest,
      sourceBytes,
      derivedManifest,
      derivedBytes,
      options,
      layoutDigest,
      runtimePolicyDigest,
      state,
      fontIdentity
    ),
    status: "failed",
    failure: {
      code: error.code,
      severity: "error",
      phase: error.phase,
      message: error.message,
      remediation: error.remediation,
      ...error.detail ? { detail: error.detail } : {},
      ...error.pending ? { pending: [...error.pending] } : {},
      ...error.partUri ? { partUri: error.partUri } : {},
      ...error.anchorId ? { anchorId: error.anchorId } : {},
      ...error.resource ? { resource: error.resource } : {}
    },
    ...rendererFingerprint && observed ? {
      environment: {
        rendererFingerprint,
        verification: "browserObserved",
        fidelityTier: "unbaselined",
        observed
      }
    } : {},
    ...pages ? { partial: { pages } } : {},
    unavailable
  };
}
function ensureTerminalReadiness(state, error) {
  const last = state.readiness.at(-1);
  if (last && last.status !== "complete") return;
  state.readiness.push({
    phase: error.phase,
    status: error.code === "operation_cancelled" ? "cancelled" : "failed",
    elapsedMs: 0,
    pending: error.pending ? [...error.pending] : []
  });
}
function asExportError(error, phase) {
  if (error instanceof DocxodusExportError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const code = phase === "pagination" || phase === "running_story_placement" || phase === "page_tree_stability" ? "pagination_failure" : phase === "output_verification" ? "output_verification_failure" : "conversion_failure";
  return new DocxodusExportError(
    code,
    phase,
    message,
    "Inspect the render report and source document, then retry with supported content.",
    { cause: error }
  );
}
async function convertDocxToPaginatedHtml(document2, requestedOptions) {
  const options = normalizeOptions(requestedOptions);
  const startedAt = monotonicNow();
  const ownedOperationAbort = new AbortController();
  const sourcePromise = ownedBytes(
    document2,
    options.limits.compressedDocxBytes,
    options.signal
  );
  const state = {
    startedAt,
    deadline: startedAt + options.timeoutMs,
    phase: "input_validation",
    readiness: [],
    warnings: [],
    fonts: [],
    resources: [],
    omittedVisualResourceIds: [],
    unsupportedContent: [],
    limits: options.limits,
    signal: options.signal
  };
  let sourceBytes;
  let renderBytes;
  let derivedBytes;
  let worker;
  let frame;
  let manifest;
  let derivedManifest;
  let runtimeAssets;
  let runtimeVersion;
  let layoutDigest = "";
  let runtimePolicyDigest = "";
  let rendererFingerprint;
  let observed;
  let fontIdentity;
  let pageMapWasMaterialized = false;
  let htmlWasMaterialized = false;
  let pagesForFailure;
  try {
    sourceBytes = await runPhase(state, "input_validation", ["document bytes"], () => sourcePromise);
    if (sourceBytes.byteLength === 0) {
      fail(
        "invalid_document",
        "input_validation",
        "The DOCX input is empty.",
        "Pass a non-empty OPC package."
      );
    }
    layoutDigest = await layoutDigestForOptions(options);
    runtimeAssets = await runPhase(state, "wasm_initialization", ["runtime asset graph"], () => loadRuntimeAssetIdentity(options.wasmBasePath, ownedOperationAbort.signal));
    runtimePolicyDigest = await runtimePolicyDigestForOptions(options, runtimeAssets);
    worker = await runPhase(state, "wasm_initialization", ["WASM worker"], async () => {
      const created = await createWorkerDocxodus({
        wasmBasePath: options.wasmBasePath,
        signal: ownedOperationAbort.signal
      });
      if (ownedOperationAbort.signal.aborted || options.signal?.aborted || monotonicNow() >= state.deadline) {
        created.terminate();
      }
      return created;
    });
    runtimeVersion = await runPhase(state, "wasm_initialization", ["WASM runtime identity"], () => worker.getVersion());
    const manifestJson = await runPhase(state, "package_preflight", ["source package manifest"], () => worker.generatePackageManifestJson(sourceBytes, inspectionLimits(options)));
    manifest = validatePackageManifestJson(manifestJson);
    await preflightManifest(manifest, sourceBytes, options, state, true);
    renderBytes = sourceBytes;
    if (options.reviewProfile !== "markup" && !options.reviewProfileAlreadyApplied) {
      derivedBytes = await runPhase(
        state,
        "package_preflight",
        [`${options.reviewProfile} review-profile projection`],
        async () => {
          try {
            return await worker.projectReviewProfile(
              sourceBytes,
              options.reviewProfile,
              options.limits.compressedDocxBytes
            );
          } catch (error) {
            if (workerErrorCode(error) === "resource_limit") {
              fail(
                "resource_limit",
                "package_preflight",
                "The derived review-profile package exceeds compressedDocxBytes.",
                "Use a smaller document or remove revision history before export."
              );
            }
            throw error;
          }
        }
      );
      enforceLimit(
        derivedBytes.byteLength,
        options.limits.compressedDocxBytes,
        "compressedDocxBytes",
        "package_preflight"
      );
      const derivedManifestJson = await runPhase(
        state,
        "package_preflight",
        ["derived package manifest"],
        () => worker.generatePackageManifestJson(derivedBytes, inspectionLimits(options))
      );
      derivedManifest = validatePackageManifestJson(derivedManifestJson);
      await preflightManifest(derivedManifest, derivedBytes, options, state, false);
      if (derivedManifest.facts.revisions.total !== 0) {
        fail(
          "conversion_failure",
          "package_preflight",
          `The ${options.reviewProfile} projection retained native tracked revisions.`,
          "Report the projection defect; derived bytes must be fully accepted or rejected exactly once."
        );
      }
      if (manifest.facts.revisions.total > 0 && constantTimeDigestEqual(
        manifest.rawPackageBytesDigest.value,
        derivedManifest.rawPackageBytesDigest.value
      )) {
        fail(
          "conversion_failure",
          "package_preflight",
          `The ${options.reviewProfile} projection did not change revision-bearing package bytes.`,
          "Report the projection defect; changed review state requires a distinct derived identity."
        );
      }
      renderBytes = derivedBytes;
    }
    const convertedHtml = await runPhase(state, "docx_conversion", ["WASM conversion"], async () => {
      try {
        return await worker.convertDocxToHtml(
          renderBytes,
          conversionOptions(options),
          options.limits.htmlOutputBytes
        );
      } catch (error) {
        if (workerErrorCode(error) === "resource_limit") {
          fail(
            "resource_limit",
            "docx_conversion",
            "Converted HTML exceeds htmlOutputBytes before main-thread materialization.",
            "Use a smaller document or lower-complexity conversion profile."
          );
        }
        throw error;
      }
    });
    preflightConvertedHtml(convertedHtml, options);
    const attemptCheckpoint = checkpointAttemptState(state);
    const bodyBudgetReductionsPt = {};
    let bodyReflowRounds = 0;
    let finalized;
    let firstAttemptSignature;
    let firstAttemptFontIdentity;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        frame = await createIsolatedFrame(globalThis.document, state, bootstrapHtml(options.title));
        const renderDocument2 = frame.contentDocument;
        sanitizeConvertedDocument(renderDocument2, convertedHtml, state, options);
        inventoryConvertedContent(renderDocument2, state, options);
        const restoreStaging = revealMeasurementStaging(renderDocument2);
        try {
          const fontTask = createBrowserFontTask(renderDocument2, options.fontResolver, state.limits);
          await runPhase(state, "font_loading", fontTask.pending(), async () => {
            await awaitFonts(renderDocument2);
            const resolved = await fontTask.wait(ownedOperationAbort.signal).catch(rethrowBrowserFontError);
            recordFontResolution(resolved, state, options);
            if (resolved.identity.resolverDigest !== void 0) {
              if (attempt === 1) {
                firstAttemptFontIdentity = resolved.identity.resolverDigest;
              } else if (firstAttemptFontIdentity !== void 0 && firstAttemptFontIdentity !== resolved.identity.resolverDigest) {
                fail(
                  "resource_policy_failure",
                  "font_loading",
                  "The font resolver returned a different configuration for the second pristine attempt.",
                  "Return one deterministic resolution for an identical set of font requests."
                );
              }
            }
          });
        } finally {
          restoreStaging();
        }
        await runPhase(state, "image_decoding", ["embedded images"], async () => {
          identifyVisualResources(renderDocument2);
          admitVisualResourceFailures(
            state,
            options,
            await decodeImages(renderDocument2),
            "image",
            {
              code: "image_decode_failed",
              phase: "image_decoding",
              message: "An embedded image did not decode and will print as empty space.",
              remediation: "Re-encode the image in a browser-supported format, or use unsupportedContent: strict to reject the document."
            }
          );
        });
        await runPhase(state, "chart_svg_materialization", ["inline SVG"], () => {
          admitVisualResourceFailures(
            state,
            options,
            validateInlineSvg(renderDocument2),
            "svg",
            {
              code: "chart_svg_unmeasurable",
              phase: "chart_svg_materialization",
              message: "An inline SVG has neither a viewBox nor explicit dimensions and cannot be laid out.",
              remediation: "Give the SVG a viewBox or explicit width and height, or use unsupportedContent: strict to reject the document."
            }
          );
        });
        const staging = renderDocument2.getElementById("pagination-staging");
        const container = renderDocument2.getElementById("pagination-container");
        if (!staging || !container) {
          fail(
            "conversion_failure",
            "docx_conversion",
            "Paginated conversion did not produce staging and page containers.",
            "Use the paginated converter contract and report the malformed conversion output."
          );
        }
        scopeMarkupBalloons(renderDocument2, [staging, container], options.commentColumnPlacement === "balloons");
        const restoreTextMeasurement = revealMeasurementStaging(renderDocument2);
        try {
          prepareSectionTextWidths(renderDocument2.body);
          prepareMixedLineHeights(staging, () => checkpointWordText(state));
          applyUnroundedNormalLineHeights(renderDocument2.body);
          prepareFitText(renderDocument2.body, () => checkpointWordText(state));
          prepareWordText(renderDocument2.body, () => checkpointWordText(state), "body");
          prepareParagraphBorders(renderDocument2.body);
          prepareTableBorders(renderDocument2.body);
        } finally {
          restoreTextMeasurement();
        }
        const prepareFootnotes = createFootnoteTextPreparer(
          staging.querySelector("#pagination-footnote-registry"),
          () => checkpointWordText(state)
        );
        const engine2 = new PaginationEngine(staging, container, {
          scale: 1,
          cssPrefix: "page-",
          showPageNumbers: false,
          pageGap: 0,
          fragmentParagraphs: true,
          prepareTableFragment: refreshTableBorderLayout,
          prepareTableText: (section) => prepareWordText(section, () => checkpointWordText(state), "tables"),
          prepareStoryText: (story) => prepareWordText(story, () => checkpointWordText(state), "running"),
          prepareFootnoteText: (note) => {
            if (!prepareFootnotes(note)) fail(
              "pagination_failure",
              "pagination",
              "Scaled footnote text cannot fit its continuation page width.",
              "Use a consistent note width or report the source document to Docxodus."
            );
          },
          commentOverflow: "appendix",
          // Running-story placement below changes the visible fragment set, and this path always
          // restamps through normalizePageMapFragmentIdentities(); stamping inside paginate()
          // would be a second full forced-layout pass whose result is immediately overwritten.
          deferFragmentIdentities: true,
          ...options.commentColumnPlacement === "balloons" ? {
            commentColumnPlacement: "balloons",
            balloonOverflow: options.balloonOverflow,
            markupMode: options.markupMode,
            deferMarkupBalloons: true
          } : {},
          bodyBudgetReductionsPt,
          checkCancellation: () => {
            if (state.signal?.aborted) {
              fail(
                "operation_cancelled",
                state.phase,
                `Export was cancelled during ${state.phase}.`,
                "Retry with a non-aborted signal.",
                { pending: ["page layout"] }
              );
            }
            if (monotonicNow() >= state.deadline) {
              fail(
                "readiness_timeout",
                state.phase,
                `Export timed out during ${state.phase}.`,
                "Increase timeoutMs or reduce document layout complexity.",
                { detail: "cooperative pagination checkpoint", pending: ["page layout"] }
              );
            }
          },
          checkPageCount: (prospectivePageCount) => {
            enforceLimit(
              prospectivePageCount,
              options.limits.finalPages,
              "finalPages",
              "pagination"
            );
          }
        });
        const pagination = await runPhase(state, "pagination", ["page layout"], () => engine2.paginate());
        inventoryUnsupportedContent(Array.from(container.querySelectorAll(
          "[data-docx-frame-pending][data-content-type]"
        )), state, options, "pagination");
        enforceLimit(pagination.totalPages, options.limits.finalPages, "finalPages", "pagination");
        const pages2 = pagination.pages.map((page) => page.element);
        if (pages2.length === 0) {
          fail(
            "pagination_failure",
            "pagination",
            "Pagination produced no pages.",
            "Verify that the DOCX has a renderable main document body."
          );
        }
        const clippedPages = await runPhase(
          state,
          "running_story_placement",
          ["headers, footers, and notes"],
          () => {
            finalizePageTree(renderDocument2, pages2, state, options);
            engine2.normalizePageMapFragmentIdentities();
            const clipped = findClippedContent(renderDocument2);
            if (clipped.length > 0 && bodyReflowRounds >= MAX_BODY_REFLOW_ROUNDS) {
              fail(
                "pagination_failure",
                "running_story_placement",
                clipped[0].message,
                "Split the oversized block or reduce its dimensions before export."
              );
            }
            return clipped;
          }
        );
        if (clippedPages.length > 0) {
          bodyReflowRounds++;
          for (const page of clippedPages) {
            bodyBudgetReductionsPt[page.pageNumber] = (bodyBudgetReductionsPt[page.pageNumber] ?? 0) + (page.overflowPx + 1) * 72 / 96;
          }
          throw new BodyReflowRequest();
        }
        countDomNodes(renderDocument2, options.limits.domNodes, "running_story_placement");
        const automaticResources = automaticResourceCount(renderDocument2);
        enforceLimit(
          automaticResources.count,
          options.limits.automaticResources,
          "automaticResources",
          "running_story_placement"
        );
        enforceLimit(
          automaticResources.bytes,
          options.limits.automaticResourceBytes,
          "automaticResourceBytes",
          "running_story_placement"
        );
        const stableSignature = await runPhase(state, "page_tree_stability", ["fixed page tree"], () => awaitStableTree(renderDocument2, pages2));
        if (attempt === 1) {
          firstAttemptSignature = stableSignature;
          frame.remove();
          frame = void 0;
          restoreAttemptState(state, attemptCheckpoint);
          continue;
        }
        if (!firstAttemptSignature || firstAttemptSignature !== stableSignature) {
          throw new PageTreeInstabilityError(
            "Two layouts created from the same pristine converted HTML produced different final page trees"
          );
        }
        finalized = { frame, document: renderDocument2, engine: engine2, pages: pages2 };
        break;
      } catch (error) {
        frame?.remove();
        frame = void 0;
        if (error instanceof BodyReflowRequest) {
          restoreAttemptState(state, attemptCheckpoint);
          firstAttemptSignature = void 0;
          attempt = 0;
          continue;
        }
        if (!(error instanceof PageTreeInstabilityError) || attempt === 2) throw error;
        restoreAttemptState(state, attemptCheckpoint);
        addWarning(state, {
          code: "page_tree_retry",
          severity: "warning",
          phase: "page_tree_stability",
          message: "The finalized page tree changed during its quiet interval and was rebuilt from pristine converted HTML.",
          remediation: "No action is required unless repeated exports fail page-tree stability."
        });
      }
    }
    if (!finalized) {
      fail(
        "pagination_failure",
        "page_tree_stability",
        "The final page tree did not stabilize within two attempts.",
        "Remove asynchronous layout inputs or report the source document to Docxodus."
      );
    }
    frame = finalized.frame;
    const { document: renderDocument, engine, pages } = finalized;
    for (const block of Array.from(renderDocument.querySelectorAll("#pagination-container [data-docx-column-table-deferred]"))) {
      const anchorId = block.querySelector("table [data-source-anchor-id]")?.getAttribute("data-source-anchor-id") ?? void 0;
      policyWarning(state, options, {
        code: "column_table_page_remainder",
        phase: "pagination",
        message: "A multi-column block containing a table moved intact to the next page. Splitting table content to use the remaining page area is not supported.",
        remediation: "Use a single-column section or review the page breaks before publication.",
        partUri: derivedManifest?.facts.mainDocumentUri ?? manifest.facts.mainDocumentUri ?? void 0,
        ...anchorId ? { anchorId } : {}
      });
    }
    for (const spacer of Array.from(renderDocument.querySelectorAll("#pagination-container [data-docx-relaxed-clearance]"))) {
      policyWarning(state, options, {
        code: "drawing_clearance_relaxed",
        phase: "output_verification",
        anchorId: spacer.closest("[data-source-anchor-id]")?.dataset.sourceAnchorId,
        message: "A drawing's top/bottom text clearance cannot fit a page and was relaxed; its authored size and placement are retained.",
        remediation: "Reduce the drawing's extent or wrapping distance to reserve text clearance on a page."
      });
    }
    alignBaselinesToWord(renderDocument.body);
    preserveClippedExactRowText(renderDocument.body);
    await runPhase(state, "output_verification", ["Word text baselines"], () => paintWordText(
      renderDocument.getElementById("pagination-container"),
      () => checkpointWordText(state)
    ));
    await runPhase(state, "output_verification", ["paragraph borders"], () => paintParagraphBorders(renderDocument.getElementById("pagination-container")));
    await runPhase(state, "output_verification", ["table borders"], () => paintTableBorders(renderDocument.getElementById("pagination-container")));
    const balloons = await runPhase(state, "output_verification", ["markup balloons"], () => engine.layoutMarkupBalloons());
    for (const { element } of balloons?.appendedPages ?? []) {
      releasePageBox(element);
      namePageForPrint(element);
      pages.push(element);
    }
    if (balloons && balloons.unplacedCommentIds.length > 0) {
      fail(
        "output_verification_failure",
        "output_verification",
        `Comments ${balloons.unplacedCommentIds.join(", ")} are marked in the document but got no balloon.`,
        "Report the source document to Docxodus, or export with the margin placement."
      );
    }
    if (balloons && (balloons.truncatedCommentIds.length > 0 || balloons.truncatedFormatting > 0)) {
      addWarning(state, {
        code: "comment_balloon_truncated",
        severity: "warning",
        phase: "output_verification",
        message: `Balloons too many to fit beside their page were cut short: ${balloons.truncatedCommentIds.length} comment(s) and ${balloons.truncatedFormatting} formatting change(s).` + (balloons.appendedPages.length > 0 ? " The cut comments are printed in full after the last page." : ""),
        remediation: [
          balloons.truncatedCommentIds.length > 0 && options.balloonOverflow !== "appendix" ? "Use balloonOverflow appendix, or the margin placement with the endnotes comment profile, to print every comment in full." : "",
          balloons.truncatedFormatting > 0 ? "Use the margin placement to print every formatting change in full." : ""
        ].filter(Boolean).join(" "),
        ...balloons.truncatedCommentIds.length > 0 ? { resource: balloons.truncatedCommentIds.join(",") } : {}
      });
    }
    const renderer = await runPhase(state, "output_verification", ["renderer identity"], () => rendererIdentity(
      renderDocument,
      layoutDigest,
      runtimePolicyDigest,
      runtimeAssets,
      runtimeVersion,
      state.fonts,
      state.fontIdentity
    ));
    rendererFingerprint = renderer.rendererFingerprint;
    observed = renderer.observed;
    fontIdentity = renderer.fontIdentity;
    const pageMap = await runPhase(state, "output_verification", ["PageMap geometry"], () => engine.materializePageMap(options.documentVersion, rendererFingerprint));
    for (const anchorId of engine.getSourceClippedTextAnchors()) {
      policyWarning(state, options, {
        code: "source_text_clipped",
        phase: "output_verification",
        anchorId,
        message: "A source paragraph is wholly outside its authored text-box clip or paper placement and is not painted.",
        remediation: "Move an off-paper text box onto the page; for internal overflow, enlarge the box or enable auto-fit."
      });
    }
    for (const anchorId of engine.getLinkedTextBoxOverflowAnchors()) {
      policyWarning(state, options, {
        code: "linked_textbox_overflow",
        phase: "output_verification",
        anchorId,
        message: "A linked text-box story does not fit its frames. From this paragraph on, its text is hidden in the last frame, as Word hides it.",
        remediation: "Enlarge the linked text boxes, add a frame to the chain, or shorten the story."
      });
    }
    for (const anchorId of engine.getClippedTableContentAnchors()) {
      policyWarning(state, options, {
        code: "source_table_content_clipped",
        phase: "output_verification",
        anchorId,
        message: "Content in an authored fixed-width table extends beyond the paper edge and is clipped.",
        remediation: "Reduce the source table width or adjust its placement or page size to keep its content on paper."
      });
    }
    pageMapWasMaterialized = true;
    if (pageMap.documentVersion !== options.documentVersion || pageMap.rendererFingerprint !== rendererFingerprint || pageMap.pages.length !== pages.length) {
      fail(
        "output_verification_failure",
        "output_verification",
        "PageMap identity does not match the finalized render.",
        "Report the materializer defect; artifact identity fields must agree exactly."
      );
    }
    const pageNumbers = /* @__PURE__ */ new Set();
    for (const [index, page] of pageMap.pages.entries()) {
      if (page.pageNumber !== index + 1 || pageNumbers.has(page.pageNumber) || !Number.isInteger(page.pageInSection) || page.pageInSection < 1 || page.sectionIndex === void 0 || !Number.isInteger(page.sectionIndex) || page.sectionIndex < 0 || typeof page.pageName !== "string" || page.pageName.length === 0 || !Number.isFinite(page.width) || page.width <= 0 || !Number.isFinite(page.height) || page.height <= 0) {
        fail(
          "output_verification_failure",
          "output_verification",
          `PageMap page ${index} violates the finalized page invariants.`,
          "Report the materializer defect; page identities and geometry must be finite and contiguous."
        );
      }
      pageNumbers.add(page.pageNumber);
    }
    const fragmentIds = /* @__PURE__ */ new Set();
    const nextFragmentIndex = /* @__PURE__ */ new Map();
    for (const [index, fragment] of pageMap.fragments.entries()) {
      const page = pageMap.pages[fragment.pageNumber - 1];
      const expectedIndex = nextFragmentIndex.get(fragment.anchorId) ?? 0;
      const geometry = fragment.geometry;
      if (!page || fragmentIds.has(fragment.fragmentId) || fragment.fragmentId !== `p${fragment.pageNumber}-f${fragment.fragmentIndex}-${fragment.anchorId}` || fragment.fragmentIndex !== expectedIndex || !Object.values(geometry).every((value) => Number.isFinite(value) && value >= 0) || geometry.x + geometry.width > page.width + 0.1 || geometry.y + geometry.height > page.height + 0.1) {
        fail(
          "output_verification_failure",
          "output_verification",
          `PageMap fragment ${index} violates the visible-fragment invariants.`,
          "Report the materializer defect; fragments must be unique, ordered, visible, and page-bounded."
        );
      }
      fragmentIds.add(fragment.fragmentId);
      nextFragmentIndex.set(fragment.anchorId, expectedIndex + 1);
    }
    pagesForFailure = reportPages(pageMap);
    const pageMapJson = canonicalJson(pageMap);
    enforceLimit(
      utf8ByteLength(pageMapJson),
      options.limits.pageMapOutputBytes,
      "pageMapOutputBytes",
      "output_verification"
    );
    const pageMapDigest = await runPhase(state, "output_verification", ["PageMap digest"], () => sha2562(utf8Bytes(pageMapJson)));
    const html = serializeDocument(renderDocument);
    htmlWasMaterialized = true;
    enforceLimit(
      utf8ByteLength(html),
      options.limits.htmlOutputBytes,
      "htmlOutputBytes",
      "output_verification"
    );
    await runPhase(state, "output_verification", ["offline reopen"], () => verifyOfflineReopen(globalThis.document, html, pageMap, state));
    const htmlDigest = await runPhase(state, "output_verification", ["HTML digest"], () => sha2562(utf8Bytes(html)));
    const report = {
      ...reportBase(
        manifest,
        sourceBytes,
        derivedManifest,
        derivedBytes,
        options,
        layoutDigest,
        runtimePolicyDigest,
        state,
        fontIdentity
      ),
      status: "complete",
      fontIdentity,
      environment: {
        rendererFingerprint,
        verification: "browserObserved",
        fidelityTier: "unbaselined",
        observed
      },
      pages: pagesForFailure,
      bindings: {
        pageMapDigest,
        htmlDigest,
        artifactRequestIds: []
      }
    };
    enforceLimit(
      utf8ByteLength(canonicalJson(report)),
      options.limits.renderReportOutputBytes,
      "renderReportOutputBytes",
      "output_verification"
    );
    return {
      html,
      pageCount: pages.length,
      pageMap,
      renderReport: report,
      warnings: report.warnings,
      rendererFingerprint
    };
  } catch (error) {
    const resolved = asExportError(error, state.phase);
    ensureTerminalReadiness(state, resolved);
    if (manifest && sourceBytes) {
      resolved.report = failureReport(
        manifest,
        sourceBytes,
        derivedManifest,
        derivedBytes,
        options,
        layoutDigest,
        runtimePolicyDigest,
        rendererFingerprint,
        observed,
        fontIdentity,
        state,
        resolved,
        pageMapWasMaterialized,
        htmlWasMaterialized,
        pagesForFailure
      );
      if (utf8ByteLength(canonicalJson(resolved.report)) > options.limits.renderReportOutputBytes) {
        resolved.report = void 0;
      }
    }
    throw resolved;
  } finally {
    state.phase = "cleanup";
    ownedOperationAbort.abort();
    frame?.remove();
    worker?.terminate();
  }
}
export {
  DEFAULT_EXPORT_RESOURCE_LIMITS,
  DEFAULT_EXPORT_TIMEOUT_MS,
  DocxodusExportError,
  FONT_REQUEST_ATTRIBUTE,
  FONT_RESOLVER_CONTRACT_ID,
  FONT_RESOLVER_SCHEMA_VERSION,
  FONT_SUBSTITUTION_CONTRACT,
  FONT_SUBSTITUTION_CONTRACT_MATERIAL,
  FONT_SUBSTITUTION_CONTRACT_VERSION,
  HARD_EXPORT_RESOURCE_LIMITS,
  HARD_EXPORT_TIMEOUT_MS,
  attestHostVerifiedRuntimeAssets,
  canonicalJson,
  convertDocxToPaginatedHtml,
  fontFamilyKey,
  inventoryDocumentFontRequests,
  normalizeFontFamilyName,
  normalizeMarkupVisibility,
  parseCssFontFamily,
  reconstructDocxodusExportError,
  renderedSourceMeasurerExpression
};
