"use client";
import { useState, useRef, type ReactNode } from "react";
import { useLocale } from "@/components/kafou/locale";
import { productCommand } from "@/lib/platform/product";
import { familyService } from "@/lib/platform/client";
import { announceSaved } from "./portal-ui";
export function ManagementForm({
  title,
  action,
  build,
  children,
  refresh,
  foundation = false,
  submit = "Save",
}: {
  title: string;
  action: string;
  build: (f: FormData) => Record<string, unknown>;
  children: ReactNode;
  refresh: () => void;
  foundation?: boolean;
  submit?: string;
}) {
  const key = useRef(crypto.randomUUID());
  const fingerprint = useRef("");
  const { t } = useLocale();
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  return (
    <form
      className="management-form"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget;
        setBusy(true);
        setNotice("");
        try {
          const payload = build(new FormData(form));
          const next = JSON.stringify(payload);
          if (fingerprint.current && next !== fingerprint.current)
            key.current = crypto.randomUUID();
          fingerprint.current = next;
          const result = await (foundation
            ? familyService.command(action, payload)
            : productCommand(action, payload, key.current));
          if (result.ok) {
            key.current = crypto.randomUUID();
            announceSaved(form);
            setNotice(t("Saved"));
            refresh();
          } else setNotice(result.message);
        } catch {
          setNotice(t("Could not save. Please try again."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{t(title)}</h3>
      {children}
      <div className="management-form-footer">
        <button className="portal-primary" disabled={busy}>
          {t(busy ? "Saving…" : submit)}
        </button>
        {notice && <p role="status">{t(notice)}</p>}
      </div>
    </form>
  );
}
export function Field({
  label,
  name,
  value = "",
  type = "text",
  required = false,
  children,
  min,
  max,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  children?: ReactNode;
  min?: number;
  max?: number;
}) {
  const { t } = useLocale();
  return (
    <label>
      {t(label)}
      {children ? (
        <select name={name} defaultValue={value} required={required}>
          {children}
        </select>
      ) : type === "textarea" ? (
        <textarea name={name} defaultValue={value} required={required} />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          min={min}
          max={max}
          step={type === "number" ? "0.01" : undefined}
        />
      )}
    </label>
  );
}
export const string = (f: FormData, k: string) => String(f.get(k) || "");
