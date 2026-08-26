/**
 * @vitest-environment jsdom
 *
 * Testes para RealFlowers — hybrid fallback: CMS entries with legacy image fallback.
 * Priority: Payload image > seed id > scientificName > skip
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
  id: 'seed_vanda_0001',
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

  it('CMS entries without image but matching legacy id → shows with legacy image', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda Renamed', image: null }),
    ]
    renderRF({ flowers })
    // Vanda Renamed has seed id seed_vanda_0001 → legacy image used, CMS name shown
    expect(screen.getByText('Vanda Renamed')).toBeInTheDocument()
    // Should NOT render full fallback — only CMS-resolved flowers
    expect(screen.queryByText('Paphiopedilum')).not.toBeInTheDocument()
  })

  it('seeded flower with changed scientificName but no image → still shows legacy (by id)', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda Nova', scientificName: 'Novo nome científico', image: null }),
    ]
    renderRF({ flowers })
    // scientificName changed, but id=seed_vanda_0001 still matches → legacy image
    expect(screen.getByText('Vanda Nova')).toBeInTheDocument()
  })

  it('seeded id takes priority over scientificName', () => {
    // Entry with id=seed_vanda_0001 but scientificName that doesn't match any legacy
    const flowers = [
      cmsFlower({ name: 'Vanda', scientificName: 'Unknown species', image: null }),
    ]
    renderRF({ flowers })
    // Should still show because id matches seed_vanda_0001
    expect(screen.getByText('Vanda')).toBeInTheDocument()
  })

  it('new CMS flower (no legacy match) without image → filtered out', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda', image: { url: '/media/vanda.jpg' } }),
      cmsFlower({ name: 'New Flower', id: null, scientificName: 'Nova species', image: null }),
    ]
    renderRF({ flowers })
    expect(screen.getByText('Vanda')).toBeInTheDocument()
    // New flower without image should NOT render
    expect(screen.queryByText('New Flower')).not.toBeInTheDocument()
  })

  it('new CMS flower without image AND no legacy match → filtered out', () => {
    const flowers = [
      cmsFlower({ name: 'NoMatch', id: null, scientificName: 'Unknown species', image: null }),
    ]
    renderRF({ flowers })
    expect(screen.queryByText('NoMatch')).not.toBeInTheDocument()
  })

  it('never renders <img> with empty src', () => {
    const flowers = [
      cmsFlower({ name: 'Vanda', image: { url: '/media/vanda.jpg' } }),
      cmsFlower({ name: 'Bad', id: null, scientificName: 'Unknown', image: null }),
    ]
    const { container } = render(<RealFlowers {...{ title: 'T', dict: BASE_DICT, flowers, locale: 'pt' }} />)
    const imgs = container.querySelectorAll('img')
    imgs.forEach((img) => {
      expect(img.getAttribute('src')).not.toBe('')
    })
  })
})

describe('RealFlowers — image object shapes', () => {
  it('image as number (pre-populated ID) with legacy id → shows legacy image', () => {
    const flowers = [cmsFlower({ name: 'NumId', image: 42 })]
    renderRF({ flowers })
    // id=seed_vanda_0001 matches legacy → legacy image, CMS name
    expect(screen.getByText('NumId')).toBeInTheDocument()
  })

  it('image as number with NO legacy match → filtered out', () => {
    const flowers = [cmsFlower({ name: 'New', id: null, scientificName: 'New species', image: 42 })]
    renderRF({ flowers })
    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  it('image as object with empty url + legacy id → shows legacy image', () => {
    const flowers = [cmsFlower({ name: 'Empty', image: { url: '' } })]
    renderRF({ flowers })
    // id=seed_vanda_0001 matches → shows with legacy image
    expect(screen.getByText('Empty')).toBeInTheDocument()
  })
})

describe('RealFlowers — hybrid scenarios (spec-driven)', () => {
  it('6 CMS entries seeded without images → all 6 appear with legacy images', () => {
    const flowers = [
      cmsFlower({ id: 'seed_vanda_0001', name: 'Orquídea Vanda', scientificName: 'Vanda coerulea', image: null }),
      cmsFlower({ id: 'seed_paphiopedilum_0002', name: 'Paphiopedilum', scientificName: 'Paphiopedilum Pinocchio', image: null }),
      cmsFlower({ id: 'seed_sobralia_0003', name: 'Sobrália', scientificName: 'Sobralia rosea', image: null }),
      cmsFlower({ id: 'seed_cambria_0004', name: 'Cambria', scientificName: 'Cambria Africana', image: null }),
      cmsFlower({ id: 'seed_laelia_0005', name: 'Laelia', scientificName: 'Laelia purpurata', image: null }),
      cmsFlower({ id: 'seed_cattleya_0006', name: 'Cattleya', scientificName: 'Cattleya spp.', image: null }),
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
      cmsFlower({ id: 'seed_vanda_0001', name: 'Vanda', scientificName: 'Vanda coerulea', image: { url: '/media/vanda.jpg' } }),
      cmsFlower({ id: 'seed_paphiopedilum_0002', name: 'Paphiopedilum', scientificName: 'Paphiopedilum Pinocchio', image: null }),
      cmsFlower({ id: 'seed_sobralia_0003', name: 'Sobrália', scientificName: 'Sobralia rosea', image: null }),
      cmsFlower({ id: 'seed_cambria_0004', name: 'Cambria', scientificName: 'Cambria Africana', image: null }),
      cmsFlower({ id: 'seed_laelia_0005', name: 'Laelia', scientificName: 'Laelia purpurata', image: null }),
      cmsFlower({ id: 'seed_cattleya_0006', name: 'Cattleya', scientificName: 'Cattleya spp.', image: null }),
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
      cmsFlower({ id: 'seed_vanda_0001', name: 'Vanda', scientificName: 'Vanda coerulea', image: null }),
      cmsFlower({ id: null, name: 'New Flower', scientificName: 'Nova species', image: { url: '/media/new.jpg' } }),
    ]
    renderRF({ flowers })
    expect(screen.getByText('Vanda')).toBeInTheDocument()
    expect(screen.getByText('New Flower')).toBeInTheDocument()
  })

  it('new flower without image → does not break site', () => {
    const flowers = [
      cmsFlower({ id: 'seed_vanda_0001', name: 'Vanda', scientificName: 'Vanda coerulea', image: { url: '/media/vanda.jpg' } }),
      cmsFlower({ id: null, name: 'Invisible', scientificName: 'Unknown', image: null }),
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