/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManualOrderDraft } from "./types";
import { buildManualOrderRequest, createRequestId } from "./utils";

const mockUseDocumentInfo = vi.fn();
const mockUseFormFields = vi.fn();

vi.mock("@payloadcms/ui", () => ({
  useConfig: () => ({ config: { routes: { admin: "/admin" } } }),
  useDocumentInfo: () => mockUseDocumentInfo(),
  useFormFields: (selector: Function) => mockUseFormFields(selector),
}));

const { ManualOrderForm } = await import("./ManualOrderForm");
const { ManualOrderPaymentActions } =
  await import("./ManualOrderPaymentActions");

function draft(): ManualOrderDraft {
  return {
    requestId: "123e4567-e89b-42d3-a456-426614174000",
    salesChannel: "whatsapp",
    customer: { name: "  Maria  ", phone: " 912345678 ", email: "", taxId: "" },
    shippingAddress: {
      recipientName: "Maria",
      phone: "",
      line1: " Rua das Flores, 1 ",
      line2: "",
      city: "Braga",
      region: "",
      postalCode: "4700-000",
      country: "pt",
    },
    billingSameAsShipping: true,
    billingAddress: {
      recipientName: "",
      phone: "",
      line1: "",
      line2: "",
      city: "",
      region: "",
      postalCode: "",
      country: "PT",
    },
    items: [{ name: "Orquídea", qty: 2, price: 35 }],
    coupon: "",
    internalNote: "",
    shipping: { amount: null, needsConfirmation: false },
  };
}

function setupOrderFields(values: Record<string, unknown>) {
  mockUseFormFields.mockImplementation((selector: Function) => {
    const fields = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, { value }]),
    );
    return selector([fields, {}]);
  });
}

describe("pedido enviado pelo formulário manual", () => {
  it("omite os campos opcionais vazios e nunca inclui preços ou estados", () => {
    const request = buildManualOrderRequest(draft());

    expect(request.customer).toEqual({ name: "Maria", phone: "912345678" });
    expect(request.billingAddress).toBeUndefined();
    expect(request.items).toEqual([{ name: "Orquídea", qty: 2, price: 35 }]);
    expect(request.shippingAddress.country).toBe("PT");
    expect(request).not.toHaveProperty("price");
    expect(request).not.toHaveProperty("subtotal");
    expect(request).not.toHaveProperty("shippingCost");
    expect(request).not.toHaveProperty("total");
    expect(request).not.toHaveProperty("orderStatus");
    expect(request).not.toHaveProperty("paymentStatus");
    expect(request.shipping).toEqual({
      amount: undefined,
      needsConfirmation: false,
    });
  });

  it("cria requestIds UUID v4", () => {
    expect(createRequestId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe("segurança dos botões no formulário Payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDocumentInfo.mockReturnValue({ id: 42 });
  });

  it('todos os botões da criação têm type="button" explícito', () => {
    render(<ManualOrderForm />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("type", "button");
    }
  });

  it("a confirmação externa exige o modal e todos os botões são não-submit", () => {
    setupOrderFields({
      orderSource: "manual",
      orderStatus: "pending_payment",
      paymentStatus: "unpaid",
      stripePaymentIntentId: null,
    });

    render(<ManualOrderPaymentActions />);
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar pagamento externo" }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar como paga" }),
    ).toBeDisabled();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("type", "button");
    }
  });

  it("não apresenta ações de pagamento numa encomenda web", () => {
    setupOrderFields({
      orderSource: "website",
      orderStatus: "pending_payment",
      paymentStatus: "unpaid",
      stripePaymentIntentId: null,
    });

    const { container } = render(<ManualOrderPaymentActions />);
    expect(container).toBeEmptyDOMElement();
  });
});
