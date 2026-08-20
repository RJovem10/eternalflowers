'use client'
/**
 * CancelOrderActions — Componente Admin UI para cancelamento de encomendas
 *
 * Injected via admin.components.edit.beforeDocumentControls na Orders
 * collection. Mostra botões contextuais dependendo do estado:
 *
 *   pending_payment → "Cancelar encomenda"
 *   confirmed + paid → "Cancelar e reembolsar" (com confirmação)
 *   processing/shipped/completed → nenhum botão
 *
 * Todas as acções chamam o endpoint seguro /api/orders/:id/cancel.
 *
 * NOTA: beforeDocumentControls não recebe props (BeforeDocumentControlsClientProps = {}).
 * O document id é obtido via useDocumentInfo() e os field values via useFormFields().
 */
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React, { useCallback, useState } from 'react'

const STYLES = {
  button:
    'inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50',
  cancelButton:
    'bg-red-600 hover:bg-red-700',
  refundButton:
    'bg-amber-600 hover:bg-amber-700',
  container:
    'mb-6 rounded border border-stone-200 bg-stone-50 p-4',
  title:
    'mb-3 font-semibold text-stone-800 text-sm uppercase tracking-wide',
  feedback:
    'mt-2 text-sm',
  confirmOverlay:
    'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
  confirmBox:
    'rounded-lg bg-white p-6 shadow-xl max-w-sm w-full mx-4',
  confirmTitle:
    'mb-3 text-lg font-semibold text-stone-900',
  confirmText:
    'mb-5 text-sm text-stone-600',
  confirmActions:
    'flex justify-end gap-3',
  confirmButton:
    'inline-flex items-center gap-1.5 rounded px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50',
  confirmCancel:
    'rounded bg-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-300',
}

export function CancelOrderActions() {
  const { id } = useDocumentInfo()

  // Use selectors específicos para evitar rerenders desnecessários
  const orderStatus = useFormFields(
    ([fields, _siblings]) => fields?.orderStatus?.value as string | undefined,
  )

  const paymentStatus = useFormFields(
    ([fields, _siblings]) => fields?.paymentStatus?.value as string | undefined,
  )

  const [loading, setLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const isPaid = paymentStatus === 'paid'

  const callEndpoint = useCallback(async () => {
    if (!id) return

    const actionKey = isPaid ? 'refund' : 'cancel'
    setLoading(actionKey)
    setFeedback(null)

    try {
      const res = await fetch(`/api/orders/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (res.ok) {
        setFeedback({ ok: true, msg: getSuccessMessage(data) })
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setFeedback({ ok: false, msg: data?.error || 'Erro desconhecido.' })
      }
    } catch (err: any) {
      setFeedback({ ok: false, msg: err?.message || 'Erro de rede.' })
    } finally {
      setLoading(null)
      setShowConfirm(false)
    }
  }, [id, isPaid])

  if (!id) return null

  // Determinar qual botão mostrar
  let buttonConfig: { label: string; isRefund: boolean } | null = null

  if (orderStatus === 'pending_payment') {
    buttonConfig = { label: 'Cancelar encomenda', isRefund: false }
  } else if (orderStatus === 'confirmed' && isPaid) {
    buttonConfig = { label: 'Cancelar e reembolsar', isRefund: true }
  }

  // Se já cancelada, mostrar estado
  if (orderStatus === 'cancelled' || orderStatus === 'expired') {
    return null
  }

  // processing/shipped/completed — nenhum botão
  if (!buttonConfig) return null

  const isDisabled = loading !== null

  const handleClick = () => {
    if (buttonConfig!.isRefund) {
      setShowConfirm(true)
    } else {
      callEndpoint()
    }
  }

  return (
    <>
      <div className={STYLES.container}>
        <h3 className={STYLES.title}>Cancelamento</h3>

        <button
          className={`${STYLES.button} ${buttonConfig.isRefund ? STYLES.refundButton : STYLES.cancelButton}`}
          onClick={handleClick}
          disabled={isDisabled}
        >
          {loading ? 'A processar...' : buttonConfig.label}
        </button>

        {feedback && (
          <p className={`${STYLES.feedback} ${feedback.ok ? 'text-emerald-600' : 'text-red-600'}`}>
            {feedback.ok ? '✅ ' : '❌ '}
            {feedback.msg}
          </p>
        )}
      </div>

      {showConfirm && (
        <div className={STYLES.confirmOverlay}>
          <div className={STYLES.confirmBox}>
            <h4 className={STYLES.confirmTitle}>Confirmar cancelamento</h4>
            <p className={STYLES.confirmText}>
              Esta encomenda será cancelada e o valor total será reembolsado ao cliente.
              Esta acção não pode ser desfeita.
            </p>
            <div className={STYLES.confirmActions}>
              <button
                className={STYLES.confirmCancel}
                onClick={() => setShowConfirm(false)}
                disabled={isDisabled}
              >
                Voltar
              </button>
              <button
                className={`${STYLES.confirmButton} bg-red-600 hover:bg-red-700`}
                onClick={callEndpoint}
                disabled={isDisabled}
              >
                {loading ? 'A processar...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function getSuccessMessage(data: any): string {
  switch (data?.kind) {
    case 'pre_payment_cancelled':
      return 'Encomenda cancelada com sucesso!'
    case 'paid_refund_cancelled':
      return 'Encomenda cancelada e reembolsada com sucesso!'
    case 'already_cancelled':
      return 'Encomenda já estava cancelada.'
    default:
      return 'Acção executada com sucesso.'
  }
}

export default CancelOrderActions
