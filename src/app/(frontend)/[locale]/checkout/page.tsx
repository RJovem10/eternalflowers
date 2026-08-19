'use client'

import Link from 'next/link'
import { useCart } from '@/components/CartProvider'
import { useParams } from 'next/navigation'
import { useRef, useState, useCallback, useMemo } from 'react'
import { getDictionary } from '@/i18n/dictionaries'
import { couponErrorToDictKey, type CouponErrorCode, type CouponErrorDictKey } from '@/lib/coupon'
import StripePaymentSection from '@/components/StripePaymentSection'

// ─── Countries (ISO 3166-1 alpha-2) ────────────────────
const COUNTRIES: [string, string][] = [
  ['PT', 'Portugal'],
  ['ES', 'Spain'],
  ['FR', 'France'],
  ['IT', 'Italy'],
  ['DE', 'Germany'],
  ['GB', 'United Kingdom'],
  ['IE', 'Ireland'],
  ['NL', 'Netherlands'],
  ['BE', 'Belgium'],
  ['CH', 'Switzerland'],
  ['AT', 'Austria'],
  ['SE', 'Sweden'],
  ['NO', 'Norway'],
  ['DK', 'Denmark'],
  ['FI', 'Finland'],
  ['PL', 'Poland'],
  ['CZ', 'Czech Republic'],
  ['LU', 'Luxembourg'],
  ['GR', 'Greece'],
  ['HU', 'Hungary'],
  ['RO', 'Romania'],
  ['BG', 'Bulgaria'],
  ['HR', 'Croatia'],
  ['SK', 'Slovakia'],
  ['SI', 'Slovenia'],
  ['LT', 'Lithuania'],
  ['LV', 'Latvia'],
  ['EE', 'Estonia'],
  ['US', 'United States'],
  ['CA', 'Canada'],
  ['BR', 'Brazil'],
  ['AU', 'Australia'],
  ['NZ', 'New Zealand'],
  ['JP', 'Japan'],
  ['CN', 'China'],
  ['IN', 'India'],
  ['AE', 'United Arab Emirates'],
  ['ZA', 'South Africa'],
  ['SG', 'Singapore'],
  ['IL', 'Israel'],
]

// ─── Types ─────────────────────────────────────────────
type CustomerForm = {
  name: string
  email: string
  phone: string
  companyName: string
  taxId: string
}

type AddressForm = {
  recipientName: string
  phone: string
  line1: string
  line2: string
  city: string
  region: string
  postalCode: string
  country: string
}

type CheckoutStatus =
  | { type: 'idle' }
  | { type: 'busy' }
  | { type: 'error'; message: string }
  | {
      type: 'success'
      orderNumber: string
      orderId: number
      orderStatus: string
      shippingCost: number | null
      total: number | null
      subtotal?: number
      discount?: number
    }

// ─── Helpers ───────────────────────────────────────────
function emptyCustomer(): CustomerForm {
  return { name: '', email: '', phone: '', companyName: '', taxId: '' }
}

function emptyAddress(recipientName = ''): AddressForm {
  return {
    recipientName,
    phone: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    country: '',
  }
}

/** Gera uma string que representa o "material" do formulário para
 *  deteção de alterações que devem invalidar o checkoutRequestId. */
function materialHash(
  customer: CustomerForm,
  shipping: AddressForm,
  billingSame: boolean,
  billing: AddressForm | null,
  items: { id: string; qty: number }[],
  coupon: string | null,
): string {
  const b = billingSame ? null : billing
  return JSON.stringify({ customer, shipping, billingSame, billing: b, items, coupon })
}

// ─── Component ─────────────────────────────────────────
export default function Checkout() {
  const { locale } = useParams() as { locale: string }
  const dict = getDictionary(locale)
  const { items, count, coupon } = useCart()

  // Form state
  const [customer, setCustomer] = useState<CustomerForm>(emptyCustomer)
  const [shipping, setShipping] = useState<AddressForm>(emptyAddress)
  const [billingSame, setBillingSame] = useState(true)
  const [billing, setBilling] = useState<AddressForm | null>(null)

  // Status
  const [status, setStatus] = useState<CheckoutStatus>({ type: 'idle' })

  // Idempotência
  const checkoutRequestIdRef = useRef<string>('')
  const lastMaterialHashRef = useRef<string>('')

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items])

  // ── Handlers ────────────────────────────────────────

  const setCustomerField = useCallback(
    <K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) =>
      setCustomer((prev) => ({ ...prev, [key]: value })),
    [],
  )

  const setShippingField = useCallback(
    <K extends keyof AddressForm>(key: K, value: AddressForm[K]) =>
      setShipping((prev) => ({ ...prev, [key]: value })),
    [],
  )

  const setBillingField = useCallback(
    <K extends keyof AddressForm>(key: K, value: AddressForm[K]) =>
      setBilling((prev) => (prev ? { ...prev, [key]: value } : { ...emptyAddress(), [key]: value })),
    [],
  )

  // ── Submit ──────────────────────────────────────────

  async function submit() {
    // Validação básica
    if (!customer.name || !customer.email || !customer.phone) {
      setStatus({ type: 'error', message: dict.required })
      return
    }
    if (!shipping.recipientName || !shipping.line1 || !shipping.city || !shipping.country) {
      setStatus({ type: 'error', message: dict.required })
      return
    }

    // Idempotência — gerar novo UUID se o material mudou
    const hash = materialHash(customer, shipping, billingSame, billing, items, coupon)
    if (!checkoutRequestIdRef.current || hash !== lastMaterialHashRef.current) {
      checkoutRequestIdRef.current = crypto.randomUUID()
      lastMaterialHashRef.current = hash
    }

    const checkoutRequestId = checkoutRequestIdRef.current

    setStatus({ type: 'busy' })

    // Construir payload (items: só flowerId + qty)
    const body = {
      checkoutRequestId,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        ...(customer.companyName ? { companyName: customer.companyName } : {}),
        ...(customer.taxId ? { taxId: customer.taxId } : {}),
      },
      shippingAddress: {
        recipientName: shipping.recipientName,
        ...(shipping.phone ? { phone: shipping.phone } : {}),
        line1: shipping.line1,
        ...(shipping.line2 ? { line2: shipping.line2 } : {}),
        city: shipping.city,
        ...(shipping.region ? { region: shipping.region } : {}),
        ...(shipping.postalCode ? { postalCode: shipping.postalCode } : {}),
        country: shipping.country,
      },
      billingSameAsShipping: billingSame,
      ...(billingSame ? {} : {
        billingAddress: billing
          ? {
              recipientName: billing.recipientName || shipping.recipientName,
              ...(billing.phone ? { phone: billing.phone } : {}),
              line1: billing.line1,
              ...(billing.line2 ? { line2: billing.line2 } : {}),
              city: billing.city,
              ...(billing.region ? { region: billing.region } : {}),
              ...(billing.postalCode ? { postalCode: billing.postalCode } : {}),
              country: billing.country,
            }
          : undefined,
      }),
      items: items.map((i) => ({ flowerId: Number(i.id), qty: i.qty })),
      ...(coupon ? { coupon } : {}),
      locale,
    }

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus({
          type: 'success',
          orderNumber: data.orderNumber,
          orderId: data.orderId,
          orderStatus: data.orderStatus,
          shippingCost: data.shippingCost ?? null,
          total: data.total ?? null,
          subtotal: data.subtotal,
          discount: data.discount,
        })
        // NÃO limpar carrinho — draft/unpaid
      } else if (res.status === 409) {
        setStatus({ type: 'error', message: dict.checkoutConflict })
      } else if (res.status >= 500) {
        setStatus({ type: 'error', message: dict.checkoutServerError })
      } else {
        // 400 — mostra erro da API ou mensagem genérica
        const errCode: CouponErrorCode = data.error_code
        const errorKey: CouponErrorDictKey | null = errCode ? couponErrorToDictKey[errCode as CouponErrorCode] : null
        setStatus({ type: 'error', message: errorKey ? dict[errorKey] : (data.error || dict.orderError) })
      }
    } catch {
      setStatus({ type: 'error', message: dict.checkoutServerError })
    }
  }

  // ── Render helpers ──────────────────────────────────

  function renderField(
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: {
      placeholder?: string
      required?: boolean
      type?: string
    },
  ) {
    return (
      <div>
        <label className="block text-xs uppercase tracking-[0.12em] text-stone-500 mb-1">
          {label}{opts?.required ? ' *' : ''}
        </label>
        <input
          type={opts?.type || 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={opts?.placeholder}
          aria-label={label}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:border-brand-gold-dark focus:outline-none"
        />
      </div>
    )
  }

  function renderAddressForm(
    addr: AddressForm,
    setters: {
      setRecipientName: (v: string) => void
      setPhone: (v: string) => void
      setLine1: (v: string) => void
      setLine2: (v: string) => void
      setCity: (v: string) => void
      setRegion: (v: string) => void
      setPostalCode: (v: string) => void
      setCountry: (v: string) => void
    },
    showRecipient: boolean,
  ) {
    return (
      <div className="space-y-3">
        {showRecipient && renderField(dict.recipientName, addr.recipientName, setters.setRecipientName, { required: true })}
        {showRecipient && renderField(dict.phone, addr.phone, setters.setPhone, { type: 'tel' })}
        {renderField(dict.addressLine1, addr.line1, setters.setLine1, { required: true })}
        {renderField(dict.addressLine2, addr.line2, setters.setLine2)}
        {renderField(dict.city, addr.city, setters.setCity, { required: true })}
        {renderField(dict.region, addr.region, setters.setRegion)}
        {renderField(dict.postalCode, addr.postalCode, setters.setPostalCode)}
        <div>
          <label className="block text-xs uppercase tracking-[0.12em] text-stone-500 mb-1">
            {dict.country} *
          </label>
          <select
            value={addr.country}
            onChange={(e) => setters.setCountry(e.target.value)}
            aria-label={dict.country}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:border-brand-gold-dark focus:outline-none"
          >
            <option value="">{dict.selectCountry}</option>
            {COUNTRIES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  // ── Success view ────────────────────────────────────

  if (status.type === 'success') {
    const isCupula = status.orderStatus === 'awaiting_shipping'

    return (
      <div className="max-w-lg mx-auto py-10 space-y-6">
        <div className="text-center space-y-4">
          <div className="text-4xl">🌿</div>
          <h2 className="text-xl font-semibold text-emerald-800">{dict.checkoutReceived}</h2>
          <p className="text-stone-600">
            {dict.orderNumberLabel}: <strong>{status.orderNumber}</strong>
          </p>
        </div>

        {/* Server-authoritative order summary */}
        {!isCupula && status.shippingCost !== null && status.total !== null && (
          <div className="bg-white border border-stone-200 rounded-lg p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>{dict.subtotal}</span>
              <span>{(status.subtotal ?? 0).toFixed(2)} €</span>
            </div>
            {status.discount ? (
              <div className="flex justify-between text-emerald-700">
                <span>{dict.discount}</span>
                <span>-{(status.discount).toFixed(2)} €</span>
              </div>
            ) : null}
            <div className="flex justify-between text-stone-600">
              <span>{dict.shippingLabel}</span>
              <span>{status.shippingCost.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2 mt-2 text-stone-800">
              <span>{dict.total}</span>
              <span>{status.total.toFixed(2)} €</span>
            </div>
          </div>
        )}

        {/* CUPULA confirmation — NO Pay Now */}
        {isCupula ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            <p className="text-sm text-amber-800 font-medium">
              {dict.shippingLabel}
            </p>
            <p className="text-sm text-amber-700 whitespace-pre-line">
              {dict.shippingToConfirm}
            </p>
          </div>
        ) : status.orderStatus === 'pending_payment' ? (
          <>
            <p className="text-sm text-stone-500 text-center">{dict.checkoutNextStep}</p>
            <div className="border-t pt-6">
              <StripePaymentSection
                orderNumber={status.orderNumber}
                checkoutRequestId={checkoutRequestIdRef.current}
                locale={locale}
                dict={{
                  payNow: dict.payNow,
                  processing: dict.processing,
                  paymentError: dict.paymentError,
                  paymentTryAgain: dict.paymentTryAgain,
                  stripeNotConfigured: dict.stripeNotConfigured,
                  amount: dict.amount,
                  loading: dict.loading,
                  shippingLabel: dict.shippingLabel,
                  shippingToConfirm: dict.shippingToConfirm,
                }}
              />
            </div>
          </>
        ) : null}

        <div className="text-center">
          <Link
            href={`/${locale}`}
            className="inline-block text-sm font-medium text-rose-600 hover:underline"
          >
            {dict.backToHome}
          </Link>
        </div>
      </div>
    )
  }

  // ── Empty cart view ─────────────────────────────────

  if (count === 0) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-stone-500">{dict.emptyCart}</p>
        <Link
          href={`/${locale}/catalog`}
          className="inline-flex text-sm font-medium text-brand-gold-dark underline decoration-brand-gold/40 underline-offset-4 transition-colors hover:text-brand-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold-dark"
        >
          {dict.continueShopping}
        </Link>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────

  const busy = status.type === 'busy'
  const errorMsg = status.type === 'error' ? status.message : null

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-12">
      {/* Back link */}
      <Link
        href={`/${locale}/cart`}
        className="inline-flex text-xs uppercase tracking-[0.18em] text-brand-charcoal/50 transition-colors hover:text-brand-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold-dark"
      >
        ← {dict.backToCart}
      </Link>

      <h1 className="text-2xl font-semibold">{dict.checkout}</h1>

      {/* Cart summary (display only) */}
      <div className="bg-white border border-stone-200 rounded-lg p-3 space-y-1">
        {items.map((i) => (
          <div key={i.id} className="flex justify-between text-sm">
            <span>
              {i.name} × {i.qty}
            </span>
            <span>{(i.price * i.qty).toFixed(2)} €</span>
          </div>
        ))}
        <div className="flex justify-between font-semibold border-t pt-2 mt-2">
          <span>{dict.subtotal}</span>
          <span>{subtotal.toFixed(2)} €</span>
        </div>
        {coupon && (
          <p className="text-xs text-emerald-700">
            {dict.coupon}: {coupon}
          </p>
        )}
      </div>

      {/* Customer section */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-stone-500">
          {dict.customerInfo}
        </h2>
        {renderField(dict.name, customer.name, (v) => setCustomerField('name', v), {
          required: true,
          placeholder: dict.namePlaceholder,
        })}
        {renderField(dict.email, customer.email, (v) => setCustomerField('email', v), {
          required: true,
          type: 'email',
          placeholder: dict.emailPlaceholder,
        })}
        {renderField(dict.phone, customer.phone, (v) => setCustomerField('phone', v), {
          required: true,
          type: 'tel',
        })}
        {renderField(dict.companyName, customer.companyName, (v) => setCustomerField('companyName', v))}
        {renderField(dict.taxId, customer.taxId, (v) => setCustomerField('taxId', v))}
      </section>

      {/* Shipping section */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-stone-500">
          {dict.shippingInfo}
        </h2>
        {renderAddressForm(
          shipping,
          {
            setRecipientName: (v) => setShippingField('recipientName', v),
            setPhone: (v) => setShippingField('phone', v),
            setLine1: (v) => setShippingField('line1', v),
            setLine2: (v) => setShippingField('line2', v),
            setCity: (v) => setShippingField('city', v),
            setRegion: (v) => setShippingField('region', v),
            setPostalCode: (v) => setShippingField('postalCode', v),
            setCountry: (v) => setShippingField('country', v),
          },
          true,
        )}
      </section>

      {/* Billing same as shipping */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={billingSame}
          onChange={(e) => {
            setBillingSame(e.target.checked)
            if (e.target.checked) setBilling(null)
            else setBilling(emptyAddress(shipping.recipientName))
          }}
          className="accent-brand-gold-dark"
        />
        <span className="text-sm text-stone-700">{dict.billingSameAsShipping}</span>
      </label>

      {/* Billing section (when different) */}
      {!billingSame && billing && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-stone-500">
            {dict.billingInfo}
          </h2>
          {renderAddressForm(
            billing,
            {
              setRecipientName: (v) => setBillingField('recipientName', v),
              setPhone: (v) => setBillingField('phone', v),
              setLine1: (v) => setBillingField('line1', v),
              setLine2: (v) => setBillingField('line2', v),
              setCity: (v) => setBillingField('city', v),
              setRegion: (v) => setBillingField('region', v),
              setPostalCode: (v) => setBillingField('postalCode', v),
              setCountry: (v) => setBillingField('country', v),
            },
            true,
          )}
        </section>
      )}

      {/* Error */}
      {errorMsg && <p className="text-sm text-rose-600 text-center">{errorMsg}</p>}

      {/* Submit */}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full bg-rose-600 text-white py-3 rounded-lg font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {busy ? dict.processing : dict.completeOrder}
      </button>
    </div>
  )
}