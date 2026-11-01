const OFFICIAL_RECIPIENT = 'shop@eternalflowers.pt'

function isProductionDelivery(): boolean {
  const mode = process.env.ADMIN_ORDER_NOTIFICATION_ENV || (process.env.NODE_ENV === 'production' ? '' : 'sandbox')
  if (!['production', 'sandbox'].includes(mode)) {
    throw new Error('ADMIN_ORDER_NOTIFICATION_ENV deve ser production ou sandbox.')
  }
  if (mode === 'production') {
    if (process.env.NODE_ENV !== 'production' || new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost').origin !== 'https://eternalflowers.pt') {
      throw new Error('Notificações administrativas reais exigem runtime production e o URL oficial.')
    }
    return true
  }
  return false
}

/** Verifica também snapshots antigos, sem substituir o destinatário persistido. */
export function assertAdminOrderDeliveryRecipient(recipient: string): void {
  if (isProductionDelivery()) {
    if (recipient !== OFFICIAL_RECIPIENT) throw new Error('O destinatário administrativo de produção deve ser o endereço oficial.')
  } else if (!/^[^@]+@(?:[a-z0-9-]+\.)+(?:invalid|test)$/i.test(recipient)) {
    throw new Error('Em sandbox, o destinatário administrativo deve usar um domínio reservado .invalid ou .test.')
  }
}

export function getAdminOrderRecipient(): string {
  const production = isProductionDelivery()
  const email = (process.env.ADMIN_ORDER_NOTIFICATION_EMAIL ?? (production ? '' : 'admin@example.invalid')).trim()
  const parts = email.split('@')
  if (email.length > 254 || parts[0]?.length > 64 ||
      !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email)) {
    throw new Error('ADMIN_ORDER_NOTIFICATION_EMAIL deve conter um único endereço de email válido.')
  }
  assertAdminOrderDeliveryRecipient(email)
  return email
}

export function getAdminOrderURL(orderId: number): string {
  const base = new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000')
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('NEXT_PUBLIC_SERVER_URL deve ser um URL HTTP(S) válido sem credenciais, query ou fragmento.')
  }
  return new URL(`/admin/collections/orders/${orderId}`, base).href
}

/** Sem DB, pagamentos ou envio. Usado no arranque e no preflight local. */
export function validateAdminEmailConfiguration(): void {
  getAdminOrderRecipient()
  getAdminOrderURL(12)
}
