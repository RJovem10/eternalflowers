/**
 * Central WhatsApp URL helper.
 *
 * Normaliza um número de telefone e gera URL https://wa.me/<numero>.
 * Aceita número puro, número com caracteres especiais, ou URL completa.
 */
export function formatWhatsAppUrl(input: string | null | undefined): string | null {
  if (!input) return null

  // Se já for URL completa, extrair o número
  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const u = new URL(input)
      if (u.hostname === 'wa.me' || u.hostname === 'api.whatsapp.com' || u.hostname === 'web.whatsapp.com') {
        // Extrair o número do path
        const parts = u.pathname.replace(/^\/+/, '').split('/')
        const num = parts[0]?.replace(/[^0-9]/g, '') || ''
        if (num) return `https://wa.me/${num}`
      }
    } catch {
      // Fall through to raw cleanup
    }
  }

  // Número puro — limpar caracteres não numéricos
  const cleaned = input.replace(/[^0-9]/g, '')
  if (!cleaned) return null

  return `https://wa.me/${cleaned}`
}