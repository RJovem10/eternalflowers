/**
 * @vitest-environment jsdom
 *
 * Testes para o Footer — verificação de logo, links e traduções.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { dictionaries, locales } from '@/i18n/dictionaries'
import Footer from '@/components/Footer'

describe('Footer — logo substitution', () => {
  const dict = { ...dictionaries.pt }
  const defaultProps = { locale: 'pt', dict }

  it('NÃO contém o emoji 🌺', () => {
    const { container, unmount } = render(<Footer {...defaultProps} />)
    expect(container.innerHTML).not.toContain('🌺')
    unmount()
  })

  it('contém imagem com src /images/eternal-flowers-logo.jpg', () => {
    const { container, unmount } = render(<Footer {...defaultProps} />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toMatch(/eternal-flowers-logo\.jpg/)
    unmount()
  })

  it('logo tem width=24 e height=24', () => {
    const { container, unmount } = render(<Footer {...defaultProps} />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('width', '24')
    expect(img).toHaveAttribute('height', '24')
    unmount()
  })

  it('logo tem alt vazio (decorativa)', () => {
    const { container, unmount } = render(<Footer {...defaultProps} />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('alt', '')
    unmount()
  })

  it('texto "Eternal Flowers" continua presente', () => {
    const { unmount } = render(<Footer {...defaultProps} />)
    expect(screen.getByText('Eternal Flowers')).toBeInTheDocument()
    unmount()
  })
})

describe('Footer — return policy link', () => {
  it.each(locales)('Footer %s mostra returnPolicyLink e href correto', (locale) => {
    const dict = { ...dictionaries[locale] }
    const { unmount } = render(
      <Footer locale={locale} dict={dict} />
    )

    const link = screen.getByText(dict.returnPolicyLink)
    expect(link).toBeInTheDocument()

    const anchor = link.closest('a')
    if (locale === 'pt') {
      expect(anchor).toHaveAttribute('href', '/return-policy')
    } else {
      expect(anchor).toHaveAttribute('href', `/${locale}/return-policy`)
    }
    unmount()
  })
})

describe('Footer — care guide link', () => {
  it.each(locales)('Footer %s mostra careGuide href locale-aware', (locale) => {
    const dict = { ...dictionaries[locale] }
    const { unmount } = render(
      <Footer locale={locale} dict={dict} />
    )

    const link = screen.getByText(dict.careGuide)
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', `/${locale}/care`)
    unmount()
  })
})

describe('Footer — translated labels are unique per locale', () => {
  it('returnPolicyLink difere por locale', () => {
    const values = locales.map((l) => dictionaries[l].returnPolicyLink)
    const unique = new Set(values)
    expect(unique.size).toBe(locales.length)
  })
})