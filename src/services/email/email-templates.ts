/**
 * email-templates.ts — Renderização de templates de email
 *
 * Funções TS puras que geram subject + HTML + texto simples.
 * Não depende de React Email nem de CMS de templates.
 *
 * Valores interpolados são escapados para HTML (XSS safety).
 * Não inclui scripts, CSS remoto ou imagens obrigatórias.
 */
import type { Locale } from '@/i18n/locales'
import type {
  OrderConfirmedSnapshot,
  OrderShippedSnapshot,
  OrderCompletedSnapshot,
  OrderCancelledSnapshot,
} from './email-types'

// ─── HTML escaping — prevenção de XSS ────────────────────────

function esc(str: string | number | null | undefined): string {
  if (str == null) return ''
  const s = String(str)
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Currency formatting ─────────────────────────────────────

function fmtPrice(value: number, currency: string): string {
  return `${value.toFixed(2)} ${currency}`
}

// ─── Inline CSS wrapper ──────────────────────────────────────

function htmlWrapper(body: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.6;margin:0;padding:0;background:#f9f9f9}
  .container{max-width:600px;margin:0 auto;padding:20px;background:#fff}
  h1{color:#8B4513;font-size:22px;border-bottom:2px solid #D4A574;padding-bottom:8px}
  h2{color:#8B4513;font-size:18px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th,td{padding:8px 6px;text-align:left;border-bottom:1px solid #eee}
  th{font-size:13px;color:#666;text-transform:uppercase}
  .total-row{font-weight:bold;font-size:15px}
  .footer{margin-top:24px;padding-top:12px;border-top:1px solid #D4A574;font-size:12px;color:#999}
  .details{margin:8px 0}
  .details dt{font-weight:bold;color:#555;font-size:13px;margin-top:8px}
  .details dd{margin:2px 0 0 0;font-size:14px}
</style>
</head>
<body>
<div class="container">
${body}
<div class="footer">
  <p>Eternal Flowers — Joias Botânicas</p>
  <p>Rua das Flores, 123 · Lisboa · Portugal</p>
</div>
</div>
</body>
</html>`
}

// ─── Dicionários de tradução para emails ──────────────────────

interface EmailStrings {
  confirmedSubject: string
  confirmedHeading: string
  confirmedGreeting: string
  confirmedBody: string
  shippedSubject: string
  shippedHeading: string
  shippedGreeting: string
  shippedBody: string
  shippedTracking: string
  completedSubject: string
  completedHeading: string
  completedGreeting: string
  completedBody: string
  cancelledSubject: string
  cancelledHeading: string
  cancelledGreeting: string
  cancelledBody: string
  cancelledBodyRefunded: string
  cancelledRefundNote: string
  orderNumberLabel: string
  itemLabel: string
  qtyLabel: string
  unitPriceLabel: string
  totalLabel: string
  subtotalLabel: string
  discountLabel: string
  shippingLabel: string
  totalFinalLabel: string
  thankYou: string
}

const emailDict: Record<string, EmailStrings> = {
  pt: {
    confirmedSubject: 'Encomenda Confirmada — Eternal Flowers',
    confirmedHeading: 'Encomenda Confirmada',
    confirmedGreeting: 'Olá, {{name}}!',
    confirmedBody: 'A sua encomenda foi confirmada com sucesso. Em breve iniciaremos a preparação dos seus produtos.',
    shippedSubject: 'Encomenda Expedida — Eternal Flowers',
    shippedHeading: 'Encomenda Expedida',
    shippedGreeting: 'Olá, {{name}}!',
    shippedBody: 'A sua encomenda já foi expedida e está a caminho.',
    shippedTracking: 'Código de Tracking',
    completedSubject: 'Encomenda Concluída — Eternal Flowers',
    completedHeading: 'Encomenda Concluída',
    completedGreeting: 'Olá, {{name}}!',
    completedBody: 'A sua encomenda foi concluída com sucesso. Esperamos que adore as suas joias botânicas!',
    cancelledSubject: 'Encomenda Cancelada — Eternal Flowers',
    cancelledHeading: 'Encomenda Cancelada',
    cancelledGreeting: 'Olá, {{name}}!',
    cancelledBody: 'A sua encomenda {orderNumber} foi cancelada.',
    cancelledBodyRefunded: 'A sua encomenda {orderNumber} foi cancelada e o reembolso integral foi iniciado.',
    cancelledRefundNote: 'O tempo até o valor aparecer na conta depende do método de pagamento/banco.',
    orderNumberLabel: 'Nº Encomenda',
    itemLabel: 'Artigo',
    qtyLabel: 'Qtd',
    unitPriceLabel: 'Preço Unit.',
    totalLabel: 'Total',
    subtotalLabel: 'Subtotal',
    discountLabel: 'Desconto',
    shippingLabel: 'Portes',
    totalFinalLabel: 'Total',
    thankYou: 'Obrigado por escolher a Eternal Flowers.',
  },
  en: {
    confirmedSubject: 'Order Confirmed — Eternal Flowers',
    confirmedHeading: 'Order Confirmed',
    confirmedGreeting: 'Hello, {{name}}!',
    confirmedBody: 'Your order has been confirmed successfully. We will start preparing your items shortly.',
    shippedSubject: 'Order Shipped — Eternal Flowers',
    shippedHeading: 'Order Shipped',
    shippedGreeting: 'Hello, {{name}}!',
    shippedBody: 'Your order has been shipped and is on its way.',
    shippedTracking: 'Tracking Code',
    completedSubject: 'Order Completed — Eternal Flowers',
    completedHeading: 'Order Completed',
    completedGreeting: 'Hello, {{name}}!',
    completedBody: 'Your order has been completed successfully. We hope you love your botanical jewels!',
    cancelledSubject: 'Order Cancelled — Eternal Flowers',
    cancelledHeading: 'Order Cancelled',
    cancelledGreeting: 'Hello, {{name}}!',
    cancelledBody: 'Your order {orderNumber} has been cancelled.',
    cancelledBodyRefunded: 'Your order {orderNumber} has been cancelled and a full refund has been initiated.',
    cancelledRefundNote: 'The time for the amount to appear in your account depends on the payment method/bank.',
    orderNumberLabel: 'Order No.',
    itemLabel: 'Item',
    qtyLabel: 'Qty',
    unitPriceLabel: 'Unit Price',
    totalLabel: 'Total',
    subtotalLabel: 'Subtotal',
    discountLabel: 'Discount',
    shippingLabel: 'Shipping',
    totalFinalLabel: 'Total',
    thankYou: 'Thank you for choosing Eternal Flowers.',
  },
  es: {
    confirmedSubject: 'Pedido Confirmado — Eternal Flowers',
    confirmedHeading: 'Pedido Confirmado',
    confirmedGreeting: '¡Hola, {{name}}!',
    confirmedBody: 'Su pedido ha sido confirmado con éxito. Pronto comenzaremos la preparación de sus productos.',
    shippedSubject: 'Pedido Enviado — Eternal Flowers',
    shippedHeading: 'Pedido Enviado',
    shippedGreeting: '¡Hola, {{name}}!',
    shippedBody: 'Su pedido ha sido enviado y está en camino.',
    shippedTracking: 'Código de Seguimiento',
    completedSubject: 'Pedido Completado — Eternal Flowers',
    completedHeading: 'Pedido Completado',
    completedGreeting: '¡Hola, {{name}}!',
    completedBody: 'Su pedido ha sido completado con éxito. ¡Esperamos que disfrute de sus joyas botánicas!',
    cancelledSubject: 'Pedido Cancelado — Eternal Flowers',
    cancelledHeading: 'Pedido Cancelado',
    cancelledGreeting: '¡Hola, {{name}}!',
    cancelledBody: 'Su pedido {orderNumber} ha sido cancelado.',
    cancelledBodyRefunded: 'Su pedido {orderNumber} ha sido cancelado y se ha iniciado el reembolso íntegro.',
    cancelledRefundNote: 'El tiempo hasta que el importe aparezca en su cuenta depende del método de pago/banco.',
    orderNumberLabel: 'Nº Pedido',
    itemLabel: 'Artículo',
    qtyLabel: 'Cant',
    unitPriceLabel: 'Precio Un.',
    totalLabel: 'Total',
    subtotalLabel: 'Subtotal',
    discountLabel: 'Descuento',
    shippingLabel: 'Envío',
    totalFinalLabel: 'Total',
    thankYou: 'Gracias por elegir Eternal Flowers.',
  },
  it: {
    confirmedSubject: 'Ordine Confermato — Eternal Flowers',
    confirmedHeading: 'Ordine Confermato',
    confirmedGreeting: 'Ciao, {{name}}!',
    confirmedBody: 'Il tuo ordine è stato confermato con successo. Presto inizieremo la preparazione dei tuoi prodotti.',
    shippedSubject: 'Ordine Spedito — Eternal Flowers',
    shippedHeading: 'Ordine Spedito',
    shippedGreeting: 'Ciao, {{name}}!',
    shippedBody: 'Il tuo ordine è stato spedito ed è in arrivo.',
    shippedTracking: 'Codice di Tracciamento',
    completedSubject: 'Ordine Completato — Eternal Flowers',
    completedHeading: 'Ordine Completato',
    completedGreeting: 'Ciao, {{name}}!',
    completedBody: 'Il tuo ordine è stato completato con successo. Speriamo che tu ami i tuoi gioielli botanici!',
    cancelledSubject: 'Ordine Annullato — Eternal Flowers',
    cancelledHeading: 'Ordine Annullato',
    cancelledGreeting: 'Ciao, {{name}}!',
    cancelledBody: 'Il tuo ordine {orderNumber} è stato annullato.',
    cancelledBodyRefunded: 'Il tuo ordine {orderNumber} è stato annullato e il rimborso totale è stato avviato.',
    cancelledRefundNote: 'Il tempo necessario affinché l\'importo appaia sul conto dipende dal metodo di pagamento/banca.',
    orderNumberLabel: 'Nº Ordine',
    itemLabel: 'Articolo',
    qtyLabel: 'Qtà',
    unitPriceLabel: 'Prezzo Un.',
    totalLabel: 'Totale',
    subtotalLabel: 'Subtotale',
    discountLabel: 'Sconto',
    shippingLabel: 'Spedizione',
    totalFinalLabel: 'Totale',
    thankYou: 'Grazie per aver scelto Eternal Flowers.',
  },
  de: {
    confirmedSubject: 'Bestellung Bestätigt — Eternal Flowers',
    confirmedHeading: 'Bestellung Bestätigt',
    confirmedGreeting: 'Hallo, {{name}}!',
    confirmedBody: 'Ihre Bestellung wurde erfolgreich bestätigt. Wir beginnen bald mit der Vorbereitung Ihrer Produkte.',
    shippedSubject: 'Bestellung Versandt — Eternal Flowers',
    shippedHeading: 'Bestellung Versandt',
    shippedGreeting: 'Hallo, {{name}}!',
    shippedBody: 'Ihre Bestellung wurde versandt und ist unterwegs.',
    shippedTracking: 'Sendungsnummer',
    completedSubject: 'Bestellung Abgeschlossen — Eternal Flowers',
    completedHeading: 'Bestellung Abgeschlossen',
    completedGreeting: 'Hallo, {{name}}!',
    completedBody: 'Ihre Bestellung wurde erfolgreich abgeschlossen. Wir hoffen, Sie lieben Ihre botanischen Schmuckstücke!',
    cancelledSubject: 'Bestellung Storniert — Eternal Flowers',
    cancelledHeading: 'Bestellung Storniert',
    cancelledGreeting: 'Hallo, {{name}}!',
    cancelledBody: 'Ihre Bestellung {orderNumber} wurde storniert.',
    cancelledBodyRefunded: 'Ihre Bestellung {orderNumber} wurde storniert und die vollständige Rückerstattung wurde eingeleitet.',
    cancelledRefundNote: 'Die Zeit bis der Betrag auf Ihrem Konto erscheint, hängt von der Zahlungsmethode/Bank ab.',
    orderNumberLabel: 'Bestell-Nr.',
    itemLabel: 'Artikel',
    qtyLabel: 'Menge',
    unitPriceLabel: 'Stückpreis',
    totalLabel: 'Gesamt',
    subtotalLabel: 'Zwischensumme',
    discountLabel: 'Rabatt',
    shippingLabel: 'Versand',
    totalFinalLabel: 'Gesamtsumme',
    thankYou: 'Vielen Dank, dass Sie sich für Eternal Flowers entschieden haben.',
  },
}

function getDict(locale: string): EmailStrings {
  return emailDict[locale] || emailDict.en
}

function replacePlaceholders(template: string, name: string, orderNumber?: string): string {
  let result = template.replace(/\{\{name\}\}/g, esc(name))
  if (orderNumber) {
    result = result.replace(/\{orderNumber\}/g, esc(orderNumber))
  }
  return result
}

// ═══════════════════════════════════════════════════════════════
// Template: Order Confirmed
// ═══════════════════════════════════════════════════════════════

export function renderOrderConfirmed(
  snapshot: OrderConfirmedSnapshot,
  locale: Locale | string,
): { subject: string; html: string; text: string } {
  const d = getDict(locale)

  const subject = replacePlaceholders(d.confirmedSubject, snapshot.customerName)

  const itemsHtml = snapshot.items
    .map(
      (item) =>
        `<tr><td>${esc(item.name)}</td><td>${item.qty}</td><td>${fmtPrice(item.unitPrice, snapshot.currency)}</td><td>${fmtPrice(item.lineTotal, snapshot.currency)}</td></tr>`,
    )
    .join('\n')

  const html = htmlWrapper(`
<h1>${esc(d.confirmedHeading)}</h1>
<p>${replacePlaceholders(d.confirmedGreeting, snapshot.customerName)}</p>
<p>${replacePlaceholders(d.confirmedBody, snapshot.customerName)}</p>
<dl class="details">
  <dt>${esc(d.orderNumberLabel)}</dt>
  <dd>${esc(snapshot.orderNumber)}</dd>
</dl>
<table>
  <thead>
    <tr>
      <th>${esc(d.itemLabel)}</th>
      <th>${esc(d.qtyLabel)}</th>
      <th>${esc(d.unitPriceLabel)}</th>
      <th>${esc(d.totalLabel)}</th>
    </tr>
  </thead>
  <tbody>
    ${itemsHtml}
  </tbody>
</table>
<table>
  <tr><td>${esc(d.subtotalLabel)}</td><td>${fmtPrice(snapshot.subtotal, snapshot.currency)}</td></tr>
  <tr><td>${esc(d.discountLabel)}</td><td>-${fmtPrice(snapshot.discount, snapshot.currency)}</td></tr>
  <tr><td>${esc(d.shippingLabel)}</td><td>${fmtPrice(snapshot.shippingCost, snapshot.currency)}</td></tr>
  <tr class="total-row"><td>${esc(d.totalFinalLabel)}</td><td>${fmtPrice(snapshot.total, snapshot.currency)}</td></tr>
</table>
<p>${esc(d.thankYou)}</p>
  `)

  const text = [
    `${d.confirmedHeading}`,
    '',
    `${replacePlaceholders(d.confirmedGreeting, snapshot.customerName)}`,
    '',
    `${replacePlaceholders(d.confirmedBody, snapshot.customerName)}`,
    '',
    `${d.orderNumberLabel}: ${snapshot.orderNumber}`,
    '',
    ...snapshot.items.map(
      (item) => `${item.qty}x ${item.name} — ${fmtPrice(item.lineTotal, snapshot.currency)}`,
    ),
    '',
    `${d.subtotalLabel}: ${fmtPrice(snapshot.subtotal, snapshot.currency)}`,
    `${d.discountLabel}: -${fmtPrice(snapshot.discount, snapshot.currency)}`,
    `${d.shippingLabel}: ${fmtPrice(snapshot.shippingCost, snapshot.currency)}`,
    `${d.totalFinalLabel}: ${fmtPrice(snapshot.total, snapshot.currency)}`,
    '',
    d.thankYou,
  ].join('\n')

  return { subject, html, text }
}

// ═══════════════════════════════════════════════════════════════
// Template: Order Shipped
// ═══════════════════════════════════════════════════════════════

export function renderOrderShipped(
  snapshot: OrderShippedSnapshot,
  locale: Locale | string,
): { subject: string; html: string; text: string } {
  const d = getDict(locale)

  const subject = replacePlaceholders(d.shippedSubject, snapshot.customerName)

  const trackingHtml = snapshot.trackingNumber
    ? `<dt>${esc(d.shippedTracking)}</dt><dd>${esc(snapshot.trackingNumber)}</dd>`
    : ''

  const serviceHtml = snapshot.shippingServiceName
    ? `<dt>Transportadora</dt><dd>${esc(snapshot.shippingServiceName)}</dd>`
    : ''

  const html = htmlWrapper(`
<h1>${esc(d.shippedHeading)}</h1>
<p>${replacePlaceholders(d.shippedGreeting, snapshot.customerName)}</p>
<p>${replacePlaceholders(d.shippedBody, snapshot.customerName)}</p>
<dl class="details">
  <dt>${esc(d.orderNumberLabel)}</dt>
  <dd>${esc(snapshot.orderNumber)}</dd>
  ${serviceHtml}
  ${trackingHtml}
</dl>
<p>${esc(d.thankYou)}</p>
  `)

  const textParts = [
    `${d.shippedHeading}`,
    '',
    `${replacePlaceholders(d.shippedGreeting, snapshot.customerName)}`,
    '',
    `${replacePlaceholders(d.shippedBody, snapshot.customerName)}`,
    '',
    `${d.orderNumberLabel}: ${snapshot.orderNumber}`,
  ]

  if (snapshot.shippingServiceName) {
    textParts.push(`Transportadora: ${snapshot.shippingServiceName}`)
  }
  if (snapshot.trackingNumber) {
    textParts.push(`${d.shippedTracking}: ${snapshot.trackingNumber}`)
  }

  textParts.push('', d.thankYou)

  return { subject, html, text: textParts.join('\n') }
}

// ═══════════════════════════════════════════════════════════════
// Template: Order Completed
// ═══════════════════════════════════════════════════════════════

export function renderOrderCompleted(
  snapshot: OrderCompletedSnapshot,
  locale: Locale | string,
): { subject: string; html: string; text: string } {
  const d = getDict(locale)

  const subject = replacePlaceholders(d.completedSubject, snapshot.customerName)

  const html = htmlWrapper(`
<h1>${esc(d.completedHeading)}</h1>
<p>${replacePlaceholders(d.completedGreeting, snapshot.customerName)}</p>
<p>${replacePlaceholders(d.completedBody, snapshot.customerName)}</p>
<dl class="details">
  <dt>${esc(d.orderNumberLabel)}</dt>
  <dd>${esc(snapshot.orderNumber)}</dd>
</dl>
<p>${esc(d.thankYou)}</p>
  `)

  const text = [
    `${d.completedHeading}`,
    '',
    `${replacePlaceholders(d.completedGreeting, snapshot.customerName)}`,
    '',
    `${replacePlaceholders(d.completedBody, snapshot.customerName)}`,
    '',
    `${d.orderNumberLabel}: ${snapshot.orderNumber}`,
    '',
    d.thankYou,
  ].join('\n')

  return { subject, html, text }
}

// ═══════════════════════════════════════════════════════════════
// Template: Order Cancelled
// ═══════════════════════════════════════════════════════════════

export function renderOrderCancelled(
  snapshot: OrderCancelledSnapshot,
  locale: Locale | string,
): { subject: string; html: string; text: string } {
  const d = getDict(locale)

  const subject = replacePlaceholders(d.cancelledSubject, snapshot.customerName)

  const bodyKey = snapshot.wasRefunded
    ? replacePlaceholders(d.cancelledBodyRefunded, snapshot.customerName, snapshot.orderNumber)
    : replacePlaceholders(d.cancelledBody, snapshot.customerName, snapshot.orderNumber)

  const refundNoteHtml = snapshot.wasRefunded
    ? `<p>${esc(d.cancelledRefundNote)}</p>`
    : ''

  const refundNoteText = snapshot.wasRefunded
    ? `\n${d.cancelledRefundNote}`
    : ''

  const html = htmlWrapper(`
<h1>${esc(d.cancelledHeading)}</h1>
<p>${replacePlaceholders(d.cancelledGreeting, snapshot.customerName)}</p>
<p>${bodyKey}</p>
${refundNoteHtml}
<dl class="details">
  <dt>${esc(d.orderNumberLabel)}</dt>
  <dd>${esc(snapshot.orderNumber)}</dd>
</dl>
<p>${esc(d.thankYou)}</p>
  `)

  const text = [
    `${d.cancelledHeading}`,
    '',
    `${replacePlaceholders(d.cancelledGreeting, snapshot.customerName)}`,
    '',
    bodyKey,
    refundNoteText,
    '',
    `${d.orderNumberLabel}: ${snapshot.orderNumber}`,
    '',
    d.thankYou,
  ].filter(Boolean).join('\n')

  return { subject, html, text }
}

// ═══════════════════════════════════════════════════════════════
// Render dispatcher
// ═══════════════════════════════════════════════════════════════

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

export function renderEmail(
  snapshot: { type: string; data: any },
  locale: Locale | string,
): RenderedEmail {
  switch (snapshot.type) {
    case 'order_confirmed':
      return renderOrderConfirmed(snapshot.data as OrderConfirmedSnapshot, locale)
    case 'order_shipped':
      return renderOrderShipped(snapshot.data as OrderShippedSnapshot, locale)
    case 'order_completed':
      return renderOrderCompleted(snapshot.data as OrderCompletedSnapshot, locale)
    case 'order_cancelled':
      return renderOrderCancelled(snapshot.data as OrderCancelledSnapshot, locale)
    default:
      throw new Error(`Unknown email type: ${snapshot.type}`)
  }
}