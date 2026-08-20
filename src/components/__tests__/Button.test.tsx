/**
 * @vitest-environment jsdom
 *
 * Testes para o componente Button:
 * - href interno → Next.js <Link> (não toca no href)
 * - href externo → <a> nativo (sem locale prefix)
 * - target/rel preservados
 * - variant/styles aplicados
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import Button from '../Button'

// Mock Next.js Link to render as <a> so we can test attributes
vi.mock('next/link', () => ({
  default: ({ href, target, rel, children, ...props }: any) => (
    <a href={href} target={target} rel={rel} {...props}>
      {children}
    </a>
  ),
}))

describe('Button — internal vs external href', () => {
  it('renders internal href', () => {
    render(<Button href="/catalog">Catalog</Button>)
    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/catalog')
  })

  it('renders external https:// href as <a nativo>', () => {
    render(<Button href="https://wa.me/351935607241">WhatsApp</Button>)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://wa.me/351935607241')
    // Must NOT be locale-prefixed
    expect(link).not.toHaveAttribute('href', '/pt/https://wa.me/351935607241')
    expect(link).not.toHaveAttribute('href', '/en/https://wa.me/351935607241')
  })

  it('external href preserves target and rel', () => {
    render(
      <Button href="https://wa.me/351935607241" target="_blank" rel="noopener noreferrer">
        WhatsApp
      </Button>,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('external http:// href works', () => {
    render(<Button href="http://example.com">HTTP</Button>)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'http://example.com')
  })

  it('internal href does not add target/rel when not provided', () => {
    render(<Button href="/catalog">Catalog</Button>)
    const link = screen.getByRole('link')
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('rel')
  })

  it('applies variant primary class', () => {
    render(<Button href="/catalog" variant="primary">Catalog</Button>)
    const link = screen.getByRole('link')
    expect(link.className).toContain('bg-brand-gold')
  })

  it('applies variant secondary class', () => {
    render(<Button href="/catalog" variant="secondary">Catalog</Button>)
    const link = screen.getByRole('link')
    expect(link.className).toContain('border-brand-gold/40')
  })

  it('applies variant ghost class', () => {
    render(<Button href="/catalog" variant="ghost">Catalog</Button>)
    const link = screen.getByRole('link')
    expect(link.className).toContain('border-white/30')
  })

  it('renders as button when no href', () => {
    render(<Button>Click</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeInTheDocument()
    expect(btn).not.toHaveAttribute('href')
  })

  it('external https:// href never gets locale prefix for any locale', () => {
    const { rerender } = render(
      <Button href="https://wa.me/351935607241" target="_blank" rel="noopener noreferrer">
        WA
      </Button>,
    )
    // Button itself doesn't locale-prefix — that's CTAFinal's job.
    // This test proves Button does not corrupt the href.
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://wa.me/351935607241')
    // No /pt/ or /en/ prefix leaked into the href
    expect(link.getAttribute('href')).not.toMatch(/^\/[a-z]{2}\//)
  })
})