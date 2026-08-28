/**
 * @vitest-environment jsdom
 *
 * Testes para CategoriesSection:
 * - imagem card/image.url fallback
 * - placeholder sem imagem
 * - sem emojis fallback
 * - isActive, sortOrder, link locale
 * - nome/descrição visíveis
 * - Media como ID numérico
 * - image sem url válida
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import CategoriesSection from '../CategoriesSection'

// ─── Mocks ──────────────────────────────────────────
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} data-fill={props.fill ? 'true' : undefined} data-sizes={props.sizes} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const BASE_DICT = {
  categoriesTitle: 'Categorias',
  categoriesSubtitle: 'Explora as nossas peças',
}

type CategoryOverrides = Record<string, any>

function renderCategories(categories: CategoryOverrides[] = [], locale = 'pt', dict = BASE_DICT) {
  return render(<CategoriesSection categories={categories} locale={locale} dict={dict} />)
}

// ─── HELPERS ────────────────────────────────────────
const makeMediaCard = (url: string) => ({
  url: 'https://cdn.eternalflowers.pt/full.jpg',
  sizes: { card: { url }, thumbnail: { url: 'https://cdn.eternalflowers.pt/thumb.jpg' } },
})

const makeMediaNoCard = (url: string) => ({
  url,
  sizes: { thumbnail: { url: 'https://cdn.eternalflowers.pt/thumb.jpg' } },
})

const makeMediaNoUrl = () => ({
  url: null,
  sizes: { card: { url: null } },
})

const defaultCat: CategoryOverrides = {
  id: '1',
  name: 'Brincos',
  slug: 'brincos',
  description: 'Brincos elegantes',
  image: makeMediaCard('https://cdn.eternalflowers.pt/card-brincos.jpg'),
  sortOrder: 1,
  isActive: true,
}

function cat(overrides: CategoryOverrides = {}): CategoryOverrides {
  return { ...defaultCat, ...overrides }
}

// ─── TESTES ─────────────────────────────────────────

describe('CategoriesSection — image handling', () => {
  it('1: usa image.sizes.card.url quando disponível', () => {
    renderCategories([cat()])
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://cdn.eternalflowers.pt/card-brincos.jpg')
  })

  it('2: usa image.url quando não existe sizes.card.url', () => {
    renderCategories([cat({ image: makeMediaNoCard('https://cdn.eternalflowers.pt/full.jpg') })])
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://cdn.eternalflowers.pt/full.jpg')
  })

  it('3: sem imagem — não renderiza <img> inválida', () => {
    renderCategories([cat({ image: null })])
    const imgs = screen.queryAllByRole('img')
    // There should be no <img> elements (the placeholder is a div, not an img)
    expect(imgs).toHaveLength(0)
  })

  it('4: sem imagem — sem emoji fallback (💎💍🌙📿🔗✨🏺🌿)', () => {
    renderCategories([cat({ image: null })])
    const text = document.body.textContent || ''
    const forbiddenEmojis = ['💎', '💍', '🌙', '📿', '🔗', '✨', '🏺', '🌿']
    for (const emoji of forbiddenEmojis) {
      expect(text).not.toContain(emoji)
    }
  })

  it('5: isActive=false — categoria não aparece', () => {
    const { container } = renderCategories([
      cat({ id: '1', name: 'Brincos', slug: 'brincos', isActive: false }),
      cat({ id: '2', name: 'Anéis', slug: 'aneis', isActive: true }),
    ])
    const links = container.querySelectorAll('a')
    const slugs = Array.from(links).map((a) => a.getAttribute('href'))
    expect(slugs).not.toContain('/pt/category/brincos')
    expect(slugs).toContain('/pt/category/aneis')
  })

  it('6: sortOrder — ordem correta', () => {
    const { container } = renderCategories([
      cat({ id: '1', name: 'Z', slug: 'z', sortOrder: 10 }),
      cat({ id: '2', name: 'A', slug: 'a', sortOrder: 1 }),
    ])
    const links = container.querySelectorAll('a')
    expect(links[0]).toHaveAttribute('href', '/pt/category/a')
    expect(links[1]).toHaveAttribute('href', '/pt/category/z')
  })

  it('7: link correto — /{locale}/category/{slug}', () => {
    const { unmount } = renderCategories([
      cat({ id: '1', name: 'Brincos', slug: 'brincos' }),
    ], 'pt')
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/pt/category/brincos')

    unmount()

    const { unmount: unmount2 } = renderCategories([
      cat({ id: '1', name: 'Earrings', slug: 'earrings' }),
    ], 'en')
    const linkEn = screen.getByRole('link')
    expect(linkEn).toHaveAttribute('href', '/en/category/earrings')
    unmount2()
  })

  it('8: nome e descrição continuam a renderizar', () => {
    renderCategories([cat({ name: 'Brincos', description: 'Descrição especial' })])
    expect(screen.getByText('Brincos')).toBeInTheDocument()
    expect(screen.getByText('Descrição especial')).toBeInTheDocument()
  })

  it('9: Media como ID numérico — não quebra e usa placeholder', () => {
    renderCategories([cat({ image: 42 })])
    // Should not throw; no img rendered, just placeholder
    const imgs = screen.queryAllByRole('img')
    expect(imgs).toHaveLength(0)
    // Name should still be visible
    expect(screen.getByText('Brincos')).toBeInTheDocument()
  })

  it('10: image com object sem url válida — não cria src vazio', () => {
    renderCategories([cat({ image: makeMediaNoUrl() })])
    const imgs = screen.queryAllByRole('img')
    // Should not render an img with src="" or src=null
    expect(imgs).toHaveLength(0)
  })
})

describe('CategoriesSection — comportamento básico', () => {
  it('retorna null quando não há categorias', () => {
    const { container } = renderCategories([])
    expect(container.innerHTML).toBe('')
  })

  it('retorna null quando todas são inativas', () => {
    const { container } = renderCategories([
      cat({ id: '1', isActive: false }),
    ])
    expect(container.innerHTML).toBe('')
  })
})
