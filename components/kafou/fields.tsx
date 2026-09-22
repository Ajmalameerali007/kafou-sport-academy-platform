"use client";
import { useLocale } from "./locale";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function Field({
  id,
  label,
  error,
  type = "text",
  hint,
  ...props
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
} & React.ComponentProps<typeof Input>) {
  const { t } = useLocale();
  const [show, setShow] = useState(false);
  const password = type === "password";
  return (
    <div className="field">
      <Label htmlFor={id}>{t(label)}</Label>
      <div className={password ? "password-wrap" : ""}>
        <Input
          {...props}
          placeholder={props.placeholder ? t(props.placeholder) : undefined}
          id={id}
          name={id}
          type={password && show ? "text" : type}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
        />
        {password && (
          <button
            type="button"
            aria-label={t(show ? "Hide password" : "Show password")}
            aria-pressed={show}
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {t(error)}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {t(hint)}
        </p>
      ) : null}
    </div>
  );
}
export function ServiceNotice({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="service-notice" role="status">
      <span aria-hidden="true">↗</span>
      <p>{typeof children === "string" ? t(children) : children}</p>
    </div>
  );
}
export function focusFirstError(errors: Record<string, string>) {
  const name = Object.keys(errors)[0];
  if (name) requestAnimationFrame(() => document.getElementById(name)?.focus());
}
