"use strict";
var DocxodusPagination = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/pagination.ts
  var pagination_exports = {};
  __export(pagination_exports, {
    PaginationEngine: () => PaginationEngine,
    clearPageCitationHighlight: () => clearPageCitationHighlight,
    createUnavailablePageMap: () => createUnavailablePageMap,
    navigateToPageCitation: () => navigateToPageCitation,
    paginateHtml: () => paginateHtml
  });

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
  function createUnavailablePageMap(documentVersion, rendererFingerprint, mode = "continuous") {
    if (!rendererFingerprint) throw new Error("rendererFingerprint must be non-empty");
    return {
      schemaVersion: 1,
      mode,
      availability: "unavailable",
      documentVersion,
      rendererFingerprint,
      pages: [],
      fragments: []
    };
  }
  var activePageCitationHighlights = /* @__PURE__ */ new WeakMap();
  function clearPageCitationHighlight(root) {
    const active = activePageCitationHighlights.get(root);
    if (!active) return;
    if (active.highlightClass && active.addedClass) {
      active.target.classList.remove(active.highlightClass);
    }
    for (const style of active.inlineStyles ?? []) {
      if (style.value) {
        active.target.style.setProperty(style.name, style.value, style.priority);
      } else {
        active.target.style.removeProperty(style.name);
      }
    }
    activePageCitationHighlights.delete(root);
  }
  function navigateToPageCitation(root, citation, options = {}) {
    clearPageCitationHighlight(root);
    if (citation.availability !== "available" || citation.fragments.length === 0) {
      return { navigated: false, unavailableReason: "citation_unavailable" };
    }
    const byAttribute = (name, value, within = root) => {
      for (const node of Array.from(within.querySelectorAll(`[${name}]`))) {
        if (node.getAttribute(name) === value) return node;
      }
      return null;
    };
    const fragment = citation.fragments[0];
    let target = byAttribute("data-page-fragment-id", fragment.fragmentId);
    if (!target) {
      const page = byAttribute("data-page-number", String(fragment.pageNumber));
      if (page) target = byAttribute("data-source-anchor-id", citation.anchorId, page) ?? page;
    }
    if (!target) {
      return {
        navigated: false,
        pageNumber: fragment.pageNumber,
        fragmentId: fragment.fragmentId,
        unavailableReason: "fragment_not_found"
      };
    }
    if (options.highlightClass) {
      const addedClass = !target.classList.contains(options.highlightClass);
      target.classList.add(options.highlightClass);
      activePageCitationHighlights.set(root, {
        target,
        highlightClass: options.highlightClass,
        addedClass
      });
    } else if (options.highlight !== false) {
      const names = ["outline", "outline-offset", "background-color"];
      const inlineStyles = names.map((name) => ({
        name,
        value: target.style.getPropertyValue(name),
        priority: target.style.getPropertyPriority(name)
      }));
      target.style.setProperty("outline", "3px solid #f4b400", "important");
      target.style.setProperty("outline-offset", "2px", "important");
      target.style.setProperty("background-color", "rgba(255, 235, 59, .18)", "important");
      activePageCitationHighlights.set(root, { target, inlineStyles });
    }
    target.scrollIntoView({
      behavior: options.behavior ?? "smooth",
      block: options.block ?? "center"
    });
    return {
      navigated: true,
      target,
      pageNumber: fragment.pageNumber,
      fragmentId: fragment.fragmentId
    };
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
  function paginateHtml(html, container, options = {}) {
    const ownerDocument = typeof container === "string" ? globalThis.document : container.ownerDocument;
    const containerEl = typeof container === "string" ? ownerDocument.getElementById(container) : container;
    if (!containerEl) {
      throw new Error("Container element not found");
    }
    containerEl.innerHTML = html;
    const cssPrefix = options.cssPrefix ?? "page-";
    const staging = containerEl.querySelector("#pagination-staging") || containerEl.querySelector(`.${cssPrefix}staging`);
    const pageContainer = containerEl.querySelector("#pagination-container") || containerEl.querySelector(`.${cssPrefix}container`);
    if (!staging) {
      throw new Error(
        "Pagination staging element not found. Make sure the HTML was generated with PaginationMode.Paginated"
      );
    }
    if (!pageContainer) {
      throw new Error("Pagination container element not found");
    }
    const engine = new PaginationEngine(staging, pageContainer, {
      ...options,
      fragmentParagraphs: options.fragmentParagraphs ?? true
    });
    return engine.paginate();
  }
  return __toCommonJS(pagination_exports);
})();
