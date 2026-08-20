'use client'
/**
 * FulfillmentActions — Custom admin component for order fulfillment
 *
 * Injected via admin.components.edit.beforeDocumentControls in the Orders
 * collection config. Shows contextual buttons depending on order state:
 *
 *   confirmed + paid → "Começar preparação"
 *   processing + paid → "Marcar como expedida"
 *   shipped + paid → "Marcar como concluída"
 *
 * All actions call the secure Payload custom endpoints, never direct updates.
 *
 * NOTA: beforeDocumentControls não recebe props (BeforeDocumentControlsClientProps = {}).
 * O document id é obtido via useDocumentInfo() e os field values via useFormFields().
 */
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React, { useCallback, useState } from 'react'

const STYLES = {
  button:
    'inline-flex items-center gap-2 rounded bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50',
  input:
    'rounded border border-stone-300 px-3 py-1.5 text-sm w-full',
  container:
    'mb-6 rounded border border-stone-200 bg-stone-50 p-4',
  title:
    'mb-3 font-semibold text-stone-800 text-sm uppercase tracking-wide',
  feedback:
    'mt-2 text-sm',
}

export function FulfillmentActions() {
  const { id } = useDocumentInfo()

  // Use selectors específicos para evitar rerenders desnecessários
  const orderStatus = useFormFields(
    ([fields, _siblings]) => fields?.orderStatus?.value as string | undefined,
  )

  const paymentStatus = useFormFields(
    ([fields, _siblings]) => fields?.paymentStatus?.value as string | undefined,
  )

  const [trackingNumber, setTrackingNumber] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const isPaid = paymentStatus === 'paid'

  const callEndpoint = useCallback(async (action: string, body?: Record<string, any>) => {
    if (!id) return
    setLoading(action)
    setFeedback(null)

    try {
      const res = await fetch(`/api/orders/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })

      const data = await res.json()

      if (res.ok) {
        setFeedback({ ok: true, msg: getSuccessMessage(action, data) })
        // Refresh the page after 1s to show updated state
        setTimeout(() => window.location.reload(), 1000)
      } else {
        setFeedback({ ok: false, msg: data?.error || 'Erro desconhecido.' })
      }
    } catch (err: any) {
      setFeedback({ ok: false, msg: err?.message || 'Erro de rede.' })
    } finally {
      setLoading(null)
    }
  }, [id])

  if (!id) return null

  // Determine which action to show
  let actionConfig: { action: string; label: string; needsTracking: boolean } | null = null

  if (orderStatus === 'confirmed' && isPaid) {
    actionConfig = { action: 'start-processing', label: 'Começar preparação', needsTracking: false }
  } else if (orderStatus === 'processing' && isPaid) {
    actionConfig = { action: 'mark-shipped', label: 'Marcar como expedida', needsTracking: true }
  } else if (orderStatus === 'shipped' && isPaid) {
    actionConfig = { action: 'complete', label: 'Marcar como concluída', needsTracking: false }
  }

  if (!actionConfig) return null

  const handleAction = () => {
    if (actionConfig!.needsTracking) {
      callEndpoint(actionConfig!.action, { trackingNumber: trackingNumber || undefined })
    } else {
      callEndpoint(actionConfig!.action)
    }
  }

  const isDisabled = loading !== null

  return (
    <div className={STYLES.container}>
      <h3 className={STYLES.title}>Fulfillment</h3>

      {actionConfig.needsTracking && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-stone-600">
            Código de Tracking (opcional)
          </label>
          <input
            className={STYLES.input}
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Ex: CT123456789PT"
            disabled={isDisabled}
          />
        </div>
      )}

      <button
        className={STYLES.button}
        onClick={handleAction}
        disabled={isDisabled}
      >
        {loading ? 'A processar...' : actionConfig.label}
      </button>

      {feedback && (
        <p className={`${STYLES.feedback} ${feedback.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {feedback.ok ? '✅ ' : '❌ '}
          {feedback.msg}
        </p>
      )}
    </div>
  )
}

function getSuccessMessage(action: string, data: any): string {
  switch (data?.kind) {
    case 'processing_started':
      return 'Preparação iniciada com sucesso!'
    case 'already_processing':
      return 'Preparação já estava iniciada.'
    case 'shipped':
      return `Expedida com sucesso!${data.trackingNumber ? ` Tracking: ${data.trackingNumber}` : ''}`
    case 'already_shipped':
      return 'Encomenda já estava marcada como expedida.'
    case 'completed':
      return 'Encomenda concluída com sucesso!'
    case 'already_completed':
      return 'Encomenda já estava concluída.'
    default:
      return 'Ação executada com sucesso.'
  }
}

export default FulfillmentActions
