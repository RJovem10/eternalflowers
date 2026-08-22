export type ManualOrderProduct = {
  id: number;
  name: string;
  sku?: string | null;
  price: number;
  availability?: string | null;
  productionMode?: string | null;
  shippingClass?: string | null;
  stockQuantity?: number | null;
};

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

export type SelectedItem = {
  flowerId: number;
  qty: number;
};

export type ManualOrderDraft = {
  requestId: string;
  salesChannel: ManualSalesChannel;
  customer: CustomerInput;
  shippingAddress: AddressInput;
  billingSameAsShipping: boolean;
  billingAddress: AddressInput;
  items: SelectedItem[];
  coupon: string;
  internalNote: string;
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
  items: SelectedItem[];
  coupon?: string;
  internalNote?: string;
  locale: "pt";
};

export type ManualOrderQuote = {
  items: Array<{
    flowerId?: number;
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
