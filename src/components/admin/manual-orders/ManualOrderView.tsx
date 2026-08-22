import { redirect } from "next/navigation";
import { formatAdminURL } from "payload/shared";
import type { AdminViewServerProps } from "payload";
import React from "react";
import { ManualOrderForm } from "./ManualOrderForm";
import styles from "./manual-orders.module.css";

export async function ManualOrderView({
  initPageResult,
}: AdminViewServerProps) {
  const req = initPageResult.req;

  if (!req?.user) {
    const loginPath = req?.payload?.config?.admin?.routes?.login || "/login";
    const adminRoute = req?.payload?.config?.routes?.admin || "/admin";
    redirect(formatAdminURL({ adminRoute, path: loginPath }));
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Nova encomenda manual</h1>
          <p className={styles.pageDescription}>
            Regista uma encomenda recebida por telefone, presencialmente ou
            pelas redes sociais. Os produtos, portes e totais são calculados
            e protegidos pelo servidor. Os portes de envio são indicados no
            resumo — se pendentes de confirmação, a encomenda ficará a
            aguardar validação manual.
          </p>
        </div>
      </header>

      <ManualOrderForm />
    </main>
  );
}

export default ManualOrderView;
