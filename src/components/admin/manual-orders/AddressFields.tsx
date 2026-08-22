"use client";

import { SHIPPING_COUNTRIES } from "@/services/shipping/country-whitelist";
import React from "react";
import styles from "./manual-orders.module.css";
import type { AddressInput } from "./types";

const COUNTRY_NAMES_PT: Record<string, string> = {
  AT: "Áustria",
  BE: "Bélgica",
  BG: "Bulgária",
  HR: "Croácia",
  CY: "Chipre",
  CZ: "Chéquia",
  DK: "Dinamarca",
  EE: "Estónia",
  FI: "Finlândia",
  FR: "França",
  DE: "Alemanha",
  GR: "Grécia",
  HU: "Hungria",
  IE: "Irlanda",
  IT: "Itália",
  LV: "Letónia",
  LT: "Lituânia",
  LU: "Luxemburgo",
  MT: "Malta",
  NL: "Países Baixos",
  PL: "Polónia",
  PT: "Portugal",
  RO: "Roménia",
  SK: "Eslováquia",
  SI: "Eslovénia",
  ES: "Espanha",
  SE: "Suécia",
  GB: "Reino Unido",
  CH: "Suíça",
  NO: "Noruega",
  IS: "Islândia",
  LI: "Listenstaine",
};

type AddressFieldsProps = {
  address: AddressInput;
  idPrefix: string;
  onChange: <K extends keyof AddressInput>(
    field: K,
    value: AddressInput[K],
  ) => void;
};

export function AddressFields({
  address,
  idPrefix,
  onChange,
}: AddressFieldsProps) {
  const autocompletePrefix = idPrefix === "shipping" ? "shipping" : "billing";

  return (
    <div className={styles.gridTwo}>
      <label className={styles.field} htmlFor={`${idPrefix}-recipientName`}>
        <span className={styles.label}>
          Destinatário<span className={styles.required}>*</span>
        </span>
        <input
          autoComplete={`${autocompletePrefix} name`}
          className={styles.input}
          id={`${idPrefix}-recipientName`}
          onChange={(event) => onChange("recipientName", event.target.value)}
          type="text"
          value={address.recipientName}
        />
      </label>

      <label className={styles.field} htmlFor={`${idPrefix}-phone`}>
        <span className={styles.label}>Telefone do destinatário</span>
        <input
          autoComplete={`${autocompletePrefix} tel`}
          className={styles.input}
          id={`${idPrefix}-phone`}
          onChange={(event) => onChange("phone", event.target.value)}
          type="tel"
          value={address.phone}
        />
      </label>

      <label className={styles.fieldWide} htmlFor={`${idPrefix}-line1`}>
        <span className={styles.label}>
          Morada<span className={styles.required}>*</span>
        </span>
        <input
          autoComplete={`${autocompletePrefix} address-line1`}
          className={styles.input}
          id={`${idPrefix}-line1`}
          onChange={(event) => onChange("line1", event.target.value)}
          type="text"
          value={address.line1}
        />
      </label>

      <label className={styles.fieldWide} htmlFor={`${idPrefix}-line2`}>
        <span className={styles.label}>Complemento (opcional)</span>
        <input
          autoComplete={`${autocompletePrefix} address-line2`}
          className={styles.input}
          id={`${idPrefix}-line2`}
          onChange={(event) => onChange("line2", event.target.value)}
          type="text"
          value={address.line2}
        />
      </label>

      <label className={styles.field} htmlFor={`${idPrefix}-postalCode`}>
        <span className={styles.label}>Código postal</span>
        <input
          autoComplete={`${autocompletePrefix} postal-code`}
          className={styles.input}
          id={`${idPrefix}-postalCode`}
          onChange={(event) => onChange("postalCode", event.target.value)}
          type="text"
          value={address.postalCode}
        />
      </label>

      <label className={styles.field} htmlFor={`${idPrefix}-city`}>
        <span className={styles.label}>
          Localidade<span className={styles.required}>*</span>
        </span>
        <input
          autoComplete={`${autocompletePrefix} address-level2`}
          className={styles.input}
          id={`${idPrefix}-city`}
          onChange={(event) => onChange("city", event.target.value)}
          type="text"
          value={address.city}
        />
      </label>

      <label className={styles.field} htmlFor={`${idPrefix}-region`}>
        <span className={styles.label}>Distrito / região</span>
        <input
          autoComplete={`${autocompletePrefix} address-level1`}
          className={styles.input}
          id={`${idPrefix}-region`}
          onChange={(event) => onChange("region", event.target.value)}
          type="text"
          value={address.region}
        />
      </label>

      <label className={styles.field} htmlFor={`${idPrefix}-country`}>
        <span className={styles.label}>
          País<span className={styles.required}>*</span>
        </span>
        <select
          autoComplete={`${autocompletePrefix} country`}
          className={styles.select}
          id={`${idPrefix}-country`}
          onChange={(event) => onChange("country", event.target.value)}
          value={address.country}
        >
          {SHIPPING_COUNTRIES.map(([code, fallbackName]) => (
            <option key={code} value={code}>
              {COUNTRY_NAMES_PT[code] || fallbackName}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
