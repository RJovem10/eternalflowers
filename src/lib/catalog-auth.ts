/**
 * catalog-auth.ts — Verificação de autenticação Payload Admin
 *
 * Reutiliza a sessão Payload existente via cookie payload-token.
 * Não cria segundo sistema de autenticação.
 */

export interface AuthUser {
  id: number | string
  email: string
  collection: string
}

/**
 * Verifica a autenticação Payload Admin a partir do token nos cookies.
 * Faz uma chamada interna ao REST API do Payload para validar o token.
 * Retorna o utilizador autenticado ou null.
 */
export async function verifyPayloadAdmin(token: string): Promise<AuthUser | null> {
  if (!token) return null

  try {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

    const res = await fetch(`${serverUrl}/api/users/me`, {
      headers: {
        Cookie: `payload-token=${token}`,
      },
      // Pequeno timeout para não bloquear
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return null

    const data = await res.json()
    if (!data?.user) return null

    return {
      id: data.user.id,
      email: data.user.email,
      collection: 'users',
    }
  } catch {
    return null
  }
}

/**
 * Verifica se o utilizador é um admin Payload.
 */
export function isAdminUser(user: AuthUser | null): boolean {
  return user?.collection === 'users' && !!user.email
}