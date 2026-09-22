"use client";
import { announceSaved } from "./portal-ui";
import { administratorVerified } from "@/lib/platform/contracts";
import { useRef, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { productCommand, type ProductRow } from "@/lib/platform/product";
import {
  entitlementBalance,
  invoiceBalance,
  money,
  membershipStatus,
  commercialSchema,
  allocationRemaining,
} from "@/lib/platform/commercial";
import {
  ProductForm,
  ProductNotice,
  val,
  type ProductProps,
} from "./product-shared";
type Option = { value: string; label: string };
type Field = {
  name: string;
  label: string;
  type?: string;
  options?: Option[];
  required?: boolean;
  value?: string;
};
const options = (
  rows: ProductRow[],
  label: (r: ProductRow) => string,
): Option[] => rows.map((r) => ({ value: val(r, "id"), label: label(r) }));
function CommercialForm({
  title,
  action,
  fields,
  initial = {},
  onSaved,
  submitLabel = "Save",
  successMessage = "Saved",
}: {
  title: string;
  action: string;
  fields: Field[];
  initial?: ProductRow;
  onSaved: () => void;
  submitLabel?: string;
  successMessage?: string;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  const fingerprint = useRef("");
  return (
    <form
      className="ops-editor product-form"
      aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        const fd = new FormData(form);
        const payload: ProductRow = { ...initial };
        setError("");
        for (const f of fields) {
          const value = String(fd.get(f.name) ?? "").trim();
          if (f.type === "checkbox") {
            payload[f.name] = fd.has(f.name);
            continue;
          }
          if (!value && !f.required) continue;
          if (f.type === "money") {
            if (!/^\d+(\.\d{1,2})?$/.test(value)) {
              setError(
                t("Enter an AED amount with at most two decimal places."),
              );
              return;
            }
            const [whole, fraction = ""] = value.split(".");
            payload[f.name] =
              Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
          } else if (f.type === "number") payload[f.name] = Number(value);
          else payload[f.name] = value;
        }
        const fp = JSON.stringify(payload);
        if (fingerprint.current && fingerprint.current !== fp)
          key.current = crypto.randomUUID();
        fingerprint.current = fp;
        setBusy(true);
        try {
          const response = await productCommand(action, payload, key.current);
          if (response.ok) {
            key.current = crypto.randomUUID();
            setError(t(successMessage));
            announceSaved(form);
            onSaved();
          } else setError(t(response.message));
        } catch {
          setError(t("Unable to save. Retry with the same details."));
        } finally {
          setBusy(false);
        }
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
                required={f.required}
                defaultValue={f.value ?? ""}
              >
                <option value="">{t("Choose")}</option>
                {f.options.map((o) => (
                  <option value={o.value} key={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                name={f.name}
                required={f.required}
                maxLength={2000}
                defaultValue={f.value}
              />
            ) : f.type === "checkbox" ? (
              <input type="checkbox" name={f.name} required={f.required} />
            ) : (
              <input
                name={f.name}
                type={f.type === "money" ? "text" : (f.type ?? "text")}
                inputMode={f.type === "money" ? "decimal" : undefined}
                required={f.required}
                defaultValue={f.value}
                min={f.type === "number" ? 0 : undefined}
              />
            )}
          </label>
        ))}
      </div>
      {error && <p role="status">{error}</p>}
      <button className="button button-green" disabled={busy}>
        {t(busy ? "Saving…" : submitLabel)}
      </button>
    </form>
  );
}
function SplitPaymentAllocation({
  payments,
  invoices,
  allocations,
  refunds,
  invoiceName,
  lookup,
  refresh,
}: {
  payments: ProductRow[];
  invoices: ProductRow[];
  allocations: ProductRow[];
  refunds: ProductRow[];
  invoiceName: (i: ProductRow) => string;
  lookup: (table: string, id: unknown, key?: string) => string;
  refresh: () => void;
}) {
  const { t, locale } = useLocale();
  const [paymentId, setPaymentId] = useState("");
  const [rows, setRows] = useState<{ invoiceId: string; amount: string }[]>([
    { invoiceId: "", amount: "" },
    { invoiceId: "", amount: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  const payment = payments.find((p) => val(p, "id") === paymentId);
  const familyInvoices = payment
    ? invoices.filter((i) => i.family_id === payment.family_id)
    : [];
  const unallocated = payment
    ? Number(payment.amount_minor) -
      allocations
        .filter((a) => a.payment_id === payment.id)
        .reduce((n, a) => n + Number(a.amount_minor), 0) -
      refunds
        .filter((r) => r.payment_id === payment.id)
        .reduce((n, r) => n + Number(r.amount_minor), 0)
    : 0;
  const toMinor = (v: string) => {
    if (!/^\d+(\.\d{1,2})?$/.test(v.trim())) return null;
    const [whole, fraction = ""] = v.trim().split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  };
  return (
    <div className="ops-editor product-form">
      <h3>{t("Split payment across sibling invoices")}</h3>
      <p>
        {t(
          "Allocate one family payment across several children's invoices in a single, atomic action.",
        )}
      </p>
      <label style={{ minWidth: 0, display: "grid" }}>
        {t("Payment")}
        <select
          value={paymentId}
          onChange={(e) => {
            setPaymentId(e.target.value);
            setRows([
              { invoiceId: "", amount: "" },
              { invoiceId: "", amount: "" },
            ]);
            setError("");
          }}
        >
          <option value="">{t("Choose")}</option>
          {payments.map((p) => (
            <option key={val(p, "id")} value={val(p, "id")}>
              {lookup("families", p.family_id)} · {val(p, "reference")} ·{" "}
              {money(Number(p.amount_minor), locale)}
            </option>
          ))}
        </select>
      </label>
      {payment && (
        <p>
          {t("Unallocated balance")}: {money(unallocated, locale)}
        </p>
      )}
      {payment &&
        rows.map((row, index) => (
          <div className="ops-form-grid" key={index}>
            <label style={{ minWidth: 0, display: "grid" }}>
              {t("Invoice")}
              <select
                value={row.invoiceId}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, invoiceId: e.target.value };
                  setRows(next);
                }}
              >
                <option value="">{t("Choose")}</option>
                {familyInvoices.map((i) => (
                  <option key={val(i, "id")} value={val(i, "id")}>
                    {invoiceName(i)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ minWidth: 0, display: "grid" }}>
              {t("Amount (AED)")}
              <input
                inputMode="decimal"
                value={row.amount}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, amount: e.target.value };
                  setRows(next);
                }}
              />
            </label>
            {rows.length > 2 && (
              <button
                type="button"
                className="button button-outline"
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              >
                {t("Remove")}
              </button>
            )}
          </div>
        ))}
      {payment && rows.length < 10 && (
        <button
          type="button"
          className="button button-outline"
          onClick={() => setRows([...rows, { invoiceId: "", amount: "" }])}
        >
          {t("Add another invoice")}
        </button>
      )}
      {error && <p role="status">{t(error)}</p>}
      {payment && (
        <button
          className="button button-green"
          disabled={busy}
          onClick={async () => {
            setError("");
            if (rows.some((r) => !r.invoiceId)) {
              setError("Choose an invoice for every row");
              return;
            }
            const ids = rows.map((r) => r.invoiceId);
            if (new Set(ids).size !== ids.length) {
              setError("Each invoice can only be listed once");
              return;
            }
            const parsed = rows.map((r) => toMinor(r.amount));
            if (parsed.some((v) => v === null || v <= 0)) {
              setError("Enter an AED amount with at most two decimal places.");
              return;
            }
            setBusy(true);
            try {
              const response = await productCommand(
                "commercial.payment.allocate-split",
                {
                  payment_id: paymentId,
                  allocations: rows.map((r, i) => ({
                    invoice_id: r.invoiceId,
                    amount_minor: parsed[i],
                  })),
                },
                key.current,
              );
              if (response.ok) {
                key.current = crypto.randomUUID();
                setPaymentId("");
                setRows([
                  { invoiceId: "", amount: "" },
                  { invoiceId: "", amount: "" },
                ]);
                refresh();
              } else setError(response.message);
            } catch {
              setError("Unable to save. Retry with the same details.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {t(busy ? "Saving…" : "Split and allocate")}
        </button>
      )}
    </div>
  );
}
function MembershipCancellation({
  memberships,
  name,
  refresh,
}: {
  memberships: ProductRow[];
  name: (member: ProductRow) => string;
  refresh: () => void;
}) {
  const { t, locale } = useLocale();
  const [id, setId] = useState("");
  const [policy, setPolicy] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<ProductRow | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const key = useRef(crypto.randomUUID());
  const invalidate = () => {
    setPreview(null);
    setConfirmed(false);
  };
  const snapshot = (preview?.snapshot ?? {}) as ProductRow;
  return (
    <details className="ops-card">
      <summary>{t("Cancel a membership")}</summary>
      <p>
        {t(
          "Synthetic cancellation choices require explicit review. No money is transferred. Any completed offline refund is recorded separately.",
        )}
      </p>
      <p>
        {t(
          "Resolve later memberships, started attendance and reserved makeup bookings first. Shared future sessions outside this membership must be resolved before cancellation.",
        )}
      </p>
      <form
        className="ops-editor product-form"
        aria-label={t("Cancel a membership")}
        aria-busy={busy}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !preview || !confirmed) return;
          setBusy(true);
          setNotice("");
          try {
            const response = await productCommand(
              "commercial.membership.cancel",
              { preview_id: preview.id, reason },
              key.current,
            );
            if (response.ok) {
              setNotice(
                t(
                  "Membership cancelled. Review the invoice credit and released payment balance before recording an offline refund.",
                ),
              );
              invalidate();
              setId("");
              setPolicy("");
              setReason("");
              refresh();
            } else {
              setNotice(t(response.message));
              invalidate();
            }
          } catch {
            setNotice(t("Unable to save. Retry with the same details."));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset
          disabled={busy}
          style={{ border: 0, minWidth: 0, padding: 0 }}
        >
          <div className="ops-form-grid">
            <label style={{ minWidth: 0, display: "grid" }}>
              {t("Membership")}
              <select
                style={{ minWidth: 0, width: "100%" }}
                required
                value={id}
                onChange={(e) => {
                  setId(e.target.value);
                  invalidate();
                }}
              >
                <option value="">{t("Choose")}</option>
                {memberships
                  .filter((m) => m.status !== "cancelled")
                  .map((m) => (
                    <option key={val(m, "id")} value={val(m, "id")}>
                      {name(m)}
                    </option>
                  ))}
              </select>
            </label>
            <label style={{ minWidth: 0, display: "grid" }}>
              {t("Synthetic cancellation policy")}
              <select
                required
                value={policy}
                onChange={(e) => {
                  setPolicy(e.target.value);
                  invalidate();
                }}
              >
                <option value="">{t("Choose")}</option>
                <option value="none">{t("No invoice credit")}</option>
                <option value="unused_calendar_days">
                  {t("Unused calendar days after today")}
                </option>
                <option value="unused_entitlements">
                  {t("Unused session entitlements")}
                </option>
              </select>
            </label>
          </div>
          <p>
            {t(
              "Calendar proration excludes today. Entitlement proration retains used sessions. Both round credit down to the nearest AED minor unit.",
            )}
          </p>
          <label>
            {t("Reason")}
            <textarea
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                invalidate();
              }}
            />
          </label>
          <button
            type="button"
            className="button"
            disabled={!id || !policy || reason.trim().length < 5 || busy}
            onClick={async () => {
              setBusy(true);
              setNotice("");
              invalidate();
              try {
                const response = await productCommand(
                  "commercial.membership.cancel.preview",
                  { id, policy },
                );
                if (response.ok) {
                  setPreview(response.data);
                  key.current = crypto.randomUUID();
                } else setNotice(t(response.message));
              } catch {
                setNotice(t("Unable to load the cancellation preview. Retry."));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("Calculate cancellation preview")}
          </button>
          {preview && (
            <section
              className="ops-card"
              aria-label={t("Cancellation preview")}
            >
              <h4>{t("Cancellation preview")}</h4>
              <p>
                {t("Synthetic policy version")}:{" "}
                {val(snapshot, "policy_version")}
              </p>
              <p>
                {t("Unused units")}: {val(snapshot, "unused_units")} /{" "}
                {val(snapshot, "total_units")}
              </p>
              <p>
                {t("Invoice credit")}:{" "}
                <strong>{money(Number(snapshot.credit_minor), locale)}</strong>
              </p>
              <p>
                {t("Payment balance released for separate refund")}:{" "}
                <strong>
                  {money(Number(snapshot.released_payment_minor), locale)}
                </strong>
              </p>
              <p>
                {t("Future ordinary sessions cancelled")}:{" "}
                {Array.isArray(snapshot.roster_ids)
                  ? snapshot.roster_ids.length
                  : 0}
              </p>
              <p>
                {t(
                  "This saved calculation expires in 15 minutes. Any relevant record change requires a new preview.",
                )}
              </p>
              <label>
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {t(
                  "I reviewed this synthetic policy, invoice credit and session cancellations.",
                )}
              </label>
              <button
                className="button button-dark"
                disabled={!confirmed || busy}
              >
                {t("Confirm membership cancellation")}
              </button>
            </section>
          )}
        </fieldset>
        {notice && <p role="status">{notice}</p>}
      </form>
    </details>
  );
}

function InvoiceAuthor({
  data,
  branches,
  globalFamilyAccess,
  onSaved,
}: {
  data: ProductProps["data"];
  branches: ProductRow[];
  globalFamilyAccess: boolean;
  onSaved: () => void;
}) {
  const { t, locale } = useLocale();
  const [branch, setBranch] = useState("");
  const [family, setFamily] = useState("");
  const [reference, setReference] = useState("");
  const emptyLine = () => ({
    key: crypto.randomUUID(),
    child_id: "",
    package_id: "",
    quantity: 1,
  });
  const [lines, setLines] = useState([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const key = useRef(crypto.randomUUID());
  const fingerprint = useRef("");
  const rows = (table: string) => data[table] ?? [];
  const families = rows("families").filter(
    (f) =>
      branch &&
      (globalFamilyAccess ||
        rows("family_branches").some(
          (link) => link.family_id === f.id && link.branch_id === branch,
        )),
  );
  const children = rows("children").filter(
    (child) => child.family_id === family,
  );
  const packages = (child: string) =>
    rows("commercial_packages").filter(
      (p) =>
        p.active &&
        p.branch_id === branch &&
        rows("child_sports").some(
          (s) =>
            s.child_id === child &&
            s.sport === p.sport &&
            (!p.level_id || s.level_id === p.level_id),
        ),
    );
  const packageName = (p: ProductRow) =>
    locale === "ar" && p.name_ar ? val(p, "name_ar") : val(p, "name");
  const linePackage = (line: (typeof lines)[number]) =>
    packages(line.child_id).find((p) => p.id === line.package_id);
  const total = lines.reduce(
    (sum, line) =>
      sum + Number(linePackage(line)?.price_minor ?? 0) * line.quantity,
    0,
  );
  const validLines = lines.every(
    (line) =>
      children.some((child) => child.id === line.child_id) &&
      linePackage(line) &&
      Number.isInteger(line.quantity) &&
      line.quantity >= 1 &&
      line.quantity <= 100,
  );
  const update = (index: number, patch: Partial<(typeof lines)[number]>) =>
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  const fieldStyle = { display: "grid", minWidth: 0 };
  const inputStyle = { width: "100%", minWidth: 0 };
  return (
    <details className="ops-card">
      <summary>{t("Create standalone invoice")}</summary>
      <form
        className="ops-editor product-form"
        aria-label={t("Create standalone invoice")}
        aria-busy={busy}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !validLines) return;
          const form = event.currentTarget;
          const payload = {
            family_id: family,
            branch_id: branch,
            reference: reference.trim(),
            lines: lines.map(({ child_id, package_id, quantity }) => ({
              child_id,
              package_id,
              quantity,
            })),
          };
          if (
            !commercialSchema.safeParse({
              action: "commercial.invoice.create",
              data: payload,
            }).success ||
            total > 1_000_000_000
          ) {
            setNotice(
              t(
                "Check the invoice reference, quantities, and duplicate child/package lines.",
              ),
            );
            return;
          }
          const next = JSON.stringify(payload);
          if (fingerprint.current && fingerprint.current !== next)
            key.current = crypto.randomUUID();
          fingerprint.current = next;
          setBusy(true);
          setNotice("");
          try {
            const response = await productCommand(
              "commercial.invoice.create",
              payload,
              key.current,
            );
            if (response.ok) {
              setNotice(
                `${t("Invoice posted")}: ${val(response.data, "reference")}`,
              );
              setReference("");
              setLines([emptyLine()]);
              key.current = crypto.randomUUID();
              fingerprint.current = "";
              form.reset();
              onSaved();
            } else setNotice(t(response.message));
          } catch {
            setNotice(t("Unable to save. Retry with the same details."));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          {t(
            "Package prices are fixed by the catalogue. Posting or paying this invoice does not create memberships or session entitlements.",
          )}
        </p>
        <fieldset
          disabled={busy}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <div className="ops-form-grid">
            <label style={fieldStyle}>
              {t("Branch")}
              <select
                style={inputStyle}
                required
                value={branch}
                onChange={(e) => {
                  setBranch(e.target.value);
                  setFamily("");
                  setLines([emptyLine()]);
                }}
              >
                <option value="">{t("Choose")}</option>
                {branches.map((b) => (
                  <option key={val(b, "id")} value={val(b, "id")}>
                    {locale === "ar" && b.name_ar
                      ? val(b, "name_ar")
                      : val(b, "name")}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              {t("Family")}
              <select
                style={inputStyle}
                required
                disabled={!branch}
                value={family}
                onChange={(e) => {
                  setFamily(e.target.value);
                  setLines([emptyLine()]);
                }}
              >
                <option value="">{t("Choose")}</option>
                {families.map((f) => (
                  <option key={val(f, "id")} value={val(f, "id")}>
                    {val(f, "name")}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              {t("Invoice request reference")}
              <input
                style={inputStyle}
                required
                minLength={3}
                maxLength={100}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
          </div>
          <p>
            {t(
              "Use one unique reference for this invoice. Retry the same request after a connection error.",
            )}
          </p>
          {branch && !families.length && (
            <ProductNotice>
              {t(
                "No permitted families are linked to this branch in the loaded records.",
              )}
            </ProductNotice>
          )}
          {lines.map((line, index) => (
            <fieldset
              key={line.key}
              className="ops-card"
              style={{ minWidth: 0 }}
            >
              <legend>
                {t("Invoice line")} {index + 1}
              </legend>
              <div className="ops-form-grid">
                <label style={fieldStyle}>
                  {t("Child")}
                  <select
                    style={inputStyle}
                    required
                    disabled={!family}
                    value={line.child_id}
                    onChange={(e) =>
                      update(index, {
                        child_id: e.target.value,
                        package_id: "",
                      })
                    }
                  >
                    <option value="">{t("Choose")}</option>
                    {children.map((child) => (
                      <option key={val(child, "id")} value={val(child, "id")}>
                        {val(child, "name")}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={fieldStyle}>
                  {t("Package")}
                  <select
                    style={inputStyle}
                    required
                    disabled={!line.child_id}
                    value={line.package_id}
                    onChange={(e) =>
                      update(index, { package_id: e.target.value })
                    }
                  >
                    <option value="">{t("Choose")}</option>
                    {packages(line.child_id).map((p) => (
                      <option key={val(p, "id")} value={val(p, "id")}>
                        {packageName(p)} ·{" "}
                        {money(Number(p.price_minor), locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={fieldStyle}>
                  {t("Quantity")}
                  <input
                    style={inputStyle}
                    type="number"
                    required
                    min={1}
                    max={100}
                    step={1}
                    value={line.quantity}
                    onChange={(e) =>
                      update(index, { quantity: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <p>
                {t("Line total")}:{" "}
                {money(
                  Number(linePackage(line)?.price_minor ?? 0) * line.quantity,
                  locale,
                )}
              </p>
              {line.child_id && !packages(line.child_id).length && (
                <ProductNotice>
                  {t(
                    "No active package matches this child's sport and level at this branch.",
                  )}
                </ProductNotice>
              )}
              <button
                type="button"
                className="button"
                disabled={lines.length === 1}
                onClick={() =>
                  setLines((current) => current.filter((_, i) => i !== index))
                }
              >
                {t("Remove line")} {index + 1}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="button"
            disabled={lines.length >= 20 || !family}
            onClick={() => setLines((current) => [...current, emptyLine()])}
          >
            {t("Add invoice line")}
          </button>
          <p>
            <strong>
              {t("Invoice total")}: {money(total, locale)}
            </strong>
          </p>
          <label>
            <input type="checkbox" required />{" "}
            {t(
              "I reviewed every child, package, quantity and the invoice total. Posted lines cannot be edited.",
            )}
          </label>
          <button
            className="button button-dark"
            disabled={!validLines || busy || total > 1_000_000_000}
          >
            {t(busy ? "Saving…" : "Post invoice")}
          </button>
        </fieldset>
        {notice && <p role="status">{notice}</p>}
      </form>
    </details>
  );
}

export function CommercialPanel({
  account,
  data,
  refresh,
  section,
}: ProductProps) {
  const { t, locale } = useLocale();
  const normalizedSection = section.toLowerCase();
  const defaultView = normalizedSection.includes("compensation")
    ? "compensation"
    : normalizedSection.includes("invoice") ||
        normalizedSection.includes("finance")
      ? "invoices"
      : normalizedSection.includes("package")
        ? "packages"
        : "membership";
  const [selected, setSelected] = useState({ section, view: defaultView });
  const view = selected.section === section ? selected.view : defaultView;
  const rows = (table: string) => data[table] ?? [];
  const packages = rows("commercial_packages");
  const memberships = rows("commercial_memberships");
  const invoices = rows("commercial_invoices");
  const payments = rows("commercial_payments");
  const allocations = rows("commercial_allocations");
  const adjustments = rows("commercial_adjustments");
  const grants = rows("product_permissions");
  const blocked =
    account.roles.includes("coach") || account.roles.includes("sales");
  const can = (permission: string, branch?: string) =>
    !blocked &&
    ((account.roles.includes("super_admin") &&
      administratorVerified(account)) ||
      grants.some(
        (g) =>
          g.user_id === account.userId &&
          g.permission === permission &&
          (!branch || !g.branch_id || g.branch_id === branch),
      ));
  const isFamily =
    account.roles.includes("parent") &&
    !account.roles.some((r) => ["admin", "super_admin", "branch"].includes(r));
  const lookup = (table: string, id: unknown, key = "name") =>
    val(
      rows(table).find((r) => r.id === id),
      key,
    ) || String(id ?? "").slice(0, 8);
  const packageName = (p: ProductRow) =>
    locale === "ar" && p.name_ar ? val(p, "name_ar") : val(p, "name");
  const memberName = (m: ProductRow) =>
    `${lookup("children", m.child_id)} · ${packageName(packages.find((p) => p.id === m.package_id) ?? {})} · ${val(m, "starts_on")}`;
  const invoiceName = (i: ProductRow) =>
    `${val(i, "reference")} · ${lookup("families", i.family_id)} · ${money(invoiceBalance(val(i, "id"), rows("commercial_invoice_lines"), allocations, adjustments), locale)}`;
  const branchOptions = options(rows("branches"), (r) =>
    locale === "ar" && r.name_ar ? val(r, "name_ar") : val(r, "name"),
  );
  const invoiceOptions = options(invoices, invoiceName);
  const paymentOptions = options(
    payments,
    (p) => `${val(p, "reference")} · ${money(Number(p.amount_minor), locale)}`,
  );
  const amount: Field = {
    name: "amount_minor",
    label: "Amount (AED)",
    type: "money",
    required: true,
  };
  const reason: Field = {
    name: "reason",
    label: "Reason",
    type: "textarea",
    required: true,
  };
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Dubai",
  });
  const balance = (i: ProductRow) =>
    invoiceBalance(
      val(i, "id"),
      rows("commercial_invoice_lines"),
      allocations,
      adjustments,
    );
  if (blocked)
    return (
      <ProductNotice>
        {t("Financial records are unavailable for this role.")}
      </ProductNotice>
    );
  const sections = [
    ["membership", "Memberships"],
    ["invoices", "Invoices and receipts"],
    ["packages", "Packages"],
    ...(!isFamily ? [["compensation", "Coach compensation"]] : []),
  ];
  return (
    <section
      className="product-panel commercial-panel product-stack"
      aria-label={t("Memberships and finance")}
    >
      <nav
        aria-label={t("Commercial sections")}
        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
      >
        {sections.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setSelected({ section, view: key })}
            className={view === key ? "button button-dark" : "button"}
          >
            {t(label)}
          </button>
        ))}
      </nav>
      <ProductNotice>
        {t(
          "Prices, package policies, and the seven-day renewal window are synthetic pending academy approval.",
        )}
      </ProductNotice>
      {view === "membership" && (
        <>
          <h2>{t("Memberships")}</h2>
          <ProductNotice>
            {t(
              "Activation reserves every already scheduled session within the membership dates. If there are more sessions than the package allows, adjust the schedule or choose a suitable package before recording payment.",
            )}
          </ProductNotice>
          {!memberships.length && (
            <ProductNotice>
              {t("No memberships are available in your permitted scope.")}
            </ProductNotice>
          )}
          <div className="product-cards">
            {memberships.map((m) => {
              const ledger = entitlementBalance(
                val(m, "id"),
                rows("entitlement_ledger"),
              );
              const invoice = invoices.find((i) => i.membership_id === m.id);
              const expired = val(m, "expires_on") <= today;
              const effectiveStatus = membershipStatus(
                m,
                invoice ? balance(invoice) : 0,
                rows("commercial_credit_approvals").filter(
                  (c) => c.invoice_id === invoice?.id,
                ),
                today,
              );
              return (
                <article className="ops-card" key={val(m, "id")}>
                  <h3>{memberName(m)}</h3>
                  <p>
                    {t(val(m, "sport"))} · {lookup("branches", m.branch_id)}
                  </p>
                  <p>
                    {val(m, "starts_on")} · {t("Expires on")}:{" "}
                    {val(m, "expires_on")} · {t(effectiveStatus)}
                  </p>
                  <p>
                    {t(
                      m.status === "cancelled"
                        ? "Unused at cancellation"
                        : "Available",
                    )}
                    : {ledger.available} · {t("Reserved")}: {ledger.reserved} ·{" "}
                    {t("Used")}: {ledger.consumed}
                  </p>
                  {invoice && (
                    <p>
                      {t("Outstanding")}: {money(balance(invoice), locale)} ·{" "}
                      {val(invoice, "reference")}
                    </p>
                  )}
                  <details>
                    <summary>{t("Entitlement history")}</summary>
                    <ul>
                      {rows("entitlement_ledger")
                        .filter((l) => l.membership_id === m.id)
                        .map((l) => (
                          <li key={val(l, "id")}>
                            {t(val(l, "kind"))} ·{" "}
                            {new Date(val(l, "created_at")).toLocaleString(
                              locale === "ar" ? "ar-AE" : "en-AE",
                            )}{" "}
                            · {t("Available")}:{" "}
                            {Number(l.available_delta) > 0 ? "+" : ""}
                            {String(l.available_delta)}
                          </li>
                        ))}
                    </ul>
                  </details>
                  {rows("commercial_membership_extensions")
                    .filter((x) => x.membership_id === m.id)
                    .map((x) => (
                      <p key={val(x, "id")}>
                        {t("Approved freeze extension")}: {val(x, "days")}{" "}
                        {t("days")} · {val(x, "previous_expires_on")} →{" "}
                        {val(x, "new_expires_on")}
                      </p>
                    ))}
                  {rows("commercial_membership_cancellations")
                    .filter((x) => x.membership_id === m.id)
                    .map((x) => (
                      <p key={val(x, "id")}>
                        {t("Cancellation invoice credit")}:{" "}
                        {money(Number(x.credit_minor), locale)} ·{" "}
                        {t("Released payment balance")}:{" "}
                        {money(Number(x.released_payment_minor), locale)}
                      </p>
                    ))}
                  {m.status !== "cancelled" &&
                    !memberships.some((next) => next.renewed_from === m.id) &&
                    (isFamily ||
                      can("finance.memberships", val(m, "branch_id"))) &&
                    !expired && (
                      <CommercialForm
                        title="Renew for the next month"
                        action="commercial.membership.renew"
                        initial={{ id: m.id }}
                        fields={[
                          {
                            name: "accepted",
                            label:
                              "I accept this package and its terms for the next monthly period.",
                            type: "checkbox",
                            required: true,
                          },
                        ]}
                        onSaved={refresh}
                        submitLabel="Create renewal invoice"
                      />
                    )}
                </article>
              );
            })}
          </div>
          {can("finance.memberships") && can("finance.view") && (
            <MembershipCancellation
              memberships={memberships.filter(
                (m) =>
                  can("finance.memberships", val(m, "branch_id")) &&
                  can("finance.view", val(m, "branch_id")),
              )}
              name={memberName}
              refresh={refresh}
            />
          )}
          {(isFamily || can("finance.memberships")) && (
            <CommercialForm
              title="Start a membership"
              action="commercial.membership.start"
              fields={[
                {
                  name: "child_id",
                  label: "Child",
                  required: true,
                  options: options(rows("children"), (r) => val(r, "name")),
                },
                {
                  name: "package_id",
                  label: "Package",
                  required: true,
                  options: options(
                    packages.filter((p) => p.active === true),
                    (p) =>
                      `${packageName(p)} · ${lookup("branches", p.branch_id)} · ${money(Number(p.price_minor), locale)} · ${p.session_allowance} ${t("sessions")}`,
                  ),
                },
                {
                  name: "starts_on",
                  label: "Starts on",
                  type: "date",
                  required: true,
                  value: today,
                },
                {
                  name: "accepted",
                  label:
                    "I have reviewed and accept the selected package terms shown below.",
                  type: "checkbox",
                  required: true,
                },
              ]}
              onSaved={refresh}
              submitLabel="Accept package and create invoice"
            />
          )}
          <details>
            <summary>{t("Package terms")}</summary>
            {packages
              .filter((p) => p.active)
              .map((p) => (
                <article key={val(p, "id")}>
                  <h4>{packageName(p)}</h4>
                  <p>
                    {locale === "ar" && p.terms_ar
                      ? val(p, "terms_ar")
                      : val(p, "terms")}
                  </p>
                </article>
              ))}
          </details>
          {can("finance.freeze") && (
            <>
              <ProductNotice>
                {t(
                  "A freeze stops session use. On resume, an explicit synthetic extension may use elapsed Dubai freeze days, without adding session entitlements or refunding payment.",
                )}
              </ProductNotice>
              <ProductForm
                title="Freeze membership"
                action="commercial.membership.freeze"
                initial={{ frozen: true }}
                fields={[
                  {
                    name: "id",
                    label: "Membership",
                    required: true,
                    options: options(
                      memberships.filter(
                        (m) =>
                          m.status !== "frozen" && m.status !== "cancelled",
                      ),
                      memberName,
                    ),
                  },
                  reason,
                ]}
                onSaved={refresh}
              />
              <ProductForm
                title="Resume membership"
                action="commercial.membership.freeze"
                initial={{ frozen: false }}
                fields={[
                  {
                    name: "id",
                    label: "Membership",
                    required: true,
                    options: options(
                      memberships.filter((m) => m.status === "frozen"),
                      memberName,
                    ),
                  },
                  {
                    name: "extend_days",
                    label: "Extension days (0 keeps current expiry)",
                    type: "number",
                    value: "0",
                    min: 0,
                    max: 366,
                  },
                  reason,
                ]}
                onSaved={refresh}
              />
            </>
          )}
          {can("finance.memberships") && (
            <ProductForm
              title="Queue seven-day renewal reminders"
              action="commercial.renewals.queue"
              fields={[
                {
                  name: "branch_id",
                  label: "Branch",
                  required: true,
                  options: branchOptions,
                },
              ]}
              onSaved={refresh}
              submitLabel="Queue in-app reminders"
            />
          )}
        </>
      )}
      {view === "invoices" && (
        <>
          <h2>{t("Invoices and receipts")}</h2>
          <ProductNotice>
            {t(
              "Online payment is unavailable. No payment provider is configured. Offline entries record payments already received; they do not charge a card or transfer money.",
            )}
          </ProductNotice>
          {!invoices.length && (
            <ProductNotice>
              {t("No invoices are available in your permitted scope.")}
            </ProductNotice>
          )}
          {can("finance.invoices") && can("finance.view") && (
            <InvoiceAuthor
              data={data}
              branches={rows("branches").filter(
                (b) =>
                  b.active &&
                  !b.provisional &&
                  can("finance.invoices", val(b, "id")) &&
                  can("finance.view", val(b, "id")),
              )}
              globalFamilyAccess={account.roles.some((role) =>
                ["admin", "super_admin"].includes(role),
              )}
              onSaved={refresh}
            />
          )}
          <div className="product-cards">
            {invoices.map((i) => (
              <article className="ops-card" key={val(i, "id")}>
                <h3>{val(i, "reference")}</h3>
                {!!i.author_reference && (
                  <p>
                    {t("Invoice request reference")}:{" "}
                    {val(i, "author_reference")}
                  </p>
                )}
                <p>
                  {lookup("families", i.family_id)} ·{" "}
                  {lookup("branches", i.branch_id)}
                </p>
                <p>
                  {t("Outstanding")}:{" "}
                  <strong>{money(balance(i), locale)}</strong>
                </p>
                <a
                  className="button button-outline"
                  href={`/api/product/invoices/${encodeURIComponent(val(i, "id"))}?locale=${locale === "ar" ? "ar" : "en"}`}
                  download
                >
                  {t("Download invoice PDF")}
                </a>
                <ul>
                  {rows("commercial_invoice_lines")
                    .filter((l) => l.invoice_id === i.id)
                    .sort(
                      (a, b) =>
                        Number(a.line_position ?? 0) -
                        Number(b.line_position ?? 0),
                    )
                    .map((l) => (
                      <li key={val(l, "id")}>
                        {locale === "ar" && l.description_ar
                          ? val(l, "description_ar")
                          : val(l, "description")}{" "}
                        · {String(l.quantity)} ×{" "}
                        {money(Number(l.unit_minor), locale)} ·{" "}
                        {money(
                          Number(l.quantity) * Number(l.unit_minor),
                          locale,
                        )}
                      </li>
                    ))}
                </ul>
                <details>
                  <summary>{t("Payments and adjustments")}</summary>
                  <ul>
                    {allocations
                      .filter((a) => a.invoice_id === i.id)
                      .map((a) => (
                        <li key={val(a, "id")}>
                          {lookup(
                            "commercial_payments",
                            a.payment_id,
                            "reference",
                          )}{" "}
                          · {money(Number(a.amount_minor), locale)}
                        </li>
                      ))}
                    {adjustments
                      .filter((a) => a.invoice_id === i.id)
                      .map((a) => (
                        <li key={val(a, "id")}>
                          {t(val(a, "kind"))} ·{" "}
                          {money(Number(a.amount_minor), locale)} ·{" "}
                          {val(a, "reason")}
                        </li>
                      ))}
                  </ul>
                </details>
                {rows("commercial_credit_approvals")
                  .filter((c) => c.invoice_id === i.id && !c.revoked_at)
                  .map((c) => (
                    <p key={val(c, "id")}>
                      {t("Approved credit until")}: {val(c, "expires_on")} ·{" "}
                      {money(Number(c.amount_minor), locale)}
                    </p>
                  ))}
              </article>
            ))}
          </div>
          <h3>{t("Receipts")}</h3>
          <div className="product-cards">
            {rows("commercial_receipts").map((receipt) => {
              const payment = payments.find((p) => p.id === receipt.payment_id);
              if (!payment) return null;
              const allocated = allocations
                .filter((a) => a.payment_id === payment.id)
                .reduce((n, a) => n + Number(a.amount_minor), 0);
              const refunded = rows("commercial_refunds")
                .filter((r) => r.payment_id === payment.id)
                .reduce((n, r) => n + Number(r.amount_minor), 0);
              return (
                <article className="ops-card" key={val(receipt, "id")}>
                  <h4>{val(receipt, "reference")}</h4>
                  <p>
                    {lookup("families", payment.family_id)} ·{" "}
                    {money(Number(payment.amount_minor), locale)}
                  </p>
                  <p>
                    {t(val(payment, "method"))} · {val(payment, "reference")} ·{" "}
                    {new Date(val(payment, "created_at")).toLocaleDateString(
                      locale === "ar" ? "ar-AE" : "en-AE",
                      { timeZone: "Asia/Dubai" },
                    )}
                  </p>
                  <p>
                    {t("Allocated")}: {money(allocated, locale)} ·{" "}
                    {t("Refunded")}: {money(refunded, locale)} ·{" "}
                    {t("Unallocated")}:{" "}
                    {money(
                      Number(payment.amount_minor) - allocated - refunded,
                      locale,
                    )}
                  </p>
                  <a
                    className="button button-outline"
                    href={`/api/product/receipts/${encodeURIComponent(val(receipt, "id"))}?locale=${locale === "ar" ? "ar" : "en"}`}
                    download
                  >
                    {t("Download receipt PDF")}
                  </a>
                </article>
              );
            })}
          </div>
          {can("finance.payment") && (
            <>
              <CommercialForm
                title="Record received offline payment"
                action="commercial.payment.record"
                fields={[
                  {
                    name: "family_id",
                    label: "Family",
                    required: true,
                    options: options(rows("families"), (r) => val(r, "name")),
                  },
                  {
                    name: "branch_id",
                    label: "Branch",
                    required: true,
                    options: branchOptions,
                  },
                  amount,
                  {
                    name: "method",
                    label: "Method",
                    required: true,
                    options: [
                      { value: "cash", label: t("Cash") },
                      { value: "bank_transfer", label: t("Bank transfer") },
                      {
                        value: "external_terminal",
                        label: t("External payment terminal"),
                      },
                    ],
                  },
                  {
                    name: "reference",
                    label: "Payment reference",
                    required: true,
                  },
                  {
                    name: "invoice_id",
                    label: "Allocate full amount to invoice (optional)",
                    options: invoiceOptions,
                  },
                ]}
                onSaved={refresh}
                submitLabel="Record payment and receipt"
              />
              <CommercialForm
                title="Allocate existing payment"
                action="commercial.payment.allocate"
                fields={[
                  {
                    name: "payment_id",
                    label: "Payment",
                    required: true,
                    options: paymentOptions,
                  },
                  {
                    name: "invoice_id",
                    label: "Invoice",
                    required: true,
                    options: invoiceOptions,
                  },
                  amount,
                ]}
                onSaved={refresh}
              />
              <SplitPaymentAllocation
                payments={payments}
                invoices={invoices}
                allocations={allocations}
                refunds={rows("commercial_refunds")}
                invoiceName={invoiceName}
                lookup={lookup}
                refresh={refresh}
              />
            </>
          )}
          {(["discount", "writeoff"] as const).map(
            (kind) =>
              can(`finance.${kind}`) && (
                <CommercialForm
                  key={kind}
                  title={
                    kind === "discount"
                      ? "Post approved discount"
                      : "Write off outstanding balance"
                  }
                  action="commercial.invoice.adjust"
                  initial={{ kind }}
                  fields={[
                    {
                      name: "invoice_id",
                      label: "Invoice",
                      required: true,
                      options: invoiceOptions,
                    },
                    amount,
                    reason,
                  ]}
                  onSaved={refresh}
                />
              ),
          )}
          {(can("finance.discount") || can("finance.writeoff")) && (
            <ProductForm
              title="Reverse an adjustment"
              action="commercial.invoice.reverse-adjustment"
              fields={[
                {
                  name: "id",
                  label: "Adjustment",
                  required: true,
                  options: options(
                    adjustments.filter(
                      (a) =>
                        a.kind !== "reversal" &&
                        !adjustments.some((b) => b.reversal_of === a.id),
                    ),
                    (a) =>
                      `${lookup("commercial_invoices", a.invoice_id, "reference")} · ${t(val(a, "kind"))} · ${money(Number(a.amount_minor), locale)}`,
                  ),
                },
                reason,
              ]}
              onSaved={refresh}
            />
          )}
          {can("finance.credit") && (
            <>
              <ProductForm
                title="Approve temporary credit"
                action="commercial.credit.approve"
                fields={[
                  {
                    name: "invoice_id",
                    label: "Invoice",
                    required: true,
                    options: invoiceOptions,
                  },
                  {
                    name: "expires_on",
                    label: "Credit expires on",
                    type: "date",
                    required: true,
                  },
                  reason,
                ]}
                onSaved={refresh}
              />
              <ProductForm
                title="Revoke credit approval"
                action="commercial.credit.revoke"
                fields={[
                  {
                    name: "id",
                    label: "Credit approval",
                    required: true,
                    options: options(
                      rows("commercial_credit_approvals").filter(
                        (c) => !c.revoked_at,
                      ),
                      (c) =>
                        `${lookup("commercial_invoices", c.invoice_id, "reference")} · ${val(c, "expires_on")}`,
                    ),
                  },
                  reason,
                ]}
                onSaved={refresh}
              />
            </>
          )}
          {can("finance.refund") && (
            <>
              <ProductNotice>
                {t(
                  "Reverse an allocation before refunding allocated funds. An unpaid membership is suspended immediately. Record a refund only after completing it offline.",
                )}
              </ProductNotice>
              <CommercialForm
                title="Reverse payment allocation"
                action="commercial.payment.unallocate"
                fields={[
                  {
                    name: "allocation_id",
                    label: "Allocation",
                    required: true,
                    options: options(
                      allocations.filter(
                        (a) =>
                          Number(a.amount_minor) > 0 &&
                          allocationRemaining(a, allocations) > 0,
                      ),
                      (a) =>
                        `${lookup("commercial_invoices", a.invoice_id, "reference")} · ${money(allocationRemaining(a, allocations), locale)}`,
                    ),
                  },
                  {
                    name: "amount_minor",
                    label: "Amount to reverse (AED, blank means remaining)",
                    type: "money",
                  },
                  reason,
                ]}
                onSaved={refresh}
              />
              <CommercialForm
                title="Record offline refund"
                action="commercial.payment.refund"
                fields={[
                  {
                    name: "payment_id",
                    label: "Payment",
                    required: true,
                    options: paymentOptions,
                  },
                  amount,
                  {
                    name: "reference",
                    label: "Refund reference",
                    required: true,
                  },
                  reason,
                ]}
                onSaved={refresh}
              />
            </>
          )}
        </>
      )}
      {view === "packages" && (
        <>
          <h2>{t("Packages")}</h2>
          <div className="product-cards">
            {packages.map((p) => (
              <article className="ops-card" key={val(p, "id")}>
                <h3>{packageName(p)}</h3>
                <p>
                  {lookup("branches", p.branch_id)} · {t(val(p, "sport"))}
                </p>
                <p>
                  {money(Number(p.price_minor), locale)} / {t("month")} ·{" "}
                  {String(p.session_allowance)} {t("sessions")}
                </p>
                <p>
                  {locale === "ar" && p.terms_ar
                    ? val(p, "terms_ar")
                    : val(p, "terms")}
                </p>
                <p>{t(p.active ? "Active" : "Inactive")}</p>
              </article>
            ))}
          </div>
          {can("finance.packages") && (
            <>
              <CommercialForm
                title="Create monthly package"
                action="commercial.package.create"
                fields={[
                  { name: "name", label: "Package name", required: true },
                  { name: "name_ar", label: "Arabic package name" },
                  {
                    name: "branch_id",
                    label: "Branch",
                    required: true,
                    options: branchOptions,
                  },
                  {
                    name: "sport",
                    label: "Sport",
                    required: true,
                    options: [
                      "swimming",
                      "football",
                      "karate",
                      "badminton",
                    ].map((s) => ({ value: s, label: t(s) })),
                  },
                  {
                    name: "level_id",
                    label: "Level (optional)",
                    options: options(
                      rows("sport_levels"),
                      (r) => `${t(val(r, "sport"))} · ${val(r, "name")}`,
                    ),
                  },
                  {
                    name: "price_minor",
                    label: "Price (AED)",
                    type: "money",
                    required: true,
                  },
                  {
                    name: "session_allowance",
                    label: "Monthly sessions",
                    type: "number",
                    required: true,
                  },
                  {
                    name: "terms",
                    label: "Package terms",
                    type: "textarea",
                    required: true,
                  },
                  {
                    name: "terms_ar",
                    label: "Arabic package terms",
                    type: "textarea",
                  },
                ]}
                onSaved={refresh}
              />
              <ProductForm
                title="Stop offering a package"
                action="commercial.package.status"
                initial={{ active: false }}
                fields={[
                  {
                    name: "id",
                    label: "Package",
                    required: true,
                    options: options(
                      packages.filter((p) => p.active),
                      packageName,
                    ),
                  },
                ]}
                onSaved={refresh}
              />
              <ProductForm
                title="Offer a package again"
                action="commercial.package.status"
                initial={{ active: true }}
                fields={[
                  {
                    name: "id",
                    label: "Package",
                    required: true,
                    options: options(
                      packages.filter((p) => !p.active),
                      packageName,
                    ),
                  },
                ]}
                onSaved={refresh}
              />
            </>
          )}
        </>
      )}
      {view === "compensation" && (
        <>
          <h2>{t("Coach compensation")}</h2>
          <ProductNotice>
            {t(
              "Accrual requires explicit completed delivery and an applicable coach rate. Attendance alone is not delivery. Approval records an amount for review; no payroll payout is performed.",
            )}
          </ProductNotice>
          {can("finance.compensation") ? (
            <>
              <div className="product-cards">
                {rows("commercial_compensation_accruals").map((a) => (
                  <article key={val(a, "id")} className="ops-card">
                    <h3>{lookup("profiles", a.coach_id)}</h3>
                    <p>
                      {lookup("class_sessions", a.session_id, "starts_at")} ·{" "}
                      {money(Number(a.amount_minor), locale)} ·{" "}
                      {t(
                        rows("commercial_compensation_settlements")
                          .filter((s) => s.accrual_id === a.id)
                          .reduce(
                            (sum, s) => sum + Number(s.amount_minor),
                            0,
                          ) === Number(a.amount_minor)
                          ? "Paid (offline record)"
                          : val(a, "status"),
                      )}
                    </p>
                    {Boolean(a.review_reason) && (
                      <p>{val(a, "review_reason")}</p>
                    )}
                  </article>
                ))}
              </div>
              <CommercialForm
                title="Set a coach compensation rate"
                action="commercial.compensation.rate"
                fields={[
                  {
                    name: "coach_id",
                    label: "Coach",
                    required: true,
                    options: options(
                      rows("profiles").filter((p) =>
                        rows("role_assignments").some(
                          (r) => r.user_id === p.id && r.role === "coach",
                        ),
                      ),
                      (p) => val(p, "name"),
                    ),
                  },
                  {
                    name: "branch_id",
                    label: "Branch",
                    required: true,
                    options: branchOptions,
                  },
                  amount,
                  {
                    name: "effective_from",
                    label: "Effective from",
                    required: true,
                    type: "date",
                  },
                  {
                    name: "effective_to",
                    label: "Effective until (exclusive)",
                    required: true,
                    type: "date",
                  },
                ]}
                onSaved={refresh}
              />
              <ProductForm
                title="Accrue a delivered session"
                action="commercial.compensation.accrue"
                fields={[
                  {
                    name: "session_id",
                    label: "Delivered session",
                    required: true,
                    options: options(
                      rows("class_sessions").filter(
                        (s) => s.delivered_at && s.status !== "cancelled",
                      ),
                      (s) =>
                        `${lookup("academy_classes", s.class_id)} · ${val(s, "starts_at")}`,
                    ),
                  },
                ]}
                onSaved={refresh}
              />
              <ProductForm
                title="Review coach compensation"
                action="commercial.compensation.review"
                fields={[
                  {
                    name: "id",
                    label: "Accrual",
                    required: true,
                    options: options(
                      rows("commercial_compensation_accruals").filter(
                        (a) =>
                          a.status === "pending" &&
                          can("finance.compensation", val(a, "branch_id")),
                      ),
                      (a) =>
                        `${lookup("profiles", a.coach_id)} · ${money(Number(a.amount_minor), locale)}`,
                    ),
                  },
                  {
                    name: "decision",
                    label: "Decision",
                    required: true,
                    options: [
                      { value: "approved", label: "Approve" },
                      { value: "rejected", label: "Reject" },
                    ],
                  },
                  reason,
                ]}
                onSaved={refresh}
              />
              {can("finance.compensation_payment") && (
                <>
                  <ProductNotice>
                    {t(
                      "Record an already completed offline coach payment. This action does not transfer money. Corrections retain the original entry.",
                    )}
                  </ProductNotice>
                  <ProductForm
                    title="Record coach payment"
                    action="commercial.compensation.settle"
                    fields={[
                      {
                        name: "id",
                        label: "Accrual",
                        required: true,
                        options: options(
                          rows("commercial_compensation_accruals").filter(
                            (a) =>
                              a.status === "approved" &&
                              can(
                                "finance.compensation",
                                val(a, "branch_id"),
                              ) &&
                              can(
                                "finance.compensation_payment",
                                val(a, "branch_id"),
                              ) &&
                              rows("commercial_compensation_settlements")
                                .filter((s) => s.accrual_id === a.id)
                                .reduce(
                                  (sum, s) => sum + Number(s.amount_minor),
                                  0,
                                ) === 0,
                          ),
                          (a) =>
                            `${lookup("profiles", a.coach_id)} · ${money(Number(a.amount_minor), locale)}`,
                        ),
                      },
                      {
                        name: "reference",
                        label: "Offline payment reference",
                        required: true,
                      },
                      reason,
                    ]}
                    onSaved={refresh}
                  />
                  <ProductForm
                    title="Correct coach payment record"
                    action="commercial.compensation.reverse"
                    fields={[
                      {
                        name: "id",
                        label: "Recorded payment",
                        required: true,
                        options: options(
                          rows("commercial_compensation_settlements").filter(
                            (s) =>
                              Number(s.amount_minor) > 0 &&
                              can(
                                "finance.compensation",
                                val(s, "branch_id"),
                              ) &&
                              can(
                                "finance.compensation_payment",
                                val(s, "branch_id"),
                              ) &&
                              !rows("commercial_compensation_settlements").some(
                                (r) => r.reversal_of === s.id,
                              ),
                          ),
                          (s) =>
                            `${val(s, "reference")} · ${money(Number(s.amount_minor), locale)}`,
                        ),
                      },
                      {
                        name: "reference",
                        label: "Correction reference",
                        required: true,
                      },
                      reason,
                    ]}
                    onSaved={refresh}
                  />
                </>
              )}
              <details className="product-panel">
                <summary>{t("Coach payment history")}</summary>
                {rows("commercial_compensation_settlements").map((s) => (
                  <article className="product-record" key={val(s, "id")}>
                    <strong>{val(s, "reference")}</strong>
                    <span>
                      {money(Number(s.amount_minor), locale)} ·{" "}
                      {val(s, "reason")}
                    </span>
                  </article>
                ))}
              </details>
            </>
          ) : (
            <ProductNotice>
              {t("An explicit compensation permission is required.")}
            </ProductNotice>
          )}
        </>
      )}
    </section>
  );
}

export function ParentMembershipStart({
  data,
  child,
  refresh,
}: {
  data: Record<string, ProductRow[]>;
  child: string;
  refresh: () => void;
}) {
  const { t, locale } = useLocale();
  const rows = (table: string) => data[table] || [];
  const packages = rows("commercial_packages");
  const packageName = (p: ProductRow) =>
    locale === "ar" && p.name_ar ? val(p, "name_ar") : val(p, "name");
  const lookup = (table: string, id: unknown) =>
    val(rows(table).find((r) => r.id === id) || {}, "name") ||
    t("Details unavailable");
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Dubai",
  });
  return (
    <>
      <p>
        {t(
          "Offers shown are from the loaded catalogue. Staff can help if a suitable package is missing. Eligibility is checked before an invoice is created.",
        )}
      </p>
      <CommercialForm
        title="Start a membership"
        successMessage="Invoice created — awaiting payment. Please contact your branch to arrange payment."
        action="commercial.membership.start"
        fields={[
          {
            name: "child_id",
            label: "Child",
            required: true,
            options: options(
              rows("children").filter((r) => !child || r.id === child),
              (r) => val(r, "name"),
            ),
            value: child,
          },
          {
            name: "package_id",
            label: "Package",
            required: true,
            options: options(
              packages.filter((p) => p.active === true),
              (p) =>
                `${packageName(p)} · ${lookup("branches", p.branch_id)} · ${money(Number(p.price_minor), locale)} · ${p.session_allowance} ${t("sessions")}`,
            ),
          },
          {
            name: "starts_on",
            label: "Starts on",
            type: "date",
            required: true,
            value: today,
          },
          {
            name: "accepted",
            label:
              "I have reviewed and accept the selected package terms shown below.",
            type: "checkbox",
            required: true,
          },
        ]}
        onSaved={refresh}
        submitLabel="Accept package and create invoice"
      />
      <details>
        <summary>{t("Package terms")}</summary>
        {packages
          .filter((p) => p.active === true)
          .map((p) => (
            <section key={val(p, "id")}>
              <h4>{packageName(p)}</h4>
              <p>
                {locale === "ar" && p.terms_ar
                  ? val(p, "terms_ar")
                  : val(p, "terms")}
              </p>
            </section>
          ))}
      </details>
    </>
  );
}
