"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Search,
  Users,
  Plus,
  Clock3,
} from "lucide-react";
import { useLocale } from "@/components/kafou/locale";
import { api } from "@/lib/platform/client";
import type { CompleteReport } from "@/lib/platform/reports-server";
import { operationalHome } from "@/lib/platform/operational-home";
import {
  records,
  value,
  dubaiDay,
  type PortalData,
  type PortalRow,
} from "@/lib/platform/portal-model";
import { invoiceBalance, money } from "@/lib/platform/commercial";
import { Avatar, StatusBadge, SportIcon, EmptyState } from "./portal-ui";
import type { Navigate } from "./portal-shell";
export function OperationalHome({
  data,
  workspace,
  navigate,
  branch = "",
}: {
  data: PortalData;
  workspace: string;
  navigate: Navigate;
  branch?: string;
}) {
  const { t, locale } = useLocale(),
    today = dubaiDay(new Date()),
    [range, setRange] = useState({ from: today, to: today }),
    home = operationalHome(data, new Date(), range),
    r = (k: string) => records(data, k),
    find = (k: string, id: unknown) => r(k).find((x) => x.id === id) || {};
  const query = new URLSearchParams({ from: range.from, to: range.to });
  if (branch) query.set("branch", branch);
  const queryKey = query.toString();
  const [summary, setSummary] = useState<{
    key: string;
    report?: CompleteReport;
    error?: string;
  }>({ key: "" });
  useEffect(() => {
    let active = true;
    void api<CompleteReport>(`reports/summary?${queryKey}`).then((r) => {
      if (active)
        setSummary(
          r.ok
            ? { key: queryKey, report: r.data }
            : { key: queryKey, error: r.message },
        );
    });
    return () => {
      active = false;
    };
  }, [queryKey, data]);
  const financial = summary.key === queryKey ? summary.report?.finance : null;
  const [queue, setQueue] = useState("attendance");
  const date = (v: unknown, timeOnly = false) =>
    v
      ? new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
          timeZone: "Asia/Dubai",
          ...(timeOnly ? {} : { day: "numeric", month: "short" }),
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(String(v)))
      : "—";
  const classFor = (s: PortalRow) => find("academy_classes", s.class_id);
  const title = (s: PortalRow) => value(classFor(s), "name") || t("Session");
  const venue = (s: PortalRow) =>
    value(find("venues", s.venue_id || classFor(s).venue_id), "name");
  const person = (row: PortalRow) =>
    value(
      find("children", find("enrollments", row.enrollment_id).child_id),
      "name",
    ) ||
    value(
      find(
        "trial_enquiries",
        find("trial_bookings", row.trial_booking_id).enquiry_id,
      ),
      "child_name",
    ) ||
    t("Trial participant");
  const sessionRow = (s: PortalRow) => (
    <button
      key={value(s, "id")}
      className="operational-session-row"
      onClick={() => navigate("Attendance", value(s, "id"))}
    >
      <time>{date(s.starts_at, true)}</time>
      <SportIcon sport={value(classFor(s), "sport")} />
      <span>
        <strong>{title(s)}</strong>
        <small>
          {venue(s)} · {home.occupancy(s.id)}/{value(s, "capacity")}{" "}
          {t("places")}
        </small>
      </span>
      <StatusBadge status={s.finalized_at ? "completed" : value(s, "status")} />
      <ArrowUpRight size={16} />
    </button>
  );
  if (workspace === "branch")
    return (
      <div className="desk-home">
        <div className="desk-quick-actions" aria-label={t("Reception actions")}>
          <button
            onClick={() => window.dispatchEvent(new Event("kafou:search"))}
          >
            <Search size={18} />
            {t("Find a family")}
          </button>
          <button onClick={() => navigate("Enquiries", "new")}>
            <Plus size={18} />
            {t("Capture enquiry")}
          </button>
          <button onClick={() => navigate("Trials")}>
            <CalendarDays size={18} />
            {t("Book trial")}
          </button>
          <button onClick={() => navigate("Makeups")}>
            <ArrowRight size={18} />
            {t("Book makeup")}
          </button>
        </div>
        <div className="desk-layout">
          <section className="desk-current">
            <div className="portal-panel-head">
              <span className="portal-eyebrow">
                {t(home.current ? "IN PROGRESS" : "NEXT ARRIVALS")}
              </span>
              <Clock3 size={18} />
            </div>
            {home.focus ? (
              <>
                <h2>{title(home.focus)}</h2>
                <p>{venue(home.focus)}</p>
                <div className="desk-session-time">
                  {date(home.focus.starts_at)}{" "}
                  <span>— {date(home.focus.ends_at, true)}</span>
                </div>
                <div className="desk-arrival-totals">
                  <span>
                    <strong>{home.arrived}</strong>
                    {t("Arrived")}
                  </span>
                  <span>
                    <strong>{home.awaiting}</strong>
                    {t("Awaiting check-in")}
                  </span>
                  <span>
                    <strong>
                      {home.arrivals.filter((x) => x.kind === "trial").length}
                    </strong>
                    {t("Trial places")}
                  </span>
                </div>
                <button
                  className="portal-primary"
                  onClick={() =>
                    navigate("Attendance", value(home.focus!, "id"))
                  }
                >
                  <ClipboardCheck size={18} />
                  {t("Open session roster")}
                </button>
                <p className="desk-current-note">
                  {t(
                    "Review the roster before marking attendance. No arrivals are recorded automatically.",
                  )}
                </p>
              </>
            ) : (
              <EmptyState
                title="No upcoming session"
                copy="New availability appears here after a confirmed booking."
                action="View schedule"
                onAction={() => navigate("Schedule")}
              />
            )}
          </section>
          <section className="portal-panel desk-roster">
            <div className="portal-panel-head">
              <h2>{t("Expected arrivals")}</h2>
              <span className="operational-count">{home.arrivals.length}</span>
            </div>
            {home.arrivals.slice(0, 6).map((row) => (
              <button
                key={value(row, "id")}
                className="operational-arrival"
                onClick={() => navigate("Attendance", value(row, "session_id"))}
              >
                <Avatar name={person(row)} small />
                <span>
                  <strong>{person(row)}</strong>
                  <small>{t(value(row, "kind") || "regular")}</small>
                </span>
                <StatusBadge status={value(row, "attendance") || "unmarked"} />
                <ArrowUpRight size={16} />
              </button>
            ))}
            {!home.arrivals.length && (
              <p className="ops-muted">
                {t("No expected participants in this session.")}
              </p>
            )}
            {home.arrivals.length > 6 && (
              <button
                className="portal-link"
                onClick={() => navigate("Attendance", value(home.focus!, "id"))}
              >
                {t("Open full roster")} <ArrowUpRight size={16} />
              </button>
            )}
          </section>
        </div>
        <div className="desk-secondary">
          <section className="portal-panel">
            <div className="portal-panel-head">
              <h2>{t("Today’s schedule")}</h2>
              <button
                className="portal-link"
                onClick={() => navigate("Schedule")}
              >
                {t("View schedule")}
                <ArrowUpRight size={16} />
              </button>
            </div>
            {home.today.slice(0, 6).map(sessionRow)}
            {!home.today.length && (
              <p className="ops-muted">
                {t("No sessions are scheduled today in the loaded records.")}
              </p>
            )}
          </section>
          <section className="portal-panel desk-handover">
            <div className="portal-panel-head">
              <h2>{t("Keep the shift moving")}</h2>
              <Users size={20} />
            </div>
            <button
              className="operational-task"
              onClick={() => navigate("Attendance")}
            >
              <span>
                <strong>{t("Attendance unresolved")}</strong>
                <small>{t("Started sessions awaiting finalization")}</small>
              </span>
              <b>{home.pendingAttendance.length}</b>
              <ArrowUpRight size={16} />
            </button>
            {r("shift_handovers")
              .filter((x) => x.status !== "resolved")
              .slice(0, 3)
              .map((h) => (
                <button
                  key={value(h, "id")}
                  className="operational-task"
                  onClick={() => navigate("Handover")}
                >
                  <span>
                    <strong>{value(h, "title")}</strong>
                    <small>
                      {t("Follow-up")} · {date(h.follow_up_at)}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            <button
              className="portal-link"
              onClick={() => navigate("Handover")}
            >
              {t("Open shift handover")}
              <ArrowUpRight size={16} />
            </button>
          </section>
        </div>
        <p className="operational-footnote">
          {t(
            "Based on permitted loaded records. Open the relevant workspace for the full queue.",
          )}
        </p>
      </div>
    );
  const invoiceRows = r("commercial_invoices")
    .map((i) => ({
      ...i,
      balance: invoiceBalance(
        value(i, "id"),
        r("commercial_invoice_lines"),
        r("commercial_allocations"),
        r("commercial_adjustments"),
      ),
    }))
    .filter((i) => i.balance > 0);
  // Staffing conflicts (a coach or venue double-booked across overlapping
  // session times) are rejected at write time by database constraints in
  // class.create/session scheduling, so no queue can ever surface one here —
  // there is nothing left over to review.
  const queues = [
    {
      id: "staffing",
      label: "Sessions needing a coach",
      rows: home.staffingAlerts.map((s) => ({ ...s, _record: s.class_id })),
      section: "Classes / Sessions",
      describe: (s: PortalRow) => title(s),
      detail: (s: PortalRow) => date(s.starts_at),
    },
    {
      id: "enrollments",
      label: "Active enrollments",
      rows: r("enrollments")
        .filter((x) => x.status === "active")
        .map((x) => ({
          ...x,
          _record: find("children", x.child_id).family_id,
        })),
      section: "Families",
      describe: (x: PortalRow) =>
        value(find("children", x.child_id), "name") || t("Athlete profile"),
      detail: (x: PortalRow) =>
        value(find("academy_classes", x.class_id), "name"),
    },
    {
      id: "trials",
      label: "Trials today",
      rows: r("trial_bookings")
        .filter(
          (x) =>
            home.today.some((s) => s.id === x.session_id) &&
            !["cancelled", "missed"].includes(value(x, "status")),
        )
        .map((x) => ({ ...x, _record: x.enquiry_id })),
      section: "Trials",
      describe: (x: PortalRow) =>
        value(find("trial_enquiries", x.enquiry_id), "child_name") ||
        t("Trial participant"),
      detail: (x: PortalRow) =>
        date(find("class_sessions", x.session_id).starts_at),
    },
    {
      id: "attendance",
      label: "Attendance unresolved",
      rows: home.pendingAttendance,
      section: "Attendance",
      describe: (x: PortalRow) => title(x),
      detail: (x: PortalRow) => date(x.starts_at),
    },
    {
      id: "followups",
      label: "Follow-ups due",
      rows: home.followups,
      section: "Enquiries",
      describe: (x: PortalRow) => value(x, "parent_name"),
      detail: (x: PortalRow) => date(x.follow_up_at),
    },
    {
      id: "review",
      label: "Assessments awaiting review",
      rows: r("development_assessments").filter(
        (a) => a.status === "submitted",
      ),
      section: "Progress",
      describe: (x: PortalRow) =>
        value(find("children", x.child_id), "name") || t("Assessment"),
      detail: (x: PortalRow) => t(value(x, "sport")),
    },
    {
      id: "renewal",
      label: "Renewals within seven days",
      rows: home.expiring,
      section: "Memberships",
      describe: (x: PortalRow) =>
        value(find("children", x.child_id), "name") || t("Membership"),
      detail: (x: PortalRow) => `${t("Valid until")} ${value(x, "expires_on")}`,
    },
    {
      id: "support",
      label: "Open support conversations",
      rows: r("support_tickets").filter((x) => x.status !== "resolved"),
      section: "Support",
      describe: (x: PortalRow) =>
        value(x, "subject") || value(x, "title") || t("Support"),
      detail: (x: PortalRow) => t(value(x, "status")),
    },
    ...(invoiceRows.length
      ? [
          {
            id: "balances",
            label: "Invoices with a balance",
            rows: invoiceRows,
            section: "Finance",
            describe: (x: PortalRow) => value(x, "reference"),
            detail: (x: PortalRow) => money(Number(x.balance), locale),
          },
        ]
      : []),
    {
      id: "cancelled",
      label: "Cancelled sessions needing follow-up",
      rows: home.cancelledFollowUp,
      section: "Schedule",
      describe: (x: PortalRow) => title(x),
      detail: (x: PortalRow) =>
        `${date(x.starts_at)} · ${t("Open makeup credits")}: ${x._openCredits}`,
    },
  ];
  const selected = queues.find((x) => x.id === queue) || queues[0];
  return (
    <div className="admin-home">
      <section className="portal-panel admin-range-panel">
        <div className="portal-panel-head">
          <div>
            <span className="portal-eyebrow">{t("REPORTING PERIOD")}</span>
            <h2>{t("Collections")}</h2>
          </div>
          <label className="admin-range-field">
            {t("From")}
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) =>
                setRange((cur) => ({ ...cur, from: e.target.value }))
              }
            />
          </label>
          <label className="admin-range-field">
            {t("To")}
            <input
              type="date"
              value={range.to}
              min={range.from}
              max={today}
              onChange={(e) =>
                setRange((cur) => ({ ...cur, to: e.target.value }))
              }
            />
          </label>
          {range.from !== today || range.to !== today ? (
            <button
              className="portal-link"
              onClick={() => setRange({ from: today, to: today })}
            >
              {t("Reset to today")}
            </button>
          ) : null}
        </div>
        <p className="ops-muted" role="status">
          {summary.key === queryKey && summary.error
            ? summary.error
            : t(
                "Complete authorized totals. Detail pagination does not affect collections.",
              )}
        </p>
        <div className="admin-collections-grid">
          <div>
            <span className="operational-count">
              {financial ? money(financial.receivedMinor, locale) : "—"}
            </span>
            <small>{t("Money received in period")}</small>
          </div>
          <div>
            <span className="operational-count">
              {financial ? money(financial.invoicedMinor, locale) : "—"}
            </span>
            <small>{t("Invoices issued in period")}</small>
          </div>
          <div>
            <span className="operational-count">
              {financial ? money(financial.outstandingMinor, locale) : "—"}
            </span>
            <small>{t("Outstanding balance (all time)")}</small>
          </div>
        </div>
      </section>
      <section className="admin-action-centre">
        <div className="portal-panel-head">
          <div>
            <span className="portal-eyebrow">
              {t("PRIORITIES BEFORE NUMBERS")}
            </span>
            <h2>{t("The next right action")}</h2>
          </div>
          <ClipboardCheck size={24} />
        </div>
        <div className="admin-action-layout">
          <div className="admin-queue-tabs" aria-label={t("Action queues")}>
            {queues.map((q) => (
              <button
                key={q.id}
                aria-pressed={q.id === selected.id}
                onClick={() => setQueue(q.id)}
              >
                <span>{t(q.label)}</span>
                <strong>{q.rows.length}</strong>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          <section
            className="admin-queue-detail"
            aria-label={t(selected.label)}
          >
            <div className="portal-panel-head">
              <h3>{t(selected.label)}</h3>
              <button
                className="portal-link"
                onClick={() => navigate(selected.section)}
              >
                {t("View all")}
                <ArrowUpRight size={16} />
              </button>
            </div>
            {selected.rows.slice(0, 5).map((x) => (
              <button
                className="operational-task"
                key={value(x, "id")}
                onClick={() =>
                  navigate(
                    selected.section,
                    value(x, "_record") || value(x, "id"),
                  )
                }
              >
                <span>
                  <strong>{selected.describe(x)}</strong>
                  <small>{selected.detail(x)}</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
            {!selected.rows.length && (
              <EmptyState
                title="This queue is clear"
                copy="No pending actions in the loaded records."
              />
            )}
            {selected.rows.length > 5 && (
              <p className="ops-muted">
                {t("Showing the first five records.")}
              </p>
            )}
          </section>
        </div>
      </section>
      <div className="admin-secondary">
        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>{t("Today’s operating timeline")}</h2>
            <button
              className="portal-link"
              onClick={() => navigate("Schedule")}
            >
              {t("View schedule")}
              <ArrowUpRight size={16} />
            </button>
          </div>
          {home.today.slice(0, 6).map(sessionRow)}
          {!home.today.length && (
            <p className="ops-muted">
              {t("No sessions are scheduled today in the loaded records.")}
            </p>
          )}
        </section>
        <section className="portal-panel admin-branch-summary">
          <div className="portal-panel-head">
            <h2>{t("Branch activity")}</h2>
            <CalendarDays size={20} />
          </div>
          <p className="ops-muted">
            {t("Today’s sessions and expected arrivals, by permitted branch.")}
          </p>
          {home.branchSummary.map((b) => (
            <div key={b.id} className="operational-branch-row">
              <strong>
                {value(
                  find("branches", b.id),
                  locale === "ar" ? "name_ar" : "name",
                ) || value(find("branches", b.id), "name")}
              </strong>
              <dl>
                <div>
                  <dt>{t("Sessions")}</dt>
                  <dd>{b.sessions}</dd>
                </div>
                <div>
                  <dt>{t("Expected")}</dt>
                  <dd>{b.expected}</dd>
                </div>
                <div>
                  <dt>{t("Attendance pending")}</dt>
                  <dd>{b.pending}</dd>
                </div>
              </dl>
            </div>
          ))}
          {!home.branchSummary.length && (
            <p className="ops-muted">
              {t("No operational records in the selected branch.")}
            </p>
          )}
          <p className="ops-muted">
            {t("Use the branch filter above to inspect its source records.")}
          </p>
        </section>
      </div>
      <p className="operational-footnote">
        {t(
          "Based on permitted loaded records. Open the relevant workspace for the full queue.",
        )}
      </p>
    </div>
  );
}
