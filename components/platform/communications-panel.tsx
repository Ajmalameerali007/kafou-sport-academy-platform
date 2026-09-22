"use client";
import { useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { productCommand, type ProductRow } from "@/lib/platform/product";
import {
  ProductForm,
  ProductNotice,
  val,
  type ProductProps,
} from "./product-shared";
import { StatusBadge, EmptyState } from "./portal-ui";
export function CommunicationsPanel({ account, data, refresh }: ProductProps) {
  const { t } = useLocale();
  const [branch, setBranch] = useState(""),
    [template, setTemplate] = useState(""),
    [recipients, setRecipients] = useState<ProductRow[] | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [time, setTime] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const allowed =
    account.roles.includes("super_admin") ||
    (data.product_permissions || []).some(
      (p) =>
        p.permission === "communications.broadcast" &&
        (!branch || !p.branch_id || p.branch_id === branch),
    );
  const run = async (action: string, payload: ProductRow) => {
    setBusy(true);
    const r = await productCommand(action, payload);
    setBusy(false);
    if (!r.ok) {
      setNotice(t(r.message));
      return;
    }
    setNotice(t("Saved"));
    refresh();
  };
  const selected = (data.communication_templates || []).find(
    (x) => x.id === template,
  );
  return (
    <div className="product-stack">
      <div className="product-section-intro">
        <h2>{t("Communication centre")}</h2>
        <p>
          {t(
            "In-app messages are delivered to verified linked guardians. Email, WhatsApp and push remain not configured.",
          )}
        </p>
      </div>
      {notice && <ProductNotice>{notice}</ProductNotice>}
      {!allowed ? (
        <EmptyState
          title="Broadcast permission required"
          copy="Security administration can grant this permission separately."
        />
      ) : (
        <>
          <details className="product-panel">
            <summary>{t("Create a template version")}</summary>
            <ProductForm
              title="New message template"
              action="communication.template.create"
              fields={[
                {
                  name: "branch_id",
                  label: "Branch",
                  required: true,
                  options: (data.branches || []).map((x) => ({
                    value: val(x, "id"),
                    label: val(x, "name"),
                  })),
                },
                { name: "name", label: "Template name", required: true },
                {
                  name: "language",
                  label: "Language",
                  options: [
                    { value: "en", label: "English" },
                    { value: "ar", label: "Arabic" },
                  ],
                  required: true,
                },
                {
                  name: "purpose",
                  label: "Purpose",
                  options: [
                    { value: "operational", label: "Operational" },
                    { value: "marketing", label: "Optional marketing" },
                  ],
                  required: true,
                },
                { name: "subject", label: "Subject", required: true },
                {
                  name: "body",
                  label: "Message",
                  type: "textarea",
                  required: true,
                },
              ]}
              onSaved={refresh}
            />
          </details>
          <section className="product-panel">
            <h3>{t("Preview recipients")}</h3>
            <div className="ops-form-grid">
              <label>
                {t("Branch")}
                <select
                  value={branch}
                  onChange={(e) => {
                    setBranch(e.target.value);
                    setRecipients(null);
                    setConfirmed(false);
                  }}
                >
                  <option value="">{t("Choose")}</option>
                  {(data.branches || []).map((x) => (
                    <option key={val(x, "id")} value={val(x, "id")}>
                      {val(x, "name")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Message template")}
                <select
                  value={template}
                  onChange={(e) => {
                    setTemplate(e.target.value);
                    setRecipients(null);
                    setConfirmed(false);
                  }}
                >
                  <option value="">{t("Choose")}</option>
                  {(data.communication_templates || []).map((x) => (
                    <option key={val(x, "id")} value={val(x, "id")}>
                      {val(x, "name")} · {val(x, "language")} · v
                      {val(x, "version")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {selected && (
              <blockquote className="product-message-preview">
                <strong>{val(selected, "subject")}</strong>
                <p>{val(selected, "body")}</p>
              </blockquote>
            )}
            <button
              className="button button-dark"
              disabled={!branch || !template || busy}
              onClick={async () => {
                setBusy(true);
                const r = await productCommand<{ recipients: ProductRow[] }>(
                  "communication.preview",
                  { branch_id: branch, template_id: template },
                );
                setBusy(false);
                if (r.ok) setRecipients(r.data.recipients);
                else setNotice(t(r.message));
              }}
            >
              {t("Load recipient preview")}
            </button>
            {recipients && (
              <div className="product-preview">
                <p>
                  {recipients.length} {t("eligible guardians")}
                </p>
                <ul>
                  {recipients.map((r) => (
                    <li key={val(r, "user_id") + val(r, "family_id")}>
                      {val(r, "name")}
                    </li>
                  ))}
                </ul>
                <p>
                  {t(
                    "Eligibility and consent are checked again at delivery. No external messages will be sent.",
                  )}
                </p>
                <label className="product-check">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  {t("I reviewed the message and recipients.")}
                </label>
                <label>
                  {t("Scheduled time (UAE)")}
                  <input
                    type="datetime-local"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </label>
                <button
                  className="button button-green"
                  disabled={busy || !confirmed || !time || !recipients.length}
                  onClick={() =>
                    run("communication.schedule", {
                      branch_id: branch,
                      template_id: template,
                      confirmed: true,
                      scheduled_at: new Date(time + "+04:00").toISOString(),
                    })
                  }
                >
                  {t("Schedule in-app message")}
                </button>
              </div>
            )}
          </section>
          {(data.communication_batches || []).map((b) => (
            <article key={val(b, "id")} className="product-panel">
              <h3>
                {val(
                  (data.communication_templates || []).find(
                    (x) => x.id === b.template_id,
                  ),
                  "subject",
                )}
              </h3>
              <p>
                {new Date(val(b, "scheduled_at")).toLocaleString("en-GB", {
                  timeZone: "Asia/Dubai",
                })}
              </p>
              <StatusBadge status={val(b, "status")} />
              <p>
                {
                  (data.communication_recipients || []).filter(
                    (r) => r.batch_id === b.id && r.status === "sent",
                  ).length
                }{" "}
                {t("in-app deliveries")}
              </p>
              {b.status === "scheduled" && (
                <div className="ops-form-actions">
                  <button
                    disabled={busy}
                    className="button button-green"
                    onClick={() => run("communication.dispatch", { id: b.id })}
                  >
                    {t("Deliver when due")}
                  </button>
                  <button
                    disabled={busy}
                    className="button button-outline"
                    onClick={() => run("communication.cancel", { id: b.id })}
                  >
                    {t("Cancel scheduled message")}
                  </button>
                </div>
              )}
            </article>
          ))}
          <p className="product-summary">
            {t(
              "Scheduled messages require an authorized operator to run delivery. Automatic job activation is tracked separately.",
            )}
          </p>
        </>
      )}
    </div>
  );
}
