/**
 * @vitest-environment jsdom
 *
 * Testes para RealFlowers — hybrid fallback: CMS entries with legacy image fallback.
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

describe('RealFlowers — A. CMS null/empty → full fallback', () => {
  it('renders fallback flowers when flowers is null', () => {
    renderRF({ flowers: null })
    expect(screen.getByText(fallbackName)).toBeInTheDocument()
  })

  it('renders all 6 fallback flowers when flowers is empty array', () => {
    renderRF({ flowers: [] })
    expect(screen.getByText(fallbackName)).toBeInTheDocument()
    expect(screen.getByText('Cattleya')).toBeInTheDocument()
  })
})

describe('RealFlowers — B. CMS has entries, hybrid resolution', () => {
  it('renders CMS flowers with Payload images', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda CMS', image: { url: '/media/vanda.jpg' } }),
      cmsFlower({ name: 'Paphiopedilum CMS', scientificName: 'Paphiopedilum Pinocchio', image: { url: '/media/paph.jpg' } }),
    ]
    renderRF({ flowers })
    expect(screen.getByText('Vanda CMS')).toBeInTheDocument()
    expect(screen.getByText('Paphiopedilum CMS')).toBeInTheDocument()
  })

  it('CMS entries without image but matching legacy → shows with legacy image', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda Renamed', image: null }),
    ]
    renderRF({ flowers })
    // Vanda Renamed matches Vanda coerulea → legacy image used, CMS name shown
    expect(screen.getByText('Vanda Renamed')).toBeInTheDocument()
    // Should NOT render full fallback — only CMS-resolved flowers
    expect(screen.queryByText('Paphiopedilum')).not.toBeInTheDocument()
  })

  it('new CMS flower (no legacy match) without image → filtered out', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda', image: { url: '/media/vanda.jpg' } }),
      cmsFlower({ name: 'New Flower', scientificName: 'Nova species', image: null }),
    ]
    renderRF({ flowers })
    expect(screen.getByText('Vanda')).toBeInTheDocument()
    // New flower without image should NOT render
    expect(screen.queryByText('New Flower')).not.toBeInTheDocument()
  })

  it('new CMS flower without image AND no legacy match → filtered out', () => {
    const flowers = [
      cmsFlower({ name: 'NoMatch', scientificName: 'Unknown species', image: null }),
    ]
    renderRF({ flowers })
    // No match → no legacy image, and no Payload image → nothing rendered
    // But Section title should still render
    expect(screen.queryByText('NoMatch')).not.toBeInTheDocument()
  })

  it('never renders <img> with empty src', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda', image: { url: '/media/vanda.jpg' } }),
      cmsFlower({ name: 'Bad', scientificName: 'Unknown', image: null }),
    ]
    const { container } = render(<RealFlowers {...{ title: 'T', dict: BASE_DICT, flowers, locale: 'pt' }} />)
    const imgs = container.querySelectorAll('img')
    imgs.forEach((img) => {
      expect(img.getAttribute('src')).not.toBe('')
    })
  })
})

describe('RealFlowers — image object shapes', () => {
  it('image as number (pre-populated ID) with legacy match → shows legacy image', () => {
    const flowers = [cmsFlower({ name: 'NumId', image: 42 })]
    renderRF({ flowers })
    // scientificName 'Vanda coerulea' matches legacy → legacy image, CMS name
    expect(screen.getByText('NumId')).toBeInTheDocument()
  })

  it('image as number with NO legacy match → filtered out', () => {
    const flowers = [cmsFlower({ name: 'New', scientificName: 'New species', image: 42 })]
    renderRF({ flowers })
    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  it('image as object with empty url + legacy match → shows legacy image', () => {
    const flowers = [cmsFlower({ name: 'Empty', image: { url: '' } })]
    renderRF({ flowers })
    // scientificName 'Vanda coerulea' matches → shows with legacy image
    expect(screen.getByText('Empty')).toBeInTheDocument()
  })
})

describe('RealFlowers — hybrid scenarios (spec-driven)', () => {
  it('6 CMS entries seeded without images → all 6 appear with legacy images', () => {
    const flowers = [
      cmsFlower({ name: 'Orquídea Vanda', scientificName: 'Vanda coerulea', image: null }),
      cmsFlower({ name: 'Paphiopedilum', scientificName: 'Paphiopedilum Pinocchio', image: null }),
      cmsFlower({ name: 'Sobrália', scientificName: 'Sobralia rosea', image: null }),
      cmsFlower({ name: 'Cambria', scientificName: 'Cambria Africana', image: null }),
      cmsFlower({ name: 'Laelia', scientificName: 'Laelia purpurata', image: null }),
      cmsFlower({ name: 'Cattleya', scientificName: 'Cattleya spp.', image: null }),
    ]
    renderRF({ flowers })
    expect(screen.getByText('Orquídea Vanda')).toBeInTheDocument()
    expect(screen.getByText('Paphiopedilum')).toBeInTheDocument()
    expect(screen.getByText('Sobrália')).toBeInTheDocument()
    expect(screen.getByText('Cambria')).toBeInTheDocument()
    expect(screen.getByText('Laelia')).toBeInTheDocument()
    expect(screen.getByText('Cattleya')).toBeInTheDocument()
  })

  it('1 CMS image + 5 legacy → 6 displayed', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda', scientificName: 'Vanda coerulea', image: { url: '/media/vanda.jpg' } }),
      cmsFlower({ name: 'Paphiopedilum', scientificName: 'Paphiopedilum Pinocchio', image: null }),
      cmsFlower({ name: 'Sobrália', scientificName: 'Sobralia rosea', image: null }),
      cmsFlower({ name: 'Cambria', scientificName: 'Cambria Africana', image: null }),
      cmsFlower({ name: 'Laelia', scientificName: 'Laelia purpurata', image: null }),
      cmsFlower({ name: 'Cattleya', scientificName: 'Cattleya spp.', image: null }),
    ]
    renderRF({ flowers })
    expect(screen.getByText('Vanda')).toBeInTheDocument()
    expect(screen.getByText('Paphiopedilum')).toBeInTheDocument()
    expect(screen.getByText('Sobrália')).toBeInTheDocument()
    expect(screen.getByText('Cambria')).toBeInTheDocument()
    expect(screen.getByText('Laelia')).toBeInTheDocument()
    expect(screen.getByText('Cattleya')).toBeInTheDocument()
  })

  it('7th CMS flower with image → 7 displayed', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda', scientificName: 'Vanda coerulea', image: null }),
      cmsFlower({ name: 'New Flower', scientificName: 'Nova species', image: { url: '/media/new.jpg' } }),
    ]
    renderRF({ flowers })
    expect(screen.getByText('Vanda')).toBeInTheDocument()
    expect(screen.getByText('New Flower')).toBeInTheDocument()
  })

  it('new flower without image → does not break site', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda', scientificName: 'Vanda coerulea', image: { url: '/media/vanda.jpg' } }),
      cmsFlower({ name: 'Invisible', scientificName: 'Unknown', image: null }),
    ]
    const { container } = renderRF({ flowers })
    // Should render without throwing
    expect(screen.getByText('Vanda')).toBeInTheDocument()
    // No empty src
    const imgs = container.querySelectorAll('img')
    imgs.forEach((img) => {
      expect(img.getAttribute('src')).not.toBe('')
    })
  })
})