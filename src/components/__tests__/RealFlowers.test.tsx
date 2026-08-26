/**
 * @vitest-environment jsdom
 *
 * Testes para RealFlowers — defensive filtering of CMS flowers.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import RealFlowers from '../RealFlowers'

// ─── Mocks ──────────────────────────────────────────
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} data-fill={props.fill ? 'true' : undefined} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const BASE_DICT = {
  realFlowersTitle: 'Flores Verdadeiras',
  realFlowersSubtitle: 'Subtitle',
}

// ─── Helpers ────────────────────────────────────────
const cmsFlower = (overrides: Record<string, any> = {}) => ({
  name: 'Orquídea Vanda',
  scientificName: 'Vanda coerulea',
  image: { url: '/media/vanda.jpg' },
  ...overrides,
})

const fallbackName = 'Orquídea Vanda' // first fallback name

function renderRF(overrides: Record<string, any> = {}) {
  const defaults = {
    title: 'Flores Verdadeiras',
    subtitle: null,
    flowers: null,
    dict: BASE_DICT,
    locale: 'pt',
  }
  return render(<RealFlowers {...defaults} {...overrides} />)
}

describe('RealFlowers — flowers null → fallback', () => {
  it('renders fallback flowers when flowers is null', () => {
    renderRF({ flowers: null })
    expect(screen.getByText(fallbackName)).toBeInTheDocument()
  })

  it('renders fallback flowers when flowers is empty array', () => {
    renderRF({ flowers: [] })
    expect(screen.getByText(fallbackName)).toBeInTheDocument()
  })
})

describe('RealFlowers — CMS flowers with images', () => {
  it('renders CMS flowers when all have valid images', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda', image: { url: '/media/vanda.jpg' } }),
      cmsFlower({ name: 'Paphiopedilum', image: { url: '/media/paph.jpg' } }),
    ]
    renderRF({ flowers })
    expect(screen.getByText('Vanda')).toBeInTheDocument()
    expect(screen.getByText('Paphiopedilum')).toBeInTheDocument()
  })

  it('filters out flowers without image and renders only valid ones', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda', image: { url: '/media/vanda.jpg' } }),
      cmsFlower({ name: 'NoImage', image: null }),
      cmsFlower({ name: 'EmptyUrl', image: { url: '' } }),
    ]
    renderRF({ flowers })
    // Vanda should be rendered
    expect(screen.getByText('Vanda')).toBeInTheDocument()
    // NoImage and EmptyUrl should NOT render
    expect(screen.queryByText('NoImage')).not.toBeInTheDocument()
    expect(screen.queryByText('EmptyUrl')).not.toBeInTheDocument()
  })

  it('renders fallback when no CMS flower has a valid image', () => {
    const flowers = [
      cmsFlower({ name: 'NoImage', image: null }),
      cmsFlower({ name: 'EmptyUrl', image: { url: '' } }),
      cmsFlower({ name: 'NoUrlProp', image: { url: undefined } }),
    ]
    renderRF({ flowers })
    // Should fallback to hardcoded
    expect(screen.getByText(fallbackName)).toBeInTheDocument()
    // CMS names should not appear
    expect(screen.queryByText('NoImage')).not.toBeInTheDocument()
    expect(screen.queryByText('EmptyUrl')).not.toBeInTheDocument()
  })

  it('never renders <img> with empty src', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda', image: { url: '/media/vanda.jpg' } }),
      cmsFlower({ name: 'Bad', image: null }),
    ]
    const { container } = render(<RealFlowers {...{ title: 'T', dict: BASE_DICT, flowers, locale: 'pt' }} />)
    const imgs = container.querySelectorAll('img')
    imgs.forEach((img) => {
      expect(img.getAttribute('src')).not.toBe('')
    })
  })
})

describe('RealFlowers — image object shapes', () => {
  it('image as number (pre-populated ID) is treated as no-image', () => {
    const flowers = [cmsFlower({ name: 'NumId', image: 42 })]
    renderRF({ flowers })
    // Should fallback to hardcoded
    expect(screen.getByText(fallbackName)).toBeInTheDocument()
  })

  it('image as object with empty url treated as invalid', () => {
    const flowers = [cmsFlower({ name: 'Empty', image: { url: '' } })]
    renderRF({ flowers })
    expect(screen.getByText(fallbackName)).toBeInTheDocument()
    expect(screen.queryByText('Empty')).not.toBeInTheDocument()
  })
})