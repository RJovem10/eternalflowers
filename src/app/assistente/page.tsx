/**
 * /assistente — Página privada do assistente de catálogo
 *
 * Protegida por autenticação Payload Admin.
 * Se o utilizador não estiver autenticado, redireciona para /admin/login.
 */

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyPayloadAdmin } from '@/lib/catalog-auth'
import ChatUI from '@/components/chat/ChatUI'

export const metadata = {
  title: 'Assistente de Catálogo — Eternal Flowers',
  robots: 'noindex, nofollow',
}

export default async function AssistentePage() {
  // ─── Verificar autenticação ─────────────────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  if (!token) {
    redirect('/admin/login')
  }

  const user = await verifyPayloadAdmin(token)
  if (!user) {
    redirect('/admin/login')
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b border-stone-200 px-4 py-3 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-stone-400 hover:text-stone-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <h1 className="text-lg font-semibold text-stone-800">Assistente de Catálogo</h1>
            <p className="text-xs text-stone-400">Eternal Flowers — {user.email}</p>
          </div>
        </div>
        <a
          href="/admin/logout"
          className="text-xs text-stone-400 hover:text-red-600 transition-colors"
        >
          Sair
        </a>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        <ChatUI />
      </div>
    </div>
  )
}