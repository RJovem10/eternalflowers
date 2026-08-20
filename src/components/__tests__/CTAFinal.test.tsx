/**
 * @vitest-environment jsdom
 *
 * Testes para o componente CTAFinal:
 * - link interno → /{locale}/{path}
 * - link externo → raw URL, target=_blank, rel=noopener noreferrer
 * - WhatsApp URL
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import CTAFinal from '../CTAFinal'

// ─── Mock Next.js Link ──────────────────────────────────
// The Button component uses next/link. In jsdom we just
// verify the rendered <a> element attributes.
vi.mock('next/link', () => ({
  default: ({ href, target, rel, children, ...props }: any) => (
    <a href={href} target={target} rel={rel} {...props}>
      {children}
    </a>
  ),
}))

const BASE_DICT = { ctaLabel: 'CTA' }

function renderCTA(overrides: Partial<Parameters<typeof CTAFinal>[0]> = {}) {
  const defaults = {
    title: 'Test Title',
    buttonText: 'Test Button',
    buttonLink: '/catalog',
    locale: 'pt',
    dict: BASE_DICT,
  }
  return render(<CTAFinal {...defaults} {...overrides} />)
}

describe('CTAFinal — internal vs external links', () => {
  it('internal link gets /{locale}/ prefix', () => {
    renderCTA({ buttonLink: '/catalog', locale: 'pt' })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/pt/catalog')
  })

  it('internal link without leading slash also works', () => {
    renderCTA({ buttonLink: 'catalog', locale: 'pt' })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/pt/catalog')
  })

  it('internal link does not get target or rel', () => {
    renderCTA({ buttonLink: '/catalog', locale: 'pt' })
    const link = screen.getByRole('link')
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('rel')
  })

  it('external http URL used directly without locale prefix', () => {
    renderCTA({ buttonLink: 'https://wa.me/351935607241', locale: 'pt' })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://wa.me/351935607241')
    expect(link).not.toHaveAttribute('href', '/pt/https://wa.me/351935607241')
  })

  it('external URL adds target=_blank and rel=noopener noreferrer', () => {
    renderCTA({ buttonLink: 'https://wa.me/351935607241', locale: 'pt' })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('external URL works for all locales', () => {
    for (const locale of ['pt', 'en', 'es', 'it', 'de']) {
      const { unmount } = renderCTA({ buttonLink: 'https://wa.me/351935607241', locale })
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', 'https://wa.me/351935607241')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      unmount()
    }
  })

  it('internal link respects locale for all locales', () => {
    for (const locale of ['pt', 'en', 'es', 'it', 'de']) {
      const { unmount } = renderCTA({ buttonLink: '/catalog', locale })
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', `/${locale}/catalog`)
      unmount()
    }
  })

  it('fallback to / when buttonLink is undefined-like', () => {
    renderCTA({ buttonLink: 'undefined', locale: 'pt' })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/pt/')
  })

  it('WhatsApp URL is treated as external', () => {
    renderCTA({ buttonLink: 'https://wa.me/351935607241', locale: 'en' })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://wa.me/351935607241')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})