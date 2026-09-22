"use client";
import { useRef, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { api } from "@/lib/platform/client";
import { productCommand } from "@/lib/platform/product";
import { ProductNotice, val, type ProductProps } from "./product-shared";
export function FilesPanel({ account, data, refresh }: ProductProps) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [family, setFamily] = useState(val(data.families?.[0], "id"));
  const key = useRef(crypto.randomUUID());
  const fingerprint = useRef("");
  const parent = account.roles.includes("parent");
  return (
    <section className="product-panel">
      <h2>{t("Private documents")}</h2>
      <p>
        {t(
          "PDF, PNG or JPEG, up to 512 KB. Files stay within the authorized family and reception team. Uploading is not signing a waiver.",
        )}
      </p>
      {notice && <ProductNotice>{notice}</ProductNotice>}
      <form
        className="product-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const form = e.currentTarget,
            fd = new FormData(form),
            file = fd.get("file");
          if (!(file instanceof File) || !file.size || file.size > 524288) {
            setNotice(t("Choose a file up to 512 KB."));
            return;
          }
          setBusy(true);
          try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            let binary = "";
            for (const b of bytes) binary += String.fromCharCode(b);
            const payload = {
              family_id: family,
              ...(fd.get("child_id") ? { child_id: fd.get("child_id") } : {}),
              ...(fd.get("branch_id")
                ? { branch_id: fd.get("branch_id") }
                : {}),
              name: file.name,
              mime_type: file.type,
              content: btoa(binary),
            };
            const fp = JSON.stringify(payload);
            if (fingerprint.current && fingerprint.current !== fp)
              key.current = crypto.randomUUID();
            fingerprint.current = fp;
            const r = await api("files/upload", {
              ...payload,
              key: key.current,
            });
            setNotice(r.ok ? t("Document saved.") : t(r.message));
            if (r.ok) {
              key.current = crypto.randomUUID();
              form.reset();
              refresh();
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="ops-form-grid">
          <label>
            {t("Family")}
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              required
            >
              {(data.families || []).map((f) => (
                <option key={val(f, "id")} value={val(f, "id")}>
                  {val(f, "name")}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Child (optional)")}
            <select name="child_id">
              <option value="">{t("Family document")}</option>
              {(data.children || [])
                .filter((c) => c.family_id === family)
                .map((c) => (
                  <option key={val(c, "id")} value={val(c, "id")}>
                    {val(c, "name")}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {t("Share with reception at branch (optional)")}
            <select name="branch_id" required={!parent}>
              <option value="">{t("Family only")}</option>
              {(data.branches || [])
                .filter((b) => !b.provisional && b.active)
                .map((b) => (
                  <option key={val(b, "id")} value={val(b, "id")}>
                    {val(b, "name")}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {t("Document")}
            <input
              type="file"
              name="file"
              accept="application/pdf,image/png,image/jpeg"
              required
            />
          </label>
        </div>
        <button className="button button-green" disabled={busy || !family}>
          {t(busy ? "Uploading…" : "Upload private document")}
        </button>
      </form>
      {(data.family_files || [])
        .filter((f) => f.family_id === family && f.status !== "pending")
        .map((f) => (
          <article className="product-record" key={val(f, "id")}>
            <span>
              <strong>{val(f, "name")}</strong>
              <small>
                {Math.ceil(Number(f.size_bytes) / 1024)} KB ·{" "}
                {t(val(f, "status"))}
              </small>
            </span>
            {f.status === "ready" && (
              <div className="ops-form-actions">
                <a
                  className="button button-outline"
                  href={"/api/files/" + val(f, "id")}
                >
                  {t("Download")}
                </a>
                {(parent || account.roles.includes("super_admin")) && (
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      const r = await productCommand("files.withdraw", {
                        id: f.id,
                      });
                      setBusy(false);
                      setNotice(r.ok ? t("Access withdrawn.") : t(r.message));
                      if (r.ok) refresh();
                    }}
                  >
                    {t("Withdraw access")}
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      <p className="product-summary">
        {t(
          "Withdrawal immediately stops downloads. Retention and deletion requests are reviewed by the academy; no medical or identity documents should be used in this synthetic staging environment.",
        )}
      </p>
    </section>
  );
}
