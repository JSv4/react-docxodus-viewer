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
    const result = {};
    for (const key of Object.keys(value).sort()) {
      assertWellFormedUnicode(key);
      const member = value[key];
      if (member !== void 0) result[key] = canonicalValue(member);
    }
    return result;
  }
  throw new TypeError(`Canonical JSON does not support ${typeof value}`);
}
function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
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
function pxToPt(px) {
  return px * 0.75;
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

// src/pagination.ts
function samePageBox(a, b) {
  return a.pageWidth === b.pageWidth && a.pageHeight === b.pageHeight && a.marginTop === b.marginTop && a.marginRight === b.marginRight && a.marginBottom === b.marginBottom && a.marginLeft === b.marginLeft;
}
var MAX_FOOTNOTE_AREA_RATIO = 0.6;
var FOOTNOTE_MEASUREMENT_GUARD_PT = 2;
var FOOTNOTE_SOURCE_POSITION_ATTR = "data-pagination-footnote-source-position";
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
    this.footnoteLayoutLikeWord8 = false;
    this.pendingFootnoteContinuation = null;
    /** Per-section `w:pgNumType` (start / format), read off the section wrappers. */
    this.pageNumbering = /* @__PURE__ */ new Map();
    this.lastPages = [];
    this.expectedPageMapAnchorIds = /* @__PURE__ */ new Set();
    this.state = "ready";
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
    this.fragmentParagraphs = options.fragmentParagraphs ?? false;
    this.deferFragmentIdentities = options.deferFragmentIdentities ?? false;
    this.cancellationCheckpoint = options.checkCancellation;
    this.pageCountCheckpoint = options.checkPageCount;
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
      const pages = [];
      let pageNumber = 1;
      this.hfRegistry = this.parseHeaderFooterRegistry();
      this.footnoteRegistry = this.parseFootnoteRegistry();
      ({
        normal: this.footnoteSeparator,
        continuation: this.footnoteContinuationSeparator
      } = this.parseFootnoteSeparators());
      this.commentMarginRegistry = this.parseCommentMarginRegistry();
      this.footnoteLayoutLikeWord8 = this.stagingElement.dataset.footnoteLayoutLikeWord8 === "true";
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
        for (const section of run.sections) {
          this.checkpoint();
          const sectionIndex = parseInt(section.dataset.sectionIndex || "0", 10);
          const sectionDims = run.sectionDimensions.get(sectionIndex) ?? run.dims;
          section.style.width = `${sectionDims.contentWidth}pt`;
          const columnCount = parseInt(section.dataset.cols || "1", 10);
          if (columnCount > 1) {
            const gap = parseFloat(section.dataset.colGap || "");
            blocks.push(...this.buildColumnBlocks(
              section,
              sectionDims,
              sectionIndex,
              columnCount,
              Number.isFinite(gap) ? gap : 36
            ));
          } else {
            blocks.push(...this.measureBlocks(section, sectionDims, sectionIndex));
          }
        }
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
      this.stagingElement.style.display = "none";
      this.substitutePageNumberFields(pages.length);
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
        if (header) this.collectExpectedSourceAnchors(header, this.expectedPageMapAnchorIds);
        if (footer) this.collectExpectedSourceAnchors(footer, this.expectedPageMapAnchorIds);
      }
      this.qualifyPageFragments(pages);
      this.transferVisibleFragmentTargets();
      if (!this.deferFragmentIdentities) this.normalizeVisiblePageFragments(pages);
      this.lastPages = pages;
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
  checkpoint() {
    this.cancellationCheckpoint?.();
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
    if (requiredAnchorIds.size === 0) {
      throw new Error("cannot publish an available PageMap without canonical source inventory");
    }
    const measuredAnchorIds = /* @__PURE__ */ new Set();
    const emittedFragmentCounts = /* @__PURE__ */ new Map();
    for (const page of this.lastPages) {
      this.checkpoint();
      const pageRect = page.element.getBoundingClientRect();
      if (pageRect.width <= 0 || pageRect.height <= 0) {
        throw new Error(`page ${page.pageNumber} has no measurable geometry`);
      }
      const pointPerRenderedX = page.dimensions.pageWidth / pageRect.width;
      const pointPerRenderedY = page.dimensions.pageHeight / pageRect.height;
      const nodes = page.element.querySelectorAll("[data-source-anchor-id]");
      for (const element of Array.from(nodes)) {
        this.checkpoint();
        if (this.isDeliberatelyUnrenderedSource(element, page.element)) continue;
        const anchorId = element.dataset.sourceAnchorId;
        if (!anchorId || !element.dataset.pageFragmentId || !Number.isInteger(parseInt(element.dataset.fragmentIndex || "", 10))) {
          throw new Error(`page ${page.pageNumber} contains an unqualified source anchor`);
        }
        const rect = element.getBoundingClientRect();
        const style = this.view.getComputedStyle(element);
        const deliberatelyHidden = style.display === "none" || style.visibility === "hidden";
        if (deliberatelyHidden) continue;
        requiredAnchorIds.add(anchorId);
        const visibleRect = this.intersectWithClippingAncestors(element, page.element, pageRect, rect);
        const left = visibleRect.left;
        const top = visibleRect.top;
        const right = visibleRect.right;
        const bottom = visibleRect.bottom;
        if (rect.width <= 0 || rect.height <= 0 || right <= left || bottom <= top) {
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
          inTableCell: element.matches("td,th") || element.closest("td,th") !== null
        });
      }
    }
    const missingAnchor = Array.from(requiredAnchorIds).find((id) => !measuredAnchorIds.has(id));
    if (missingAnchor) {
      throw new Error(`source anchor ${missingAnchor} has no measurable fragment in the paginated layout`);
    }
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
        const rect = element.getBoundingClientRect();
        const visible = this.intersectWithClippingAncestors(element, page.element, pageRect, rect);
        if (rect.width <= 0 || rect.height <= 0 || visible.right <= visible.left || visible.bottom <= visible.top) continue;
        const fragmentIndex = emittedFragmentCounts.get(anchorId) ?? 0;
        emittedFragmentCounts.set(anchorId, fragmentIndex + 1);
        element.dataset.pageNumber = String(page.pageNumber);
        element.dataset.fragmentIndex = String(fragmentIndex);
        element.dataset.pageFragmentId = `p${page.pageNumber}-f${fragmentIndex}-${anchorId}`;
      }
    }
  }
  /**
   * Intersect an element with every ancestor that establishes an overflow clip before the page
   * root. getBoundingClientRect() reports layout outside those clips, which is not rendered and
   * therefore must not satisfy PageMap completeness or inflate portable geometry.
   */
  intersectWithClippingAncestors(element, page, pageRect, rect) {
    let left = Math.max(rect.left, pageRect.left);
    let top = Math.max(rect.top, pageRect.top);
    let right = Math.min(rect.right, pageRect.right);
    let bottom = Math.min(rect.bottom, pageRect.bottom);
    const clips = (value) => value === "hidden" || value === "clip" || value === "scroll" || value === "auto";
    for (let ancestor = element.parentElement; ancestor && ancestor !== page; ancestor = ancestor.parentElement) {
      const style = this.view.getComputedStyle(ancestor);
      const clipsX = clips(style.overflowX);
      const clipsY = clips(style.overflowY);
      if (!clipsX && !clipsY) continue;
      const ancestorRect = ancestor.getBoundingClientRect();
      if (clipsX) {
        left = Math.max(left, ancestorRect.left);
        right = Math.min(right, ancestorRect.right);
      }
      if (clipsY) {
        top = Math.max(top, ancestorRect.top);
        bottom = Math.min(bottom, ancestorRect.bottom);
      }
    }
    return { left, top, right, bottom };
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
    const candidates = source.matches("[data-source-anchor-id]") ? [source] : [];
    candidates.push(...Array.from(source.querySelectorAll("[data-source-anchor-id]")));
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
      const anchorId = element.dataset.sourceAnchorId;
      if (anchorId) destination.add(anchorId);
    }
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
   * Runs after layout because NUMPAGES cannot be known before the last page exists. The
   * substituted text can therefore be marginally wider than the cached result the header was
   * measured with; the header band clips, so the failure mode is a hair of overflow rather than
   * a layout that disagrees with itself.
   *
   * Scoped to the CLONED header/footer regions on purpose. A page-number field in body text is
   * ordinary run content that the editor may make editable, and committing an edited block writes
   * back whatever text the DOM holds — rewriting it here would mean a body field commits a number
   * the document never contained. Body content is also not cloned, so it does not have the problem
   * this method exists to solve.
   */
  substitutePageNumberFields(totalPages) {
    const boxes = this.containerElement.querySelectorAll(`.${this.cssPrefix}box`);
    for (const box of Array.from(boxes)) {
      const markers = box.querySelectorAll(
        `.${this.cssPrefix}header [data-field], .${this.cssPrefix}footer [data-field]`
      );
      if (markers.length === 0) continue;
      const sectionIndex = parseInt(box.dataset.sectionIndex || "0", 10);
      const pageNumber = parseInt(box.dataset.pageNumber || "1", 10);
      const numbering = this.pageNumbering.get(sectionIndex) ?? {};
      const displayed = parseInt(box.dataset.displayedPageNumber || String(pageNumber), 10);
      for (const marker of Array.from(markers)) {
        const kind = marker.dataset.field;
        if (kind !== "PAGE" && kind !== "NUMPAGES") continue;
        const format = marker.dataset.fieldFormat ?? numbering.format;
        marker.textContent = formatPageNumber(kind === "PAGE" ? displayed : totalPages, format);
      }
    }
  }
  /**
   * Measures all content blocks in a section.
   */
  measureBlocks(section, dims, sectionIndex) {
    const blocks = [];
    const children = Array.from(section.children);
    for (const child of children) {
      this.checkpoint();
      if (child.dataset.sectionIndex !== void 0) {
        const nestedSectionIndex = parseInt(child.dataset.sectionIndex || String(sectionIndex), 10);
        const nestedBlocks = this.measureBlocks(child, dims, nestedSectionIndex);
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
      const rect = child.getBoundingClientRect();
      const style = this.view.getComputedStyle(child);
      const marginTopPx = parseFloat(style.marginTop) || 0;
      const marginBottomPx = parseFloat(style.marginBottom) || 0;
      const heightPt = pxToPt(rect.height);
      const marginTopPt = pxToPt(marginTopPx);
      const marginBottomPt = pxToPt(marginBottomPx);
      const isPageBreak = child.dataset.pageBreak === "true" || child.classList.contains(`${this.cssPrefix}break`);
      blocks.push({
        element: child,
        sectionIndex,
        heightPt,
        marginTopPt,
        marginBottomPt,
        keepWithNext: child.dataset.keepWithNext === "true",
        keepLines: child.dataset.keepLines === "true",
        pageBreakBefore: child.dataset.pageBreakBefore === "true",
        isPageBreak,
        isWordParagraph: this.isWordParagraphElement(child)
      });
    }
    return blocks;
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
      if (blocks.length === 0) clonedRule.style.marginTop = sectionStyle.marginTop;
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
        clone.style.fontSize ||= sectionStyle.fontSize;
        clone.style.lineHeight ||= sectionStyle.lineHeight;
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
          const value = parseInt(item.getAttribute("value") || String(itemIndex + 1), 10);
          const marker = this.formatOrderedListMarker(
            Number.isFinite(value) ? value : itemIndex + 1,
            listStyle.listStyleType
          );
          clone.insertBefore(this.document.createTextNode(`${marker}. `), clone.firstChild);
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
   * a balanced `column-count` container reproduces that geometry, and the paginator
   * then places each container as one ordinary measured block. A container grows
   * greedily until its balanced height would exceed the smallest page body available
   * to the section, so a long columned section still splits across pages at block
   * boundaries. Each child lands in exactly one container, so anchors never
   * duplicate. An explicit page break child passes through as its own block, which
   * ends the current container and lets the normal flow logic turn the page.
   */
  buildColumnBlocks(section, dims, sectionIndex, columnCount, columnGapPt) {
    const children = Array.from(section.children);
    const blocks = [];
    const maxFragmentHeight = this.smallestEffectiveContentHeight(dims, sectionIndex);
    const isBreak = (child) => child.dataset.pageBreak === "true" || child.classList.contains(`${this.cssPrefix}break`);
    const makeContainer = (slice) => {
      const container = this.document.createElement("div");
      container.style.columnCount = String(columnCount);
      container.style.columnGap = `${columnGapPt}pt`;
      for (const child of slice) {
        container.appendChild(child.cloneNode(true));
      }
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
      let measured = this.measureElement(container, dims, sectionIndex);
      while (end < children.length && !isBreak(children[end])) {
        this.checkpoint();
        const candidate = makeContainer(children.slice(start, end + 1));
        const candidateMeasured = this.measureElement(candidate, dims, sectionIndex);
        if (candidateMeasured.heightPt > maxFragmentHeight) break;
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
  /**
   * Measures one element in the same hidden staging context used for the source blocks.
   * This is intentionally DOM-based: table row heights cannot be inferred from individual
   * rows because wrapping and collapsed borders change the height of a fragment.
   */
  measureElement(element, dims, sectionIndex) {
    const measurementHost = this.document.createElement("div");
    measurementHost.style.position = "absolute";
    measurementHost.style.visibility = "hidden";
    measurementHost.style.left = "-9999px";
    measurementHost.style.width = `${dims.contentWidth}pt`;
    const measuredElement = element.cloneNode(true);
    measurementHost.appendChild(measuredElement);
    this.stagingElement.appendChild(measurementHost);
    const rect = measuredElement.getBoundingClientRect();
    const style = this.view.getComputedStyle(measuredElement);
    const measured = {
      element,
      sectionIndex,
      heightPt: pxToPt(rect.height),
      marginTopPt: pxToPt(parseFloat(style.marginTop) || 0),
      marginBottomPt: pxToPt(parseFloat(style.marginBottom) || 0),
      keepWithNext: element.dataset.keepWithNext === "true",
      keepLines: element.dataset.keepLines === "true",
      pageBreakBefore: element.dataset.pageBreakBefore === "true",
      isPageBreak: element.dataset.pageBreak === "true" || element.classList.contains(`${this.cssPrefix}break`),
      isWordParagraph: this.isWordParagraphElement(element)
    };
    this.stagingElement.removeChild(measurementHost);
    return measured;
  }
  /**
   * Returns the contiguous keep-with-next chain beginning at a block.
   *
   * A hard page break or a page-break-before directive is stronger than a
   * keep-with-next directive, so it terminates the chain. The caller only
   * keeps a chain together when the whole chain can fit on a fresh page.
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
  measureKeepWithNextChainBodyHeight(chain, previousMarginBottomPt, isFirstOnPage, pageInSection) {
    const firstBlock = chain[0];
    if (!firstBlock) return 0;
    const firstMarginTop = this.effectiveBlockMarginTop(
      firstBlock,
      previousMarginBottomPt,
      isFirstOnPage,
      pageInSection
    );
    let bodyHeight = firstMarginTop + firstBlock.heightPt;
    for (let index = 1; index < chain.length; index++) {
      const previousBlock = chain[index - 1];
      const block = chain[index];
      bodyHeight += Math.max(previousBlock.marginBottomPt, block.marginTopPt) + block.heightPt;
    }
    return bodyHeight;
  }
  /** Word paragraphs render as `p`, or as `h1`–`h6` when their style has an outline level. */
  isWordParagraphElement(element) {
    return element.tagName === "P" || /^H[1-6]$/.test(element.tagName);
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
    if (this.shouldSuppressPageTopSpacing(block, isFirstOnPage, pageInSection)) {
      return 0;
    }
    return isFirstOnPage ? block.marginTopPt : Math.max(block.marginTopPt, previousMarginBottomPt) - previousMarginBottomPt;
  }
  /** Clone a source block with the same page-top spacing decision used by the height budget. */
  cloneBlockForPage(block, isFirstOnPage, pageInSection) {
    const clone = block.element.cloneNode(true);
    if (this.shouldSuppressPageTopSpacing(block, isFirstOnPage, pageInSection)) {
      clone.style.setProperty("margin-top", "0", "important");
    }
    return clone;
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
   * Complex table features are deliberately rejected by the caller: a split across
   * merged cells, nested tables, or footnotes cannot be made correct by cloning rows.
   */
  createSimpleTableFragment(wrapper, table, body, rows, retainAnchor) {
    const wrapperClone = wrapper.cloneNode(false);
    const tableClone = table.cloneNode(false);
    for (const child of Array.from(table.children)) {
      if (child !== body) {
        tableClone.appendChild(child.cloneNode(true));
      }
    }
    const bodyClone = body.cloneNode(false);
    for (const row of rows) {
      bodyClone.appendChild(row.cloneNode(true));
    }
    tableClone.appendChild(bodyClone);
    if (!retainAnchor) {
      wrapperClone.removeAttribute("data-anchor");
      tableClone.removeAttribute("data-anchor");
    }
    wrapperClone.appendChild(tableClone);
    return wrapperClone;
  }
  /**
   * Splits an oversized, ordinary table at row boundaries. This only participates
   * in the existing oversized-block fallback; unsupported tables keep the previous
   * overflow behavior rather than risking broken table semantics.
   */
  trySplitSimpleOversizedTable(block, dims, sectionIndex) {
    const wrapper = block.element;
    if (wrapper.tagName !== "DIV" || wrapper.children.length !== 1 || block.keepWithNext || block.keepLines || block.pageBreakBefore || block.isPageBreak) {
      return null;
    }
    const tableElement = wrapper.firstElementChild;
    if (!tableElement || tableElement.localName !== "table") {
      return null;
    }
    const table = tableElement;
    const body = table.tBodies.length === 1 ? table.tBodies[0] : null;
    if (!body || table.tHead || table.tFoot || body.rows.length < 2 || Array.from(table.children).some((child) => child !== body && child.tagName !== "COLGROUP") || table.querySelector("table, [rowspan], [colspan], [data-footnote-id]") || wrapper.querySelector("[data-footnote-id]")) {
      return null;
    }
    const rows = Array.from(body.rows);
    const minimumContentHeight = this.smallestEffectiveContentHeight(dims, sectionIndex);
    const maximumFragmentHeight = minimumContentHeight - block.marginTopPt - block.marginBottomPt;
    if (maximumFragmentHeight <= 0) {
      return null;
    }
    const groups = [];
    let start = 0;
    while (start < rows.length) {
      this.checkpoint();
      let end = start;
      while (end < rows.length) {
        this.checkpoint();
        const candidate = this.createSimpleTableFragment(
          wrapper,
          table,
          body,
          rows.slice(start, end + 1),
          start === 0
        );
        const measured = this.measureElement(candidate, dims, block.sectionIndex);
        if (measured.heightPt > maximumFragmentHeight) {
          break;
        }
        end++;
      }
      if (end === start) {
        return null;
      }
      groups.push(rows.slice(start, end));
      start = end;
    }
    if (groups.length < 2) {
      return null;
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
        isFirst
      );
      if (!isFirst) {
        fragment.style.setProperty("margin-top", "0", "important");
      }
      if (!isLast) {
        fragment.style.setProperty("margin-bottom", "0", "important");
      }
      const measured = this.measureElement(fragment, dims, block.sectionIndex);
      if (measured.heightPt + measured.marginTopPt + measured.marginBottomPt > minimumContentHeight) {
        return null;
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
   * DOM endpoints that can finish a paragraph fragment. The flattened UTF-16
   * offsets are checked against the browser's Unicode grapheme segmenter, so a
   * formatting-run boundary can never bisect a surrogate pair, combining
   * sequence, or joined emoji. NBSP/word-joiner boundaries remain indivisible.
   * PAGE/NUMPAGES field results are atomic because splitting their marker would
   * make later substitution duplicate or replace only half of the field.
   */
  paragraphFragmentEndpoints(paragraph, emergencyGraphemeBreaks = false) {
    const textNodes = [];
    const textStarts = /* @__PURE__ */ new Map();
    const lastTextByField = /* @__PURE__ */ new Map();
    const walker = this.document.createTreeWalker(paragraph, this.view.NodeFilter.SHOW_TEXT);
    const flattenedChunks = [];
    let flattenedLength = 0;
    let textNode;
    while (textNode = walker.nextNode()) {
      this.checkpoint();
      textStarts.set(textNode, flattenedLength);
      textNodes.push(textNode);
      flattenedChunks.push(textNode.data);
      flattenedLength += textNode.data.length;
      let field = textNode.parentElement?.closest("[data-field]") ?? null;
      while (field?.parentElement?.closest("[data-field]")) {
        field = field.parentElement.closest("[data-field]");
      }
      if (field && paragraph.contains(field)) lastTextByField.set(field, textNode);
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
      if (this.isNonBreakingTextBoundary(flattenedText, textOffset)) return;
      if (!this.isLegalParagraphLineBoundary(paragraph, flattenedText, textOffset)) return;
      if (graphemeBoundaries) {
        if (!graphemeBoundaries.has(textOffset)) return;
      } else if (!this.isConservativeFallbackTextBoundary(flattenedText, textOffset)) {
        return;
      }
      candidates.push(candidate);
    };
    for (const node of textNodes) {
      this.checkpoint();
      const start = textStarts.get(node);
      const atomic = node.parentElement?.closest(
        "[data-field], [data-list-marker], a[data-comment-id]"
      );
      if (atomic && paragraph.contains(atomic)) continue;
      const whitespace = /[\u0009-\u000D\u0020]+/g;
      let match;
      let matchesSinceCheckpoint = 0;
      while ((match = whitespace.exec(node.data)) !== null) {
        if (++matchesSinceCheckpoint % 256 === 0) this.checkpoint();
        const offset = match.index + match[0].length;
        addCandidate({ node, offset, textOffset: start + offset, priority: 0 });
      }
      addCandidate({
        node,
        offset: node.data.length,
        textOffset: start + node.data.length,
        priority: 0
      });
      if (emergencyGraphemeBreaks) {
        for (let offset = 1; offset < node.data.length; offset++) {
          if (offset % 256 === 0) this.checkpoint();
          addCandidate({
            node,
            offset,
            textOffset: start + offset,
            priority: -1
          });
        }
      }
    }
    for (const field of Array.from(paragraph.querySelectorAll("[data-field]"))) {
      this.checkpoint();
      if (field.parentElement?.closest("[data-field]")) continue;
      const last = lastTextByField.get(field);
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
   * Whether a range contains visible text after ignoring bidi/zero-width marks.
   * Paragraph fragmentation deliberately excludes non-textual descendants, so
   * this is enough to reject empty head or tail fragments.
   */
  hasVisibleFragmentText(fragment) {
    return this.hasVisibleText(fragment.textContent || "");
  }
  hasVisibleText(text) {
    return text.replace(/[\u200B-\u200F\uFEFF]/g, "").trim().length > 0;
  }
  /**
   * Phase one only handles text-like paragraph descendants. Objects, explicit
   * line breaks, list markers, notes, and out-of-flow/inline-block content all
   * require their own line-layout rules and retain the established whole-block
   * fallback instead of risking broken content or duplicate anchors.
   */
  canFragmentParagraph(block) {
    if (!this.fragmentParagraphs) {
      return false;
    }
    const paragraph = block.element;
    if (block.keepWithNext || block.keepLines || block.pageBreakBefore || block.isPageBreak || paragraph.dataset.widowControl === "true" || paragraph.hasAttribute("contenteditable")) {
      return false;
    }
    return this.canRangeFragmentParagraph(paragraph);
  }
  /**
   * Shared structural gate for body and note paragraph fragmentation. Footnote
   * first paragraphs are inline beside their marker, so that one known layout
   * context may opt into an inline root while retaining every descendant and
   * break-safety restriction used for body text.
   */
  canRangeFragmentParagraph(paragraph, allowInlineRoot = false) {
    if (paragraph.tagName !== "P" || paragraph.dataset.keepWithNext === "true" || paragraph.dataset.keepLines === "true" || paragraph.dataset.pageBreakBefore === "true" || paragraph.dataset.widowControl === "true" || paragraph.hasAttribute("contenteditable")) {
      return false;
    }
    const unsupportedDescendants = [
      "br",
      "img",
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
      "[data-footnote-id]",
      "[contenteditable]"
    ].join(", ");
    if (paragraph.querySelector(unsupportedDescendants)) {
      return false;
    }
    const isValidatedEndnote = paragraph.dataset.paginationSafeEndnote === "true";
    return isValidatedEndnote || this.hasRangeFragmentSafeLayout(paragraph, allowInlineRoot);
  }
  /**
   * A range clone preserves nested inline formatting exactly. Anything that establishes its own
   * box/layout context is deferred until a future fragmenter can model it accurately. Callers
   * must invoke this while the paragraph is attached to the styled document.
   */
  hasRangeFragmentSafeLayout(paragraph, allowInlineRoot = false) {
    const paragraphStyle = this.view.getComputedStyle(paragraph);
    if (paragraphStyle.display !== "block" && !(allowInlineRoot && paragraphStyle.display === "inline") || paragraphStyle.position !== "static" || paragraphStyle.float !== "none" || paragraphStyle.whiteSpace !== "normal" && paragraphStyle.whiteSpace !== "pre-wrap" || paragraphStyle.breakBefore !== "auto" || paragraphStyle.breakAfter !== "auto" || paragraphStyle.breakInside === "avoid" || paragraphStyle.pageBreakBefore !== "auto" || paragraphStyle.pageBreakAfter !== "auto" || paragraphStyle.pageBreakInside === "avoid") {
      return false;
    }
    for (const descendant of Array.from(paragraph.querySelectorAll("*"))) {
      const style = this.view.getComputedStyle(descendant);
      if (style.display !== "inline" || style.position !== "static" || style.float !== "none" || style.whiteSpace !== "normal" && style.whiteSpace !== "pre-wrap") {
        return false;
      }
    }
    return true;
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
    }
    if (!isFinalFragment) {
      fragment.style.setProperty("margin-bottom", "0", "important");
    }
    return fragment;
  }
  /**
   * Range clones repeat an inline ancestor when the split lands inside it. Keep
   * semantic wrappers (links, comments, formatting) on both sides, but retain a
   * duplicated HTML/editor identity only on the leading fragment. Targets that
   * occur wholly after the split are absent from `head` and remain on `tail`.
   */
  reconcileParagraphFragmentIdentities(head, tail) {
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
        if (this.hasVisibleFragmentText(lastContents)) {
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
        if (!this.hasVisibleFragmentText(headContents)) {
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
    tailRange.setStart(best.endpoint.node, best.endpoint.offset);
    tailRange.setEnd(paragraph, paragraph.childNodes.length);
    const tailContents = tailRange.cloneContents();
    if (!this.hasVisibleFragmentText(tailContents)) return { kind: "indivisible" };
    const tail = this.createParagraphFragment(paragraph, tailRange, false, true);
    this.reconcileParagraphFragmentIdentities(best.head, tail);
    return {
      kind: "split",
      head: best.head,
      tail
    };
  }
  /**
   * Splits a simple paragraph at the largest DOM Range endpoint that fits the
   * currently available body space. The caller then processes the tail normally,
   * allowing it to fragment again on later pages when necessary.
   */
  tryFragmentParagraph(block, dims, availableHeightPt, effectiveMarginTopPt) {
    if (!this.canFragmentParagraph(block) || availableHeightPt <= effectiveMarginTopPt) {
      return null;
    }
    const split = this.splitParagraphAtLargestFit(block.element, (head) => {
      const measured = this.measureElement(head, dims, block.sectionIndex);
      return effectiveMarginTopPt + measured.heightPt <= availableHeightPt;
    });
    if (split.kind !== "split") return null;
    const headMeasured = this.measureElement(split.head, dims, block.sectionIndex);
    const tailMeasured = this.measureElement(split.tail, dims, block.sectionIndex);
    return [
      {
        ...headMeasured,
        element: split.head,
        keepWithNext: false,
        keepLines: false,
        pageBreakBefore: false,
        isPageBreak: false
      },
      {
        ...tailMeasured,
        element: split.tail,
        keepWithNext: false,
        keepLines: false,
        pageBreakBefore: false,
        isPageBreak: false
      }
    ];
  }
  /**
   * Parses the header/footer registry from the staging element.
   * Also measures heights during parsing for lazy-loading compatibility.
   */
  parseHeaderFooterRegistry() {
    const registry = /* @__PURE__ */ new Map();
    const registryEl = this.stagingElement.querySelector("#pagination-hf-registry");
    if (!registryEl) return registry;
    const sectionWidths = /* @__PURE__ */ new Map();
    const sections = Array.from(this.stagingElement.querySelectorAll("[data-section-index]"));
    for (const section of sections) {
      const idx = parseInt(section.dataset.sectionIndex || "0", 10);
      const contentWidth = parseFloat(section.dataset.contentWidth || "") || DEFAULT_PAGE_WIDTH - 2 * DEFAULT_MARGIN;
      sectionWidths.set(idx, contentWidth);
    }
    const defaultContentWidth = sectionWidths.get(0) || DEFAULT_PAGE_WIDTH - 2 * DEFAULT_MARGIN;
    const entries = Array.from(registryEl.querySelectorAll("[data-section][data-hf-type]"));
    for (const entry of entries) {
      const sectionIndex = parseInt(entry.dataset.section || "0", 10);
      const hfType = entry.dataset.hfType;
      if (!registry.has(sectionIndex)) {
        registry.set(sectionIndex, {});
      }
      const section = registry.get(sectionIndex);
      const content = entry.cloneNode(true);
      const contentWidth = sectionWidths.get(sectionIndex) || defaultContentWidth;
      const measuredHeight = this.measureHeaderFooterHeight(content, contentWidth);
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
    for (const element of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
      element.removeAttribute("id");
      element.removeAttribute("data-anchor");
      element.removeAttribute("data-committed-text");
      element.removeAttribute("data-source-anchor-id");
      element.removeAttribute("data-page-fragment-id");
      element.removeAttribute("data-fragment-index");
      element.removeAttribute("data-footnote-id");
      element.removeAttribute("data-comment-id");
      element.removeAttribute("name");
      if (element instanceof this.view.HTMLAnchorElement && element.getAttribute("href")?.startsWith("#")) {
        element.removeAttribute("href");
      }
      element.setAttribute("contenteditable", "false");
    }
    container.appendChild(clone);
  }
  /** Parses the hidden source notes used to render paginated margin comments. */
  parseCommentMarginRegistry() {
    const registry = /* @__PURE__ */ new Map();
    const registryEl = this.stagingElement.querySelector(
      "#pagination-comment-margin-registry"
    );
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
   * those shells. Only the number and initial HTML/editor identities are
   * omitted. A hidden sentinel preserves `p:not(:first-of-type)` for a page
   * whose first carried element was a later source paragraph.
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
    const number = footnote.querySelector(".footnote-number");
    if (number) item.appendChild(number.cloneNode(true));
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
      return pxToPt(measureContainer.getBoundingClientRect().height);
    } finally {
      measureContainer.remove();
    }
  }
  /**
   * Partition a continuation for one page's note band, preferring complete children
   * and range-fragmenting an eligible paragraph when necessary. Always advances by
   * at least one element so an indivisible oversized paragraph follows the established
   * clipped fallback without trapping pagination in a loop.
   */
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
        const candidateHeight = pxToPt(measureContainer.getBoundingClientRect().height);
        if (candidateHeight <= availableHeightPt) {
          fitting.push(element);
          continue;
        }
        const canSplitCandidate = candidate.tagName === "P" && this.canRangeFragmentParagraph(candidate);
        candidate.remove();
        let split = null;
        if (canSplitCandidate) {
          split = this.splitParagraphAtLargestFit(candidate, (head) => {
            content.appendChild(head);
            try {
              return pxToPt(measureContainer.getBoundingClientRect().height) <= availableHeightPt;
            } finally {
              head.remove();
            }
          }, {
            // Both fallbacks below cut where ordinary line breaking would not,
            // so they are only ever right for an element that owns the whole
            // band: if this page already carries earlier content, a paragraph
            // that will not start here belongs intact in the next note band.
            emergencyGraphemeBreaks: fitting.length === 0,
            // A continuation page owns the full note band. If even one legal
            // grapheme is taller than it, clip only that unit and keep draining.
            forceFirstOnNoFit: fitting.length === 0
          });
        }
        if (split?.kind === "split") {
          if (sourcePosition) {
            split.head.setAttribute(FOOTNOTE_SOURCE_POSITION_ATTR, sourcePosition);
            split.tail.setAttribute(FOOTNOTE_SOURCE_POSITION_ATTR, sourcePosition);
          }
          fitting.push(split.head);
          remaining = [split.tail, ...continuation.remainingElements.slice(index + 1)];
        } else if (fitting.length === 0) {
          fitting.push(element);
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
      for (let i = 0; i < children.length; i++) {
        this.checkpoint();
        const child = children[i];
        const measuredCandidate = child.cloneNode(true);
        measuredContent.appendChild(measuredCandidate);
        const candidateFits = pxToPt(measureContainer.getBoundingClientRect().height) <= availableHeightPt;
        if (candidateFits) {
          fits.push(child.cloneNode(true));
          continue;
        }
        measuredCandidate.remove();
        const split = this.canRangeFragmentParagraph(child, true) ? this.splitParagraphAtLargestFit(child, (head) => {
          measuredContent.appendChild(head);
          try {
            return pxToPt(measureContainer.getBoundingClientRect().height) <= availableHeightPt;
          } finally {
            head.remove();
          }
        }, {
          // Both fallbacks cut where ordinary line breaking would not, so they
          // are only ever right for an element that owns the whole band: with
          // earlier siblings already packed here, a paragraph that will not
          // start belongs intact in the next note band.
          emergencyGraphemeBreaks: fits.length === 0 && forceProgress,
          forceFirstOnNoFit: fits.length === 0 && forceProgress
        }) : null;
        if (split?.kind === "split") {
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
      return { fits, overflow };
    } finally {
      measureContainer.remove();
      layoutContext.remove();
    }
  }
  /**
   * Adds footnotes to a page container, including continuation content.
   */
  addPageFootnotes(pageBox, footnoteIds, dims, bands, footnoteHeight, continuation, partialFootnotes) {
    const hasContinuation = continuation && continuation.remainingElements.length > 0;
    if (footnoteIds.length === 0 && !hasContinuation) {
      return;
    }
    if (this.footnoteRegistry.size === 0 && !hasContinuation) {
      return;
    }
    const maxFootnoteHeight = Math.min(
      footnoteHeight,
      bands.bodyHeight * MAX_FOOTNOTE_AREA_RATIO
    );
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
   * Deterministic: it depends only on the section's page setup and the registry's pre-measured
   * story heights, never on the page's content, which is what keeps it lazy-loading compatible.
   */
  getPageBands(dims, sectionIndex, pageInSection, displayedPageNumber) {
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
  /**
   * Measures the content height of a header or footer element.
   *
   * This is what tells {@link resolvePageBands} whether the story stays inside its margin or
   * pushes the body, so it must measure the story ALONE — any padding added here would have to
   * be added to the rendered band too, and the two drifting apart is exactly how a header
   * silently starts overlapping body text.
   */
  measureHeaderFooterHeight(source, contentWidth) {
    const measureContainer = this.document.createElement("div");
    measureContainer.style.position = "absolute";
    measureContainer.style.visibility = "hidden";
    measureContainer.style.width = `${contentWidth}pt`;
    measureContainer.style.left = "-9999px";
    for (const child of Array.from(source.childNodes)) {
      measureContainer.appendChild(child.cloneNode(true));
    }
    this.stagingElement.appendChild(measureContainer);
    const rect = measureContainer.getBoundingClientRect();
    const heightPt = pxToPt(rect.height);
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
    let { bodyHeight: effectiveContentHeight } = this.getPageBands(
      dimensionsFor(),
      pageSectionIndex,
      pageInSection(),
      displayedPageNumber()
    );
    let remainingHeight = effectiveContentHeight;
    let prevMarginBottomPt = 0;
    let currentFootnoteIds = [];
    let currentPageHasFootnoteReference = false;
    let currentFootnoteHeight = 0;
    let currentContinuation = this.pendingFootnoteContinuation;
    let nextPageContinuation = null;
    let currentContinuationPartitioned = false;
    let currentPageAdmitted = false;
    let deferredFootnoteIds = [];
    let currentPartialFootnotes = [];
    const adoptEmptyPageOwner = (owner) => {
      pageSectionIndex = owner;
      const bands = this.getPageBands(
        dimensionsFor(owner),
        owner,
        pageInSection(owner),
        displayedPageNumber(owner)
      );
      effectiveContentHeight = bands.bodyHeight;
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
        displayedPageNumber()
      );
      const partition = this.splitContinuationForPage(
        currentContinuation,
        pageBands.bodyHeight * MAX_FOOTNOTE_AREA_RATIO,
        ownedDimensions.contentWidth
      );
      currentContinuation = partition.current;
      if (partition.overflow) nextPageContinuation = partition.overflow;
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
        ownedDisplayedPageNumber
      );
      const maxFootnoteHeight = pageBands.bodyHeight * MAX_FOOTNOTE_AREA_RATIO;
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
              maxFootnoteHeight - FOOTNOTE_MEASUREMENT_GUARD_PT,
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
        currentPageAdmitted
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
        displayedPageNumber()
      );
      effectiveContentHeight = newBands.bodyHeight;
      remainingHeight = effectiveContentHeight;
      prevMarginBottomPt = 0;
      currentFootnoteIds = [];
      currentPageHasFootnoteReference = false;
      currentPartialFootnotes = [];
      currentContinuation = nextPageContinuation;
      nextPageContinuation = null;
      currentContinuationPartitioned = false;
      currentPageAdmitted = false;
      if (deferredFootnoteIds.length > 0) {
        currentFootnoteIds = [...deferredFootnoteIds];
        deferredFootnoteIds = [];
      }
      const nextDimensions = dimensionsFor();
      currentFootnoteHeight = currentContinuation ? 0 : this.measureFootnotesHeight(currentFootnoteIds, nextDimensions.contentWidth);
    };
    const pageHasPayload = () => currentContent.length > 0 || currentFootnoteIds.length > 0 || (currentContinuation?.remainingElements.length ?? 0) > 0;
    for (let i = 0; i < blocks.length; i++) {
      this.checkpoint();
      const block = blocks[i];
      const allBlockFootnoteIds = this.extractFootnoteRefs(block.element);
      if (block.sectionIndex !== pageSectionIndex && currentPageHasFootnoteReference && (!this.footnoteLayoutLikeWord8 || allBlockFootnoteIds.length > 0)) {
        finishPage(block.sectionIndex);
      }
      const pageIsEmpty = currentContent.length === 0 && currentFootnoteIds.length === 0 && (currentContinuation?.remainingElements.length ?? 0) === 0;
      if (pageIsEmpty && block.sectionIndex !== pageSectionIndex) {
        adoptEmptyPageOwner(block.sectionIndex);
      }
      prepareCurrentContinuation();
      if (currentFootnoteHeight > 0) {
        const ownerDimensions = dimensionsFor();
        const ownerBands = this.getPageBands(
          ownerDimensions,
          pageSectionIndex,
          pageInSection(),
          displayedPageNumber()
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
      const nextBlockPageInSection = pageInSection(block.sectionIndex, pageNumber + 1);
      const freshBlockPageBodyHeight = this.getPageBands(
        blockDimensions,
        block.sectionIndex,
        nextBlockPageInSection,
        displayedPageNumber(block.sectionIndex, nextBlockPageInSection, pageNumber + 1)
      ).bodyHeight;
      if (block.isPageBreak) {
        finishPage(block.sectionIndex);
        continue;
      }
      if (block.pageBreakBefore && currentContent.length > 0) {
        finishPage(block.sectionIndex);
      }
      const previousBlock = blocks[i - 1];
      const startsKeepChain = !previousBlock || !previousBlock.keepWithNext || previousBlock.isPageBreak || block.pageBreakBefore;
      const pageHasOccupiedSpace = currentContent.length > 0 || currentFootnoteHeight > 0;
      if (pageHasOccupiedSpace && block.keepWithNext && startsKeepChain) {
        const keepChain = this.getKeepWithNextChain(blocks, i);
        if (keepChain.length > 1) {
          const newChainFootnoteIds = this.collectNewFootnoteIds(
            keepChain,
            currentFootnoteIds
          );
          let additionalChainFootnoteHeight = 0;
          if (newChainFootnoteIds.length > 0 && this.footnoteRegistry.size > 0) {
            const totalChainFootnoteHeight = this.measureFootnotesHeight(
              [...currentFootnoteIds, ...newChainFootnoteIds],
              blockDimensions.contentWidth,
              currentContinuation
            );
            additionalChainFootnoteHeight = Math.max(
              0,
              totalChainFootnoteHeight - currentFootnoteHeight
            );
          }
          const currentChainHeight = this.measureKeepWithNextChainBodyHeight(
            keepChain,
            prevMarginBottomPt,
            currentContent.length === 0,
            pageInSection(block.sectionIndex)
          ) + additionalChainFootnoteHeight;
          const currentAvailableHeight = remainingHeight - currentFootnoteHeight;
          if (currentChainHeight > currentAvailableHeight) {
            const nextPageBands = this.getPageBands(
              dimensionsFor(block.sectionIndex),
              block.sectionIndex,
              pageInSection(block.sectionIndex, pageNumber + 1),
              displayedPageNumber(
                block.sectionIndex,
                pageInSection(block.sectionIndex, pageNumber + 1),
                pageNumber + 1
              )
            );
            const freshChainBodyHeight = this.measureKeepWithNextChainBodyHeight(
              keepChain,
              0,
              true,
              pageInSection(block.sectionIndex, pageNumber + 1)
            );
            const freshChainFootnoteHeight = this.measureFootnotesHeight(
              newChainFootnoteIds,
              blockDimensions.contentWidth,
              nextPageContinuation
            );
            if (freshChainBodyHeight + freshChainFootnoteHeight <= nextPageBands.bodyHeight) {
              finishPage(block.sectionIndex);
            }
          }
        }
      }
      const newFootnoteIds = this.collectNewFootnoteIds([block], currentFootnoteIds);
      let combinedFootnoteHeight = currentFootnoteHeight;
      let additionalFootnoteHeight = 0;
      if (newFootnoteIds.length > 0 && this.footnoteRegistry.size > 0) {
        const combinedFootnoteIds = [...currentFootnoteIds, ...newFootnoteIds];
        combinedFootnoteHeight = this.measureFootnotesHeight(
          combinedFootnoteIds,
          blockDimensions.contentWidth,
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
      const blockSpace = effectiveMarginTop + block.heightPt + additionalFootnoteHeight;
      const effectiveRemainingHeight = remainingHeight - currentFootnoteHeight;
      const bodyContentUsed = effectiveContentHeight - remainingHeight;
      const maxFootnoteArea = effectiveContentHeight * MAX_FOOTNOTE_AREA_RATIO;
      if (blockSpace > effectiveRemainingHeight) {
        const paragraphFragments = this.tryFragmentParagraph(
          block,
          blockDimensions,
          effectiveRemainingHeight,
          effectiveMarginTop
        );
        if (paragraphFragments) {
          blocks.splice(i, 1, ...paragraphFragments);
          i--;
          continue;
        }
      }
      if (blockSpace <= effectiveRemainingHeight && (combinedFootnoteHeight === 0 || combinedFootnoteHeight + FOOTNOTE_MEASUREMENT_GUARD_PT <= maxFootnoteArea)) {
        markSectionPlaced(block.sectionIndex);
        currentContent.push(this.cloneBlockForPage(
          block,
          isFirstOnPage,
          pageInSection(block.sectionIndex)
        ));
        remainingHeight -= effectiveMarginTop + block.heightPt + block.marginBottomPt;
        prevMarginBottomPt = block.marginBottomPt;
        if (newFootnoteIds.length > 0) {
          currentFootnoteIds.push(...newFootnoteIds);
          currentFootnoteHeight = combinedFootnoteHeight;
        }
        currentPageHasFootnoteReference ||= allBlockFootnoteIds.length > 0;
      } else if (block.heightPt + this.effectiveBlockMarginTop(
        block,
        0,
        true,
        pageInSection(block.sectionIndex, pageNumber + 1)
      ) <= freshBlockPageBodyHeight) {
        const blockSpaceWithoutFootnotes = effectiveMarginTop + block.heightPt;
        if (newFootnoteIds.length > 0 && blockSpaceWithoutFootnotes <= effectiveRemainingHeight) {
          markSectionPlaced(block.sectionIndex);
          currentContent.push(this.cloneBlockForPage(
            block,
            isFirstOnPage,
            pageInSection(block.sectionIndex)
          ));
          remainingHeight -= effectiveMarginTop + block.heightPt + block.marginBottomPt;
          prevMarginBottomPt = block.marginBottomPt;
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
            if (nextPageContinuation) {
              deferredFootnoteIds.push(...newFootnoteIds.slice(noteIndex));
              break;
            }
            const candidateIds = [...currentFootnoteIds, footnoteId];
            const candidateHeight = this.measureFootnotesHeight(
              candidateIds,
              blockDimensions.contentWidth,
              currentContinuation,
              currentPartialFootnotes
            );
            const spaceLeftForFootnotes = availableForFootnotes - currentFootnoteHeight;
            if (candidateHeight + FOOTNOTE_MEASUREMENT_GUARD_PT <= availableForFootnotes) {
              currentFootnoteIds.push(footnoteId);
              currentFootnoteHeight = candidateHeight;
            } else {
              if (spaceLeftForFootnotes > 20) {
                const { fits, overflow } = this.splitFootnoteToFit(
                  footnote,
                  availableForFootnotes,
                  blockDimensions.contentWidth,
                  deferralCannotHelp,
                  {
                    footnoteIds: currentFootnoteIds,
                    continuation: currentContinuation,
                    partialFootnotes: currentPartialFootnotes
                  }
                );
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
                    blockDimensions.contentWidth,
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
          currentPageHasFootnoteReference ||= allBlockFootnoteIds.length > 0;
        } else {
          finishPage(block.sectionIndex, !pageHasPayload());
          i--;
          continue;
        }
      } else {
        const tableFragments = this.trySplitSimpleOversizedTable(
          block,
          dimensionsFor(block.sectionIndex),
          block.sectionIndex
        );
        if (tableFragments) {
          if (currentContent.length > 0 || currentContinuation) {
            finishPage(block.sectionIndex);
          }
          blocks.splice(i, 1, ...tableFragments);
          i--;
          continue;
        }
        if (pageHasPayload()) {
          finishPage(block.sectionIndex);
          i--;
          continue;
        }
        markSectionPlaced(block.sectionIndex);
        currentContent.push(this.cloneBlockForPage(
          block,
          true,
          pageInSection(block.sectionIndex)
        ));
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
  /** A repeated margin note is presentation, not a second bookmark/link target. */
  makeClonedMarginCommentInert(root) {
    this.makeClonedStoryInert(root);
    const nodes = [root, ...Array.from(root.querySelectorAll("*"))];
    for (const element of nodes) {
      element.removeAttribute("id");
      if (element.localName === "a" && element.getAttribute("href")?.startsWith("#")) {
        element.removeAttribute("href");
        element.setAttribute("aria-disabled", "true");
        element.tabIndex = -1;
      }
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
      const widthReference = this.horizontalAnchorReference(
        anchor.getAttribute("data-docx-anchor-width-relative") ?? "margin",
        dims,
        pageNumber,
        context
      );
      const widthPercent = this.anchorNumber(anchor, "width-percent");
      if (widthPercent !== void 0) {
        anchor.style.width = `${widthReference.size * widthPercent / 100}pt`;
      }
      const heightReference = this.verticalAnchorReference(
        anchor.getAttribute("data-docx-anchor-height-relative") ?? "margin",
        dims,
        pageNumber,
        context
      );
      const heightPercent = this.anchorNumber(anchor, "height-percent");
      if (heightPercent !== void 0 && anchor.dataset.docxAnchorAutofit !== "true") {
        anchor.style.height = `${heightReference.size * heightPercent / 100}pt`;
      }
      const sizedRect = anchor.getBoundingClientRect();
      const width = sizedRect.width / pixelsPerPoint;
      const height = sizedRect.height / pixelsPerPoint;
      const horizontal = this.horizontalAnchorReference(
        anchor.getAttribute("data-docx-anchor-h-relative") ?? "column",
        dims,
        pageNumber,
        context
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
      pageBox.appendChild(anchor);
      anchor.style.position = "absolute";
      anchor.style.left = `${left}pt`;
      anchor.style.top = `${top}pt`;
      anchor.style.margin = "0";
    }
  }
  anchorNumber(anchor, suffix) {
    const raw = anchor.getAttribute(`data-docx-anchor-${suffix}`);
    if (raw === null) return void 0;
    const value = Number(raw);
    return Number.isFinite(value) ? value : void 0;
  }
  horizontalAnchorReference(relativeFrom, dims, pageNumber, context) {
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
  createPage(dims, pageNumber, sectionIndex, displayedPageNumber, content, pageInSection, footnoteIds = [], footnoteHeight = 0, continuation, partialFootnotes, isSectionFiller = false, pageAlreadyAdmitted = false) {
    if (!pageAlreadyAdmitted) this.admitPageAllocation();
    const pageBox = this.document.createElement("div");
    pageBox.className = `${this.cssPrefix}box`;
    pageBox.style.width = `${dims.pageWidth}pt`;
    pageBox.style.height = `${dims.pageHeight}pt`;
    pageBox.style.overflow = "hidden";
    pageBox.style.position = "relative";
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
    const bands = this.getPageBands(dims, sectionIndex, pageInSection, displayedPageNumber);
    const headerSource = isSectionFiller ? void 0 : this.selectHeader(sectionIndex, pageInSection, displayedPageNumber);
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
      headerDiv.style.overflow = "hidden";
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
    contentArea.style.overflow = "hidden";
    for (const el of content) {
      contentArea.appendChild(el);
    }
    pageBox.appendChild(contentArea);
    const hasContinuation = continuation && continuation.remainingElements.length > 0;
    if (!isSectionFiller && (footnoteIds.length > 0 || hasContinuation)) {
      this.addPageFootnotes(pageBox, footnoteIds, dims, bands, footnoteHeight, continuation, partialFootnotes);
    }
    const pageCommentIds = [];
    for (const marker of Array.from(
      pageBox.querySelectorAll("[data-comment-id]")
    )) {
      if (marker.closest(`.${this.cssPrefix}comment-margin`)) continue;
      const id = marker.dataset.commentId;
      if (id && this.commentMarginRegistry.has(id) && !pageCommentIds.includes(id)) {
        pageCommentIds.push(id);
      }
    }
    if (pageCommentIds.length > 0) {
      const marginColumn = this.document.createElement("aside");
      marginColumn.className = `${this.cssPrefix}comment-margin`;
      marginColumn.style.position = "absolute";
      marginColumn.style.top = `${contentAreaTop}pt`;
      marginColumn.style.left = `${dims.marginLeft + dims.contentWidth + 3}pt`;
      marginColumn.style.width = `${Math.max(12, dims.marginRight - 6)}pt`;
      marginColumn.style.maxHeight = `${contentAreaHeight}pt`;
      marginColumn.style.overflow = "hidden";
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
      pageBox.appendChild(marginColumn);
    }
    const footerSource = isSectionFiller ? void 0 : this.selectFooter(sectionIndex, pageInSection, displayedPageNumber);
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
      footerDiv.style.overflow = "hidden";
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
    this.containerElement.appendChild(pageBox);
    this.positionDrawingAnchors(pageBox, contentArea, dims, pageNumber);
    const notesEl = pageBox.querySelector(`.${this.cssPrefix}footnotes`);
    if (notesEl) {
      const notesHeightPt = pxToPt(notesEl.getBoundingClientRect().height);
      if (notesHeightPt > 0) {
        contentArea.style.height = `${Math.max(0, contentAreaHeight - notesHeightPt)}pt`;
      }
    }
    return {
      pageNumber,
      sectionIndex,
      dimensions: dims,
      element: pageBox
    };
  }
};

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
  function sendRequest(request, transfer) {
    return new Promise((resolve, reject) => {
      if (!isWorkerActive) {
        reject(new Error("Worker has been terminated"));
        return;
      }
      pendingRequests.set(request.id, { resolve, reject });
      try {
        if (transfer && transfer.length > 0) {
          worker.postMessage(request, transfer);
        } else {
          worker.postMessage(request);
        }
      } catch (error) {
        pendingRequests.delete(request.id);
        reject(error instanceof Error ? error : new Error(String(error)));
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
  return {
    async generatePackageManifest(document2, limits) {
      const bytes = await toBytes(document2);
      const response = await sendRequest(
        {
          id: generateId(),
          type: "generatePackageManifest",
          documentBytes: bytes,
          limits,
          representation: "object"
        },
        [bytes.buffer]
      );
      return response.manifest;
    },
    async verifyDeliverable(document2, baseline) {
      const bytes = await toBytes(document2);
      const baselineBytes = baseline === void 0 ? void 0 : await toBytes(baseline);
      const transfer = [bytes.buffer];
      if (baselineBytes !== void 0) transfer.push(baselineBytes.buffer);
      const response = await sendRequest(
        {
          id: generateId(),
          type: "verifyDeliverable",
          documentBytes: bytes,
          baselineBytes
        },
        transfer
      );
      if (!response.success || !response.verification) {
        throw new Error(response.error ?? "verifyDeliverable failed");
      }
      return response.verification;
    },
    async proveRedlineReversibility(baseline, intendedFinal, redline) {
      const baselineBytes = await toBytes(baseline);
      const intendedFinalBytes = await toBytes(intendedFinal);
      const redlineBytes = await toBytes(redline);
      const response = await sendRequest(
        {
          id: generateId(),
          type: "proveRedlineReversibility",
          baselineBytes,
          intendedFinalBytes,
          redlineBytes
        },
        [baselineBytes.buffer, intendedFinalBytes.buffer, redlineBytes.buffer]
      );
      if (!response.success || !response.proof) {
        throw new Error(response.error ?? "proveRedlineReversibility failed");
      }
      return response.proof;
    },
    async getSemanticChanges(left, right, settings) {
      const leftBytes = await toBytes(left);
      const rightBytes = await toBytes(right);
      const response = await sendRequest(
        {
          id: generateId(),
          type: "getSemanticChanges",
          leftBytes,
          rightBytes,
          settings
        },
        [leftBytes.buffer, rightBytes.buffer]
      );
      return response.semanticChanges;
    },
    async generatePackageManifestJson(document2, limits) {
      const bytes = await toBytes(document2);
      const response = await sendRequest(
        {
          id: generateId(),
          type: "generatePackageManifest",
          documentBytes: bytes,
          limits,
          representation: "json"
        },
        [bytes.buffer]
      );
      if (response.manifestJson === void 0) {
        throw new Error("Package manifest worker response omitted canonical JSON");
      }
      return response.manifestJson;
    },
    async projectReviewProfile(document2, profile, maximumOutputBytes) {
      const bytes = await toBytes(document2);
      const response = await sendRequest(
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
      const response = await sendRequest(
        {
          id: generateId(),
          type: "convertDocxToHtml",
          documentBytes: bytes,
          options: options2,
          maximumOutputBytes
        },
        [bytes.buffer]
      );
      return response.html;
    },
    async compareDocuments(original, modified, options2) {
      const originalBytes = await toBytes(original);
      const modifiedBytes = await toBytes(modified);
      const response = await sendRequest(
        {
          id: generateId(),
          type: "compareDocuments",
          originalBytes,
          modifiedBytes,
          options: options2
        },
        [originalBytes.buffer, modifiedBytes.buffer]
      );
      return response.documentBytes;
    },
    async compareDocumentsToHtml(original, modified, options2) {
      const originalBytes = await toBytes(original);
      const modifiedBytes = await toBytes(modified);
      const response = await sendRequest(
        {
          id: generateId(),
          type: "compareDocumentsToHtml",
          originalBytes,
          modifiedBytes,
          options: options2
        },
        [originalBytes.buffer, modifiedBytes.buffer]
      );
      return response.html;
    },
    async getRevisions(document2) {
      const bytes = await toBytes(document2);
      const response = await sendRequest(
        {
          id: generateId(),
          type: "getRevisions",
          documentBytes: bytes
        },
        [bytes.buffer]
      );
      return response.revisions;
    },
    async getDocumentMetadata(document2) {
      const bytes = await toBytes(document2);
      const response = await sendRequest(
        {
          id: generateId(),
          type: "getDocumentMetadata",
          documentBytes: bytes
        },
        [bytes.buffer]
      );
      return response.metadata;
    },
    async getVersion() {
      const response = await sendRequest({
        id: generateId(),
        type: "getVersion"
      });
      return response.version;
    },
    prepare() {
      if (preparePromise) {
        return preparePromise;
      }
      preparePromise = sendRequest({
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
      const openResponse = await sendRequest(
        {
          id: generateId(),
          type: "sessionOpen",
          documentBytes: bytes,
          settingsJson
        },
        [bytes.buffer]
      );
      if (!openResponse.success || openResponse.handle === void 0) {
        throw new Error(
          `Failed to open worker DocxSession: ${openResponse.error ?? "unknown error"}`
        );
      }
      const handle = openResponse.handle;
      return {
        async getPackageManifest() {
          const res = await sendRequest({
            id: generateId(),
            type: "sessionGetPackageManifest",
            handle
          });
          if (!res.success || !res.manifest) {
            throw new Error(res.error ?? "sessionGetPackageManifest failed");
          }
          return res.manifest;
        },
        async getSemanticChanges() {
          const res = await sendRequest({
            id: generateId(),
            type: "sessionGetSemanticChanges",
            handle
          });
          if (!res.success || !res.semanticChanges) {
            throw new Error(res.error ?? "sessionGetSemanticChanges failed");
          }
          return res.semanticChanges;
        },
        async verifyDeliverable() {
          const res = await sendRequest({
            id: generateId(),
            type: "sessionVerifyDeliverable",
            handle
          });
          if (!res.success || !res.verification) {
            throw new Error(res.error ?? "sessionVerifyDeliverable failed");
          }
          return res.verification;
        },
        async addAnnotation(anchorId, span, annotation) {
          const res = await sendRequest({
            id: generateId(),
            type: "sessionAddAnnotation",
            handle,
            anchorId,
            spanJson: span ? JSON.stringify(span) : "",
            annotationJson: JSON.stringify(annotation)
          });
          if (!res.success) {
            throw new Error(res.error ?? "sessionAddAnnotation failed");
          }
          return res.result;
        },
        async removeAnnotation(annotationId) {
          const res = await sendRequest({
            id: generateId(),
            type: "sessionRemoveAnnotation",
            handle,
            annotationId
          });
          if (!res.success) {
            throw new Error(res.error ?? "sessionRemoveAnnotation failed");
          }
          return res.result;
        },
        async updateAnnotation(annotationId, update) {
          const res = await sendRequest({
            id: generateId(),
            type: "sessionUpdateAnnotation",
            handle,
            annotationId,
            updateJson: JSON.stringify(update)
          });
          if (!res.success) {
            throw new Error(res.error ?? "sessionUpdateAnnotation failed");
          }
          return res.result;
        },
        async moveAnnotation(annotationId, newAnchorId, newSpan) {
          const res = await sendRequest({
            id: generateId(),
            type: "sessionMoveAnnotation",
            handle,
            annotationId,
            newAnchorId,
            newSpanJson: newSpan ? JSON.stringify(newSpan) : ""
          });
          if (!res.success) {
            throw new Error(res.error ?? "sessionMoveAnnotation failed");
          }
          return res.result;
        },
        async close() {
          await sendRequest({
            id: generateId(),
            type: "sessionClose",
            handle
          });
        }
      };
    },
    terminate() {
      stopWorker("Worker terminated");
    },
    isActive() {
      return isWorkerActive;
    }
  };
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
function collectFontInventory(document2, limits) {
  const view = document2.defaultView;
  if (!view || !document2.body) throw new BrowserFontError("invalid_response", "The render document has no font realm.");
  const requests = /* @__PURE__ */ new Map();
  const uses = [];
  let sampledCodePoints = 0;
  let renderedTextNodeCount = 0;
  const walker = document2.createTreeWalker(document2.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue ?? "";
    const element = node.parentElement;
    if (!text || !element || /^(?:script|style|template|noscript)$/i.test(element.localName)) continue;
    if (!participatesInRendering(element, view)) continue;
    renderedTextNodeCount++;
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
    for (const character of text) {
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
    uses.push({ element, requestKey: key, originalStyle: element.getAttribute("style") });
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
    "faces"
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
      "licenseEvidence"
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
    const resolved = Object.freeze({
      id,
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
  pending.add("resolver");
  let responseValue;
  const resolverRequests = Object.freeze(inventory.requests.map((request) => Object.freeze({
    id: request.id,
    familyStack: Object.freeze([...request.familyStack]),
    familyKinds: Object.freeze([...request.familyKinds]),
    style: request.style,
    weight: request.weight,
    stretch: request.stretch,
    sampleCodePoints: Object.freeze([...request.sampleCodePoints])
  })));
  const resolverRequest = Object.freeze({
    schemaVersion: FONT_RESOLVER_SCHEMA_VERSION,
    requests: resolverRequests
  });
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
  const validated = await validateResolverResponse(responseValue, inventory.requests, limits, contractDigest);
  const resolverDigest = await digestJson({
    requests: inventory.requests,
    response: responseIdentityMaterial(validated.response)
  });
  const view = document2.defaultView;
  if (!view) throw new BrowserFontError("invalid_response", "The render document has no font realm.");
  const successfulFaces = /* @__PURE__ */ new Set();
  const faceLoadFailures = /* @__PURE__ */ new Map();
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
  for (const request of inventory.requests) {
    const synthetic = syntheticByRequest.get(request.id);
    if (!synthetic) continue;
    for (const use of usesByRequest.get(request.id) ?? []) {
      use.element.style.setProperty(
        "font-family",
        `${cssString(synthetic)}, ${serializeFamilyStack(request.familyStack, request.familyKinds)}`,
        "important"
      );
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
            for (const use of usesByRequest.get(request.id) ?? []) restoreUse(use);
          }
        } else {
          const specification = fontSpecification(request, request.familyStack, request.familyKinds);
          const sample = String.fromCodePoint(...request.sampleCodePoints.slice(0, 4096)) || " ";
          await abortable(document2.fonts.load(specification, sample), signal);
          fallbackAvailable.set(request.id, requestedFamilyAvailable(document2, request));
        }
      } catch (error) {
        if (signal.aborted) throw error;
        requestLoadFailures.set(request.id, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
        fallbackAvailable.set(request.id, false);
        successfulRequests.delete(request.id);
        syntheticByRequest.delete(request.id);
        for (const use of usesByRequest.get(request.id) ?? []) restoreUse(use);
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
      source: selected ? selected.licenseEvidence.kind === "attested" ? "attested" : "configured" : "browser",
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
  const inventory = collectFontInventory(document2, limits);
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
    commentProfile: options.commentProfile,
    title,
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
  const verifiedRuntimeAssets = assets.filter((entry) => entry.path === "./docxodus.worker.js" || entry.path.startsWith("./wasm/_framework/"));
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
  for (const finding of manifest.findings) {
    if (finding.severity === "info") continue;
    addWarning(state, {
      code: finding.code,
      severity: "warning",
      phase: "package_preflight",
      message: finding.message,
      remediation: "Inspect the named package part before relying on export fidelity.",
      ...finding.location?.entryUri ? { partUri: finding.location.entryUri } : {},
      ...finding.location?.targetUri ? { resource: finding.location.targetUri } : {}
    });
  }
  const packageLimitFinding = manifest.findings.find((finding) => PACKAGE_LIMIT_FINDINGS.has(finding.code));
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
  if (manifest.packageKind !== "opc" || !manifest.isValid || !manifest.facts.mainDocumentUri) {
    fail(
      "invalid_document",
      "package_preflight",
      `The input is not a valid DOCX OPC package (${manifest.packageKind}).`,
      "Repair or decrypt the document before export."
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
  }[options.commentProfile];
  return {
    pageTitle: options.title,
    cssPrefix: "docx-",
    fabricateClasses: true,
    additionalCss: "",
    commentRenderMode,
    commentCssClassPrefix: "comment-",
    paginationMode: 1 /* Paginated */,
    paginationScale: 1,
    paginationCssClassPrefix: "page-",
    renderAnnotations: true,
    renderFootnotesAndEndnotes: true,
    renderHeadersAndFooters: true,
    renderTrackedChanges: options.reviewProfile === "markup",
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
}
function inventoryConvertedContent(document2, state, options) {
  for (const placeholder of Array.from(document2.querySelectorAll("[data-content-type]"))) {
    const outcome = {
      contentType: placeholder.dataset.contentType ?? "Other",
      ...placeholder.dataset.elementName ? { elementName: placeholder.dataset.elementName } : {},
      ...placeholder.closest("[data-source-anchor-id]")?.dataset.sourceAnchorId ? { anchorId: placeholder.closest("[data-source-anchor-id]").dataset.sourceAnchorId } : {},
      action: "placeholder"
    };
    addUnsupportedContent(state, outcome);
    policyWarning(state, options, {
      code: "unsupported_content_placeholder",
      phase: "docx_conversion",
      message: `${outcome.contentType} is represented by a visible placeholder.`,
      remediation: "Replace it with a supported static representation for faithful export.",
      ...outcome.anchorId ? { anchorId: outcome.anchorId } : {}
    });
  }
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
  return { resource: visualResourceLabel(element, kind, index), ...anchorId ? { anchorId } : {} };
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
    addResource(state, { kind, status: "omitted", resource: failure.resource });
    policyWarning(state, options, { ...warning, ...failure });
  }
}
function assertVisualResourcesIntact(failures, alreadyOmitted, what) {
  const regressions = failures.filter((failure) => !alreadyOmitted.has(failure.resource));
  if (regressions.length === 0) return;
  throw new Error(
    `${regressions.length} ${what} that materialized successfully did not survive serialization: ${regressions.slice(0, 8).map((failure) => failure.resource).join(", ")}`
  );
}
function omittedVisualResources(state, kind) {
  return new Set(state.resources.filter((resource) => resource.kind === kind && resource.status === "omitted" && resource.resource).map((resource) => resource.resource));
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
function standaloneStyle(pages) {
  const namedPages = /* @__PURE__ */ new Map();
  for (const page of pages) {
    const sectionIndex = Number.parseInt(page.dataset.sectionIndex ?? "0", 10);
    const width = Number.parseFloat(page.style.width);
    const height = Number.parseFloat(page.style.height);
    const name = `docxodus-section-${sectionIndex}`;
    if (!namedPages.has(name)) namedPages.set(name, { width, height });
    page.style.setProperty("page", name);
    page.dataset.pageWidthPt = String(width);
    page.dataset.pageHeightPt = String(height);
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
    for (const property of [
      "zoom",
      "transform",
      "transform-origin",
      "margin-right",
      "margin-bottom",
      "box-shadow"
    ]) page.style.removeProperty(property);
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
function assertNoClippedContent(document2) {
  for (const footnotes of Array.from(document2.querySelectorAll(".page-footnotes"))) {
    if (footnotes.scrollHeight <= footnotes.clientHeight + 1) continue;
    const boundary = footnotes.getBoundingClientRect().bottom;
    const hasVisibleOverflow = Array.from(footnotes.querySelectorAll("*")).some((element) => element.getBoundingClientRect().bottom > boundary + 1);
    if (hasVisibleOverflow) {
      fail(
        "pagination_failure",
        "running_story_placement",
        "A footnote continuation is clipped in the final page tree.",
        "Report the unsupported note structure; eligible text paragraphs are continued losslessly."
      );
    }
  }
  for (const content of Array.from(document2.querySelectorAll(".page-content"))) {
    if (content.scrollHeight > content.clientHeight + 1) {
      const pageNumber = content.closest(".page-box")?.dataset.pageNumber ?? "unknown";
      const boundary = content.getBoundingClientRect().bottom;
      const overflow = Array.from(content.querySelectorAll("*")).map((element) => ({
        element,
        bottom: element.getBoundingClientRect().bottom
      })).filter(({ bottom }) => bottom > boundary + 1).sort((left, right) => right.bottom - left.bottom).slice(0, 3).map(({ element, bottom }) => `${element.localName}${element.className ? `.${String(element.className).trim().replace(/\s+/g, ".")}` : ""} (+${(bottom - boundary).toFixed(1)}px)`);
      if (overflow.length === 0) continue;
      fail(
        "pagination_failure",
        "running_story_placement",
        `Page ${pageNumber} body content is clipped (${content.scrollHeight}px scroll height in a ${content.clientHeight}px band; ${overflow.join(", ")}).`,
        "Split the oversized block or reduce its dimensions before export."
      );
    }
  }
}
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
    unsupportedContent: state.unsupportedContent.length
  };
}
function restoreAttemptState(state, checkpoint) {
  state.readiness.length = checkpoint.readiness;
  state.warnings.length = checkpoint.warnings;
  state.fonts.length = checkpoint.fonts;
  state.resources.length = checkpoint.resources;
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
async function layoutDigestForOptions(options) {
  const layoutContract = {
    title: options.title,
    reviewProfile: options.reviewProfile,
    reviewProfileAlreadyApplied: options.reviewProfileAlreadyApplied,
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
function visibleRectWithinPage(document2, element, page) {
  const pageRect = page.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  let left = Math.max(rect.left, pageRect.left);
  let top = Math.max(rect.top, pageRect.top);
  let right = Math.min(rect.right, pageRect.right);
  let bottom = Math.min(rect.bottom, pageRect.bottom);
  const clips = (value) => value === "hidden" || value === "clip" || value === "scroll" || value === "auto";
  for (let ancestor = element.parentElement; ancestor && ancestor !== page; ancestor = ancestor.parentElement) {
    const style = document2.defaultView.getComputedStyle(ancestor);
    const ancestorRect = ancestor.getBoundingClientRect();
    if (clips(style.overflowX)) {
      left = Math.max(left, ancestorRect.left);
      right = Math.min(right, ancestorRect.right);
    }
    if (clips(style.overflowY)) {
      top = Math.max(top, ancestorRect.top);
      bottom = Math.min(bottom, ancestorRect.bottom);
    }
  }
  return { left, top, right, bottom };
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
    assertVisualResourcesIntact(
      await decodeImages(reopened),
      omittedVisualResources(state, "image"),
      "embedded images"
    );
    assertVisualResourcesIntact(
      validateInlineSvg(reopened),
      omittedVisualResources(state, "svg"),
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
        const rect = element.getBoundingClientRect();
        const visible = visibleRectWithinPage(reopened, element, page);
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
          inTableCell: element.matches("td,th") || element.closest("td,th") !== null
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
        const engine2 = new PaginationEngine(staging, container, {
          scale: 1,
          cssPrefix: "page-",
          showPageNumbers: false,
          pageGap: 0,
          fragmentParagraphs: true,
          // Running-story placement below changes the visible fragment set, and this path always
          // restamps through normalizePageMapFragmentIdentities(); stamping inside paginate()
          // would be a second full forced-layout pass whose result is immediately overwritten.
          deferFragmentIdentities: true,
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
        await runPhase(state, "running_story_placement", ["headers, footers, and notes"], () => {
          finalizePageTree(renderDocument2, pages2, state, options);
          engine2.normalizePageMapFragmentIdentities();
          assertNoClippedContent(renderDocument2);
        });
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
  FONT_RESOLVER_CONTRACT_ID,
  FONT_RESOLVER_SCHEMA_VERSION,
  FONT_SUBSTITUTION_CONTRACT,
  FONT_SUBSTITUTION_CONTRACT_MATERIAL,
  FONT_SUBSTITUTION_CONTRACT_VERSION,
  HARD_EXPORT_RESOURCE_LIMITS,
  HARD_EXPORT_TIMEOUT_MS,
  canonicalJson,
  convertDocxToPaginatedHtml,
  fontFamilyKey,
  inventoryDocumentFontRequests,
  normalizeFontFamilyName,
  parseCssFontFamily,
  reconstructDocxodusExportError
};
