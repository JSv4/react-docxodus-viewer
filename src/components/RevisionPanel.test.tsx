import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RevisionPanel } from './RevisionPanel'
import type { DocxDiffRevision as Revision, RevisionListEntry, FormatChangeDetails } from 'docxodus/core'

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

  it.each([
    { type: 'structure', family: 'cell_merge', filter: 'structural', label: 'cell merge' },
    { type: 'format', family: 'properties_change', filter: 'formatting', label: 'Formatted' },
  ] as const)('retains $type diagnostics and disables unsafe resolution', async ({ type, family, filter, label }) => {
    const onAccept = vi.fn();
    const revision = native({ type, family, resolutionStatus: 'ambiguous', diagnostic: { code: 'ambiguous_pair', message: 'This change has conflicting markers.' } });
    render(<RevisionPanel revisions={[revision]} onAccept={onAccept} onAcceptAll={vi.fn()} formatDetails={{ [revision.id]: {
      oldProperties: { bold: 'false' }, newProperties: { bold: 'false' },
    } }} />);
    await userEvent.setup().selectOptions(screen.getByRole('combobox'), filter);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('This change has conflicting markers.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Accept all' })).toBeDisabled();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('renders empty state when no revisions', () => {
    render(<RevisionPanel revisions={[]} />)
    expect(screen.getByText('No tracked changes found in this document.')).toBeInTheDocument()
  })

  it.each(['comparison', 'native'] as const)('shows only actual formatting differences for %s revisions', async (source) => {
    const unchanged: FormatChangeDetails = {
      oldProperties: { justification: 'Left', spacingAfter: '0' },
      newProperties: { justification: 'Left', spacingAfter: '0' },
    }
    const changed: FormatChangeDetails = {
      oldProperties: { ...unchanged.oldProperties, bold: 'false', fontSize: '20', underline: 'single' },
      newProperties: { ...unchanged.newProperties, bold: 'true', fontSize: '24', italic: 'true' },
    }
    const entries = [
      { text: 'Unchanged heading', details: unchanged },
      { text: 'Changed heading', details: changed },
    ]
    const revisions = entries.map(({ text, details }) => source === 'native'
      ? native({ id: text, type: 'format', family: 'properties_change', text })
      : { ...mockRevisions[0], revisionType: 'FormatChanged', text, formatChange: details })
    const { container } = render(<RevisionPanel
      revisions={[...revisions, { ...mockRevisions[0], formatChange: unchanged }]}
      formatDetails={Object.fromEntries(entries.map(({ text, details }) => [text, details]))}
    />)

    expect(Array.from(container.querySelectorAll('.rdv-format-change'), row => row.textContent)).toEqual([
      'BoldNo→Yes', 'Font Size20→24', 'UnderlineSingle(removed)', 'ItalicYes(added)',
    ])
    expect(screen.queryByText('Unchanged heading')).not.toBeInTheDocument()
    expect(screen.getByText('This is inserted text')).toBeInTheDocument()
    expect(screen.getByText('2 changes')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Formatting (1)' })).toBeInTheDocument()
    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'formatting')
    expect(screen.getByText('Changed heading')).toBeInTheDocument()
    expect(screen.queryByText('This is inserted text')).not.toBeInTheDocument()
  })

  it('keeps changes with incomplete evidence or unprintable properties', () => {
    const entries: Array<{ text: string; formatChange?: FormatChangeDetails }> = [
      { text: 'No formatting evidence' },
      { text: 'Missing old snapshot', formatChange: { newProperties: {} } },
      { text: 'Missing new snapshot', formatChange: { oldProperties: {} } },
      { text: 'Empty snapshots', formatChange: { oldProperties: {}, newProperties: {} } },
      { text: 'Unmodeled run change', formatChange: { oldProperties: {}, newProperties: {}, changedPropertyNames: [] } },
      { text: 'Unmodeled change beside equal bold', formatChange: { oldProperties: { bold: 'true' }, newProperties: { bold: 'true' }, changedPropertyNames: [] } },
      { text: 'Table shell changed', formatChange: { oldProperties: {}, newProperties: {}, changedPropertyNames: ['shell'], scope: 'table' } },
      { text: 'Border XML changed', formatChange: { oldProperties: { border: '<w:top w:val="single"/>' }, newProperties: { border: '<w:top w:val="double"/>' } } },
    ]
    const { container } = render(<RevisionPanel revisions={entries.map(entry => ({
      ...mockRevisions[0], revisionType: 'FormatChanged', ...entry,
    }))} />)
    for (const { text } of entries) expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.getByText('8 changes')).toBeInTheDocument()
    expect(container.querySelector('.rdv-format-change')).not.toBeInTheDocument()
  })

  it('shows the empty state when arriving evidence proves the only revision unchanged', () => {
    const revision = native({ type: 'format', family: 'properties_change', text: 'Same paragraph' })
    const { rerender } = render(<RevisionPanel revisions={[revision]} />)
    expect(screen.getByText('Same paragraph')).toBeInTheDocument()
    rerender(<RevisionPanel revisions={[revision]} formatDetails={{ [revision.id]: {
      oldProperties: { keepNext: 'false' }, newProperties: { keepNext: 'false' },
    } }} />)
    expect(screen.getByText('No tracked changes found in this document.')).toBeInTheDocument()
    expect(screen.queryByText('Same paragraph')).not.toBeInTheDocument()
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
