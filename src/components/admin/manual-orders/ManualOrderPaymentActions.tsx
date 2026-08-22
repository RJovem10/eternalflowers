"use client";

import { useDocumentInfo, useFormFields } from "@payloadcms/ui";
import React, { useCallback, useState } from "react";
import styles from "./manual-orders.module.css";
import type { ExternalPaymentMethod } from "./types";
import { apiErrorMessage } from "./utils";

const EXTERNAL_METHODS: Array<{ label: string; value: ExternalPaymentMethod }> =
  [
    { label: "MB WAY externo", value: "external_mb_way" },
    { label: "Transferência bancária", value: "bank_transfer" },
    { label: "Dinheiro", value: "cash" },
    { label: "Outro", value: "other" },
  ];

type Feedback = { ok: boolean; message: string } | null;

export function ManualOrderPaymentActions() {
  const { id } = useDocumentInfo();
  const orderSource = useFormFields(
    ([fields]) =>
      (fields?.orderSource?.value ?? fields?.source?.value) as
        string | undefined,
  );
  const orderStatus = useFormFields(
    ([fields]) => fields?.orderStatus?.value as string | undefined,
  );
  const paymentStatus = useFormFields(
    ([fields]) => fields?.paymentStatus?.value as string | undefined,
  );
  const stripePaymentIntentId = useFormFields(
    ([fields]) => fields?.stripePaymentIntentId?.value as string | undefined,
  );

  const [loading, setLoading] = useState<
    "external" | "link" | "shipping" | null
  >(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [externalMethod, setExternalMethod] =
    useState<ExternalPaymentMethod>("external_mb_way");
  const [externalReference, setExternalReference] = useState("");
  const [externalConfirmed, setExternalConfirmed] = useState(false);
  const [shippingCost, setShippingCost] = useState("");
  const [shippingReference, setShippingReference] = useState("");
  const [shippingConfirmed, setShippingConfirmed] = useState(false);

  const post = useCallback(
    async (path: string, body?: Record<string, unknown>) => {
      const response = await fetch(`/api/orders/${id}/${path}`, {
        body: body ? JSON.stringify(body) : undefined,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          apiErrorMessage(data, "Não foi possível concluir esta ação."),
        );
      }
      return data;
    },
    [id],
  );

  async function confirmExternalPayment() {
    if (!externalConfirmed) return;
    setLoading("external");
    setFeedback(null);

    try {
      await post("manual-payment/confirm", {
        confirmed: true,
        method: externalMethod,
        reference: externalReference.trim() || undefined,
      });
      setFeedback({
        ok: true,
        message: "Pagamento externo confirmado com sucesso.",
      });
      setShowExternalModal(false);
      setTimeout(() => window.location.reload(), 1000);
    } catch (caught) {
      setFeedback({
        ok: false,
        message:
          caught instanceof Error
            ? caught.message
            : "Não foi possível confirmar o pagamento.",
      });
    } finally {
      setLoading(null);
    }
  }

  async function generatePaymentLink() {
    setLoading("link");
    setFeedback(null);
    setCopyFeedback(null);

    try {
      const data = await post("payment-link", {});
      const link = data?.paymentLink || data?.url;
      if (typeof link !== "string") {
        throw new Error("O servidor não devolveu um link de pagamento.");
      }
      setPaymentLink(link);
      setFeedback({ ok: true, message: "Link de pagamento gerado." });
    } catch (caught) {
      setFeedback({
        ok: false,
        message:
          caught instanceof Error
            ? caught.message
            : "Não foi possível gerar o link.",
      });
    } finally {
      setLoading(null);
    }
  }

  async function copyLink() {
    if (!paymentLink) return;
    try {
      await navigator.clipboard.writeText(paymentLink);
      setCopyFeedback("Link copiado.");
    } catch {
      setCopyFeedback("Seleciona o link e copia-o manualmente.");
    }
  }

  async function confirmShipping() {
    const numericCost = Number(shippingCost);
    if (!shippingConfirmed || !Number.isFinite(numericCost) || numericCost < 0)
      return;

    setLoading("shipping");
    setFeedback(null);
    try {
      await post("shipping/confirm", {
        confirmed: true,
        quotedShippingCost: numericCost,
        reference: shippingReference.trim() || undefined,
      });
      setFeedback({ ok: true, message: "Portes confirmados com sucesso." });
      setTimeout(() => window.location.reload(), 1000);
    } catch (caught) {
      setFeedback({
        ok: false,
        message:
          caught instanceof Error
            ? caught.message
            : "Não foi possível confirmar os portes.",
      });
    } finally {
      setLoading(null);
    }
  }

  if (!id || orderSource !== "manual" || paymentStatus !== "unpaid")
    return null;

  if (orderStatus === "awaiting_shipping") {
    const numericCost = Number(shippingCost);
    const validCost =
      shippingCost.trim() !== "" &&
      Number.isFinite(numericCost) &&
      numericCost >= 0;

    return (
      <div className={styles.actionPanel}>
        <h3 className={styles.actionTitle}>Portes da encomenda manual</h3>
        <p className={styles.actionDescription}>
          Esta encomenda inclui uma cúpula. Confirma o valor acordado para os
          portes antes de gerar um link Stripe ou registar um pagamento externo.
        </p>

        <div className={styles.gridTwo}>
          <label className={styles.field} htmlFor="manual-shipping-cost">
            <span className={styles.label}>Portes confirmados (€)</span>
            <input
              className={styles.input}
              id="manual-shipping-cost"
              inputMode="decimal"
              min="0"
              onChange={(event) => {
                setShippingCost(event.target.value);
                setShippingConfirmed(false);
              }}
              step="0.01"
              type="number"
              value={shippingCost}
            />
          </label>
          <label className={styles.field} htmlFor="manual-shipping-reference">
            <span className={styles.label}>Referência da cotação (opcional)</span>
            <input
              className={styles.input}
              id="manual-shipping-reference"
              maxLength={500}
              onChange={(event) => {
                setShippingReference(event.target.value);
                setShippingConfirmed(false);
              }}
              type="text"
              value={shippingReference}
            />
          </label>
          <div className={styles.field}>
            <span className={styles.label}>Confirmação</span>
            <label className={styles.checkboxRow}>
              <input
                checked={shippingConfirmed}
                onChange={(event) => setShippingConfirmed(event.target.checked)}
                type="checkbox"
              />
              <span>Confirmo que este é o valor de portes acordado.</span>
            </label>
          </div>
        </div>

        <button
          className={styles.primaryButton}
          disabled={loading !== null || !validCost || !shippingConfirmed}
          onClick={confirmShipping}
          type="button"
        >
          {loading === "shipping" ? "A confirmar…" : "Confirmar portes"}
        </button>

        {feedback && (
          <p
            className={feedback.ok ? styles.alertSuccess : styles.alertError}
            role="status"
          >
            {feedback.message}
          </p>
        )}
      </div>
    );
  }

  if (orderStatus !== "pending_payment") return null;

  return (
    <>
      <div className={styles.actionPanel}>
        <h3 className={styles.actionTitle}>Pagamento da encomenda manual</h3>
        <p className={styles.actionDescription}>
          Gera um link seguro para o cliente ou confirma um pagamento que já
          recebeste fora do site.
        </p>

        {paymentLink ? (
          <div>
            <div className={styles.linkRow}>
              <input
                aria-label="Link de pagamento"
                className={styles.linkInput}
                onFocus={(event) => event.currentTarget.select()}
                readOnly
                type="text"
                value={paymentLink}
              />
              <button
                className={styles.primaryButton}
                onClick={copyLink}
                type="button"
              >
                Copiar link
              </button>
            </div>
            {copyFeedback && <p className={styles.muted}>{copyFeedback}</p>}
            {!stripePaymentIntentId && (
              <button
                className={styles.successButton}
                disabled={loading !== null}
                onClick={() => setShowExternalModal(true)}
                type="button"
              >
                Confirmar pagamento externo e revogar link
              </button>
            )}
          </div>
        ) : (
          <div className={styles.inlineActions}>
            <button
              className={styles.primaryButton}
              disabled={loading !== null}
              onClick={generatePaymentLink}
              type="button"
            >
              {loading === "link" ? "A gerar…" : "Gerar link Stripe"}
            </button>

            {!stripePaymentIntentId && (
              <button
                className={styles.successButton}
                disabled={loading !== null}
                onClick={() => setShowExternalModal(true)}
                type="button"
              >
                Confirmar pagamento externo
              </button>
            )}
          </div>
        )}

        {stripePaymentIntentId && !paymentLink && (
          <p className={styles.alertInfo}>
            Já existe uma tentativa de pagamento Stripe. Para evitar estados
            contraditórios, a confirmação como pagamento externo não está
            disponível nesta interface.
          </p>
        )}

        {feedback && (
          <p
            className={feedback.ok ? styles.alertSuccess : styles.alertError}
            role="status"
          >
            {feedback.message}
          </p>
        )}
      </div>

      {showExternalModal && (
        <div
          aria-labelledby="manual-payment-action-title"
          aria-modal="true"
          className={styles.modalOverlay}
          role="dialog"
        >
          <div className={styles.modal}>
            <h3 className={styles.modalTitle} id="manual-payment-action-title">
              Confirmar pagamento externo
            </h3>
            <p className={styles.modalText}>
              Esta ação marca a encomenda como paga e confirma as reservas de
              stock. Usa-a apenas depois de verificares que o dinheiro foi
              recebido.
            </p>
            {paymentLink && (
              <p className={styles.alertWarning}>
                O link Stripe apresentado deixará de funcionar quando confirmares
                o pagamento externo.
              </p>
            )}

            <div className={styles.gridTwo}>
              <label className={styles.field} htmlFor="manual-payment-method">
                <span className={styles.label}>Método recebido</span>
                <select
                  className={styles.select}
                  id="manual-payment-method"
                  onChange={(event) => {
                    setExternalMethod(
                      event.target.value as ExternalPaymentMethod,
                    );
                    setExternalConfirmed(false);
                  }}
                  value={externalMethod}
                >
                  {EXTERNAL_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>

              <label
                className={styles.field}
                htmlFor="manual-payment-reference"
              >
                <span className={styles.label}>
                  Referência / nota (opcional)
                </span>
                <input
                  className={styles.input}
                  id="manual-payment-reference"
                  maxLength={500}
                  onChange={(event) => {
                    setExternalReference(event.target.value);
                    setExternalConfirmed(false);
                  }}
                  type="text"
                  value={externalReference}
                />
              </label>
            </div>

            <label className={styles.checkboxRow}>
              <input
                checked={externalConfirmed}
                onChange={(event) => setExternalConfirmed(event.target.checked)}
                type="checkbox"
              />
              <strong>
                Confirmo que este pagamento foi realmente recebido.
              </strong>
            </label>

            <div className={styles.inlineActions}>
              <button
                className={styles.secondaryButton}
                disabled={loading !== null}
                onClick={() => {
                  setShowExternalModal(false);
                  setExternalConfirmed(false);
                }}
                type="button"
              >
                Voltar
              </button>
              <button
                className={styles.successButton}
                disabled={loading !== null || !externalConfirmed}
                onClick={confirmExternalPayment}
                type="button"
              >
                {loading === "external"
                  ? "A confirmar…"
                  : "Confirmar como paga"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ManualOrderPaymentActions;
