/**
 * @vitest-environment jsdom
 *
 * Testes para FounderHero — locale-aware button links.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import FounderHero from '../FounderHero'

// ─── Mocks ──────────────────────────────────────────
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} data-fill={props.fill ? 'true' : undefined} />
  ),
}))

const BASE_DICT = {
  heroCtaDiscover: 'Descobrir',
  heroCtaAbout: 'Sobre Nós',
  scroll: 'Scroll',
}

function renderHero(overrides: Record<string, any> = {}) {
  const defaults = {
    dict: BASE_DICT,
    locale: 'pt',
  }
  return render(<FounderHero {...defaults} {...overrides} />)
}

describe('FounderHero — button links locale-aware', () => {
  it('primaryButtonLink /catalog → /pt/catalog for PT', () => {
    renderHero({ primaryButtonLink: '/catalog', locale: 'pt' })
    const links = screen.getAllByRole('link')
    const primary = links.find(l => l.textContent === 'Descobrir')
    expect(primary).toHaveAttribute('href', '/pt/catalog')
  })

  it('primaryButtonLink /catalog → /en/catalog for EN', () => {
    renderHero({ primaryButtonLink: '/catalog', locale: 'en' })
    const links = screen.getAllByRole('link')
    const primary = links.find(l => l.textContent === 'Descobrir')
    expect(primary).toHaveAttribute('href', '/en/catalog')
  })

  it('secondaryButtonLink /about → /pt/about for PT', () => {
    renderHero({ secondaryButtonLink: '/about', locale: 'pt' })
    const links = screen.getAllByRole('link')
    const secondary = links.find(l => l.textContent === 'Sobre Nós')
    expect(secondary).toHaveAttribute('href', '/pt/about')
  })

  it('secondaryButtonLink /about → /en/about for EN', () => {
    renderHero({ secondaryButtonLink: '/about', locale: 'en' })
    const links = screen.getAllByRole('link')
    const secondary = links.find(l => l.textContent === 'Sobre Nós')
    expect(secondary).toHaveAttribute('href', '/en/about')
  })

  it('replaces existing locale prefix in link', () => {
    renderHero({ primaryButtonLink: '/pt/catalog', locale: 'en' })
    const links = screen.getAllByRole('link')
    const primary = links.find(l => l.textContent === 'Descobrir')
    expect(primary).toHaveAttribute('href', '/en/catalog')
  })

  it('external URL is passed through unchanged', () => {
    renderHero({
      primaryButtonLink: 'https://instagram.com/eternal.flowers.pt',
      locale: 'pt',
    })
    const links = screen.getAllByRole('link')
    const primary = links.find(l => l.textContent === 'Descobrir')
    expect(primary).toHaveAttribute('href', 'https://instagram.com/eternal.flowers.pt')
  })

  it('falls back to /{locale}/catalog when primaryButtonLink is null', () => {
    renderHero({ primaryButtonLink: null, locale: 'pt' })
    const links = screen.getAllByRole('link')
    const primary = links.find(l => l.textContent === 'Descobrir')
    expect(primary).toHaveAttribute('href', '/pt/catalog')
  })

  it('falls back to /{locale}/about when secondaryButtonLink is null', () => {
    renderHero({ secondaryButtonLink: null, locale: 'en' })
    const links = screen.getAllByRole('link')
    const secondary = links.find(l => l.textContent === 'Sobre Nós')
    expect(secondary).toHaveAttribute('href', '/en/about')
  })

  it('badge contains "Lisboa" no Hero', () => {
    renderHero({ locale: 'pt' })
    expect(screen.getByText(/Lisboa/)).toBeInTheDocument()
  })
})