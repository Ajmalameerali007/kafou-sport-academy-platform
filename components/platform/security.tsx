/* eslint-disable @next/next/no-img-element -- Authenticator QR is an in-memory SVG data URI; never send it to an image optimizer. */
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/platform/client";
import { useLocale } from "@/components/kafou/locale";
export function SecurityPanel({ required = false }: { required?: boolean }) {
  const { t } = useLocale();
  const [factor, setFactor] = useState(""),
    [qr, setQr] = useState(""),
    [secret, setSecret] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<{ totp: Array<{ id: string; status: string }> }>("auth/mfa").then(
      (r) => {
        if (r.ok)
          setFactor(r.data.totp.find((f) => f.status === "verified")?.id || "");
        else setNotice(r.message);
      },
    );
  }, []);
  return (
    <section className="ops-editor">
      <h2>{t("Secure your account")}</h2>
      <p>
        {t(
          required
            ? "Verify your authenticator before using administrator tools."
            : "Use an authenticator app for an extra layer of account security.",
        )}
      </p>
      {!factor ? (
        <button
          className="button button-dark"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await api<{
              id: string;
              totp: { qr_code: string; secret: string };
            }>("auth/mfa/enroll", {});
            setBusy(false);
            if (r.ok) {
              setFactor(r.data.id);
              setQr(r.data.totp.qr_code);
              setSecret(r.data.totp.secret);
            } else setNotice(r.message);
          }}
        >
          {t("Set up authenticator")}
        </button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const code = String(new FormData(e.currentTarget).get("code"));
            const r = await api("auth/mfa/verify", { factorId: factor, code });
            setBusy(false);
            if (r.ok) location.reload();
            else setNotice(r.message);
          }}
        >
          {qr && (
            <>
              <img
                className="ops-qr"
                src={qr}
                alt={t("Scan this code with your authenticator app")}
              />
              <details>
                <summary>{t("Manual setup key")}</summary>
                <code dir="ltr">{secret}</code>
              </details>
            </>
          )}
          <label className="ops-select">
            {t("Six-digit authenticator code")}
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </label>
          <button className="button button-dark" disabled={busy}>
            {t("Verify")}
          </button>
        </form>
      )}
      {notice && <p role="status">{t(notice)}</p>}
    </section>
  );
}
