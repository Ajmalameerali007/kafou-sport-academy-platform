"use client";
import { DailyCostSummary } from "./daily-workspace";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import type { AccountContext } from "@/lib/platform/contracts";
import type { FinanceSummary } from "@/lib/platform/management";
import {
  type PortalData,
  type PortalRow,
  records,
  value,
  dubaiDay,
} from "@/lib/platform/portal-model";
import { api } from "@/lib/platform/client";
import { money } from "@/lib/platform/commercial";
import { PortalDrawer } from "./portal-ui";
import { Field, ManagementForm, string } from "./management-ui";
import { CoachEarnings } from "./coach-management";
import { CommercialPanel } from "./commercial-panel";
export function BranchFinance({
  data,
  account,
  branch,
  refresh,
  openBranch,
  moreRecords,
  loadingMore,
}: {
  data: PortalData;
  account: AccountContext;
  branch: string;
  refresh: () => void;
  openBranch: (id: string) => void;
  moreRecords: () => void;
  loadingMore: boolean;
}) {
  const { t, locale } = useLocale();
  const today = dubaiDay(new Date());
  const [from, setFrom] = useState(today.slice(0, 7) + "-01"),
    [to, setTo] = useState(today),
    [tab, setTab] = useState("Invoices"),
    [q, setQ] = useState(""),
    [offset, setOffset] = useState(0),
    [invoiceId, setInvoiceId] = useState(""),
    [revision, setRevision] = useState(0);
  type InvoiceDetail = {
    invoice: PortalRow;
    lines: PortalRow[];
    balance: number;
  };
  const [summaryState, setSummaryState] = useState<{
    key: string;
    value?: FinanceSummary;
    error?: string;
  }>({ key: "" });
  const [pageState, setPageState] = useState<{
    key: string;
    value?: { rows: PortalRow[]; total: number };
    error?: string;
  }>({ key: "" });
  const [detailState, setDetailState] = useState<{
    key: string;
    value?: InvoiceDetail;
    error?: string;
  }>({ key: "" });
  const summaryKey = JSON.stringify([branch, from, to, revision]);
  const pageKey = JSON.stringify([branch, from, to, tab, q, offset, revision]);
  const detailKey = JSON.stringify([invoiceId, revision]);
  const summary =
    summaryState.key === summaryKey ? summaryState.value : undefined;
  const page = pageState.key === pageKey ? pageState.value : undefined;
  const detail = detailState.key === detailKey ? detailState.value : undefined;
  const error =
    (summaryState.key === summaryKey && summaryState.error) ||
    (pageState.key === pageKey && pageState.error) ||
    "";
  const detailError = detailState.key === detailKey ? detailState.error : "";
  const changed = () => {
    setRevision((r) => r + 1);
    refresh();
  };
  useEffect(() => {
    let live = true;
    void api<FinanceSummary>(
      `management/finance?from=${from}&to=${to}${branch ? "&branch=" + branch : ""}`,
    ).then((r) => {
      if (live)
        setSummaryState(
          r.ok
            ? { key: summaryKey, value: r.data }
            : { key: summaryKey, error: r.message },
        );
    });
    return () => {
      live = false;
    };
  }, [summaryKey, from, to, branch, data]);
  useEffect(() => {
    let live = true;
    if (branch && ["Invoices", "Outstanding"].includes(tab))
      void api<{ rows: PortalRow[]; total: number }>(
        `management/invoices?branch=${branch}&from=${from}&to=${to}&offset=${offset}&outstanding=${tab === "Outstanding"}&q=${encodeURIComponent(q)}`,
      ).then((r) => {
        if (live)
          setPageState(
            r.ok
              ? { key: pageKey, value: r.data }
              : { key: pageKey, error: r.message },
          );
      });
    return () => {
      live = false;
    };
  }, [pageKey, branch, from, to, tab, q, offset, data]);
  useEffect(() => {
    let live = true;
    if (invoiceId)
      void api<InvoiceDetail>("management/invoice?id=" + invoiceId).then(
        (r) => {
          if (live)
            setDetailState(
              r.ok
                ? { key: detailKey, value: r.data }
                : { key: detailKey, error: r.message },
            );
        },
      );
    return () => {
      live = false;
    };
  }, [detailKey, invoiceId, data]);
  const totals = summary?.branches.length
    ? summary.branches.reduce(
        (a, b) => ({
          received: a.received + Number(b.finance?.receivedMinor || 0),
          due: a.due + Number(b.finance?.outstandingMinor || 0),
          earned: a.earned + Number(b.earnedMinor),
          paid: a.paid + Number(b.paidMinor),
          coachDue: a.coachDue + Number(b.coachOutstandingMinor),
        }),
        { received: 0, due: 0, earned: 0, paid: 0, coachDue: 0 },
      )
    : undefined;
  const coachVisible = summary?.branches.some((b) => b.coachVisible);
  const centralRows =
    summary?.branches.filter((b) =>
      b.name.toLowerCase().includes(q.toLowerCase()),
    ) || [];
  const canPay =
    account.roles.includes("super_admin") ||
    records(data, "product_permissions").some(
      (p) =>
        p.user_id === account.userId &&
        p.permission === "finance.payment" &&
        (!p.branch_id || p.branch_id === branch),
    );
  return (
    <section className="management-workspace">
      <div className="management-toolbar">
        <h2>{t(branch ? "Branch finance" : "Central finance")}</h2>
        <div className="management-range">
          <label>
            {t("From")}
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label>
            {t("To")}
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setOffset(0);
              }}
            />
          </label>
        </div>
      </div>
      <DailyCostSummary branch={branch} from={from} to={to} />
      {error && (
        <p role="alert" className="ops-notice">
          {error}
        </p>
      )}
      <div className="management-metrics">
        {[
          ["Collections in period", totals?.received],
          ["Customer balance · current", totals?.due],
          [
            "Approved earnings in period",
            coachVisible ? totals?.earned : undefined,
          ],
          ["Coach payouts in period", coachVisible ? totals?.paid : undefined],
          [
            "Coach balance · current",
            coachVisible ? totals?.coachDue : undefined,
          ],
        ].map(([label, n]) => (
          <div key={String(label)}>
            <span>{t(String(label))}</span>
            <strong>{n === undefined ? "—" : money(Number(n), locale)}</strong>
          </div>
        ))}
      </div>
      <p className="ops-muted">
        {t(
          "Complete authorized totals. Detail pagination does not change these figures.",
        )}
      </p>
      {!branch ? (
        <>
          <label>
            {t("Find a branch")}
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <div className="management-table-wrap management-branch-summary">
            <table className="management-table">
              <thead>
                <tr>
                  <th>{t("Branch")}</th>
                  <th>{t("Collections")}</th>
                  <th>{t("Customer balance")}</th>
                  <th>{t("Coach cost")}</th>
                  <th>{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {centralRows.slice(offset, offset + 8).map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td data-label={t("Collections")}>
                      {money(Number(b.finance?.receivedMinor || 0), locale)}
                    </td>
                    <td data-label={t("Customer balance")}>
                      {money(Number(b.finance?.outstandingMinor || 0), locale)}
                    </td>
                    <td data-label={t("Coach cost")}>
                      {b.coachVisible ? money(b.earnedMinor, locale) : "—"}
                    </td>
                    <td>
                      <button
                        className="portal-primary"
                        onClick={() => openBranch(b.id)}
                      >
                        {t("Open branch finance")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {centralRows.length > 8 && (
            <div className="management-toolbar">
              <span>
                {offset + 1}–{Math.min(offset + 8, centralRows.length)} /{" "}
                {centralRows.length}
              </span>
              <div>
                <button
                  className="portal-btn"
                  disabled={!offset}
                  onClick={() => setOffset((n) => Math.max(0, n - 8))}
                >
                  {t("Previous")}
                </button>
                <button
                  className="portal-btn"
                  disabled={offset + 8 >= centralRows.length}
                  onClick={() => setOffset((n) => n + 8)}
                >
                  {t("Next")}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <nav className="management-tabs" aria-label={t("Finance views")}>
            {[
              "Invoices",
              "Receipts",
              "Outstanding",
              "Coach payouts",
              "Exceptions",
            ].map((s) => (
              <button
                key={s}
                aria-pressed={s === tab}
                onClick={() => {
                  setTab(s);
                  setOffset(0);
                }}
              >
                {t(s)}
              </button>
            ))}
          </nav>
          {["Invoices", "Outstanding"].includes(tab) && (
            <>
              <label>
                {t("Find customer or invoice")}
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setOffset(0);
                  }}
                />
              </label>
              <div className="management-table-wrap">
                <table className="management-table">
                  <thead>
                    <tr>
                      <th>{t("Invoice")}</th>
                      <th>{t("Customer")}</th>
                      <th>{t("Balance")}</th>
                      <th>{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page?.rows.map((i) => (
                      <tr key={value(i, "id")}>
                        <td>
                          {value(i, "reference")}
                          <small>{value(i, "created_at").slice(0, 10)}</small>
                        </td>
                        <td>{value(i, "family_name")}</td>
                        <td>{money(Number(i.balance), locale)}</td>
                        <td>
                          <button
                            className="portal-link"
                            onClick={() => setInvoiceId(value(i, "id"))}
                          >
                            {t(
                              Number(i.balance) > 0
                                ? "Open invoice / record payment"
                                : "View invoice",
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {page && !page.rows.length && (
                  <p>{t("No matching invoices")}</p>
                )}
                {!page && !error && <p role="status">{t("Loading…")}</p>}
              </div>
              {page && (
                <div className="management-toolbar">
                  <span>
                    {page.total ? offset + 1 : 0}–
                    {Math.min(offset + page.rows.length, page.total)} /{" "}
                    {page.total}
                  </span>
                  <div>
                    <button
                      className="portal-btn"
                      disabled={!offset}
                      onClick={() => setOffset((x) => Math.max(0, x - 50))}
                    >
                      {t("Previous")}
                    </button>
                    <button
                      className="portal-btn"
                      disabled={offset + 50 >= page.total}
                      onClick={() => setOffset((x) => x + 50)}
                    >
                      {t("Next")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {tab === "Receipts" && (
            <div className="management-table-wrap">
              <table className="management-table">
                <thead>
                  <tr>
                    <th>{t("Receipt")}</th>
                    <th>{t("Customer")}</th>
                    <th>{t("Amount")}</th>
                    <th>{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {records(data, "commercial_receipts").map((r) => {
                    const p = records(data, "commercial_payments").find(
                      (p) => p.id === r.payment_id,
                    );
                    if (
                      !p ||
                      dubaiDay(new Date(value(p, "created_at"))) < from ||
                      dubaiDay(new Date(value(p, "created_at"))) > to
                    )
                      return null;
                    return (
                      <tr key={value(r, "id")}>
                        <td>
                          {value(r, "reference")}
                          <small>{value(p, "reference")}</small>
                        </td>
                        <td>
                          {value(
                            records(data, "families").find(
                              (f) => f.id === p.family_id,
                            ) || {},
                            "name",
                          )}
                        </td>
                        <td>{money(Number(p.amount_minor), locale)}</td>
                        <td>
                          <a
                            className="portal-link"
                            href={`/api/product/receipts/${r.id}?locale=${locale}`}
                            download
                          >
                            {t("Download receipt")}
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {tab === "Coach payouts" && (
            <CoachEarnings data={data} refresh={changed} />
          )}
          {["Receipts", "Coach payouts", "Exceptions"].includes(tab) &&
            Boolean(
              data.pagination?.[0]?.more || data.product_pagination?.[0]?.more,
            ) && (
              <button
                className="portal-btn"
                disabled={loadingMore}
                onClick={moreRecords}
              >
                {t(loadingMore ? "Loading…" : "Load more records")}
              </button>
            )}
          {tab === "Exceptions" && (
            <>
              <p>
                {t(
                  "For reviewed adjustments, refunds and unallocated payments only.",
                )}
              </p>
              <CommercialPanel
                data={data}
                account={account}
                refresh={changed}
                section="Finance"
              />
            </>
          )}
        </>
      )}
      <PortalDrawer
        open={Boolean(invoiceId)}
        onClose={() => setInvoiceId("")}
        title={t("Invoice details")}
      >
        {detailError && <p role="alert">{detailError}</p>}
        {!detail && !detailError && <p>{t("Loading…")}</p>}
        {detail && (
          <>
            <h3>{value(detail.invoice, "reference")}</h3>
            <p>
              {value(
                records(data, "families").find(
                  (f) => f.id === detail.invoice.family_id,
                ) || {},
                "name",
              )}{" "}
              ·{" "}
              {value(
                records(data, "branches").find(
                  (b) => b.id === detail.invoice.branch_id,
                ) || {},
                "name",
              )}
            </p>
            {detail.lines.map((l) => (
              <div className="management-row" key={value(l, "id")}>
                <span>{value(l, "description")}</span>
                <strong>
                  {money(Number(l.unit_minor) * Number(l.quantity), locale)}
                </strong>
              </div>
            ))}
            <p>
              <strong>
                {t("Outstanding")}: {money(detail.balance, locale)}
              </strong>
            </p>
            <a
              className="portal-link"
              href={`/api/product/invoices/${invoiceId}?locale=${locale}`}
              download
            >
              {t("Download invoice")}
            </a>
            {canPay && detail.balance > 0 && (
              <ManagementForm
                key={invoiceId + ":" + revision}
                title="Record payment"
                action="commercial.payment.record"
                refresh={changed}
                submit="Record payment and receipt"
                build={(f) => ({
                  invoice_id: invoiceId,
                  family_id: detail.invoice.family_id,
                  branch_id: detail.invoice.branch_id,
                  amount_minor: Math.round(Number(f.get("amount")) * 100),
                  method: string(f, "method"),
                  reference: string(f, "reference"),
                })}
              >
                <Field
                  label="Amount (AED)"
                  name="amount"
                  type="number"
                  min={0.01}
                  max={detail.balance / 100}
                  value={detail.balance / 100}
                  required
                />
                <Field label="Method" name="method">
                  <option value="cash">{t("Cash")}</option>
                  <option value="external_terminal">
                    {t("External payment terminal")}
                  </option>
                  <option value="bank_transfer">{t("Bank transfer")}</option>
                </Field>
                <Field label="Payment reference" name="reference" required />
                <p className="ops-muted">
                  {t(
                    "Record money already received. No online charge is made.",
                  )}
                </p>
              </ManagementForm>
            )}
            {detail.balance === 0 && (
              <p role="status">
                {t("Invoice paid. Receipt available in Receipts.")}
              </p>
            )}
          </>
        )}
      </PortalDrawer>
    </section>
  );
}
