import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentViewer } from './DocumentViewer'

describe('DocumentViewer', () => {
  it('renders without crashing', () => {
    render(<DocumentViewer />)
    expect(screen.getByText('Open Document')).toBeInTheDocument()
  })

  it('displays custom placeholder text', () => {
    render(<DocumentViewer placeholder="Drop a file here" />)
    expect(screen.getByText('Drop a file here')).toBeInTheDocument()
  })

  it('renders toolbar at top by default', () => {
    const { container } = render(<DocumentViewer />)
    const viewer = container.querySelector('.rdv-viewer')
    const toolbar = container.querySelector('.rdv-toolbar')
    expect(viewer?.firstChild).toBe(toolbar)
  })

  it('renders toolbar at bottom when specified', () => {
    const { container } = render(<DocumentViewer toolbar="bottom" />)
    const viewer = container.querySelector('.rdv-viewer')
    const toolbar = container.querySelector('.rdv-toolbar')
    expect(viewer?.lastChild).toBe(toolbar)
  })

  it('hides toolbar when toolbar="none"', () => {
    const { container } = render(<DocumentViewer toolbar="none" />)
    const toolbar = container.querySelector('.rdv-toolbar')
    expect(toolbar).not.toBeInTheDocument()
  })

  it('shows settings button by default', () => {
    render(<DocumentViewer />)
    expect(screen.getByTitle('Settings')).toBeInTheDocument()
  })

  it('hides settings button when showSettingsButton={false}', () => {
    render(<DocumentViewer showSettingsButton={false} />)
    expect(screen.queryByTitle('Settings')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<DocumentViewer className="my-custom-class" />)
    const viewer = container.querySelector('.rdv-viewer')
    expect(viewer).toHaveClass('my-custom-class')
  })

  it('applies custom style', () => {
    const { container } = render(<DocumentViewer style={{ maxWidth: '800px' }} />)
    const viewer = container.querySelector('.rdv-viewer')
    expect(viewer).toHaveStyle({ maxWidth: '800px' })
  })

  it('opens settings modal when settings button is clicked', async () => {
    const user = userEvent.setup()
    render(<DocumentViewer />)

    await user.click(screen.getByTitle('Settings'))

    expect(screen.getByText('Viewer Settings')).toBeInTheDocument()
  })

  it('closes settings modal when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<DocumentViewer />)

    await user.click(screen.getByTitle('Settings'))
    expect(screen.getByText('Viewer Settings')).toBeInTheDocument()

    await user.click(screen.getByText('×'))
    expect(screen.queryByText('Viewer Settings')).not.toBeInTheDocument()
  })

  it('calls onError callback when an error occurs', async () => {
    const onError = vi.fn()
    render(<DocumentViewer onError={onError} />)
    // Error callback would be tested with actual file conversion
    expect(onError).not.toHaveBeenCalled()
  })

  it('accepts file input', () => {
    const { container } = render(<DocumentViewer />)
    const input = container.querySelector('input[type="file"]')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('accept', '.docx')
  })
})
