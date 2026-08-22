import { redirect } from "next/navigation";
import { formatAdminURL } from "payload/shared";
import type { AdminViewServerProps } from "payload";
import React from "react";
import { ManualOrderForm } from "./ManualOrderForm";
import styles from "./manual-orders.module.css";
import type { ManualOrderProduct } from "./types";

export async function ManualOrderView({
  initPageResult,
}: AdminViewServerProps) {
  const req = initPageResult.req;

  if (!req?.user) {
    const loginPath = req?.payload?.config?.admin?.routes?.login || "/login";
    const adminRoute = req?.payload?.config?.routes?.admin || "/admin";
    redirect(formatAdminURL({ adminRoute, path: loginPath }));
  }

  const result = await req.payload.find({
    collection: "flowers",
    depth: 0,
    limit: 1000,
    overrideAccess: false,
    req,
    sort: "namePt",
  });

  const products = result.docs
    .map((document: any): ManualOrderProduct | null => {
      const id = Number(document.id);
      if (!Number.isInteger(id) || id < 1) return null;

      return {
        id,
        name: String(document.namePt || document.nameEn || `Produto ${id}`),
        sku: typeof document.sku === "string" ? document.sku : null,
        price: Number(document.price) || 0,
        availability:
          typeof document.availability === "string"
            ? document.availability
            : null,
        productionMode:
          typeof document.productionMode === "string"
            ? document.productionMode
            : null,
        shippingClass:
          typeof document.shippingClass === "string"
            ? document.shippingClass
            : null,
        stockQuantity:
          typeof document.stockQuantity === "number"
            ? document.stockQuantity
            : null,
      };
    })
    .filter((product): product is ManualOrderProduct => product !== null);

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Nova encomenda manual</h1>
          <p className={styles.pageDescription}>
            Regista uma encomenda recebida por telefone, presencialmente ou
            pelas redes sociais. Os preços, descontos, portes e estados são
            calculados e protegidos pelo servidor.
          </p>
        </div>
      </header>

      <ManualOrderForm products={products} />
    </main>
  );
}

export default ManualOrderView;
