import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RevisionPanel } from './RevisionPanel'
import type { Revision } from 'docxodus/react'

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
        text: 'A'.repeat(150), // Text longer than 100 chars
      },
    ]

    render(<RevisionPanel revisions={longRevision} />)
    expect(screen.getByText('Show more')).toBeInTheDocument()
  })

  it('expands text when show more is clicked', async () => {
    const user = userEvent.setup()
    const longText = 'A'.repeat(150)
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
})
