import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock docxodus since it requires WASM
vi.mock('docxodus/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('docxodus/core')>();
  return {
    ...actual,
    initialize: vi.fn().mockResolvedValue(undefined),
    convertDocxToHtml: vi.fn().mockResolvedValue('<div>Mock HTML</div>'),
    getRevisions: vi.fn().mockResolvedValue([]),
    getDocumentMetadata: vi.fn().mockResolvedValue({
      sections: [{ pageWidthPt: 612, pageHeightPt: 792 }],
      totalParagraphs: 10, totalTables: 2, hasFootnotes: false, hasEndnotes: false,
      hasTrackedChanges: false, hasComments: false, estimatedPageCount: 3,
    }),
  };
});

vi.mock('../components/PaginatedDocument', () => ({
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
