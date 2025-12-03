import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock docxodus since it requires WASM
vi.mock('docxodus', () => ({
  CommentRenderMode: {
    Disabled: 0,
    EndnoteStyle: 1,
    Inline: 2,
    Margin: 3,
  },
  PaginationMode: {
    Paginated: 1,
  },
  AnnotationLabelMode: {
    Above: 0,
    Inline: 1,
    Tooltip: 2,
    None: 3,
  },
  RevisionType: {
    Inserted: 'Inserted',
    Deleted: 'Deleted',
    Moved: 'Moved',
    FormatChanged: 'FormatChanged',
  },
  isInsertion: (rev: { revisionType: string }) => rev.revisionType === 'Inserted',
  isDeletion: (rev: { revisionType: string }) => rev.revisionType === 'Deleted',
  isMove: (rev: { revisionType: string }) => rev.revisionType === 'Moved',
  isFormatChange: (rev: { revisionType: string }) => rev.revisionType === 'FormatChanged',
  getDocumentMetadata: vi.fn().mockResolvedValue({
    sections: [{ pageWidthPt: 612, pageHeightPt: 792 }],
    totalParagraphs: 10,
    totalTables: 2,
    hasFootnotes: false,
    hasEndnotes: false,
    hasTrackedChanges: false,
    hasComments: false,
    estimatedPageCount: 3,
  }),
}))

vi.mock('docxodus/react', () => ({
  useDocxodus: () => ({
    isReady: true,
    isLoading: false,
    error: null,
    convertToHtml: vi.fn().mockResolvedValue('<div>Mock HTML</div>'),
    getRevisions: vi.fn().mockResolvedValue([]),
  }),
  PaginatedDocument: ({ html }: { html: string }) => (
    <div data-testid="paginated-document">{html}</div>
  ),
}))

vi.mock('docxodus/worker', () => ({
  createWorkerDocxodus: vi.fn().mockResolvedValue({
    convertDocxToHtml: vi.fn().mockResolvedValue('<div>Worker Mock HTML</div>'),
    getRevisions: vi.fn().mockResolvedValue([]),
    getDocumentMetadata: vi.fn().mockResolvedValue({
      sections: [{ pageWidthPt: 612, pageHeightPt: 792 }],
      totalParagraphs: 10,
      totalTables: 2,
      hasFootnotes: false,
      hasEndnotes: false,
      hasTrackedChanges: false,
      hasComments: false,
      estimatedPageCount: 3,
    }),
    terminate: vi.fn(),
    isActive: vi.fn().mockReturnValue(true),
  }),
  isWorkerSupported: vi.fn().mockReturnValue(true),
}))
