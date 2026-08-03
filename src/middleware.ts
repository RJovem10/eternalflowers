import { NextRequest, NextResponse } from 'next/server'
import { locales, defaultLocale } from '@/i18n/dictionaries'

function getLocaleFromCookie(req: NextRequest): string | undefined {
  const cookie = req.cookies.get('NEXT_LOCALE')?.value
  if (cookie && locales.includes(cookie as any)) return cookie
  return undefined
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // não tocar em /admin (Painel da Marina), assets, api, ou ficheiros estáticos
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/media') ||
    pathname.startsWith('/instagram') ||
    pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|woff2?|ttf|eot|pdf)$/)
  ) {
    return NextResponse.next()
  }

  const hasLocale = locales.some((l) => pathname.startsWith(`/${l}`))
  if (hasLocale) return NextResponse.next()

  const cookieLocale = getLocaleFromCookie(req)
  const locale = cookieLocale || defaultLocale
  const url = req.nextUrl.clone()
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next|api|admin|media|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico|css|js|woff2?|ttf|eot|pdf)).*)'],
}
