import type {
  AddressInput,
  ManualOrderDraft,
  ManualOrderRequest,
} from "./types";

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function serializeAddress(
  address: AddressInput,
): ManualOrderRequest["shippingAddress"] {
  return {
    recipientName: address.recipientName.trim(),
    phone: optional(address.phone),
    line1: address.line1.trim(),
    line2: optional(address.line2),
    city: address.city.trim(),
    region: optional(address.region),
    postalCode: optional(address.postalCode),
    country: address.country.trim().toUpperCase(),
  };
}

export function buildManualOrderRequest(
  draft: ManualOrderDraft,
): ManualOrderRequest {
  return {
    requestId: draft.requestId,
    salesChannel: draft.salesChannel,
    customer: {
      name: draft.customer.name.trim(),
      phone: draft.customer.phone.trim(),
      email: optional(draft.customer.email)?.toLowerCase(),
      taxId: optional(draft.customer.taxId),
    },
    shippingAddress: serializeAddress(draft.shippingAddress),
    billingSameAsShipping: draft.billingSameAsShipping,
    billingAddress: draft.billingSameAsShipping
      ? undefined
      : serializeAddress(draft.billingAddress),
    items: draft.items.map(({ flowerId, qty }) => ({ flowerId, qty })),
    coupon: optional(draft.coupon)?.toUpperCase(),
    internalNote: optional(draft.internalNote),
    locale: "pt",
  };
}

export function createRequestId(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  if (typeof webCrypto?.getRandomValues !== "function") {
    throw new Error(
      "Este browser não permite criar um identificador seguro. Atualiza o browser.",
    );
  }

  const bytes = webCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function apiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;

  const response = data as {
    error?: unknown;
    message?: unknown;
    details?: unknown;
  };

  if (typeof response.error === "string" && response.error.trim())
    return response.error;
  if (typeof response.message === "string" && response.message.trim())
    return response.message;
  if (Array.isArray(response.details)) {
    const details = response.details.filter(
      (value): value is string => typeof value === "string",
    );
    if (details.length > 0) return details.join(" ");
  }

  return fallback;
}
