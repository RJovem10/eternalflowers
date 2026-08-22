"use client";

import { useConfig } from "@payloadcms/ui";
import { formatAdminURL } from "payload/shared";
import React from "react";
import styles from "./manual-orders.module.css";

export function ManualOrderListAction() {
  const { config } = useConfig();
  const href = formatAdminURL({
    adminRoute: config.routes.admin,
    path: "/collections/orders/manual",
  });

  return (
    <a className={styles.listAction} href={href}>
      <span aria-hidden="true">＋</span>
      Nova encomenda manual
    </a>
  );
}

export default ManualOrderListAction;
