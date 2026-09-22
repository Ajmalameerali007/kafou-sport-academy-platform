"use client";
import { useEffect, useRef, useState } from "react";
import {
  LocaleProvider,
  useLocale,
  type Locale,
} from "@/components/kafou/locale";
import { FormShell } from "@/components/kafou/form-shell";
import { Field, ServiceNotice } from "@/components/kafou/fields";
import { api, familyService } from "@/lib/platform/client";
export function AuthCompletion({
  locale,
  reset = false,
}: {
  locale: Locale;
  reset?: boolean;
}) {
  return (
    <LocaleProvider locale={locale}>
      <FormShell kind="auth">
        <Completion reset={reset} />
      </FormShell>
    </LocaleProvider>
  );
}
function Completion({ reset }: { reset: boolean }) {
  const { t } = useLocale();
  const started = useRef(false);
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(!reset),
    [complete, setComplete] = useState(false);
  useEffect(() => {
    if (reset || started.current) return;
    started.current = true;
    const query = new URLSearchParams(location.search),
      hash = new URLSearchParams(location.hash.slice(1));
    const invitation = query.get("invitation");
    const body = {
      code: query.get("code") || undefined,
      token_hash: query.get("token_hash") || undefined,
      type: query.get("type") || undefined,
      access_token: hash.get("access_token") || undefined,
      refresh_token: hash.get("refresh_token") || undefined,
    };
    const next = query.get("next");
    history.replaceState(null, "", "/auth/confirm");
    void api("auth/confirm", body).then(async (r) => {
      if (!r.ok) {
        setNotice(r.message);
        setBusy(false);
        return;
      }
      if (invitation) {
        const accepted = await familyService.command("invitation.accept", {
          id: invitation,
        });
        if (!accepted.ok) {
          setNotice(accepted.message);
          setBusy(false);
          return;
        }
      }
      location.replace(
        invitation || next === "reset" || hash.get("type") === "recovery"
          ? "/auth/reset"
          : "/account",
      );
    });
  }, [reset]);
  return (
    <>
      <p className="eyebrow">{t("Account security")}</p>
      <h1 className="form-title">
        {t(reset ? "Choose a new password." : "Confirming your account.")}
      </h1>
      {busy && <p role="status">{t("Please wait…")}</p>}
      {reset && !complete && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            const r = await api("auth/reset", Object.fromEntries(f));
            setBusy(false);
            if (r.ok) {
              setComplete(true);
              setNotice("Password updated. Sign in with your new password.");
            } else setNotice(r.message);
          }}
        >
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <Field
            id="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <button className="button button-dark" disabled={busy}>
            {t("Update password")}
          </button>
        </form>
      )}
      {notice && <ServiceNotice>{notice}</ServiceNotice>}
      <a className="text-link" href="/auth">
        {t("Back to login")}
      </a>
    </>
  );
}
