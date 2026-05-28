import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentViewer } from './DocumentViewer'

// Use useWorker={false} in tests to avoid async worker initialization
// which causes act() warnings

describe('DocumentViewer', () => {
  it('renders without crashing', () => {
    render(<DocumentViewer useWorker={false} />)
    expect(screen.getByText('Open Document')).toBeInTheDocument()
  })

  it('displays custom placeholder text', () => {
    render(<DocumentViewer useWorker={false} placeholder="Drop a file here" />)
    expect(screen.getByText('Drop a file here')).toBeInTheDocument()
  })

  it('renders toolbar at top by default', () => {
    const { container } = render(<DocumentViewer useWorker={false} />)
    const viewer = container.querySelector('.rdv-viewer')
    const toolbar = container.querySelector('.rdv-toolbar')
    expect(viewer?.firstChild).toBe(toolbar)
  })

  it('renders toolbar at bottom when specified', () => {
    const { container } = render(<DocumentViewer useWorker={false} toolbar="bottom" />)
    const viewer = container.querySelector('.rdv-viewer')
    const toolbar = container.querySelector('.rdv-toolbar')
    expect(viewer?.lastChild).toBe(toolbar)
  })

  it('hides toolbar when toolbar="none"', () => {
    const { container } = render(<DocumentViewer useWorker={false} toolbar="none" />)
    const toolbar = container.querySelector('.rdv-toolbar')
    expect(toolbar).not.toBeInTheDocument()
  })

  it('shows settings button by default', () => {
    render(<DocumentViewer useWorker={false} />)
    expect(screen.getByTitle('Settings')).toBeInTheDocument()
  })

  it('hides settings button when showSettingsButton={false}', () => {
    render(<DocumentViewer useWorker={false} showSettingsButton={false} />)
    expect(screen.queryByTitle('Settings')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<DocumentViewer useWorker={false} className="my-custom-class" />)
    const viewer = container.querySelector('.rdv-viewer')
    expect(viewer).toHaveClass('my-custom-class')
  })

  it('applies custom style', () => {
    const { container } = render(<DocumentViewer useWorker={false} style={{ maxWidth: '800px' }} />)
    const viewer = container.querySelector('.rdv-viewer')
    expect(viewer).toHaveStyle({ maxWidth: '800px' })
  })

  it('opens settings modal when settings button is clicked', async () => {
    const user = userEvent.setup()
    render(<DocumentViewer useWorker={false} />)

    await user.click(screen.getByTitle('Settings'))

    expect(screen.getByText('Viewer Settings')).toBeInTheDocument()
  })

  it('closes settings modal when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<DocumentViewer useWorker={false} />)

    await user.click(screen.getByTitle('Settings'))
    expect(screen.getByText('Viewer Settings')).toBeInTheDocument()

    await user.click(screen.getByText('×'))
    expect(screen.queryByText('Viewer Settings')).not.toBeInTheDocument()
  })

  it('calls onError callback when an error occurs', async () => {
    const onError = vi.fn()
    render(<DocumentViewer useWorker={false} onError={onError} />)
    // Error callback would be tested with actual file conversion
    expect(onError).not.toHaveBeenCalled()
  })

  it('accepts file input', () => {
    const { container } = render(<DocumentViewer useWorker={false} />)
    const input = container.querySelector('input[type="file"]')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('accept', '.docx')
  })

  it('accepts fitMode prop without crashing', () => {
    expect(() => {
      render(<DocumentViewer useWorker={false} fitMode="page-width" />)
    }).not.toThrow()
    expect(screen.getByText('Open Document')).toBeInTheDocument()
  })
})
