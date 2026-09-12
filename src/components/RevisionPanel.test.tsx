import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RevisionPanel } from './RevisionPanel'
import type { DocxDiffRevision as Revision, RevisionListEntry } from 'docxodus/core'

const mockRevisions: Revision[] = [
  {
    author: 'John Doe',
    date: '2024-01-15T10:30:00Z',
    revisionType: 'Inserted',
    text: 'This is inserted text',
  },
  {
    author: 'Jane Smith',
    date: '2024-01-16T14:00:00Z',
    revisionType: 'Deleted',
    text: 'This was deleted',
  },
  {
    author: 'Bob Wilson',
    date: '2024-01-17T09:00:00Z',
    revisionType: 'Moved',
    text: 'This was moved',
    moveGroupId: 1,
    isMoveSource: true,
  },
]

describe('RevisionPanel', () => {
  const native = (updates: Partial<RevisionListEntry> = {}): RevisionListEntry => ({
    id: 'rev2-native-1', type: 'move', family: 'move', constituentIds: ['1', '2'],
    constituentKeys: ['moveFrom:1', 'moveTo:2'], author: 'Reviewer', text: 'A moved clause',
    partUri: '/word/document.xml', scope: 'body', affectedAnchors: [], resolutionStatus: 'supported',
    ...updates,
  });

  it('renders a native move once and resolves it by its atomic revision id', async () => {
    const onAccept = vi.fn();
    render(<RevisionPanel revisions={[native()]} onAccept={onAccept} />);
    expect(screen.getByText('Moved')).toBeInTheDocument();
    expect(screen.queryByText('Moved from')).not.toBeInTheDocument();
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Accept' }));
    expect(onAccept).toHaveBeenCalledWith('rev2-native-1');
  });

  it('retains structural diagnostics and disables unsafe resolution', async () => {
    const onAccept = vi.fn();
    render(<RevisionPanel revisions={[native({ type: 'structure', family: 'cell_merge', resolutionStatus: 'ambiguous', diagnostic: { code: 'ambiguous_pair', message: 'The cell merge has conflicting markers.' } })]} onAccept={onAccept} onAcceptAll={vi.fn()} />);
    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'structural');
    expect(screen.getByText('cell merge')).toBeInTheDocument();
    expect(screen.getByText('The cell merge has conflicting markers.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Accept all' })).toBeDisabled();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('renders empty state when no revisions', () => {
    render(<RevisionPanel revisions={[]} />)
    expect(screen.getByText('No tracked changes found in this document.')).toBeInTheDocument()
  })

  it('displays revision count in stats', () => {
    render(<RevisionPanel revisions={mockRevisions} />)
    expect(screen.getByText('3 changes')).toBeInTheDocument()
  })

  it('displays insertion count', () => {
    render(<RevisionPanel revisions={mockRevisions} />)
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('displays deletion count', () => {
    render(<RevisionPanel revisions={mockRevisions} />)
    expect(screen.getByText('−1')).toBeInTheDocument()
  })

  it('displays move count', () => {
    render(<RevisionPanel revisions={mockRevisions} />)
    expect(screen.getByText('↔1')).toBeInTheDocument()
  })

  it('renders all revisions in list', () => {
    render(<RevisionPanel revisions={mockRevisions} />)
    expect(screen.getByText('This is inserted text')).toBeInTheDocument()
    expect(screen.getByText('This was deleted')).toBeInTheDocument()
    expect(screen.getByText('This was moved')).toBeInTheDocument()
  })

  it('displays author names', () => {
    render(<RevisionPanel revisions={mockRevisions} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
  })

  it('displays revision type labels', () => {
    render(<RevisionPanel revisions={mockRevisions} />)
    expect(screen.getByText('Inserted')).toBeInTheDocument()
    expect(screen.getByText('Deleted')).toBeInTheDocument()
    expect(screen.getByText('Moved from')).toBeInTheDocument()
  })

  it('filters revisions by type', async () => {
    const user = userEvent.setup()
    render(<RevisionPanel revisions={mockRevisions} />)

    const filter = screen.getByRole('combobox')
    await user.selectOptions(filter, 'insertions')

    expect(screen.getByText('This is inserted text')).toBeInTheDocument()
    expect(screen.queryByText('This was deleted')).not.toBeInTheDocument()
    expect(screen.queryByText('This was moved')).not.toBeInTheDocument()
  })

  it('shows all revisions when filter set to all', async () => {
    const user = userEvent.setup()
    render(<RevisionPanel revisions={mockRevisions} />)

    const filter = screen.getByRole('combobox')
    await user.selectOptions(filter, 'deletions')
    await user.selectOptions(filter, 'all')

    expect(screen.getByText('This is inserted text')).toBeInTheDocument()
    expect(screen.getByText('This was deleted')).toBeInTheDocument()
    expect(screen.getByText('This was moved')).toBeInTheDocument()
  })

  it('truncates long text and shows expand button', () => {
    const longRevision: Revision[] = [
      {
        author: 'Test Author',
        date: '2024-01-15T10:30:00Z',
        revisionType: 'Inserted',
        text: 'A'.repeat(200), // Text longer than 150 chars
      },
    ]

    render(<RevisionPanel revisions={longRevision} />)
    expect(screen.getByText('Show more')).toBeInTheDocument()
  })

  it('expands text when show more is clicked', async () => {
    const user = userEvent.setup()
    const longText = 'A'.repeat(200)
    const longRevision: Revision[] = [
      {
        author: 'Test Author',
        date: '2024-01-15T10:30:00Z',
        revisionType: 'Inserted',
        text: longText,
      },
    ]

    render(<RevisionPanel revisions={longRevision} />)

    await user.click(screen.getByText('Show more'))

    expect(screen.getByText('Show less')).toBeInTheDocument()
    expect(screen.getByText(longText)).toBeInTheDocument()
  })

  it('keeps expansion tied to the revision when the filter changes', async () => {
    const user = userEvent.setup()
    const deletedText = 'D'.repeat(200)
    const insertedText = 'I'.repeat(200)
    const revisions: Revision[] = [
      { author: 'A', date: '2024-01-15T10:30:00Z', revisionType: 'Deleted', text: deletedText },
      { author: 'B', date: '2024-01-16T10:30:00Z', revisionType: 'Inserted', text: insertedText },
    ]

    render(<RevisionPanel revisions={revisions} />)

    // Expand the inserted revision (second in the unfiltered list).
    const expandButtons = screen.getAllByText('Show more')
    await user.click(expandButtons[1])
    expect(screen.getByText(insertedText)).toBeInTheDocument()

    // Filtering to insertions shifts it to index 0 — expansion must follow the
    // revision, not the list position (previously it snapped back to collapsed).
    await user.selectOptions(screen.getByRole('combobox'), 'insertions')

    expect(screen.getByText('Show less')).toBeInTheDocument()
    expect(screen.getByText(insertedText)).toBeInTheDocument()
  })
})
