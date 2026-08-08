/**
 * orders.ts — Serviço de domínio para criação segura de Orders (Issue 1B)
 *
 * Responsabilidades:
 * - Validar input do cliente (nunca confia em preço/nome/subtotal do frontend)
 * - Carregar Flower real da BD para cada item
 * - Calcular lineTotal, subtotal, discount server-side
 * - Validar e aplicar cupão (sem incrementar usesCount)
 * - Idempotência via checkoutRequestId → SHA-256 hash
 * - Criar Order atomicamente dentro de transacção
 *
 * NOTA: NÃO reserva stock, NÃO confirma stock, NÃO incrementa usesCount.
 */
import type { Payload } from 'payload'
import crypto from 'crypto'
import { runInTransaction, type TransactionCtx } from './transact'
import { validateCoupon } from '@/lib/coupon'
import { isLocale } from '@/i18n/locales'
import type {
  CreateOrderInput,
  CreateOrderResult,
  OrderItemSnapshot,
  OrderAddressSnapshot,
} from './order-types'
import {
  OrderValidationError,
  InvalidProductError,
  CouponValidationError,
  IdempotencyConflictError,
} from './order-types'

// ─── Constantes ───────────────────────────────────────────────

const ISO_ALPHA2_RE = /^[A-Z]{2}$/
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ORDER_NUMBER_RETRIES = 5

// ─── Helpers ──────────────────────────────────────────────────

function hashCheckoutRequest(checkoutRequestId: string): string {
  return crypto.createHash('sha256').update(checkoutRequestId).digest('hex')
}

function generateOrderNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `EF-${y}${m}${d}-${rand}`
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeCountry(country: string): string {
  return country.trim().toUpperCase()
}

// ─── Validação de input (antes da transacção) ─────────────────

function validateInput(input: CreateOrderInput): void {
  const errors: string[] = []

  // checkoutRequestId
  if (!input.checkoutRequestId || !UUID_V4_RE.test(input.checkoutRequestId)) {
    errors.push('checkoutRequestId deve ser um UUID v4 válido.')
  }

  // customer
  if (!input.customer) {
    errors.push('customer é obrigatório.')
  } else {
    if (!input.customer.name || typeof input.customer.name !== 'string' || !input.customer.name.trim()) {
      errors.push('customer.name é obrigatório.')
    }
    if (!input.customer.email || typeof input.customer.email !== 'string' || !input.customer.email.trim()) {
      errors.push('customer.email é obrigatório.')
    } else if (!input.customer.email.includes('@')) {
      errors.push('customer.email inválido.')
    }
    if (!input.customer.phone || typeof input.customer.phone !== 'string' || !input.customer.phone.trim()) {
      errors.push('customer.phone é obrigatório.')
    }
  }

  // shippingAddress
  if (!input.shippingAddress) {
    errors.push('shippingAddress é obrigatório.')
  } else {
    if (!input.shippingAddress.recipientName || !input.shippingAddress.recipientName.trim()) {
      errors.push('shippingAddress.recipientName é obrigatório.')
    }
    if (!input.shippingAddress.line1 || !input.shippingAddress.line1.trim()) {
      errors.push('shippingAddress.line1 é obrigatório.')
    }
    if (!input.shippingAddress.city || !input.shippingAddress.city.trim()) {
      errors.push('shippingAddress.city é obrigatório.')
    }
    if (input.shippingAddress.country) {
      const normalized = normalizeCountry(input.shippingAddress.country)
      if (!ISO_ALPHA2_RE.test(normalized)) {
        errors.push('shippingAddress.country deve ser ISO 3166-1 alpha-2.')
      }
    } else {
      errors.push('shippingAddress.country é obrigatório.')
    }
    if (input.shippingAddress.phone && !input.shippingAddress.phone.trim()) {
      errors.push('shippingAddress.phone não pode ser vazio se fornecido.')
    }
  }

  // items
  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    errors.push('items não pode estar vazio.')
  } else {
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i]
      if (!Number.isInteger(item.flowerId) || item.flowerId < 1) {
        errors.push(`items[${i}].flowerId deve ser um inteiro positivo.`)
      }
      if (!Number.isInteger(item.qty) || item.qty < 1) {
        errors.push(`items[${i}].qty deve ser um inteiro positivo.`)
      }
    }
  }

  // billingAddress if not same as shipping
  if (!input.billingSameAsShipping) {
    if (!input.billingAddress) {
      errors.push('billingAddress é obrigatório quando billingSameAsShipping é false.')
    } else if (input.billingAddress.country) {
      const normalized = normalizeCountry(input.billingAddress.country)
      if (!ISO_ALPHA2_RE.test(normalized)) {
        errors.push('billingAddress.country deve ser ISO 3166-1 alpha-2.')
      }
    }
  }

  // locale
  if (input.locale && !isLocale(input.locale)) {
    errors.push(`locale "${input.locale}" não é suportado. Locales: pt, en, es, it, de.`)
  }

  if (errors.length > 0) {
    throw new OrderValidationError(errors)
  }
}

// ─── Criar Order ──────────────────────────────────────────────

export async function createOrder(
  payload: Payload,
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  // 1. Validar input (antes da transacção)
  validateInput(input)

  const checkoutRequestHash = hashCheckoutRequest(input.checkoutRequestId)
  const locale = input.locale && isLocale(input.locale) ? input.locale : 'pt'

  return runInTransaction(payload, input.req, async (ctx) => {
    return executeCreateOrder(ctx, payload, input, checkoutRequestHash, locale)
  })
}

async function executeCreateOrder(
  ctx: TransactionCtx,
  payload: Payload,
  input: CreateOrderInput,
  checkoutRequestHash: string,
  locale: string,
): Promise<CreateOrderResult> {
  // ── 2. Idempotência ────────────────────────────────────────
  const existing = await payload.find({
    collection: 'orders',
    where: { checkoutRequestHash: { equals: checkoutRequestHash } },
    limit: 1,
    depth: 0,
    req: ctx.req,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    return handleExistingOrder(ctx, payload, existing.docs[0], input, checkoutRequestHash)
  }

  // ── 3. Carregar Flowers da BD (autoridade server-side) ─────
  const items: OrderItemSnapshot[] = []
  let subtotal = 0

  for (const itemInput of input.items) {
    const flower = await payload.findByID({
      collection: 'flowers',
      id: itemInput.flowerId,
      depth: 0,
      req: ctx.req,
      overrideAccess: true,
    }) as any

    if (!flower || !flower.id) {
      throw new InvalidProductError(`Flor com id ${itemInput.flowerId} não encontrada.`)
    }

    // Nome da flor: usar o campo localizado ou cair para namePt
    const name = flower.namePt || flower.nameEn || ''
    if (!name) {
      throw new InvalidProductError(`Flor ${itemInput.flowerId} não tem nome definido.`)
    }

    const price = Number(flower.price) || 0
    if (price <= 0) {
      throw new InvalidProductError(`Flor ${itemInput.flowerId} tem preço inválido (${flower.price}).`)
    }

    const qty = itemInput.qty
    const lineTotal = Number((price * qty).toFixed(2))
    subtotal += lineTotal

    items.push({
      flower: itemInput.flowerId,
      name,
      price,
      qty,
      lineTotal,
      productionMode: flower.productionMode || null,
    })
  }

  subtotal = Number(subtotal.toFixed(2))

  // ── 4. Cupão (se houver) ────────────────────────────────────
  let discount = 0
  let couponCode: string | null = null

  if (input.coupon) {
    const result = await validateCoupon(payload, input.coupon, input.customer.email, subtotal)

    if (!result.valid) {
      throw new CouponValidationError(
        result.error || 'Cupão inválido para esta encomenda.',
      )
    }

    discount = Number((result.discount ?? 0).toFixed(2))
    couponCode = input.coupon.toUpperCase()
  }

  // ── 5. Montar snapshots ─────────────────────────────────────
  const customerSnapshot = {
    name: input.customer.name.trim(),
    email: normalizeEmail(input.customer.email),
    phone: input.customer.phone.trim(),
    companyName: input.customer.companyName?.trim() || null,
    taxId: input.customer.taxId?.trim() || null,
  }

  const shippingSnapshot: OrderAddressSnapshot = {
    recipientName: input.shippingAddress.recipientName.trim(),
    phone: input.shippingAddress.phone?.trim() || null,
    line1: input.shippingAddress.line1.trim(),
    line2: input.shippingAddress.line2?.trim() || null,
    city: input.shippingAddress.city.trim(),
    region: input.shippingAddress.region?.trim() || null,
    postalCode: input.shippingAddress.postalCode?.trim() || null,
    country: normalizeCountry(input.shippingAddress.country),
  }

  let billingSnapshot: OrderAddressSnapshot | null = null
  if (!input.billingSameAsShipping && input.billingAddress) {
    billingSnapshot = {
      recipientName: input.billingAddress.recipientName.trim(),
      phone: input.billingAddress.phone?.trim() || null,
      line1: input.billingAddress.line1.trim(),
      line2: input.billingAddress.line2?.trim() || null,
      city: input.billingAddress.city.trim(),
      region: input.billingAddress.region?.trim() || null,
      postalCode: input.billingAddress.postalCode?.trim() || null,
      country: normalizeCountry(input.billingAddress.country),
    }
  }

  // ── 6. Criar Order (com retry em colisão de orderNumber) ────
  let lastError: unknown
  for (let attempt = 0; attempt < ORDER_NUMBER_RETRIES; attempt++) {
    try {
      const order = await payload.create({
        collection: 'orders',
        data: {
          orderNumber: generateOrderNumber(),

          // Customer
          customer: customerSnapshot,

          // Addresses
          shippingAddress: shippingSnapshot,
          billingSameAsShipping: input.billingSameAsShipping,
          billingAddress: billingSnapshot || undefined,

          // Items
          items: items.map((item) => ({
            flower: item.flower,
            name: item.name,
            price: item.price,
            qty: item.qty,
            lineTotal: item.lineTotal,
            productionMode: item.productionMode,
          })),

          // Financial
          currency: 'EUR',
          subtotal,
          discount,
          shippingCost: null,
          total: null,
          coupon: couponCode,

          // Status
          orderStatus: 'draft',
          paymentStatus: 'unpaid',

          // Meta
          locale,
          checkoutRequestHash,

          // Legacy
          email: customerSnapshot.email,
          status: 'pending',
        },
        req: ctx.req,
        overrideAccess: true,
        depth: 0,
      })

      return { order }
    } catch (err: any) {
      // Só retry em colisão de orderNumber (UNIQUE constraint)
      const msg = err?.message || ''
      const isUniqueCollision = msg.includes('UNIQUE') || msg.includes('duplicate key')

      // Se colidiu em checkoutRequestHash (TOCTOU race), re-fetch e devolve a existente
      if (isUniqueCollision && (msg.includes('checkout_request_hash') || msg.includes('checkoutRequestHash'))) {
        const existing = await payload.find({
          collection: 'orders',
          where: { checkoutRequestHash: { equals: checkoutRequestHash } },
          limit: 1, depth: 0, req: ctx.req, overrideAccess: true,
        })
        if (existing.docs.length > 0) {
          return { order: existing.docs[0] }
        }
        // Caso improvável: re-lançar se não encontrar
        continue
      }

      if (isUniqueCollision && msg.includes('order_number') && attempt < ORDER_NUMBER_RETRIES - 1) {
        lastError = err
        continue
      }
      throw err
    }
  }

  throw lastError || new Error('Falha ao criar orderNumber único após várias tentativas.')
}

// ─── Idempotência — validar compatibilidade ───────────────────

async function handleExistingOrder(
  ctx: TransactionCtx,
  payload: Payload,
  existingOrder: any,
  input: CreateOrderInput,
  checkoutRequestHash: string,
): Promise<CreateOrderResult> {
  // Verificar compatibilidade: items e email essenciais
  const existingItems = existingOrder.items as any[] | undefined
  const existingEmail = existingOrder.customer?.email || existingOrder.email || ''
  const inputEmail = normalizeEmail(input.customer.email)

  // 1. Email deve corresponder
  if (existingEmail.toLowerCase() !== inputEmail.toLowerCase()) {
    throw new IdempotencyConflictError(
      `checkoutRequestHash ${checkoutRequestHash} já usado para email diferente.`,
    )
  }

  // 2. Items devem corresponder em quantidade e flowerId
  if (existingItems && input.items) {
    if (existingItems.length !== input.items.length) {
      throw new IdempotencyConflictError(
        `checkoutRequestHash ${checkoutRequestHash} já usado com número de items diferente.`,
      )
    }

    for (let i = 0; i < input.items.length; i++) {
      const existingFlowerId = typeof existingItems[i]?.flower === 'object'
        ? existingItems[i].flower.id
        : existingItems[i]?.flower
      if (existingFlowerId !== input.items[i].flowerId) {
        throw new IdempotencyConflictError(
          `checkoutRequestHash ${checkoutRequestHash} já usado com items diferentes.`,
        )
      }
      // Quantidade também deve corresponder
      if ((existingItems[i]?.qty ?? 0) !== input.items[i].qty) {
        throw new IdempotencyConflictError(
          `checkoutRequestHash ${checkoutRequestHash} já usado com quantidades diferentes.`,
        )
      }
    }
  }

  // Compatível — devolver existente
  return { order: existingOrder }
}