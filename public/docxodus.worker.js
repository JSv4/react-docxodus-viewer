// src/external-annotation-wire.ts
function readPawlsPage(p) {
  return {
    page: {
      width: p.Page?.Width ?? p.page?.width,
      height: p.Page?.Height ?? p.page?.height,
      index: p.Page?.Index ?? p.page?.index
    },
    tokens: (p.Tokens || p.tokens || []).map((t) => ({
      x: t.X ?? t.x,
      y: t.Y ?? t.y,
      width: t.Width ?? t.width,
      height: t.Height ?? t.height,
      text: t.Text ?? t.text
    }))
  };
}
function readAnnotationJson(json) {
  if (!json) return void 0;
  if (json.Start !== void 0 || json.start !== void 0) {
    return {
      id: json.Id ?? json.id,
      start: json.Start ?? json.start,
      end: json.End ?? json.end,
      text: json.Text ?? json.text
    };
  }
  const result = {};
  for (const [key, value] of Object.entries(json)) {
    const v = value;
    result[key] = {
      bounds: {
        top: v.Bounds?.Top ?? v.bounds?.top,
        bottom: v.Bounds?.Bottom ?? v.bounds?.bottom,
        left: v.Bounds?.Left ?? v.bounds?.left,
        right: v.Bounds?.Right ?? v.bounds?.right
      },
      tokensJsons: (v.TokensJsons || v.tokensJsons || []).map((t) => ({
        pageIndex: t.PageIndex ?? t.pageIndex,
        tokenIndex: t.TokenIndex ?? t.tokenIndex
      })),
      rawText: v.RawText ?? v.rawText
    };
  }
  return result;
}
function readAnnotation(a) {
  return {
    id: a.Id ?? a.id,
    annotationLabel: a.AnnotationLabel ?? a.annotationLabel,
    rawText: a.RawText ?? a.rawText,
    page: a.Page ?? a.page,
    annotationJson: readAnnotationJson(a.AnnotationJson ?? a.annotationJson),
    parentId: a.ParentId ?? a.parentId,
    annotationType: a.AnnotationType ?? a.annotationType,
    structural: a.Structural ?? a.structural
  };
}
function readRelationship(r) {
  return {
    id: r.Id ?? r.id,
    relationshipLabel: r.RelationshipLabel ?? r.relationshipLabel,
    sourceAnnotationIds: r.SourceAnnotationIds ?? r.sourceAnnotationIds ?? [],
    targetAnnotationIds: r.TargetAnnotationIds ?? r.targetAnnotationIds ?? [],
    structural: r.Structural ?? r.structural
  };
}
function readLabel(l) {
  return {
    id: l.Id ?? l.id,
    color: l.Color ?? l.color,
    description: l.Description ?? l.description ?? "",
    icon: l.Icon ?? l.icon ?? "",
    text: l.Text ?? l.text,
    labelType: l.LabelType ?? l.labelType ?? "text"
  };
}
function readLabels(raw) {
  const labels = {};
  for (const [key, value] of Object.entries(raw || {})) labels[key] = readLabel(value);
  return labels;
}
function readOpenContractExport(parsed) {
  return {
    title: parsed.Title ?? parsed.title,
    content: parsed.Content ?? parsed.content,
    description: parsed.Description ?? parsed.description,
    pageCount: parsed.PageCount ?? parsed.pageCount,
    pawlsFileContent: (parsed.PawlsFileContent || parsed.pawlsFileContent || []).map(readPawlsPage),
    docLabels: parsed.DocLabels ?? parsed.docLabels ?? [],
    labelledText: (parsed.LabelledText || parsed.labelledText || []).map(readAnnotation),
    relationships: (parsed.Relationships || parsed.relationships)?.map(readRelationship)
  };
}
function readExternalAnnotationSet(parsed) {
  return {
    documentId: parsed.DocumentId ?? parsed.documentId,
    documentHash: parsed.DocumentHash ?? parsed.documentHash,
    createdAt: parsed.CreatedAt ?? parsed.createdAt,
    updatedAt: parsed.UpdatedAt ?? parsed.updatedAt,
    version: parsed.Version ?? parsed.version,
    ...readOpenContractExport(parsed),
    textLabels: readLabels(parsed.TextLabels || parsed.textLabels),
    docLabelDefinitions: readLabels(parsed.DocLabelDefinitions || parsed.docLabelDefinitions)
  };
}
function readExternalAnnotationValidation(parsed) {
  return {
    isValid: parsed.IsValid ?? parsed.isValid,
    hashMismatch: parsed.HashMismatch ?? parsed.hashMismatch,
    issues: (parsed.Issues || parsed.issues || []).map((i) => ({
      annotationId: i.AnnotationId ?? i.annotationId,
      issueType: i.IssueType ?? i.issueType,
      description: i.Description ?? i.description,
      expectedText: i.ExpectedText ?? i.expectedText,
      actualText: i.ActualText ?? i.actualText
    }))
  };
}
function readProjectedHtml(parsed) {
  return parsed.Html ?? parsed.html;
}

// src/docxodus.worker.ts
var wasmExports = null;
var initPromise = null;
var sessionHandles = /* @__PURE__ */ new Set();
async function initializeWasm(basePath) {
  if (wasmExports) {
    return;
  }
  if (initPromise) {
    return initPromise;
  }
  initPromise = (async () => {
    try {
      const normalizedPath = basePath.endsWith("/") ? basePath : basePath + "/";
      const dotnetModule = await import(
        /* webpackIgnore: true */
        `${normalizedPath}_framework/dotnet.js`
      );
      const { getAssemblyExports, getConfig } = await dotnetModule.dotnet.withDiagnosticTracing(false).create();
      const config = getConfig();
      const exports = await getAssemblyExports(config.mainAssemblyName);
      wasmExports = {
        DocumentConverter: exports.DocxodusWasm.DocumentConverter,
        DocumentComparer: exports.DocxodusWasm.DocumentComparer,
        DocxDiffBridge: exports.DocxodusWasm.DocxDiffBridge,
        DocxSessionBridge: exports.DocxodusWasm.DocxSessionBridge
      };
    } catch (error) {
      initPromise = null;
      throw error;
    }
  })();
  return initPromise;
}
function ensureInitialized() {
  if (!wasmExports) {
    throw new Error("Worker not initialized. Call init first.");
  }
  return wasmExports;
}
function isErrorResponse(result) {
  try {
    const parsed = JSON.parse(result);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) && "Error" in parsed;
  } catch {
    return false;
  }
}
function handleGeneratePackageManifest(request) {
  try {
    const json = request.limits ? ensureInitialized().DocumentConverter.GeneratePackageManifestWithOptions(
      request.documentBytes,
      request.limits.opcEntries,
      request.limits.expandedOpcBytes,
      request.limits.xmlPartBytes,
      request.limits.opcCompressionRatio,
      request.limits.opcUriCharacters
    ) : ensureInitialized().DocumentConverter.GeneratePackageManifest(
      request.documentBytes
    );
    const representation = request.representation ?? "both";
    return {
      manifest: representation === "json" ? void 0 : JSON.parse(json),
      manifestJson: representation === "object" ? void 0 : json
    };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleProjectReviewProfile(request) {
  try {
    const result = request.profile === "final" ? ensureInitialized().DocxDiffBridge.AcceptRevisions(request.documentBytes) : ensureInitialized().DocxDiffBridge.RejectRevisions(request.documentBytes);
    if (!result || result.byteLength === 0) {
      return { error: `Failed to derive the ${request.profile} review profile` };
    }
    if (request.maximumOutputBytes !== void 0 && result.byteLength > request.maximumOutputBytes) {
      return {
        error: `Derived ${request.profile} package exceeds compressedDocxBytes (${result.byteLength} > ${request.maximumOutputBytes})`,
        errorCode: "resource_limit"
      };
    }
    return { documentBytes: result };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleProveRedlineReversibility(request) {
  try {
    const json = ensureInitialized().DocumentConverter.ProveRedlineReversibility(
      request.baselineBytes,
      request.intendedFinalBytes,
      request.redlineBytes
    );
    return { proof: JSON.parse(json) };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleVerifyDeliverable(request) {
  try {
    const converter = ensureInitialized().DocumentConverter;
    let json;
    if (request.requestJson !== void 0) {
      if (!converter.VerifyDeliverableWithRequest || !converter.VerifyDeliverableWithBaselineAndRequest) {
        throw new Error("This WASM bundle predates full verification requests; rebuild docxodus.");
      }
      json = request.baselineBytes === void 0 ? converter.VerifyDeliverableWithRequest(request.documentBytes, request.requestJson) : converter.VerifyDeliverableWithBaselineAndRequest(
        request.baselineBytes,
        request.documentBytes,
        request.requestJson
      );
    } else {
      json = request.baselineBytes === void 0 ? converter.VerifyDeliverable(request.documentBytes) : converter.VerifyDeliverableWithBaseline(
        request.baselineBytes,
        request.documentBytes
      );
    }
    return {
      verification: JSON.parse(json)
    };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleGetSemanticChanges(request) {
  try {
    const json = ensureInitialized().DocxDiffBridge.GetSemanticChangesJson(
      request.leftBytes,
      request.rightBytes,
      request.settings ? JSON.stringify(request.settings) : ""
    );
    if (isErrorResponse(json)) return { error: parseError(json).error };
    return { semanticChanges: JSON.parse(json) };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleCreateExternalAnnotationSet(request) {
  try {
    const json = ensureInitialized().DocumentConverter.CreateExternalAnnotationSet(
      request.documentBytes,
      request.documentId
    );
    if (isErrorResponse(json)) return { error: parseError(json).error };
    return { annotationSet: readExternalAnnotationSet(JSON.parse(json)) };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleValidateExternalAnnotations(request) {
  try {
    const json = ensureInitialized().DocumentConverter.ValidateExternalAnnotations(
      request.documentBytes,
      JSON.stringify(request.annotationSet)
    );
    if (isErrorResponse(json)) return { error: parseError(json).error };
    return { validation: readExternalAnnotationValidation(JSON.parse(json)) };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleProjectAnnotationsOntoHtml(request) {
  try {
    const json = ensureInitialized().DocumentConverter.ProjectAnnotationsOntoHtml(
      request.html,
      JSON.stringify(request.annotationSet),
      request.projectionOptions?.cssClassPrefix ?? "ext-annot-",
      request.projectionOptions?.labelMode ?? 0 /* Above */
    );
    if (isErrorResponse(json)) return { error: parseError(json).error };
    return { html: readProjectedHtml(JSON.parse(json)) };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleConvertWithExternalAnnotations(request) {
  try {
    const options = request.conversionOptions;
    const json = ensureInitialized().DocumentConverter.ConvertDocxToHtmlWithExternalAnnotations(
      request.documentBytes,
      JSON.stringify(request.annotationSet),
      options?.pageTitle ?? "Document",
      options?.cssPrefix ?? "docx-",
      options?.fabricateClasses ?? true,
      options?.additionalCss ?? "",
      request.projectionOptions?.cssClassPrefix ?? "ext-annot-",
      request.projectionOptions?.labelMode ?? 0 /* Above */
    );
    if (isErrorResponse(json)) return { error: parseError(json).error };
    return { html: readProjectedHtml(JSON.parse(json)) };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleExportToOpenContract(request) {
  try {
    const json = ensureInitialized().DocumentConverter.ExportToOpenContract(request.documentBytes);
    if (isErrorResponse(json)) return { error: parseError(json).error };
    return { export: readOpenContractExport(JSON.parse(json)) };
  } catch (error) {
    return { error: String(error) };
  }
}
function parseError(result) {
  try {
    const parsed = JSON.parse(result);
    return { error: parsed.Error || parsed.error || "Unknown error" };
  } catch {
    return { error: result };
  }
}
function handleConvert(request) {
  const exports = ensureInitialized();
  const options = request.options;
  try {
    let result;
    const needsCompleteMethod = options?.renderFootnotesAndEndnotes !== void 0 || options?.renderHeadersAndFooters !== void 0 || options?.renderTrackedChanges !== void 0 || options?.showDeletedContent !== void 0 || options?.renderMoveOperations !== void 0 || options?.renderUnsupportedContentPlaceholders !== void 0 || options?.documentLanguage !== void 0;
    if (needsCompleteMethod || options?.renderAnnotations) {
      result = exports.DocumentConverter.ConvertDocxToHtmlComplete(
        request.documentBytes,
        options?.pageTitle ?? "Document",
        options?.cssPrefix ?? "docx-",
        options?.fabricateClasses ?? true,
        options?.additionalCss ?? "",
        options?.commentRenderMode ?? -1,
        options?.commentCssClassPrefix ?? "comment-",
        options?.paginationMode ?? 0,
        options?.paginationScale ?? 1,
        options?.paginationCssClassPrefix ?? "page-",
        options?.renderAnnotations ?? false,
        options?.annotationLabelMode ?? 0,
        options?.annotationCssClassPrefix ?? "annot-",
        options?.renderFootnotesAndEndnotes ?? false,
        options?.renderHeadersAndFooters ?? false,
        options?.renderTrackedChanges ?? false,
        options?.showDeletedContent ?? true,
        options?.renderMoveOperations ?? true,
        options?.renderUnsupportedContentPlaceholders ?? false,
        options?.documentLanguage ?? null,
        options?.stampAnchors ?? false
      );
    } else if (options?.paginationMode !== void 0 && options.paginationMode !== 0) {
      result = exports.DocumentConverter.ConvertDocxToHtmlWithPagination(
        request.documentBytes,
        options.pageTitle ?? "Document",
        options.cssPrefix ?? "docx-",
        options.fabricateClasses ?? true,
        options.additionalCss ?? "",
        options.commentRenderMode ?? -1,
        options.commentCssClassPrefix ?? "comment-",
        options.paginationMode,
        options.paginationScale ?? 1,
        options.paginationCssClassPrefix ?? "page-"
      );
    } else if (options) {
      result = exports.DocumentConverter.ConvertDocxToHtmlWithOptions(
        request.documentBytes,
        options.pageTitle ?? "Document",
        options.cssPrefix ?? "docx-",
        options.fabricateClasses ?? true,
        options.additionalCss ?? "",
        options.commentRenderMode ?? -1,
        options.commentCssClassPrefix ?? "comment-"
      );
    } else {
      result = exports.DocumentConverter.ConvertDocxToHtml(
        request.documentBytes
      );
    }
    if (isErrorResponse(result)) {
      return parseError(result);
    }
    if (request.maximumOutputBytes !== void 0) {
      let byteLength = 0;
      for (let index = 0; index < result.length; index++) {
        const unit = result.charCodeAt(index);
        if (unit < 128) byteLength++;
        else if (unit < 2048) byteLength += 2;
        else if (unit >= 55296 && unit <= 56319 && result.charCodeAt(index + 1) >= 56320 && result.charCodeAt(index + 1) <= 57343) {
          byteLength += 4;
          index++;
        } else byteLength += 3;
        if (byteLength > request.maximumOutputBytes) {
          return {
            error: `Converted HTML exceeds htmlOutputBytes (${byteLength} > ${request.maximumOutputBytes})`,
            errorCode: "resource_limit"
          };
        }
      }
    }
    return { html: result };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleCompare(request) {
  const exports = ensureInitialized();
  const options = request.options;
  try {
    let result;
    if (options?.caseInsensitive) {
      result = exports.DocumentComparer.CompareDocumentsWithOptions(
        request.originalBytes,
        request.modifiedBytes,
        options?.authorName ?? "Docxodus",
        options.caseInsensitive
      );
    } else {
      result = exports.DocumentComparer.CompareDocuments(
        request.originalBytes,
        request.modifiedBytes,
        options?.authorName ?? "Docxodus"
      );
    }
    if (result.length === 0) {
      return { error: "Comparison returned empty result" };
    }
    return { documentBytes: result };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleCompareToHtml(request) {
  const exports = ensureInitialized();
  const options = request.options;
  try {
    const renderTrackedChanges = options?.renderTrackedChanges ?? true;
    const result = exports.DocumentComparer.CompareDocumentsToHtmlWithOptions(
      request.originalBytes,
      request.modifiedBytes,
      options?.authorName ?? "Docxodus",
      renderTrackedChanges
    );
    if (isErrorResponse(result)) {
      return parseError(result);
    }
    return { html: result };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleGetRevisions(request) {
  const exports = ensureInitialized();
  try {
    const result = exports.DocumentComparer.GetRevisionsJson(request.documentBytes);
    if (isErrorResponse(result)) {
      return parseError(result);
    }
    const revisions = JSON.parse(result);
    return { revisions };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleGetComments(request) {
  const exports = ensureInitialized();
  try {
    const result = exports.DocumentComparer.GetCommentsJson(request.documentBytes);
    if (isErrorResponse(result)) {
      return parseError(result);
    }
    return { comments: JSON.parse(result) };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleGetDocumentMetadata(request) {
  const exports = ensureInitialized();
  try {
    const result = exports.DocumentConverter.GetDocumentMetadata(
      request.documentBytes
    );
    if (isErrorResponse(result)) {
      return parseError(result);
    }
    const parsed = JSON.parse(result);
    const convertSection = (s) => ({
      sectionIndex: s.SectionIndex ?? s.sectionIndex,
      pageWidthPt: s.PageWidthPt ?? s.pageWidthPt,
      pageHeightPt: s.PageHeightPt ?? s.pageHeightPt,
      marginTopPt: s.MarginTopPt ?? s.marginTopPt,
      marginRightPt: s.MarginRightPt ?? s.marginRightPt,
      marginBottomPt: s.MarginBottomPt ?? s.marginBottomPt,
      marginLeftPt: s.MarginLeftPt ?? s.marginLeftPt,
      contentWidthPt: s.ContentWidthPt ?? s.contentWidthPt,
      contentHeightPt: s.ContentHeightPt ?? s.contentHeightPt,
      headerPt: s.HeaderPt ?? s.headerPt,
      footerPt: s.FooterPt ?? s.footerPt,
      paragraphCount: s.ParagraphCount ?? s.paragraphCount,
      tableCount: s.TableCount ?? s.tableCount,
      hasHeader: s.HasHeader ?? s.hasHeader,
      hasFooter: s.HasFooter ?? s.hasFooter,
      hasFirstPageHeader: s.HasFirstPageHeader ?? s.hasFirstPageHeader,
      hasFirstPageFooter: s.HasFirstPageFooter ?? s.hasFirstPageFooter,
      hasEvenPageHeader: s.HasEvenPageHeader ?? s.hasEvenPageHeader,
      hasEvenPageFooter: s.HasEvenPageFooter ?? s.hasEvenPageFooter,
      startParagraphIndex: s.StartParagraphIndex ?? s.startParagraphIndex,
      endParagraphIndex: s.EndParagraphIndex ?? s.endParagraphIndex,
      startTableIndex: s.StartTableIndex ?? s.startTableIndex,
      endTableIndex: s.EndTableIndex ?? s.endTableIndex
    });
    const metadata = {
      sections: (parsed.Sections || parsed.sections || []).map(convertSection),
      totalParagraphs: parsed.TotalParagraphs ?? parsed.totalParagraphs,
      totalTables: parsed.TotalTables ?? parsed.totalTables,
      hasFootnotes: parsed.HasFootnotes ?? parsed.hasFootnotes,
      hasEndnotes: parsed.HasEndnotes ?? parsed.hasEndnotes,
      hasTrackedChanges: parsed.HasTrackedChanges ?? parsed.hasTrackedChanges,
      hasComments: parsed.HasComments ?? parsed.hasComments,
      estimatedPageCount: parsed.EstimatedPageCount ?? parsed.estimatedPageCount,
      estimatedPageCountSource: parsed.EstimatedPageCountSource ?? parsed.estimatedPageCountSource ?? "heuristic"
    };
    return { metadata };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleSessionOpen(request) {
  const exports = ensureInitialized();
  try {
    const handle = exports.DocxSessionBridge.OpenSession(
      request.documentBytes,
      request.settingsJson ?? ""
    );
    sessionHandles.add(handle);
    return { handle };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleSessionGetPackageManifest(request) {
  try {
    const json = ensureInitialized().DocxSessionBridge.GetPackageManifest(request.handle);
    return { manifest: JSON.parse(json) };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleSessionGetSemanticChanges(request) {
  try {
    const json = ensureInitialized().DocxSessionBridge.GetSemanticChanges(request.handle);
    if (isErrorResponse(json)) return { error: parseError(json).error };
    return { semanticChanges: JSON.parse(json) };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleSessionVerifyDeliverable(request) {
  try {
    const bridge = ensureInitialized().DocxSessionBridge;
    let json;
    if (request.requestJson !== void 0) {
      if (!bridge.VerifyDeliverableWithRequest) {
        throw new Error("This WASM bundle predates full verification requests; rebuild docxodus.");
      }
      json = bridge.VerifyDeliverableWithRequest(request.handle, request.requestJson);
    } else {
      json = bridge.VerifyDeliverable(request.handle);
    }
    return {
      verification: JSON.parse(json)
    };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleSessionClose(request) {
  const exports = ensureInitialized();
  try {
    exports.DocxSessionBridge.CloseSession(request.handle);
    sessionHandles.delete(request.handle);
    return {};
  } catch (error) {
    return { error: String(error) };
  }
}
function handleSessionAddAnnotation(request) {
  const exports = ensureInitialized();
  try {
    const json = exports.DocxSessionBridge.AddAnnotation(
      request.handle,
      request.anchorId,
      request.spanJson,
      request.annotationJson
    );
    const result = JSON.parse(json);
    return { result };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleSessionRemoveAnnotation(request) {
  const exports = ensureInitialized();
  try {
    const json = exports.DocxSessionBridge.SessionRemoveAnnotation(
      request.handle,
      request.annotationId
    );
    const result = JSON.parse(json);
    return { result };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleSessionUpdateAnnotation(request) {
  const exports = ensureInitialized();
  try {
    const json = exports.DocxSessionBridge.UpdateAnnotation(
      request.handle,
      request.annotationId,
      request.updateJson
    );
    const result = JSON.parse(json);
    return { result };
  } catch (error) {
    return { error: String(error) };
  }
}
function handleSessionMoveAnnotation(request) {
  const exports = ensureInitialized();
  try {
    const json = exports.DocxSessionBridge.MoveAnnotation(
      request.handle,
      request.annotationId,
      request.newAnchorId,
      request.newSpanJson
    );
    const result = JSON.parse(json);
    return { result };
  } catch (error) {
    return { error: String(error) };
  }
}
function handlePrepare() {
  const exports = ensureInitialized();
  try {
    const result = exports.DocumentComparer.Warmup();
    if (isErrorResponse(result)) {
      return parseError(result);
    }
    return {};
  } catch (error) {
    return { error: String(error) };
  }
}
function handleGetVersion() {
  const exports = ensureInitialized();
  try {
    const result = exports.DocumentConverter.GetVersion();
    const parsed = JSON.parse(result);
    return {
      version: {
        library: parsed.Library || parsed.library,
        dotnetVersion: parsed.DotnetVersion || parsed.dotnetVersion,
        platform: parsed.Platform || parsed.platform
      }
    };
  } catch (error) {
    return { error: String(error) };
  }
}
self.addEventListener("message", async (event) => {
  const request = event.data;
  try {
    let response;
    switch (request.type) {
      case "init": {
        const initRequest = request;
        try {
          await initializeWasm(initRequest.wasmBasePath);
          response = {
            id: request.id,
            type: "init",
            success: true
          };
        } catch (error) {
          response = {
            id: request.id,
            type: "init",
            success: false,
            error: String(error)
          };
        }
        break;
      }
      case "generatePackageManifest": {
        const result = handleGeneratePackageManifest(
          request
        );
        response = {
          id: request.id,
          type: "generatePackageManifest",
          success: !result.error,
          manifest: result.manifest,
          manifestJson: result.manifestJson,
          error: result.error
        };
        break;
      }
      case "verifyDeliverable": {
        const result = handleVerifyDeliverable(
          request
        );
        response = {
          id: request.id,
          type: "verifyDeliverable",
          success: !result.error,
          verification: result.verification,
          error: result.error
        };
        break;
      }
      case "proveRedlineReversibility": {
        const result = handleProveRedlineReversibility(
          request
        );
        response = {
          id: request.id,
          type: "proveRedlineReversibility",
          success: !result.error,
          proof: result.proof,
          error: result.error
        };
        break;
      }
      case "projectReviewProfile": {
        const result = handleProjectReviewProfile(
          request
        );
        response = {
          id: request.id,
          type: "projectReviewProfile",
          success: !result.error,
          documentBytes: result.documentBytes,
          error: result.error,
          errorCode: result.errorCode
        };
        if (result.documentBytes) {
          self.postMessage(response, { transfer: [result.documentBytes.buffer] });
          return;
        }
        break;
      }
      case "convertDocxToHtml": {
        const convertRequest = request;
        const result = handleConvert(convertRequest);
        response = {
          id: request.id,
          type: "convertDocxToHtml",
          success: !result.error,
          html: result.html,
          error: result.error,
          errorCode: result.errorCode
        };
        break;
      }
      case "compareDocuments": {
        const compareRequest = request;
        const result = handleCompare(compareRequest);
        response = {
          id: request.id,
          type: "compareDocuments",
          success: !result.error,
          documentBytes: result.documentBytes,
          error: result.error
        };
        if (result.documentBytes) {
          self.postMessage(response, { transfer: [result.documentBytes.buffer] });
          return;
        }
        break;
      }
      case "compareDocumentsToHtml": {
        const compareToHtmlRequest = request;
        const result = handleCompareToHtml(compareToHtmlRequest);
        response = {
          id: request.id,
          type: "compareDocumentsToHtml",
          success: !result.error,
          html: result.html,
          error: result.error
        };
        break;
      }
      case "getSemanticChanges": {
        const result = handleGetSemanticChanges(
          request
        );
        response = {
          id: request.id,
          type: "getSemanticChanges",
          success: !result.error,
          semanticChanges: result.semanticChanges,
          error: result.error
        };
        break;
      }
      case "createExternalAnnotationSet": {
        const result = handleCreateExternalAnnotationSet(
          request
        );
        response = {
          id: request.id,
          type: "createExternalAnnotationSet",
          success: !result.error,
          annotationSet: result.annotationSet,
          error: result.error
        };
        break;
      }
      case "validateExternalAnnotations": {
        const result = handleValidateExternalAnnotations(
          request
        );
        response = {
          id: request.id,
          type: "validateExternalAnnotations",
          success: !result.error,
          validation: result.validation,
          error: result.error
        };
        break;
      }
      case "projectAnnotationsOntoHtml": {
        const result = handleProjectAnnotationsOntoHtml(
          request
        );
        response = {
          id: request.id,
          type: "projectAnnotationsOntoHtml",
          success: !result.error,
          html: result.html,
          error: result.error
        };
        break;
      }
      case "convertDocxToHtmlWithExternalAnnotations": {
        const result = handleConvertWithExternalAnnotations(
          request
        );
        response = {
          id: request.id,
          type: "convertDocxToHtmlWithExternalAnnotations",
          success: !result.error,
          html: result.html,
          error: result.error
        };
        break;
      }
      case "exportToOpenContract": {
        const result = handleExportToOpenContract(
          request
        );
        response = {
          id: request.id,
          type: "exportToOpenContract",
          success: !result.error,
          export: result.export,
          error: result.error
        };
        break;
      }
      case "getRevisions": {
        const getRevisionsRequest = request;
        const result = handleGetRevisions(getRevisionsRequest);
        response = {
          id: request.id,
          type: "getRevisions",
          success: !result.error,
          revisions: result.revisions,
          error: result.error
        };
        break;
      }
      case "getComments": {
        const result = handleGetComments(request);
        response = {
          id: request.id,
          type: "getComments",
          success: !result.error,
          comments: result.comments,
          error: result.error
        };
        break;
      }
      case "getDocumentMetadata": {
        const getMetadataRequest = request;
        const result = handleGetDocumentMetadata(getMetadataRequest);
        response = {
          id: request.id,
          type: "getDocumentMetadata",
          success: !result.error,
          metadata: result.metadata,
          error: result.error
        };
        break;
      }
      case "getVersion": {
        const result = handleGetVersion();
        response = {
          id: request.id,
          type: "getVersion",
          success: !result.error,
          version: result.version,
          error: result.error
        };
        break;
      }
      case "prepare": {
        const result = handlePrepare();
        response = {
          id: request.id,
          type: "prepare",
          success: !result.error,
          error: result.error
        };
        break;
      }
      case "sessionOpen": {
        const sessionOpenRequest = request;
        const result = handleSessionOpen(sessionOpenRequest);
        response = {
          id: request.id,
          type: "sessionOpen",
          success: !result.error,
          handle: result.handle,
          error: result.error
        };
        break;
      }
      case "sessionGetPackageManifest": {
        const result = handleSessionGetPackageManifest(
          request
        );
        response = {
          id: request.id,
          type: "sessionGetPackageManifest",
          success: !result.error,
          manifest: result.manifest,
          error: result.error
        };
        break;
      }
      case "sessionGetSemanticChanges": {
        const result = handleSessionGetSemanticChanges(
          request
        );
        response = {
          id: request.id,
          type: "sessionGetSemanticChanges",
          success: !result.error,
          semanticChanges: result.semanticChanges,
          error: result.error
        };
        break;
      }
      case "sessionVerifyDeliverable": {
        const result = handleSessionVerifyDeliverable(
          request
        );
        response = {
          id: request.id,
          type: "sessionVerifyDeliverable",
          success: !result.error,
          verification: result.verification,
          error: result.error
        };
        break;
      }
      case "sessionClose": {
        const sessionCloseRequest = request;
        const result = handleSessionClose(sessionCloseRequest);
        response = {
          id: request.id,
          type: "sessionClose",
          success: !result.error,
          error: result.error
        };
        break;
      }
      case "sessionAddAnnotation": {
        const addAnnotRequest = request;
        const result = handleSessionAddAnnotation(addAnnotRequest);
        response = {
          id: request.id,
          type: "sessionAddAnnotation",
          success: !result.error,
          result: result.result,
          error: result.error
        };
        break;
      }
      case "sessionRemoveAnnotation": {
        const removeAnnotRequest = request;
        const result = handleSessionRemoveAnnotation(removeAnnotRequest);
        response = {
          id: request.id,
          type: "sessionRemoveAnnotation",
          success: !result.error,
          result: result.result,
          error: result.error
        };
        break;
      }
      case "sessionUpdateAnnotation": {
        const updateAnnotRequest = request;
        const result = handleSessionUpdateAnnotation(updateAnnotRequest);
        response = {
          id: request.id,
          type: "sessionUpdateAnnotation",
          success: !result.error,
          result: result.result,
          error: result.error
        };
        break;
      }
      case "sessionMoveAnnotation": {
        const moveAnnotRequest = request;
        const result = handleSessionMoveAnnotation(moveAnnotRequest);
        response = {
          id: request.id,
          type: "sessionMoveAnnotation",
          success: !result.error,
          result: result.result,
          error: result.error
        };
        break;
      }
      default: {
        const unknownRequest = request;
        self.postMessage({
          id: unknownRequest.id,
          type: unknownRequest.type,
          success: false,
          error: `Unknown request type: ${unknownRequest.type}`
        });
        return;
      }
    }
    self.postMessage(response);
  } catch (error) {
    self.postMessage({
      id: request.id,
      type: request.type,
      success: false,
      error: String(error)
    });
  }
});
self.postMessage({ type: "ready" });
