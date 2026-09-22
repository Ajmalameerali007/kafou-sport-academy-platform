"use client";
import { useRef, useState } from "react";
import type { AccountContext } from "@/lib/platform/contracts";
import {
  productCommand,
  type ProductData,
  type ProductRow,
} from "@/lib/platform/product";
import { useLocale } from "@/components/kafou/locale";
import { announceSaved } from "./portal-ui";
export type ProductProps = {
  account: AccountContext;
  data: ProductData;
  refresh: () => void;
  section: string;
};
export type ProductField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  value?: string;
  min?: number;
  max?: number;
  step?: string;
};
export const val = (r: ProductRow | undefined, k: string) =>
  String(r?.[k] ?? "");
export function ProductNotice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <p
      className={error ? "ops-notice" : "product-notice"}
      role={error ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
export function ProductForm({
  title,
  action,
  fields,
  initial = {},
  onSaved,
  submitLabel = "Save",
}: {
  title: string;
  action: string;
  fields: ProductField[];
  initial?: ProductRow;
  onSaved: () => void;
  submitLabel?: string;
}) {
  const { t } = useLocale();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const fingerprint = useRef("");
  return (
    <form
      className="ops-editor product-form"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget;
        const values: ProductRow = { ...initial };
        const fd = new FormData(form);
        for (const field of fields) {
          const v = fd.get(field.name);
          if (field.type === "number")
            values[field.name] = v === "" ? undefined : Number(v);
          else if (v !== null && v !== "") values[field.name] = v;
          else if (field.required) values[field.name] = "";
        }
        const fp = JSON.stringify(values);
        if (fingerprint.current && fingerprint.current !== fp)
          key.current = crypto.randomUUID();
        fingerprint.current = fp;
        setBusy(true);
        setNotice("");
        const r = await productCommand(action, values, key.current);
        setBusy(false);
        if (r.ok) {
          setNotice(t("Saved"));
          key.current = crypto.randomUUID();
          announceSaved(form);
          onSaved();
        } else setNotice(t(r.message));
      }}
    >
      <h3>{t(title)}</h3>
      <div className="ops-form-grid">
        {fields.map((f) => (
          <label key={f.name}>
            {t(f.label)}
            {f.options ? (
              <select
                name={f.name}
                defaultValue={String(initial[f.name] ?? f.value ?? "")}
                required={f.required}
              >
                <option value="">{t("Choose")}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.label)}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                name={f.name}
                required={f.required}
                defaultValue={String(initial[f.name] ?? f.value ?? "")}
                maxLength={4000}
              />
            ) : (
              <input
                name={f.name}
                type={f.type || "text"}
                required={f.required}
                defaultValue={String(initial[f.name] ?? f.value ?? "")}
                min={f.min}
                max={f.max}
                step={f.step}
              />
            )}
          </label>
        ))}
      </div>
      {notice && <p role="status">{notice}</p>}
      <button className="button button-green" disabled={busy}>
        {t(busy ? "Saving…" : submitLabel)}
      </button>
    </form>
  );
}
