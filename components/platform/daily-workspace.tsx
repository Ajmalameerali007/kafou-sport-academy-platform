"use client";
import { useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/components/kafou/locale";
import { api } from "@/lib/platform/client";
import type { DailyPage, DailyRow } from "@/lib/platform/daily-operations";
import { dubaiDay } from "@/lib/platform/portal-model";
import { money } from "@/lib/platform/commercial";
import { productCommand } from "@/lib/platform/product";
import { usePortalQuery } from "./use-portal-query";
import { PortalDrawer, StatusBadge } from "./portal-ui";
import { Field } from "./management-ui";
import type { Navigate } from "./portal-shell";
import { StaffFaceCheckIn } from "./staff-face-checkin";
const str = (r: DailyRow, k: string) => String(r[k] ?? "");
const num = (r: DailyRow, k: string) => Number(r[k] ?? 0);
const minor = (v: FormDataEntryValue | null) => {
  const s = String(v || "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw Error("Enter an amount with up to two decimal places");
  const [a, b = ""] = s.split(".");
  return Number(a) * 100 + Number(b.padEnd(2, "0"));
};
function saved(form?: HTMLFormElement) {
  window.dispatchEvent(
    new CustomEvent("kafou:saved", { detail: { form, inlineFeedback: true } }),
  );
}
function Pager({
  offset,
  total,
  change,
}: {
  offset: number;
  total: number;
  change: (n: number) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="daily-pager">
      <span>
        {total
          ? `${offset + 1}–${Math.min(offset + 50, total)} / ${total}`
          : t("No matching records")}
      </span>
      <button
        className="portal-btn"
        disabled={!offset}
        onClick={() => change(Math.max(0, offset - 50))}
      >
        {t("Previous")}
      </button>
      <button
        className="portal-btn"
        disabled={offset + 50 >= total}
        onClick={() => change(offset + 50)}
      >
        {t("Next")}
      </button>
    </div>
  );
}
export function DailyForm({
  action,
  build,
  onSaved,
  children,
  submit = "Save",
}: {
  action: string;
  build: (f: FormData) => Record<string, unknown>;
  onSaved: () => void;
  children: ReactNode;
  submit?: string;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const lock = useRef(false),
    pending = useRef({ fingerprint: "", key: crypto.randomUUID() });
  return (
    <form
      className="management-form daily-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setNotice("");
        try {
          const data = build(new FormData(e.currentTarget)),
            fingerprint = JSON.stringify([action, data]);
          if (pending.current.fingerprint !== fingerprint)
            pending.current = { fingerprint, key: crypto.randomUUID() };
          const r = await api("daily", {
            action,
            data,
            key: pending.current.key,
          });
          if (r.ok) {
            saved(form);
            setNotice(t("Saved"));
            onSaved();
          } else setNotice(r.message);
        } catch (e) {
          setNotice(
            e instanceof Error
              ? e.message
              : t("Could not save. Please try again."),
          );
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    >
      {children}
      {notice && <p role="status">{t(notice)}</p>}
      <button className="portal-primary" disabled={busy}>
        {t(busy ? "Saving…" : submit)}
      </button>
    </form>
  );
}
export function StaffClock({ branch = "" }: { branch?: string }) {
  const { t, locale } = useLocale();
  const q = usePortalQuery<DailyPage>("daily?view=shifts");
  const [location, setLocation] = useState(branch);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    pending = useRef({ fingerprint: "", key: crypto.randomUUID() });
  const d = q.data;
  if (!d)
    return (
      <p role={q.error ? "alert" : "status"}>{t(q.error || "Loading…")}</p>
    );
  const shift = d.open_shift;
  const selected = branch || location;
  return (
    <section className="daily-clock" aria-label={t("Staff check-in")}>
      <div>
        <strong>{t(shift ? "Clocked in" : "Not clocked in")}</strong>
        {shift && (
          <span>
            {d.branches.find((b) => b.id === shift.branch_id)?.name ||
              t("Central office")}{" "}
            ·{" "}
            {new Date(str(shift, "clocked_in_at")).toLocaleString(
              locale === "ar" ? "ar-AE" : "en-GB",
              {
                timeZone: "Asia/Dubai",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              },
            )}
          </span>
        )}
      </div>
      {!shift && (
        <label>
          {t("Work location")}
          <select
            value={selected}
            disabled={!!branch}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="">
              {t(d.can_clock_central ? "Central office" : "Choose branch")}
            </option>
            {d.branches.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        className="portal-primary"
        disabled={
          busy ||
          !!q.error ||
          !!shift?.needs_review ||
          (!shift && !selected && !d.can_clock_central)
        }
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          setError("");
          const action = shift ? "shift.out" : "shift.in",
            data = shift ? { id: shift.id } : { branch_id: selected || null },
            fp = JSON.stringify([action, data]);
          if (pending.current.fingerprint !== fp)
            pending.current = { fingerprint: fp, key: crypto.randomUUID() };
          const r = await api("daily", {
            action,
            data,
            key: pending.current.key,
          });
          if (r.ok) {
            q.refresh();
            saved();
          } else setError(r.message);
          setBusy(false);
          lock.current = false;
        }}
      >
        {t(busy ? "Saving…" : shift ? "Clock out" : "Clock in")}
      </button>
      {shift?.needs_review === true && (
        <p role="alert">
          {t("This open shift needs a reviewed time correction")}
        </p>
      )}
      {(error || q.error) && <p role="alert">{t(error || q.error || "")}</p>}
      <StaffFaceCheckIn branch={selected} shift={shift} onSaved={q.refresh} disabled={!!q.error || !!shift?.needs_review || (!shift && !selected && !d.can_clock_central)} />
    </section>
  );
}
export function DailyToday({
  branch,
  workspace,
  navigate,
}: {
  branch: string;
  workspace: string;
  navigate: Navigate;
}) {
  const { t, locale } = useLocale();
  const [day, setDay] = useState(dubaiDay(new Date())),
    [offset, setOffset] = useState(0);
  const q = usePortalQuery<DailyPage>(
    `daily?view=today&from=${day}&to=${day}&offset=${offset}${branch ? "&branch=" + branch : ""}`,
  );
  return (
    <section className="portal-panel daily-today">
      <StaffClock branch={branch} />
      {workspace !== "coach" && (
        <nav className="daily-section-tabs" aria-label={t("Daily actions")}>
          {[
            [
              workspace === "admin" && !branch ? "Branches" : "Families",
              workspace === "admin" && !branch
                ? "Open branch"
                : "Register customer",
            ],
            ["Trials", "Book trial"],
            ["Finance", "Record payment"],
            ["Expenses", "Add expense"],
          ].map(([tab, label]) => (
            <button key={tab} onClick={() => navigate(tab)}>
              {t(label)}
            </button>
          ))}
        </nav>
      )}
      {q.data?.tasks && (
        <div className="daily-totals">
          {[
            ["Expected", q.data.tasks.expected],
            ["Checked in", q.data.tasks.arrived],
            ["Attendance unresolved", q.data.tasks.unresolved],
            ["Trials", q.data.tasks.trials],
            ...(workspace === "coach"
              ? []
              : [
                  ["Lead follow-ups", q.data.tasks.followups],
                  ["Coach reassignment", q.data.tasks.staffing],
                ]),
          ].map(([label, n]) => (
            <div key={String(label)}>
              <span>{t(String(label))}</span>
              <strong>{n}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="daily-toolbar">
        <div>
          <h2>{t("Sessions and arrivals")}</h2>
          <p>
            {t(
              "Open a session to check in students, finish attendance and record delivery.",
            )}
          </p>
        </div>
        <label>
          {t("Date")}
          <input
            type="date"
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              setOffset(0);
            }}
          />
        </label>
      </div>
      {q.error && <p role="alert">{t(q.error)}</p>}
      {!q.data ? (
        <p>{t("Loading…")}</p>
      ) : (
        <>
          <div className="daily-session-list">
            {q.data.rows.map((r) => (
              <article key={r.id}>
                <div className="daily-session-time">
                  {new Date(str(r, "starts_at")).toLocaleTimeString(
                    locale === "ar" ? "ar-AE" : "en-GB",
                    {
                      timeZone: "Asia/Dubai",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </div>
                <div>
                  <h3>{str(r, "name")}</h3>
                  <p>
                    {str(r, "branch_name")} · {str(r, "venue_name")}
                  </p>
                  <span>
                    {num(r, "arrived")} / {num(r, "expected")} {t("checked in")}
                  </span>
                </div>
                <StatusBadge
                  status={
                    r.delivered_at
                      ? "completed"
                      : r.finalized_at
                        ? "finalized"
                        : str(r, "status")
                  }
                />
                <button
                  className="portal-primary"
                  onClick={() =>
                    navigate(
                      workspace === "coach"
                        ? "Assigned sessions"
                        : "Attendance",
                      r.id,
                      "session",
                    )
                  }
                >
                  {t(r.finalized_at ? "Open session" : "Take attendance")}
                </button>
              </article>
            ))}
          </div>
          <Pager offset={offset} total={q.data.total} change={setOffset} />
        </>
      )}
    </section>
  );
}
export function SessionDelivery({
  session,
  branch,
  finalized,
  canMark,
  onSaved,
}: {
  session: string;
  branch: string;
  finalized: boolean;
  canMark: boolean;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const q = usePortalQuery<DailyPage>(`daily?view=session&id=${session}`);
  const [start, setStart] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    key = useRef(crypto.randomUUID());
  const d = q.data;
  if (!d) return q.error ? <p role="alert">{t(q.error)}</p> : null;
  return (
    <section className="daily-delivery">
      <div>
        <strong>
          {t(
            d.delivered_at
              ? "Session completed"
              : d.delivery
                ? "Session started"
                : "Session not started",
          )}
        </strong>
        <p>
          {t(
            "Attendance records students. Complete session records the coach’s delivery.",
          )}
        </p>
      </div>
      {!d.delivery && !d.delivered_at && canMark && (
        <button className="portal-btn" onClick={() => setStart(!start)}>
          {t("Start session")}
        </button>
      )}
      {d.delivery && !d.delivered_at && canMark && (
        <button
          className="portal-primary"
          disabled={!finalized || busy || !!q.error}
          onClick={async () => {
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            const r = await productCommand(
              "academy.session.complete",
              { session_id: session },
              key.current,
            );
            if (r.ok) {
              q.refresh();
              onSaved();
              saved();
            } else setError(r.message);
            setBusy(false);
            lock.current = false;
          }}
        >
          {t("Complete session")}
        </button>
      )}
      {error && <p role="alert">{t(error)}</p>}
      {d.delivery && !d.delivered_at && d.can_review_delivery && (
        <details>
          <summary>{t("Review coach assignment")}</summary>
          <DailyForm
            action="session.correct_start"
            submit="Save review"
            onSaved={() => {
              q.refresh();
              onSaved();
            }}
            build={(f) => ({
              session_id: session,
              revision: d.delivery?.revision,
              reason: String(f.get("reason")),
            })}
          >
            <p>
              {t(
                "Use the current assigned coach and preserve the previous delivery record in history.",
              )}
            </p>
            <Field name="reason" label="Reason" required />
          </DailyForm>
        </details>
      )}
      {start && !d.delivery && (
        <div className="daily-start">
          <StaffClock branch={branch} />
          <DailyForm
            action="session.start"
            submit="Start session"
            build={(f) => ({
              session_id: session,
              ...(f.get("reason") ? { reason: String(f.get("reason")) } : {}),
            })}
            onSaved={() => {
              setStart(false);
              q.refresh();
              onSaved();
            }}
          >
            <Field
              name="reason"
              label="Reason if starting on behalf of the coach"
            />
          </DailyForm>
        </div>
      )}
    </section>
  );
}
function EmployeeField() {
  const { t } = useLocale();
  const [q, setQ] = useState(""),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState({ id: "", name: "" });
  const query = usePortalQuery<DailyPage>(
    `daily?view=employees&q=${encodeURIComponent(q)}&offset=${offset}`,
  );
  return (
    <div>
      <label>
        {t("Find an employee")}
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
      </label>
      <label>
        {t("Employee")}
        <select
          aria-label={t("Employee")}
          required
          value={selected.id}
          onChange={(e) =>
            setSelected({
              id: e.target.value,
              name:
                (query.data?.rows.find((r) => r.id === e.target.value)
                  ?.name as string) || "",
            })
          }
        >
          <option value="">{t("Choose employee")}</option>
          {selected.id &&
            !query.data?.rows.some((r) => r.id === selected.id) && (
              <option value={selected.id}>{selected.name}</option>
            )}
          {query.data?.rows.map((r) => (
            <option value={r.id} key={r.id}>
              {str(r, "name")}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="employee_id" value={selected.id} />
      {query.error && <p role="alert">{t(query.error)}</p>}
      <Pager
        offset={offset}
        total={query.data?.total || 0}
        change={setOffset}
      />
    </div>
  );
}
function AllocationFields({
  branches,
  initial = [],
}: {
  branches: DailyPage["branches"];
  initial?: { branch_id: string | null; amount_minor: number }[];
}) {
  const { t } = useLocale();
  const [rows, setRows] = useState(
    (initial.length ? initial : [{ branch_id: null, amount_minor: 0 }]).map(
      (r) => ({
        key: crypto.randomUUID(),
        branch_id: r.branch_id || "",
        amount: r.amount_minor ? String(r.amount_minor / 100) : "",
      }),
    ),
  );
  return (
    <fieldset className="daily-allocations">
      <legend>{t("Cost allocation")}</legend>
      <p>
        {t(
          "Allocation amounts must equal the total. Central office keeps unallocated central costs visible.",
        )}
      </p>
      {rows.map((r, i) => (
        <div key={r.key}>
          <label>
            {t("Cost centre")}
            <select
              name={`allocation_branch_${i}`}
              value={r.branch_id}
              onChange={(e) =>
                setRows(
                  rows.map((x) =>
                    x.key === r.key ? { ...x, branch_id: e.target.value } : x,
                  ),
                )
              }
            >
              <option value="">{t("Central office")}</option>
              {branches.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Amount (AED)")}
            <input
              name={`allocation_amount_${i}`}
              required
              inputMode="decimal"
              value={r.amount}
              onChange={(e) =>
                setRows(
                  rows.map((x) =>
                    x.key === r.key ? { ...x, amount: e.target.value } : x,
                  ),
                )
              }
            />
          </label>
          {rows.length > 1 && (
            <button
              type="button"
              className="portal-btn"
              onClick={() => setRows(rows.filter((_, n) => n !== i))}
            >
              {t("Remove")}
            </button>
          )}
        </div>
      ))}
      <input type="hidden" name="allocation_count" value={rows.length} />
      <button
        type="button"
        className="portal-btn"
        onClick={() =>
          setRows([
            ...rows,
            { key: crypto.randomUUID(), branch_id: "", amount: "" },
          ])
        }
      >
        {t("Add cost centre")}
      </button>
    </fieldset>
  );
}
function allocationData(f: FormData) {
  return Array.from({ length: Number(f.get("allocation_count")) }, (_, i) => ({
    branch_id: String(f.get(`allocation_branch_${i}`) || "") || null,
    amount_minor: minor(f.get(`allocation_amount_${i}`)),
  }));
}
function SalaryPeriodFields({
  record,
  branches,
}: {
  record: DailyRow;
  branches: DailyPage["branches"];
}) {
  const { t } = useLocale();
  const [month, setMonth] = useState("");
  const start = month + "-01";
  const next = month
    ? new Date(
        Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1),
      )
        .toISOString()
        .slice(0, 10)
    : "";
  const partial =
    !!month &&
    (str(record, "effective_from") > start ||
      str(record, "effective_to") < next);
  return (
    <>
      <label>
        {t("Month")}
        <input
          type="month"
          name="month"
          required
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      {partial && (
        <>
          <input type="hidden" name="partial" value="true" />
          <p>
            {t(
              "Enter the agreed partial-month amount and reason. No proration is calculated.",
            )}
          </p>
          <Field name="partial_amount" label="Reviewed amount (AED)" required />
          <Field name="reason" label="Reason" required />
          <AllocationFields branches={branches} />
        </>
      )}
    </>
  );
}
export function DailyAccounts({
  branch,
  mode,
}: {
  branch: string;
  mode: "expenses" | "staff" | "self" | "timekeeping";
}) {
  const { t, locale } = useLocale();
  const today = dubaiDay(new Date());
  const [view, setView] = useState(
      mode === "expenses"
        ? "expenses"
        : ["self", "timekeeping"].includes(mode)
          ? "shifts"
          : "salary",
    ),
    [from, setFrom] = useState(today.slice(0, 7) + "-01"),
    [to, setTo] = useState(today),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState(""),
    [action, setActionState] = useState("");
  const path = `daily?view=${view}&from=${from}&to=${to}&q=${encodeURIComponent(search)}&offset=${offset}${branch ? "&branch=" + branch : ""}`;
  const q = usePortalQuery<DailyPage>(path),
    detail = usePortalQuery<DailyPage>(
      `daily?view=${view}&from=${from}&to=${to}&id=${selected}${branch ? "&branch=" + branch : ""}`,
      !!selected && ["salary", "expenses"].includes(view),
    );
  const d = q.data;
  const liveRecord = detail.data
    ? detail.data.rows[0]
    : d?.rows.find((r) => r.id === selected);
  const [formSnapshot, setFormSnapshot] = useState<DailyRow | null>(null);
  const setAction = (value: string) => {
    setFormSnapshot(value && liveRecord ? liveRecord : null);
    setActionState(value);
  };
  const record =
    q.denied || detail.denied
      ? undefined
      : liveRecord && action && formSnapshot
        ? formSnapshot
        : liveRecord;
  const refresh = () => {
    q.refresh();
    detail.refresh();
    setAction("");
  };
  const cash = (n: number) => money(n, locale);
  const title =
    mode === "timekeeping"
      ? "Staff attendance"
      : mode === "expenses"
        ? "Expenses"
        : mode === "self"
          ? "My work"
          : "Staff pay";
  const canManage = view === "expenses" ? d?.can_expenses : d?.can_payroll;
  const open = (r: DailyRow) => {
    setSelected(r.id);
    setAction("");
  };
  return (
    <section className="daily-accounts">
      <header className="daily-toolbar">
        <div>
          <h2>{t(title)}</h2>
          <p>
            {t(
              mode === "timekeeping"
                ? "Clock in or out and review shift history. Only authorized reviewers can correct staff times."
                : mode === "expenses"
                  ? "Submit costs for central review. Payments record money already paid."
                  : "Agreed pay, approvals and recorded payments. Timekeeping does not deduct salary automatically.",
            )}
          </p>
        </div>
        {view === "expenses" && d?.can_submit_expense && (
          <button
            className="portal-primary"
            onClick={() => {
              setSelected("");
              setAction("expense");
            }}
          >
            {t("Add expense")}
          </button>
        )}
        {view === "agreements" && d?.can_payroll && (
          <button
            className="portal-primary"
            onClick={() => {
              setSelected("");
              setAction("agreement");
            }}
          >
            {t("Add salary agreement")}
          </button>
        )}
      </header>
      {["self", "timekeeping"].includes(mode) && <StaffClock branch={branch} />}
      {mode !== "expenses" && mode !== "timekeeping" && (
        <nav className="daily-section-tabs" aria-label={t(title)}>
          {[
            ["salary", "Pay records"],
            ["agreements", "Salary agreements"],
            ["shifts", "Timekeeping"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={v === view ? "is-active" : ""}
              onClick={() => {
                setView(v);
                setOffset(0);
                setSelected("");
                setAction("");
              }}
            >
              {t(label)}
            </button>
          ))}
        </nav>
      )}
      <div className="daily-toolbar">
        <label>
          {t("Search")}
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
        </label>
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
      {q.error && <p role="alert">{t(q.error)}</p>}
      {d?.summary && (
        <div className="daily-totals">
          {[
            ["Approved costs", d.summary.approved_cost_minor],
            ["Payments allocated", d.summary.paid_minor],
            ["Outstanding", d.summary.outstanding_minor],
          ].map(([label, amt]) => (
            <div key={String(label)}>
              <span>{t(String(label))}</span>
              <strong>{cash(Number(amt))}</strong>
            </div>
          ))}
        </div>
      )}
      {!d ? (
        <p role="status">{t("Loading…")}</p>
      ) : (
        <>
          <div className="management-table-wrap">
            <table className="daily-table">
              <thead>
                <tr>
                  <th>{t(view === "expenses" ? "Expense" : "Employee")}</th>
                  <th>{t("Date / period")}</th>
                  <th>{t(view === "shifts" ? "Clock out" : "Amount (AED)")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Action")}</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id}>
                    <td
                      data-label={t(
                        view === "expenses" ? "Expense" : "Employee",
                      )}
                    >
                      <strong>
                        {str(
                          r,
                          view === "expenses" ? "title" : "employee_name",
                        )}
                      </strong>
                      <small>
                        {str(
                          r,
                          view === "expenses" ? "category" : "branch_name",
                        )}
                      </small>
                    </td>
                    <td data-label={t("Date / period")}>
                      {view === "shifts"
                        ? new Date(str(r, "clocked_in_at")).toLocaleString(
                            locale === "ar" ? "ar-AE" : "en-GB",
                            { timeZone: "Asia/Dubai" },
                          )
                        : str(
                            r,
                            view === "agreements"
                              ? "effective_from"
                              : "cost_date",
                          )}
                      {view === "agreements" && (
                        <small>→ {str(r, "effective_to")}</small>
                      )}
                    </td>
                    <td
                      data-label={t(
                        view === "shifts" ? "Clock out" : "Amount (AED)",
                      )}
                    >
                      {view === "shifts"
                        ? r.clocked_out_at
                          ? new Date(str(r, "clocked_out_at")).toLocaleString(
                              locale === "ar" ? "ar-AE" : "en-GB",
                              { timeZone: "Asia/Dubai" },
                            )
                          : t("Open shift")
                        : cash(
                            num(r, "amount_minor") + num(r, "adjustment_minor"),
                          )}
                    </td>
                    <td data-label={t("Status")}>
                      <StatusBadge
                        status={
                          view === "shifts"
                            ? r.clocked_out_at
                              ? "closed"
                              : "open"
                            : str(r, "status") || "configured"
                        }
                      />
                    </td>
                    <td>
                      <button className="portal-btn" onClick={() => open(r)}>
                        {t("View details")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager offset={offset} total={d.total} change={setOffset} />
        </>
      )}
      <PortalDrawer
        title={t(
          action === "agreement"
            ? "Add salary agreement"
            : action === "expense"
              ? "Expense"
              : record
                ? str(record, view === "expenses" ? "title" : "employee_name")
                : "Details",
        )}
        open={!!selected || !!action}
        onClose={() => {
          setSelected("");
          setAction("");
        }}
      >
        {detail.error && <p role="alert">{t(detail.error)}</p>}
        {record && !action && (
          <>
            <dl className="daily-details">
              <dt>{t("Status")}</dt>
              <dd>
                <StatusBadge status={str(record, "status") || "configured"} />
              </dd>
              {["expenses", "salary"].includes(view) && (
                <>
                  <dt>{t("Date / period")}</dt>
                  <dd>
                    {str(record, "period_start") || str(record, "cost_date")}
                  </dd>
                </>
              )}
              {view === "agreements" && (
                <>
                  <dt>{t("Effective from")}</dt>
                  <dd>{str(record, "effective_from")}</dd>
                  <dt>{t("Effective until (exclusive)")}</dt>
                  <dd>{str(record, "effective_to")}</dd>
                </>
              )}
              {view === "shifts" && (
                <>
                  <dt>{t("Clock in")}</dt>
                  <dd>{str(record, "clocked_in_at")}</dd>
                  <dt>{t("Clock out")}</dt>
                  <dd>{str(record, "clocked_out_at") || t("Open shift")}</dd>
                </>
              )}
              <dt>{t("Branch")}</dt>
              <dd>
                {d?.branches.find((b) => b.id === record.branch_id)?.name ||
                  t("Central / allocated")}
              </dd>
              {view !== "shifts" && (
                <>
                  <dt>{t("Amount (AED)")}</dt>
                  <dd>
                    {cash(
                      num(record, "amount_minor") +
                        num(record, "adjustment_minor"),
                    )}
                  </dd>
                </>
              )}
              {!!record.evidence && (
                <>
                  <dt>{t("Receipt / evidence reference")}</dt>
                  <dd>{str(record, "evidence")}</dd>
                </>
              )}
              {["expenses", "salary"].includes(view) && (
                <>
                  <dt>{t("Payments allocated")}</dt>
                  <dd>{cash(num(record, "paid_minor"))}</dd>
                  <dt>{t("Outstanding")}</dt>
                  <dd>
                    {cash(
                      num(record, "amount_minor") +
                        num(record, "adjustment_minor") -
                        num(record, "paid_minor"),
                    )}
                  </dd>
                </>
              )}
            </dl>
            {Array.isArray(record.allocations) && (
              <div>
                <h3>{t("Cost allocation")}</h3>
                {(
                  record.allocations as {
                    branch_id: string | null;
                    amount_minor: number;
                  }[]
                ).map((a) => (
                  <p key={a.branch_id || "central"}>
                    {d?.branches.find((b) => b.id === a.branch_id)?.name ||
                      t("Central office")}{" "}
                    · {cash(a.amount_minor)}
                  </p>
                ))}
              </div>
            )}
            <div className="daily-actions">
              {view === "expenses" &&
                ["draft", "rejected"].includes(str(record, "status")) &&
                d?.can_submit_expense && (
                  <button
                    className="portal-btn"
                    onClick={() => setAction("expense")}
                  >
                    {t("Edit expense")}
                  </button>
                )}
              {["expenses", "salary"].includes(view) &&
                record.status === "draft" &&
                (canManage ||
                  (d?.can_submit_expense && view === "expenses")) && (
                  <DailyForm
                    action="cost.submit"
                    build={() => ({ id: record.id, revision: record.revision })}
                    onSaved={refresh}
                    submit="Submit for approval"
                  >
                    {null}
                  </DailyForm>
                )}
              {["expenses", "salary"].includes(view) &&
                record.status === "submitted" &&
                canManage && (
                  <button
                    className="portal-primary"
                    onClick={() => setAction("review")}
                  >
                    {t("Review")}
                  </button>
                )}
              {["approved", "part_paid"].includes(str(record, "status")) &&
                canManage && (
                  <button
                    className="portal-primary"
                    onClick={() => setAction("pay")}
                  >
                    {t("Record payout")}
                  </button>
                )}
              {view === "salary" &&
                ["draft", "rejected"].includes(str(record, "status")) &&
                d?.can_payroll && (
                  <button
                    className="portal-btn"
                    onClick={() => setAction("adjust")}
                  >
                    {t("Adjust draft")}
                  </button>
                )}
              {view === "agreements" && d?.can_payroll && (
                <button
                  className="portal-primary"
                  onClick={() => setAction("draft")}
                >
                  {t("Draft monthly pay")}
                </button>
              )}
              {view === "agreements" && d?.can_payroll && (
                <button className="portal-btn" onClick={() => setAction("end")}>
                  {t("End salary agreement")}
                </button>
              )}
              {view === "shifts" && d?.can_timekeeping && (
                <button
                  className="portal-btn"
                  onClick={() => setAction("correct")}
                >
                  {t("Correct times")}
                </button>
              )}
            </div>
            {detail.data?.payouts?.map((r) => (
              <article className="daily-payout" key={r.id}>
                <div>
                  <strong>{cash(num(r, "amount_minor"))}</strong>
                  <span>
                    {str(r, "paid_on")} · {t(str(r, "method"))}
                  </span>
                </div>
                <dl>
                  <dt>{t("Payment reference")}</dt>
                  <dd>{str(r, "reference")}</dd>
                </dl>
                {canManage &&
                  num(r, "amount_minor") > 0 &&
                  !detail.data?.payouts?.some(
                    (p) => p.reversal_of === r.id,
                  ) && (
                    <button
                      className="portal-btn"
                      onClick={() => setAction("reverse:" + r.id)}
                    >
                      {t("Reverse payout")}
                    </button>
                  )}
              </article>
            ))}
            {detail.data?.history && (
              <details>
                <summary>{t("History")}</summary>
                {detail.data.history.map((r) => (
                  <p key={r.id}>
                    {str(r, "created_at")} · {str(r, "action")} ·{" "}
                    {str(r, "reason")}
                  </p>
                ))}
              </details>
            )}
          </>
        )}
        {action === "expense" && d && (
          <DailyForm
            action="expense.save"
            submit="Save draft"
            build={(f) => ({
              ...(record ? { id: record.id, revision: record.revision } : {}),
              branch_id: branch || String(f.get("branch_id") || "") || null,
              title: String(f.get("title")),
              category: String(f.get("category")),
              cost_date: String(f.get("cost_date")),
              amount_minor: minor(f.get("amount")),
              evidence: String(f.get("evidence") || ""),
            })}
            onSaved={() => {
              refresh();
              setSelected("");
            }}
          >
            {!branch && (
              <Field
                label="Branch"
                name="branch_id"
                value={record ? str(record, "branch_id") : ""}
              >
                <option value="">{t("Central office")}</option>
                {d.branches.map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.name}
                  </option>
                ))}
              </Field>
            )}
            <Field
              label="Expense"
              name="title"
              value={record ? str(record, "title") : ""}
              required
            />
            <Field
              label="Category"
              name="category"
              value={record ? str(record, "category") : ""}
              required
            />
            <Field
              label="Date"
              name="cost_date"
              type="date"
              value={record ? str(record, "cost_date") : today}
              required
            />
            <Field
              label="Amount (AED)"
              name="amount"
              value={record ? num(record, "amount_minor") / 100 : ""}
              required
            />
            <Field
              label="Receipt / evidence reference"
              name="evidence"
              value={record ? str(record, "evidence") : ""}
            />
          </DailyForm>
        )}
        {action === "agreement" && d?.can_payroll && (
          <DailyForm
            action="salary.agreement"
            submit="Save agreement"
            onSaved={refresh}
            build={(f) => ({
              employee_id: String(f.get("employee_id")),
              effective_from: String(f.get("effective_from")),
              effective_to: String(f.get("effective_to")),
              amount_minor: minor(f.get("amount")),
              allocations: allocationData(f),
            })}
          >
            <EmployeeField />
            <Field
              label="Effective from"
              name="effective_from"
              type="date"
              required
            />
            <Field
              label="Effective until (exclusive)"
              name="effective_to"
              type="date"
              required
            />
            <Field label="Monthly amount (AED)" name="amount" required />
            <AllocationFields branches={d.branches} />
          </DailyForm>
        )}
        {record && action === "end" && d?.can_payroll && (
          <DailyForm
            action="salary.end"
            submit="Save end date"
            onSaved={refresh}
            build={(f) => ({
              id: record.id,
              effective_to: String(f.get("effective_to")),
              reason: String(f.get("reason")),
            })}
          >
            <Field
              name="effective_to"
              label="Effective until (exclusive)"
              type="date"
              required
            />
            <Field name="reason" label="Reason" required />
          </DailyForm>
        )}
        {record && action.startsWith("reverse:") && canManage && (
          <DailyForm
            action="cost.reverse"
            submit="Reverse payout"
            onSaved={refresh}
            build={(f) => ({
              id: record.id,
              revision: record.revision,
              payout_id: action.split(":")[1],
              reference: String(f.get("reference")),
              reason: String(f.get("reason")),
            })}
          >
            <p>
              {t(
                "This adds a correction entry and restores the outstanding balance. It does not return money.",
              )}
            </p>
            <Field name="reference" label="Payment reference" required />
            <Field name="reason" label="Reason" required />
          </DailyForm>
        )}
        {record && action === "draft" && d?.can_payroll && (
          <DailyForm
            action="salary.draft"
            submit="Draft monthly pay"
            onSaved={refresh}
            build={(f) => ({
              agreement_id: record.id,
              period_start: String(f.get("month")) + "-01",
              ...(f.get("partial")
                ? {
                    reviewed_amount_minor: minor(f.get("partial_amount")),
                    reason: String(f.get("reason")),
                    allocations: allocationData(f),
                  }
                : {}),
            })}
          >
            <p>
              {t(
                "Choose a full month covered by this agreement. No automatic partial-month calculation.",
              )}
            </p>
            <SalaryPeriodFields record={record} branches={d.branches} />
          </DailyForm>
        )}
        {record && action === "review" && canManage && (
          <DailyForm
            action="cost.review"
            submit="Save review"
            onSaved={refresh}
            build={(f) => ({
              id: record.id,
              revision: record.revision,
              decision: String(f.get("decision")),
              reason: String(f.get("reason")),
            })}
          >
            <Field label="Decision" name="decision">
              <option value="approved">{t("Approve")}</option>
              <option value="rejected">{t("Reject")}</option>
            </Field>
            <Field label="Reason" name="reason" type="textarea" required />
          </DailyForm>
        )}
        {record && action === "pay" && canManage && (
          <DailyForm
            action="cost.pay"
            submit="Record payout"
            onSaved={refresh}
            build={(f) => ({
              id: record.id,
              revision: record.revision,
              amount_minor: minor(f.get("amount")),
              method: String(f.get("method")),
              reference: String(f.get("reference")),
              paid_on: String(f.get("paid_on")),
              ...(view === "salary" ? { allocations: allocationData(f) } : {}),
            })}
          >
            <p>
              {t(
                "Record a payment already made. This does not transfer money.",
              )}
            </p>
            <Field
              label="Amount (AED)"
              name="amount"
              value={
                (num(record, "amount_minor") +
                  num(record, "adjustment_minor") -
                  num(record, "paid_minor")) /
                100
              }
              required
            />
            <Field label="Method" name="method">
              <option value="bank">{t("Bank transfer")}</option>
              <option value="cash">{t("Cash")}</option>
              <option value="card">{t("Card")}</option>
            </Field>
            <Field label="Payment reference" name="reference" required />
            {view === "salary" && d && (
              <AllocationFields
                branches={d.branches}
                initial={(
                  record.allocations as {
                    branch_id: string | null;
                    amount_minor: number;
                  }[]
                )
                  .map((a) => ({
                    ...a,
                    amount_minor:
                      a.amount_minor -
                      (detail.data?.payouts || []).reduce(
                        (sum, p) =>
                          sum +
                          ((
                            (p.allocations as {
                              branch_id: string | null;
                              amount_minor: number;
                            }[]) || []
                          ).find((x) => x.branch_id === a.branch_id)
                            ?.amount_minor || 0),
                        0,
                      ),
                  }))
                  .filter((a) => a.amount_minor > 0)}
              />
            )}
            <Field
              label="Paid on"
              name="paid_on"
              type="date"
              value={today}
              required
            />
          </DailyForm>
        )}
        {record && d?.can_payroll && action === "adjust" && (
          <DailyForm
            action="cost.adjust"
            submit="Save adjustment"
            onSaved={refresh}
            build={(f) => {
              const a = String(f.get("adjustment"));
              return {
                id: record.id,
                revision: record.revision,
                adjustment_minor:
                  (a.startsWith("-") ? -1 : 1) * minor(a.replace(/^-/, "")),
                reason: String(f.get("reason")),
                allocations: allocationData(f),
              };
            }}
          >
            <Field
              label="Adjustment (AED, negative for reduction)"
              name="adjustment"
              required
            />
            <Field label="Reason" name="reason" type="textarea" required />
            <AllocationFields
              branches={d.branches}
              initial={
                record.allocations as {
                  branch_id: string | null;
                  amount_minor: number;
                }[]
              }
            />
          </DailyForm>
        )}
        {record && action === "correct" && d?.can_timekeeping && (
          <DailyForm
            action="shift.correct"
            submit="Save correction"
            onSaved={refresh}
            build={(f) => ({
              id: record.id,
              revision: record.revision,
              clocked_in_at: new Date(
                String(f.get("start")) + "+04:00",
              ).toISOString(),
              clocked_out_at: new Date(
                String(f.get("end")) + "+04:00",
              ).toISOString(),
              reason: String(f.get("reason")),
            })}
          >
            <p>
              {t(
                "Enter UAE local times. Original values remain in the audit history.",
              )}
            </p>
            <Field
              label="Clock in"
              name="start"
              type="datetime-local"
              required
            />
            <Field
              label="Clock out"
              name="end"
              type="datetime-local"
              required
            />
            <Field label="Reason" name="reason" type="textarea" required />
          </DailyForm>
        )}
      </PortalDrawer>
    </section>
  );
}

export function DailyCostSummary({
  branch,
  from,
  to,
}: {
  branch: string;
  from: string;
  to: string;
}) {
  const { t, locale } = useLocale();
  const suffix = `&from=${from}&to=${to}${branch ? "&branch=" + branch : ""}`;
  const expense = usePortalQuery<DailyPage>("daily?view=expenses" + suffix),
    salary = usePortalQuery<DailyPage>("daily?view=salary" + suffix);
  return (
    <section className="daily-cost-summary">
      <h3>{t("Expenses and staff pay")}</h3>
      <p>
        {t(
          "Costs use the selected cost period. Payments shown here are allocated against those costs.",
        )}
      </p>
      <div className="daily-totals">
        {[
          ["Expenses", expense.data?.summary, expense.error],
          [
            "Staff pay",
            salary.data?.can_payroll ? salary.data.summary : undefined,
            salary.error,
          ],
        ].map(([label, summary, error]) => {
          const s = summary as DailyPage["summary"];
          const loading =
            label === "Expenses"
              ? !expense.data && !expense.error
              : !salary.data && !salary.error;
          return (
            <div key={String(label)}>
              <span>{t(String(label))}</span>
              {loading ? (
                <span>{t("Loading…")}</span>
              ) : error ? (
                <span role="alert">{t(String(error))}</span>
              ) : s ? (
                <>
                  <strong>
                    {money(Number(s.approved_cost_minor), locale)}
                  </strong>
                  <span>
                    {t("Outstanding")}:{" "}
                    {money(Number(s.outstanding_minor), locale)}
                  </span>
                </>
              ) : (
                <span>{t("Not available with current permissions")}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DailyAccountsHome({
  branch,
  navigate,
}: {
  branch: string;
  navigate: Navigate;
}) {
  const { t } = useLocale();
  const today = dubaiDay(new Date());
  const [from, setFrom] = useState(today.slice(0, 7) + "-01"),
    [to, setTo] = useState(today);
  const access = usePortalQuery<DailyPage>(
    `daily?view=shifts${branch ? "&branch=" + branch : ""}`,
  );
  return (
    <section className="daily-workspace">
      <h2>{t("Accounts overview")}</h2>
      <StaffClock branch={branch} />
      <div className="daily-toolbar">
        <label>
          {t("From")}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          {t("To")}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        {access.data?.can_expenses && (
          <button className="portal-btn" onClick={() => navigate("Expenses")}>
            {t("Review expenses")}
          </button>
        )}
        {(access.data?.can_payroll || access.data?.can_timekeeping) && (
          <button className="portal-btn" onClick={() => navigate("Staff pay")}>
            {t("Staff pay")}
          </button>
        )}
      </div>
      {access.error ? (
        <p role="alert">{t(access.error)}</p>
      ) : (
        <DailyCostSummary branch={branch} from={from} to={to} />
      )}
    </section>
  );
}
