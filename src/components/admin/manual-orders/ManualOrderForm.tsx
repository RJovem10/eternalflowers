"use client";

import { useConfig } from "@payloadcms/ui";
import { formatAdminURL } from "payload/shared";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AddressFields } from "./AddressFields";
import styles from "./manual-orders.module.css";
import type {
  AddressInput,
  CreatedManualOrder,
  CustomerInput,
  ExternalPaymentMethod,
  ManualOrderDraft,
  ManualOrderProduct,
  ManualOrderQuote,
  ManualSalesChannel,
} from "./types";
import {
  apiErrorMessage,
  buildManualOrderRequest,
  createRequestId,
} from "./utils";

type PaymentChoice = "stripe" | "external";

type ManualOrderFormProps = {
  products: ManualOrderProduct[];
};

const EMPTY_ADDRESS: AddressInput = {
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "PT",
};

const EMPTY_CUSTOMER: CustomerInput = {
  name: "",
  phone: "",
  email: "",
  taxId: "",
};

const CHANNELS: Array<{ label: string; value: ManualSalesChannel }> = [
  { label: "Telefone", value: "phone" },
  { label: "Presencial", value: "in_person" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Instagram", value: "instagram" },
  { label: "Outro", value: "other" },
];

const EXTERNAL_METHODS: Array<{ label: string; value: ExternalPaymentMethod }> =
  [
    { label: "MB WAY externo", value: "external_mb_way" },
    { label: "Transferência bancária", value: "bank_transfer" },
    { label: "Dinheiro", value: "cash" },
    { label: "Outro", value: "other" },
  ];

function initialDraft(requestId = ""): ManualOrderDraft {
  return {
    requestId,
    salesChannel: "phone",
    customer: { ...EMPTY_CUSTOMER },
    shippingAddress: { ...EMPTY_ADDRESS },
    billingSameAsShipping: true,
    billingAddress: { ...EMPTY_ADDRESS },
    items: [],
    coupon: "",
    internalNote: "",
  };
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "Por confirmar";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function orderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    pending_payment: "A aguardar pagamento",
    awaiting_shipping: "A aguardar confirmação dos portes",
    confirmed: "Confirmada",
    processing: "Em preparação",
    shipped: "Expedida",
    completed: "Concluída",
    cancelled: "Cancelada",
    expired: "Expirada",
  };
  return labels[status] || status;
}

function paymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    unpaid: "Não pago",
    pending: "Pendente",
    paid: "Pago",
    failed: "Falhou",
    refunded: "Reembolsado",
  };
  return labels[status] || status;
}

function validateDraft(draft: ManualOrderDraft): string | null {
  if (!draft.customer.name.trim()) return "Preenche o nome do cliente.";
  if (!draft.customer.phone.trim()) return "Preenche o telefone do cliente.";
  if (
    draft.customer.email.trim() &&
    !/^\S+@\S+\.\S+$/.test(draft.customer.email.trim())
  ) {
    return "Confirma o email do cliente ou deixa esse campo vazio.";
  }
  if (draft.items.length === 0) return "Adiciona pelo menos um produto.";
  if (draft.items.some((item) => !Number.isInteger(item.qty) || item.qty < 1)) {
    return "As quantidades dos produtos têm de ser números inteiros positivos.";
  }

  const shippingError = validateAddress(draft.shippingAddress, "entrega");
  if (shippingError) return shippingError;

  if (!draft.billingSameAsShipping) {
    const billingError = validateAddress(draft.billingAddress, "faturação");
    if (billingError) return billingError;
  }

  return null;
}

function validateAddress(address: AddressInput, label: string): string | null {
  if (!address.recipientName.trim())
    return `Preenche o destinatário da morada de ${label}.`;
  if (!address.line1.trim()) return `Preenche a morada de ${label}.`;
  if (!address.city.trim())
    return `Preenche a localidade da morada de ${label}.`;
  if (!address.country.trim()) return `Escolhe o país da morada de ${label}.`;
  return null;
}

function productAvailability(product: ManualOrderProduct): string {
  if (product.availability === "sold") return "Vendido";
  if (product.availability === "reserved") return "Reservado";
  if (product.availability === "preparing") return "Em preparação";
  if (!product.productionMode) return "Produto por classificar";
  if (product.productionMode === "made_to_order")
    return "Produzido por encomenda";
  if ((product.stockQuantity ?? 0) <= 0) return "Sem stock";
  if (typeof product.stockQuantity === "number")
    return `Stock: ${product.stockQuantity}`;
  return "Disponível";
}

function isProductSelectable(product: ManualOrderProduct): boolean {
  if (product.productionMode === "made_to_order") {
    return ["available", "preparing"].includes(
      product.availability || "available",
    );
  }
  if (!["unique", "reproducible"].includes(product.productionMode || ""))
    return false;
  if (["sold", "reserved", "preparing"].includes(product.availability || ""))
    return false;
  return (product.stockQuantity ?? 0) > 0;
}

export function ManualOrderForm({ products }: ManualOrderFormProps) {
  const { config } = useConfig();
  const [draft, setDraft] = useState<ManualOrderDraft>(() => initialDraft());
  const [productToAdd, setProductToAdd] = useState("");
  const [quote, setQuote] = useState<ManualOrderQuote | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("stripe");
  const [externalMethod, setExternalMethod] =
    useState<ExternalPaymentMethod>("external_mb_way");
  const [externalReference, setExternalReference] = useState("");
  const [externalConfirmed, setExternalConfirmed] = useState(false);
  const [loading, setLoading] = useState<"preview" | "create" | "link" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedManualOrder | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [showExternalModal, setShowExternalModal] = useState(false);
  const requestIdRef = useRef("");

  useEffect(() => {
    const requestId = createRequestId();
    requestIdRef.current = requestId;
    setDraft((current) => ({ ...current, requestId }));
  }, []);

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const availableProducts = useMemo(
    () =>
      products.filter(
        (product) => !draft.items.some((item) => item.flowerId === product.id),
      ),
    [draft.items, products],
  );

  function materialChange(
    update: (current: ManualOrderDraft) => ManualOrderDraft,
  ) {
    const requestId = createRequestId();
    requestIdRef.current = requestId;
    setDraft((current) => ({ ...update(current), requestId }));
    setQuote(null);
    setError(null);
  }

  function updateCustomer<K extends keyof CustomerInput>(
    field: K,
    value: CustomerInput[K],
  ) {
    materialChange((current) => ({
      ...current,
      customer: { ...current.customer, [field]: value },
    }));
  }

  function updateAddress(
    kind: "shippingAddress" | "billingAddress",
    field: keyof AddressInput,
    value: string,
  ) {
    materialChange((current) => ({
      ...current,
      [kind]: { ...current[kind], [field]: value },
    }));
  }

  function addProduct() {
    const flowerId = Number(productToAdd);
    const product = productsById.get(flowerId);
    if (!product || !isProductSelectable(product)) return;

    materialChange((current) => ({
      ...current,
      items: [...current.items, { flowerId, qty: 1 }],
    }));
    setProductToAdd("");
  }

  function updateQuantity(flowerId: number, value: string) {
    const qty = Number(value);
    materialChange((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.flowerId === flowerId ? { ...item, qty } : item,
      ),
    }));
  }

  function removeProduct(flowerId: number) {
    materialChange((current) => ({
      ...current,
      items: current.items.filter((item) => item.flowerId !== flowerId),
    }));
  }

  function setPayment(nextChoice: PaymentChoice) {
    if (nextChoice === paymentChoice) return;
    setPaymentChoice(nextChoice);
    setExternalConfirmed(false);
    materialChange((current) => current);
  }

  function setExternalPaymentMethod(nextMethod: ExternalPaymentMethod) {
    setExternalMethod(nextMethod);
    setExternalConfirmed(false);
    materialChange((current) => current);
  }

  function changeExternalReference(value: string) {
    setExternalReference(value);
    setExternalConfirmed(false);
    materialChange((current) => current);
  }

  function currentDraft(): ManualOrderDraft {
    if (draft.requestId) return draft;
    const next = { ...draft, requestId: createRequestId() };
    requestIdRef.current = next.requestId;
    setDraft(next);
    return next;
  }

  async function handlePreview() {
    const preparedDraft = currentDraft();
    const previewRequestId = preparedDraft.requestId;
    const validationError = validateDraft(preparedDraft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading("preview");
    setError(null);

    try {
      const response = await fetch("/api/orders/manual/preview", {
        body: JSON.stringify(buildManualOrderRequest(preparedDraft)),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.ok !== true || !data?.quote) {
        throw new Error(
          apiErrorMessage(data, "Não foi possível calcular o resumo."),
        );
      }

      if (requestIdRef.current === previewRequestId) {
        setQuote(data.quote as ManualOrderQuote);
      }
    } catch (caught) {
      if (requestIdRef.current === previewRequestId) {
        setQuote(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível calcular o resumo.",
        );
      }
    } finally {
      setLoading(null);
    }
  }

  function requestCreate() {
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!quote) {
      setError("Calcula o resumo antes de criar a encomenda.");
      return;
    }
    if (paymentChoice === "external" && quote.orderStatus !== "awaiting_shipping") {
      if (!externalConfirmed) {
        setError("Confirma que o pagamento externo já foi recebido.");
        return;
      }
      setShowExternalModal(true);
      return;
    }

    void createOrder();
  }

  async function createOrder() {
    if (!quote) return;
    setLoading("create");
    setError(null);

    const baseRequest = buildManualOrderRequest(currentDraft());
    // Uma cúpula ainda não tem total final: a forma de pagamento só pode
    // ser escolhida depois de os portes serem confirmados no documento.
    const effectivePaymentChoice = quote.orderStatus === "awaiting_shipping"
      ? "stripe"
      : paymentChoice;
    const body = {
      ...baseRequest,
      paymentChoice: effectivePaymentChoice,
      ...(effectivePaymentChoice === "external"
        ? {
            externalPayment: {
              confirmed: true,
              method: externalMethod,
              reference: externalReference.trim() || undefined,
            },
          }
        : {}),
    };

    try {
      const response = await fetch("/api/orders/manual/create", {
        body: JSON.stringify(body),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.ok !== true || !data?.order) {
        throw new Error(
          apiErrorMessage(data, "Não foi possível criar a encomenda."),
        );
      }

      setCreated(data.order as CreatedManualOrder);
      setPaymentLink(
        typeof data.paymentLink === "string" ? data.paymentLink : null,
      );
      setCopyFeedback(null);
      const nextRequestId = createRequestId();
      requestIdRef.current = nextRequestId;
      setDraft((current) => ({ ...current, requestId: nextRequestId }));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível criar a encomenda.",
      );
    } finally {
      setLoading(null);
      setShowExternalModal(false);
    }
  }

  async function generatePaymentLink() {
    if (!created || created.orderStatus === "awaiting_shipping") return;
    setLoading("link");
    setError(null);
    setCopyFeedback(null);

    try {
      const response = await fetch(`/api/orders/${created.id}/payment-link`, {
        body: JSON.stringify({}),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      const link = data?.paymentLink || data?.url;

      if (!response.ok || data?.ok !== true || typeof link !== "string") {
        throw new Error(
          apiErrorMessage(data, "Não foi possível gerar o link de pagamento."),
        );
      }

      setPaymentLink(link);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível gerar o link.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function copyPaymentLink() {
    if (!paymentLink) return;
    try {
      await navigator.clipboard.writeText(paymentLink);
      setCopyFeedback("Link copiado.");
    } catch {
      setCopyFeedback("Seleciona o link e copia-o manualmente.");
    }
  }

  function startAnotherOrder() {
    const requestId = createRequestId();
    requestIdRef.current = requestId;
    setDraft(initialDraft(requestId));
    setProductToAdd("");
    setQuote(null);
    setPaymentChoice("stripe");
    setExternalMethod("external_mb_way");
    setExternalReference("");
    setExternalConfirmed(false);
    setError(null);
    setCreated(null);
    setPaymentLink(null);
    setCopyFeedback(null);
  }

  if (created) {
    const documentURL = formatAdminURL({
      adminRoute: config.routes.admin,
      path: `/collections/orders/${created.id}`,
    });
    const awaitingShipping = created.orderStatus === "awaiting_shipping";

    return (
      <section className={styles.resultCard} aria-live="polite">
        <p className={styles.alertSuccess}>Encomenda criada com sucesso.</p>
        <h2 className={styles.sectionTitle}>Número da encomenda</h2>
        <p className={styles.resultNumber}>{created.orderNumber}</p>

        <div className={styles.resultFacts}>
          <div className={styles.resultFact}>
            <span className={styles.resultFactLabel}>Estado</span>
            {orderStatusLabel(created.orderStatus)}
          </div>
          <div className={styles.resultFact}>
            <span className={styles.resultFactLabel}>Pagamento</span>
            {paymentStatusLabel(created.paymentStatus)}
          </div>
          <div className={styles.resultFact}>
            <span className={styles.resultFactLabel}>Total</span>
            {formatMoney(created.total)}
          </div>
        </div>

        {error && <p className={styles.alertError}>{error}</p>}

        {awaitingShipping ? (
          <p className={styles.alertWarning}>
            Esta encomenda inclui uma cúpula. Confirma primeiro o valor dos
            portes no documento da encomenda. Enquanto isso, não será criado
            qualquer pagamento Stripe.
          </p>
        ) : paymentChoice === "stripe" ? (
          <div>
            <h3 className={styles.subheading}>Link de pagamento Stripe</h3>
            {paymentLink ? (
              <>
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
                    onClick={copyPaymentLink}
                    type="button"
                  >
                    Copiar link
                  </button>
                </div>
                {copyFeedback && <p className={styles.muted}>{copyFeedback}</p>}
              </>
            ) : (
              <button
                className={styles.primaryButton}
                disabled={loading !== null}
                onClick={generatePaymentLink}
                type="button"
              >
                {loading === "link" ? "A gerar…" : "Gerar link de pagamento"}
              </button>
            )}
          </div>
        ) : (
          <p className={styles.alertInfo}>
            O pagamento externo ficou registado nesta encomenda.
          </p>
        )}

        <div className={styles.resultActions}>
          <a className={styles.successButton} href={documentURL}>
            Abrir encomenda
          </a>
          <button
            className={styles.secondaryButton}
            onClick={startAnotherOrder}
            type="button"
          >
            Criar outra encomenda
          </button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={(event) => event.preventDefault()}>
      {error && (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>1. Cliente</h2>
            <p className={styles.sectionHint}>
              O email é opcional nas encomendas manuais.
            </p>
          </div>
        </div>

        <div className={styles.gridTwo}>
          <label className={styles.field} htmlFor="manual-sales-channel">
            <span className={styles.label}>Canal da encomenda</span>
            <select
              className={styles.select}
              id="manual-sales-channel"
              onChange={(event) =>
                materialChange((current) => ({
                  ...current,
                  salesChannel: event.target.value as ManualSalesChannel,
                }))
              }
              value={draft.salesChannel}
            >
              {CHANNELS.map((channel) => (
                <option key={channel.value} value={channel.value}>
                  {channel.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field} htmlFor="manual-customer-name">
            <span className={styles.label}>
              Nome<span className={styles.required}>*</span>
            </span>
            <input
              autoComplete="name"
              className={styles.input}
              id="manual-customer-name"
              onChange={(event) => updateCustomer("name", event.target.value)}
              type="text"
              value={draft.customer.name}
            />
          </label>

          <label className={styles.field} htmlFor="manual-customer-phone">
            <span className={styles.label}>
              Telefone<span className={styles.required}>*</span>
            </span>
            <input
              autoComplete="tel"
              className={styles.input}
              id="manual-customer-phone"
              onChange={(event) => updateCustomer("phone", event.target.value)}
              type="tel"
              value={draft.customer.phone}
            />
          </label>

          <label className={styles.field} htmlFor="manual-customer-email">
            <span className={styles.label}>Email (opcional)</span>
            <input
              autoComplete="email"
              className={styles.input}
              id="manual-customer-email"
              onChange={(event) => updateCustomer("email", event.target.value)}
              type="email"
              value={draft.customer.email}
            />
          </label>

          <label className={styles.field} htmlFor="manual-customer-tax-id">
            <span className={styles.label}>NIF (opcional)</span>
            <input
              className={styles.input}
              id="manual-customer-tax-id"
              inputMode="numeric"
              onChange={(event) => updateCustomer("taxId", event.target.value)}
              type="text"
              value={draft.customer.taxId}
            />
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>2. Produtos</h2>
            <p className={styles.sectionHint}>
              Os preços apresentados vêm do catálogo e serão novamente validados
              pelo servidor.
            </p>
          </div>
        </div>

        {products.length === 0 ? (
          <p className={styles.emptyState}>
            Não existem produtos disponíveis no catálogo.
          </p>
        ) : (
          <>
            <div className={styles.productPicker}>
              <label className={styles.field} htmlFor="manual-product-picker">
                <span className={styles.label}>Escolher produto</span>
                <select
                  className={styles.select}
                  id="manual-product-picker"
                  onChange={(event) => setProductToAdd(event.target.value)}
                  value={productToAdd}
                >
                  <option value="">Seleciona um produto…</option>
                  {availableProducts.map((product) => (
                    <option
                      disabled={!isProductSelectable(product)}
                      key={product.id}
                      value={product.id}
                    >
                      {product.name}
                      {product.sku ? ` · ${product.sku}` : ""} ·{" "}
                      {formatMoney(product.price)} ·{" "}
                      {productAvailability(product)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={styles.secondaryButton}
                disabled={!productToAdd}
                onClick={addProduct}
                type="button"
              >
                Adicionar
              </button>
            </div>

            {draft.items.length === 0 ? (
              <p className={styles.emptyState}>
                Ainda não adicionaste produtos.
              </p>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Preço atual</th>
                      <th>Quantidade</th>
                      <th aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((item) => {
                      const product = productsById.get(item.flowerId);
                      if (!product) return null;
                      return (
                        <tr key={item.flowerId}>
                          <td>
                            <span className={styles.productName}>
                              {product.name}
                            </span>
                            <span className={styles.productMeta}>
                              {[product.sku, productAvailability(product)]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </td>
                          <td>{formatMoney(product.price)}</td>
                          <td>
                            <input
                              aria-label={`Quantidade de ${product.name}`}
                              className={styles.quantityInput}
                              inputMode="numeric"
                              min="1"
                              onChange={(event) =>
                                updateQuantity(
                                  item.flowerId,
                                  event.target.value,
                                )
                              }
                              step="1"
                              type="number"
                              value={Number.isNaN(item.qty) ? "" : item.qty}
                            />
                          </td>
                          <td className={styles.numericCell}>
                            <button
                              className={styles.quietButton}
                              onClick={() => removeProduct(item.flowerId)}
                              type="button"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>3. Moradas</h2>
            <p className={styles.sectionHint}>
              Só são apresentados os países atualmente suportados.
            </p>
          </div>
          <button
            className={styles.quietButton}
            onClick={() =>
              materialChange((current) => ({
                ...current,
                shippingAddress: {
                  ...current.shippingAddress,
                  recipientName: current.customer.name,
                  phone: current.customer.phone,
                },
              }))
            }
            type="button"
          >
            Copiar nome e telefone do cliente
          </button>
        </div>

        <h3 className={styles.subheading}>Morada de entrega</h3>
        <AddressFields
          address={draft.shippingAddress}
          idPrefix="shipping"
          onChange={(field, value) =>
            updateAddress("shippingAddress", field, value)
          }
        />

        <div className={styles.addressBlock}>
          <label className={styles.checkboxRow}>
            <input
              checked={draft.billingSameAsShipping}
              onChange={(event) =>
                materialChange((current) => ({
                  ...current,
                  billingSameAsShipping: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>A morada de faturação é igual à morada de entrega</span>
          </label>

          {!draft.billingSameAsShipping && (
            <div className={styles.addressBlock}>
              <h3 className={styles.subheading}>Morada de faturação</h3>
              <AddressFields
                address={draft.billingAddress}
                idPrefix="billing"
                onChange={(field, value) =>
                  updateAddress("billingAddress", field, value)
                }
              />
            </div>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>4. Resumo</h2>
            <p className={styles.sectionHint}>
              O servidor calcula os artigos, desconto, portes e total. Qualquer
              alteração exige um novo cálculo.
            </p>
          </div>
        </div>

        <div className={styles.gridTwo}>
          <label className={styles.field} htmlFor="manual-coupon">
            <span className={styles.label}>Cupão (opcional)</span>
            <input
              autoCapitalize="characters"
              className={styles.input}
              id="manual-coupon"
              onChange={(event) =>
                materialChange((current) => ({
                  ...current,
                  coupon: event.target.value,
                }))
              }
              type="text"
              value={draft.coupon}
            />
          </label>

          <label className={styles.fieldWide} htmlFor="manual-internal-note">
            <span className={styles.label}>Nota interna (opcional)</span>
            <textarea
              className={styles.textarea}
              id="manual-internal-note"
              maxLength={4000}
              onChange={(event) =>
                materialChange((current) => ({
                  ...current,
                  internalNote: event.target.value,
                }))
              }
              placeholder="Informação útil para preparar ou acompanhar esta encomenda."
              value={draft.internalNote}
            />
          </label>
        </div>

        {!quote ? (
          <p className={styles.alertInfo}>
            Preenche os dados e clica em “Calcular resumo” para veres os valores
            finais.
          </p>
        ) : (
          <div aria-live="polite">
            <div className={styles.tableScroll}>
              <table className={styles.quoteTable}>
                <thead>
                  <tr>
                    <th>Artigo</th>
                    <th className={styles.numericCell}>Qtd.</th>
                    <th className={styles.numericCell}>Preço</th>
                    <th className={styles.numericCell}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item, index) => (
                    <tr key={`${item.flowerId || item.name}-${index}`}>
                      <td>{item.name}</td>
                      <td className={styles.numericCell}>{item.qty}</td>
                      <td className={styles.numericCell}>
                        {formatMoney(item.price)}
                      </td>
                      <td className={styles.numericCell}>
                        {formatMoney(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.totals}>
              <div className={styles.totalRow}>
                <span>Subtotal</span>
                <strong>{formatMoney(quote.subtotal)}</strong>
              </div>
              <div className={styles.totalRow}>
                <span>Desconto</span>
                <strong>{formatMoney(quote.discount)}</strong>
              </div>
              <div className={styles.totalRow}>
                <span>Portes</span>
                <strong>{formatMoney(quote.shippingCost)}</strong>
              </div>
              <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                <span>Total</span>
                <strong>{formatMoney(quote.total)}</strong>
              </div>
            </div>

            {quote.orderStatus === "awaiting_shipping" && (
              <p className={styles.alertWarning}>
                Esta encomenda inclui uma cúpula e ficará a aguardar confirmação
                dos portes. Não será gerado pagamento Stripe antes dessa
                confirmação.
              </p>
            )}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>5. Pagamento</h2>
            <p className={styles.sectionHint}>
              Escolhe como o cliente irá pagar esta encomenda.
            </p>
          </div>
        </div>

        {quote?.orderStatus === "awaiting_shipping" ? (
          <p className={styles.alertWarning}>
            A forma de pagamento será escolhida depois de confirmares os portes
            no documento da encomenda. Nenhum pagamento será registado agora.
          </p>
        ) : <><div className={styles.paymentChoices}>
          <label className={styles.radioCard}>
            <input
              checked={paymentChoice === "stripe"}
              name="paymentChoice"
              onChange={() => setPayment("stripe")}
              type="radio"
            />
            <span>
              <span className={styles.radioTitle}>Enviar link Stripe</span>
              <span className={styles.radioDescription}>
                A encomenda fica não paga até o webhook Stripe confirmar o
                pagamento.
              </span>
            </span>
          </label>

          <label className={styles.radioCard}>
            <input
              checked={paymentChoice === "external"}
              name="paymentChoice"
              onChange={() => setPayment("external")}
              type="radio"
            />
            <span>
              <span className={styles.radioTitle}>Já pago fora do site</span>
              <span className={styles.radioDescription}>
                Usa apenas quando confirmaste que o valor foi realmente
                recebido.
              </span>
            </span>
          </label>
        </div>

        {paymentChoice === "external" && (
          <div className={styles.externalFields}>
            <div className={styles.gridTwo}>
              <label className={styles.field} htmlFor="manual-external-method">
                <span className={styles.label}>Método recebido</span>
                <select
                  className={styles.select}
                  id="manual-external-method"
                  onChange={(event) =>
                    setExternalPaymentMethod(
                      event.target.value as ExternalPaymentMethod,
                    )
                  }
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
                htmlFor="manual-external-reference"
              >
                <span className={styles.label}>
                  Referência / nota (opcional)
                </span>
                <input
                  className={styles.input}
                  id="manual-external-reference"
                  maxLength={500}
                  onChange={(event) =>
                    changeExternalReference(event.target.value)
                  }
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
                Confirmo que o pagamento foi recebido fora do site.
              </strong>
            </label>
          </div>
        )}</>}
      </section>

      <div className={styles.stickyActions}>
        <span className={styles.muted}>
          {quote
            ? "Resumo calculado e pronto para confirmar."
            : "Calcula o resumo antes de criar."}
        </span>
        <div className={styles.buttonRow}>
          <button
            className={styles.secondaryButton}
            disabled={loading !== null || !draft.requestId}
            onClick={handlePreview}
            type="button"
          >
            {loading === "preview"
              ? "A calcular…"
              : quote
                ? "Recalcular resumo"
                : "Calcular resumo"}
          </button>
          <button
            className={
              paymentChoice === "external"
                ? styles.successButton
                : styles.primaryButton
            }
            disabled={
              loading !== null ||
              !quote ||
              (paymentChoice === "external" &&
                quote?.orderStatus !== "awaiting_shipping" &&
                !externalConfirmed)
            }
            onClick={requestCreate}
            type="button"
          >
            {loading === "create"
              ? "A criar…"
              : quote?.orderStatus === "awaiting_shipping"
                ? "Criar a aguardar portes"
                : paymentChoice === "external"
                ? "Criar e registar pagamento"
                : "Criar encomenda"}
          </button>
        </div>
      </div>

      {showExternalModal && quote && (
        <div
          aria-labelledby="external-payment-confirm-title"
          aria-modal="true"
          className={styles.modalOverlay}
          role="dialog"
        >
          <div className={styles.modal}>
            <h2
              className={styles.modalTitle}
              id="external-payment-confirm-title"
            >
              Confirmar pagamento externo
            </h2>
            <p className={styles.modalText}>
              {`Confirmas que recebeste ${formatMoney(quote.total)} por ${
                    EXTERNAL_METHODS.find(
                      (method) => method.value === externalMethod,
                    )?.label || "método externo"
                  }? Esta ação confirma o pagamento e o stock apenas uma vez.`}
            </p>
            <div className={styles.inlineActions}>
              <button
                className={styles.secondaryButton}
                disabled={loading !== null}
                onClick={() => setShowExternalModal(false)}
                type="button"
              >
                Voltar
              </button>
              <button
                className={styles.successButton}
                disabled={loading !== null}
                onClick={() => void createOrder()}
                type="button"
              >
                {loading === "create"
                  ? "A confirmar…"
                  : "Sim, pagamento recebido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

export default ManualOrderForm;
