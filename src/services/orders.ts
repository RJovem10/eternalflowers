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
  CreateManualOrderInput,
  CreateOrderResult,
  ManualOrderItemInput,
  ManualOrderPreview,
  OrderItemInput,
  OrderItemSnapshot,
  OrderAddressSnapshot,
} from './order-types'
import { MANUAL_SALES_CHANNELS } from './order-types'
import {
  OrderValidationError,
  InvalidProductError,
  CouponValidationError,
  IdempotencyConflictError,
} from './order-types'
import { isShippingDestination } from './shipping/country-whitelist'
import { calculateFixedShipping, type FixedShippingItem } from './shipping/fixed-shipping'

// ─── Constantes ───────────────────────────────────────────────

const ISO_ALPHA2_RE = /^[A-Z]{2}$/
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ORDER_NUMBER_RETRIES = 5

// ─── Helpers ──────────────────────────────────────────────────

function hashCheckoutRequest(checkoutRequestId: string, source: 'website' | 'manual'): string {
  const material = source === 'website' ? checkoutRequestId : `manual:${checkoutRequestId}`
  return crypto.createHash('sha256').update(material).digest('hex')
}

function generateOrderNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `EF-${y}${m}${d}-${rand}`
}

function normalizeEmail(email?: string): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function normalizeCountry(country: string): string {
  return country.trim().toUpperCase()
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validateAddressInput(
  value: unknown,
  field: 'shippingAddress' | 'billingAddress',
  errors: string[],
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${field} é obrigatório.`)
    return
  }

  const address = value as Record<string, unknown>
  if (!isNonEmptyString(address.recipientName)) {
    errors.push(`${field}.recipientName é obrigatório.`)
  }
  if (!isNonEmptyString(address.line1)) {
    errors.push(`${field}.line1 é obrigatório.`)
  }
  if (!isNonEmptyString(address.city)) {
    errors.push(`${field}.city é obrigatório.`)
  }

  if (!isNonEmptyString(address.country)) {
    errors.push(`${field}.country é obrigatório.`)
  } else {
    const normalized = normalizeCountry(address.country)
    if (!ISO_ALPHA2_RE.test(normalized)) {
      errors.push(`${field}.country deve ser ISO 3166-1 alpha-2.`)
    } else if (!isShippingDestination(normalized)) {
      errors.push(`Envio não disponível para "${normalized}". Destinos suportados: UE-27 + GB/CH/NO/IS/LI.`)
    }
  }

  for (const optionalField of ['phone', 'line2', 'region', 'postalCode'] as const) {
    const optionalValue = address[optionalField]
    if (optionalValue !== undefined && optionalValue !== null && typeof optionalValue !== 'string') {
      errors.push(`${field}.${optionalField} deve ser texto.`)
    }
  }
}

// ─── Validação de input (antes da transacção) ─────────────────

type OrderCreationInput = CreateOrderInput | CreateManualOrderInput

interface CreationPolicy {
  source: 'website' | 'manual'
  requireEmail: boolean
}

function aggregateItems(items: (OrderItemInput | ManualOrderItemInput)[]): (OrderItemInput | ManualOrderItemInput)[] {
  // Website items — aggregate by flowerId
  if (items.length > 0 && 'flowerId' in items[0]) {
    const typed = items as OrderItemInput[]
    const quantities = new Map<number, number>()
    for (const item of typed) {
      const quantity = (quantities.get(item.flowerId) || 0) + item.qty
      if (!Number.isSafeInteger(quantity)) {
        throw new OrderValidationError([`Quantidade total inválida para flowerId=${item.flowerId}.`])
      }
      quantities.set(item.flowerId, quantity)
    }
    return [...quantities.entries()].map(([flowerId, qty]) => ({ flowerId, qty }))
  }
  // Manual free items — aggregate by name+price
  if (items.length > 0 && 'name' in items[0]) {
    const typed = items as ManualOrderItemInput[]
    const keyed = new Map<string, ManualOrderItemInput>()
    for (const item of typed) {
      const key = `${item.name}|${item.price}`
      const existing = keyed.get(key)
      if (existing) {
        existing.qty += item.qty
      } else {
        keyed.set(key, { ...item })
      }
    }
    return [...keyed.values()]
  }
  return items
}

function validateInput(input: OrderCreationInput, policy: CreationPolicy): void {
  const errors: string[] = []

  // checkoutRequestId
  if (!input.checkoutRequestId || !UUID_V4_RE.test(input.checkoutRequestId)) {
    errors.push('checkoutRequestId deve ser um UUID v4 válido.')
  }

  // customer
  if (!input.customer || typeof input.customer !== 'object' || Array.isArray(input.customer)) {
    errors.push('customer é obrigatório.')
  } else {
    if (!isNonEmptyString(input.customer.name)) {
      errors.push('customer.name é obrigatório.')
    }
    const email = input.customer.email
    if (policy.requireEmail && !isNonEmptyString(email)) {
      errors.push('customer.email é obrigatório.')
    } else if (email && (typeof email !== 'string' || !email.includes('@'))) {
      errors.push('customer.email inválido.')
    }
    if (!isNonEmptyString(input.customer.phone)) {
      errors.push('customer.phone é obrigatório.')
    }
    for (const optionalField of ['companyName', 'taxId'] as const) {
      const optionalValue = input.customer[optionalField]
      if (optionalValue !== undefined && optionalValue !== null && typeof optionalValue !== 'string') {
        errors.push(`customer.${optionalField} deve ser texto.`)
      }
    }
  }

  // shippingAddress
  validateAddressInput(input.shippingAddress, 'shippingAddress', errors)

  // items
  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    errors.push('items não pode estar vazio.')
  } else {
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i] as any
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(`items[${i}] deve ser um objeto.`)
        continue
      }
      // Website items — validate flowerId + qty
      if ('flowerId' in item) {
        if (!Number.isSafeInteger(item.flowerId) || item.flowerId < 1) {
          errors.push(`items[${i}].flowerId deve ser um inteiro positivo.`)
        }
        if (!Number.isSafeInteger(item.qty) || item.qty < 1) {
          errors.push(`items[${i}].qty deve ser um inteiro positivo.`)
        }
      }
      // Manual free items — validate name + qty + price
      else if ('name' in item && 'price' in item) {
        if (typeof item.name !== 'string' || !item.name.trim()) {
          errors.push(`items[${i}].name é obrigatório.`)
        } else if (item.name.length > 500) {
          errors.push(`items[${i}].name não pode exceder 500 caracteres.`)
        }
        if (!Number.isInteger(Number(item.qty)) || Number(item.qty) < 1) {
          errors.push(`items[${i}].qty deve ser um inteiro positivo.`)
        }
        if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0) {
          errors.push(`items[${i}].price deve ser um número não negativo.`)
        }
      } else {
        errors.push(`items[${i}] deve ter flowerId+qty (catálogo) ou name+qty+price (livre).`)
      }
    }
  }

  // billingAddress if not same as shipping
  if (!input.billingSameAsShipping) {
    validateAddressInput(input.billingAddress, 'billingAddress', errors)
  }

  if (typeof input.billingSameAsShipping !== 'boolean') {
    errors.push('billingSameAsShipping deve ser booleano.')
  }

  if (input.coupon !== undefined && typeof input.coupon !== 'string') {
    errors.push('coupon deve ser texto.')
  }

  // locale
  if (input.locale && !isLocale(input.locale)) {
    errors.push(`locale "${input.locale}" não é suportado. Locales: pt, en, es, it, de.`)
  }

  if (policy.source === 'manual') {
    const manualInput = input as CreateManualOrderInput
    if (!MANUAL_SALES_CHANNELS.includes(manualInput.salesChannel)) {
      errors.push('salesChannel inválido para encomenda manual.')
    }
    if (manualInput.internalNote !== undefined && typeof manualInput.internalNote !== 'string') {
      errors.push('internalNote deve ser texto.')
    } else if (manualInput.internalNote && manualInput.internalNote.length > 4000) {
      errors.push('internalNote não pode exceder 4000 caracteres.')
    }
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
  return createOrderWithPolicy(payload, input, { source: 'website', requireEmail: true })
}

export async function createManualOrder(
  payload: Payload,
  input: CreateManualOrderInput,
): Promise<CreateOrderResult> {
  return createOrderWithPolicy(payload, input, { source: 'manual', requireEmail: false })
}

export async function previewManualOrder(
  payload: Payload,
  input: CreateManualOrderInput,
): Promise<ManualOrderPreview> {
  const policy: CreationPolicy = { source: 'manual', requireEmail: false }
  validateInput(input, policy)
  const normalizedInput = { ...input, items: aggregateItems(input.items) as ManualOrderItemInput[] }
  const resolved = await resolveOrderDraft(payload, normalizedInput, input.req)
  const shipping = calculateFixedShipping({
    items: resolved.fixedShippingItems,
    destinationCountry: resolved.shippingSnapshot.country,
  })
  const total = shipping.shippingCost === null
    ? null
    : Number((resolved.subtotal - resolved.discount + shipping.shippingCost).toFixed(2))

  return {
    items: resolved.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      price: item.price,
      lineTotal: item.lineTotal,
    })),
    subtotal: resolved.subtotal,
    discount: resolved.discount,
    shippingCost: shipping.shippingCost,
    total,
    orderStatus: shipping.cupulaNeedsConfirmation ? 'awaiting_shipping' : 'pending_payment',
  }
}

async function createOrderWithPolicy(
  payload: Payload,
  input: OrderCreationInput,
  policy: CreationPolicy,
): Promise<CreateOrderResult> {
  validateInput(input, policy)
  const normalizedInput = { ...input, items: aggregateItems(input.items) } as OrderCreationInput
  const checkoutRequestHash = hashCheckoutRequest(input.checkoutRequestId, policy.source)
  const locale = input.locale && isLocale(input.locale) ? input.locale : 'pt'

  return runInTransaction(payload, input.req, async (ctx) => {
    return executeCreateOrder(
      ctx,
      payload,
      normalizedInput,
      policy,
      checkoutRequestHash,
      locale,
    )
  })
}

interface ResolvedOrderDraft {
  items: OrderItemSnapshot[]
  fixedShippingItems: FixedShippingItem[]
  subtotal: number
  discount: number
  couponCode: string | null
  customerSnapshot: {
    name: string
    email: string | null
    phone: string
    companyName: string | null
    taxId: string | null
  }
  shippingSnapshot: OrderAddressSnapshot
  billingSnapshot: OrderAddressSnapshot | null
}

async function resolveOrderDraft(
  payload: Payload,
  input: OrderCreationInput,
  req?: any,
): Promise<ResolvedOrderDraft> {
  const items: OrderItemSnapshot[] = []
  const fixedShippingItems: FixedShippingItem[] = []
  let subtotal = 0

  for (const itemInput of input.items) {
    // Manual free item — use name/qty/price directly
    if ('name' in itemInput && 'price' in itemInput && !('flowerId' in itemInput)) {
      const manual = itemInput as ManualOrderItemInput
      const name = manual.name.trim()
      if (!name) {
        throw new InvalidProductError('Item livre tem nome vazio.')
      }
      const price = Number(manual.price) || 0
      if (price < 0) {
        throw new InvalidProductError(`Item livre "${name}" tem preço inválido (${manual.price}).`)
      }
      const qty = Number(manual.qty) || 0
      if (qty < 1) {
        throw new InvalidProductError(`Item livre "${name}" tem quantidade inválida.`)
      }
      const lineTotal = Number((price * qty).toFixed(2))
      subtotal += lineTotal
      items.push({
        flower: null,
        name,
        price,
        qty,
        lineTotal,
        productionMode: null,
      })
      continue
    }

    // Catalog item — look up flower in DB
    const catalogItem = itemInput as OrderItemInput
    const flower = await payload.findByID({
      collection: 'flowers',
      id: catalogItem.flowerId,
      depth: 0,
      req,
      overrideAccess: true,
    }) as any

    if (!flower || !flower.id) {
      throw new InvalidProductError(`Flor com id ${catalogItem.flowerId} não encontrada.`)
    }

    const name = flower.namePt || flower.nameEn || ''
    if (!name) {
      throw new InvalidProductError(`Flor ${catalogItem.flowerId} não tem nome definido.`)
    }

    const price = Number(flower.price) || 0
    if (price <= 0) {
      throw new InvalidProductError(`Flor ${catalogItem.flowerId} tem preço inválido (${flower.price}).`)
    }

    const qty = catalogItem.qty
    const lineTotal = Number((price * qty).toFixed(2))
    subtotal += lineTotal
    items.push({
      flower: catalogItem.flowerId,
      name,
      price,
      qty,
      lineTotal,
      productionMode: flower.productionMode || null,
    })
    fixedShippingItems.push({
      shippingClass: flower.shippingClass === 'cupula' ? 'cupula' : 'standard',
      canShareShippingPackage: flower.canShareShippingPackage === true,
      qty,
    })
  }

  subtotal = Number(subtotal.toFixed(2))
  let discount = 0
  let couponCode: string | null = null
  if (input.coupon?.trim()) {
    const result = await validateCoupon(
      payload,
      input.coupon,
      normalizeEmail(input.customer.email) || undefined,
      subtotal,
    )
    if (!result.valid) {
      throw new CouponValidationError(result.error || 'Cupão inválido para esta encomenda.')
    }
    discount = Number((result.discount ?? 0).toFixed(2))
    couponCode = input.coupon.trim().toUpperCase()
  }

  const normalizedEmail = normalizeEmail(input.customer.email)
  const customerSnapshot = {
    name: input.customer.name.trim(),
    email: normalizedEmail || null,
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

  return {
    items,
    fixedShippingItems,
    subtotal,
    discount,
    couponCode,
    customerSnapshot,
    shippingSnapshot,
    billingSnapshot,
  }
}

async function executeCreateOrder(
  ctx: TransactionCtx,
  payload: Payload,
  input: OrderCreationInput,
  policy: CreationPolicy,
  checkoutRequestHash: string,
  locale: string,
): Promise<CreateOrderResult> {
  const existing = await payload.find({
    collection: 'orders',
    where: { checkoutRequestHash: { equals: checkoutRequestHash } },
    limit: 1,
    depth: 0,
    req: ctx.req,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    return handleExistingOrder(existing.docs[0], input, policy, checkoutRequestHash)
  }

  const resolved = await resolveOrderDraft(payload, input, ctx.req)
  let lastError: unknown
  for (let attempt = 0; attempt < ORDER_NUMBER_RETRIES; attempt++) {
    try {
      const order = await payload.create({
        collection: 'orders',
        data: {
          orderNumber: generateOrderNumber(),

          // Customer
          customer: resolved.customerSnapshot,

          // Addresses
          shippingAddress: resolved.shippingSnapshot,
          billingSameAsShipping: input.billingSameAsShipping,
          billingAddress: resolved.billingSnapshot || undefined,

          // Items
          items: resolved.items.map((item) => ({
            flower: item.flower,
            name: item.name,
            price: item.price,
            qty: item.qty,
            lineTotal: item.lineTotal,
            productionMode: item.productionMode,
          })),

          // Financial
          currency: 'EUR',
          subtotal: resolved.subtotal,
          discount: resolved.discount,
          shippingCost: null,
          total: null,
          coupon: resolved.couponCode,

          // Status
          orderStatus: 'draft',
          paymentStatus: 'unpaid',

          // Meta
          locale,
          checkoutRequestHash,
          orderSource: policy.source,
          salesChannel: policy.source === 'manual'
            ? (input as CreateManualOrderInput).salesChannel
            : null,
          internalNote: policy.source === 'manual'
            ? (input as CreateManualOrderInput).internalNote?.trim() || null
            : null,
          paymentProvider: policy.source === 'website' ? 'stripe' : null,

          // Legacy
          email: resolved.customerSnapshot.email || '',
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
          return handleExistingOrder(existing.docs[0], input, policy, checkoutRequestHash)
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
  existingOrder: any,
  input: OrderCreationInput,
  policy: CreationPolicy,
  checkoutRequestHash: string,
): Promise<CreateOrderResult> {
  // Verificar compatibilidade: items e email essenciais
  const existingItems = existingOrder.items as any[] | undefined
  const existingEmail = existingOrder.customer?.email || existingOrder.email || ''
  const inputEmail = normalizeEmail(input.customer.email)

  if ((existingOrder.orderSource || 'website') !== policy.source) {
    throw new IdempotencyConflictError(
      `checkoutRequestHash ${checkoutRequestHash} já usado para origem diferente.`,
    )
  }

  // 1. Email deve corresponder
  if (String(existingEmail).toLowerCase() !== inputEmail.toLowerCase()) {
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
      const incomingItem = input.items[i] as any
      const incomingFlowerId = 'flowerId' in incomingItem ? incomingItem.flowerId : 0
      if (existingFlowerId !== incomingFlowerId) {
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
