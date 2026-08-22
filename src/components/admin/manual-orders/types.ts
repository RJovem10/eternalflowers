export type ManualSalesChannel =
  "phone" | "in_person" | "whatsapp" | "instagram" | "other";

export type ExternalPaymentMethod =
  "external_mb_way" | "bank_transfer" | "cash" | "other";

export type AddressInput = {
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export type CustomerInput = {
  name: string;
  phone: string;
  email: string;
  taxId: string;
};

export type FreeItem = {
  name: string;
  qty: number;
  price: number;
};

export type ManualOrderDraft = {
  requestId: string;
  salesChannel: ManualSalesChannel;
  customer: CustomerInput;
  shippingAddress: AddressInput;
  billingSameAsShipping: boolean;
  billingAddress: AddressInput;
  items: FreeItem[];
  coupon: string;
  internalNote: string;
  shipping: {
    amount: number | null;
    needsConfirmation: boolean;
  };
};

export type ManualOrderRequest = {
  requestId: string;
  salesChannel: ManualSalesChannel;
  customer: {
    name: string;
    phone: string;
    email?: string;
    taxId?: string;
  };
  shippingAddress: {
    recipientName: string;
    phone?: string;
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode?: string;
    country: string;
  };
  billingSameAsShipping: boolean;
  billingAddress?: {
    recipientName: string;
    phone?: string;
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode?: string;
    country: string;
  };
  items: FreeItem[];
  coupon?: string;
  internalNote?: string;
  locale: "pt";
  shipping?: {
    amount?: number | null;
    needsConfirmation: boolean;
  };
};

export type ManualOrderQuote = {
  items: Array<{
    name: string;
    qty: number;
    price: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discount: number;
  shippingCost: number | null;
  total: number | null;
  orderStatus: "pending_payment" | "awaiting_shipping";
};

export type CreatedManualOrder = {
  id: number | string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  total: number | null;
};