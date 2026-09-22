"use client";
import type { AccountContext } from "@/lib/platform/contracts";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import type { CompleteReport } from "@/lib/platform/reports-server";
import { api } from "@/lib/platform/client";
import {
  dubaiDay,
  records,
  value,
  type PortalData,
} from "@/lib/platform/portal-model";

export function ReportsPanel({
  data,
  workspace = "admin",
  branch = "",
}: {
  data: PortalData;
  workspace?: string;
  account: AccountContext;
  branch?: string;
}) {
  const { t, locale } = useLocale();
  const today = dubaiDay(new Date());
  const [range, setRange] = useState({ from: today, to: today });
  const effectiveRange =
    range.from && range.to && range.from <= range.to
      ? range
      : { from: today, to: today };
  const [sport, setSport] = useState("");
  const [result, setResult] = useState<{
    key: string;
    report?: CompleteReport;
    error?: string;
  }>({ key: "" });
  const [revision, setRevision] = useState(0);
  const query = new URLSearchParams({
    from: effectiveRange.from,
    to: effectiveRange.to,
  });
  if (branch) query.set("branch", branch);
  if (sport) query.set("sport", sport);
  const queryKey = query.toString();
  useEffect(() => {
    let active = true;
    void api<CompleteReport>(`reports/summary?${queryKey}`).then((response) => {
      if (active)
        setResult(
          response.ok
            ? { key: queryKey, report: response.data }
            : { key: queryKey, error: response.message },
        );
    });
    return () => {
      active = false;
    };
  }, [queryKey, revision, data]);
  const coachSessions = records(data, "development_sessions");
  const report = result.key === queryKey ? result.report : undefined;
  const sales = workspace === "admin" || workspace === "sales";
  const operations = workspace !== "sales";
  const finance = report?.financeVisible && report.finance;
  const money = (minor: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
      style: "currency",
      currency: "AED",
    }).format(minor / 100);
  const percent = (ratio: number | null) =>
    ratio === null
      ? t("Not yet available")
      : new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-GB", {
          style: "percent",
          maximumFractionDigits: 0,
        }).format(ratio);
  const coachName = (id: string) =>
    value(
      records(data, "coach_directory").find((c) => c.id === id) || {},
      "name",
    ) ||
    value(coachSessions.find((s) => s.coach_id === id) || {}, "coach_name") ||
    t("Coach");
  const label = (key: string, type: "branch" | "sport" | "day") => {
    if (type === "sport") return t(key);
    if (type === "day")
      return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
        month: "short",
        day: "numeric",
        timeZone: "Asia/Dubai",
      }).format(new Date(`${key}T12:00:00+04:00`));
    const branch = records(data, "branches").find((b) => b.id === key) || {};
    return (
      value(branch, locale === "ar" ? "name_ar" : "name") ||
      value(branch, "name") ||
      t("Branch")
    );
  };
  const comparison = (
    title: string,
    rows: CompleteReport["branches"],
    type: "branch" | "sport" | "day",
  ) => (
    <section className="report-comparison">
      <h3>{t(title)}</h3>
      {rows.length ? (
        <div
          className="report-table-scroll"
          role="region"
          aria-label={t(title)}
          tabIndex={0}
        >
          <table className="report-table">
            <caption>{t(title)}</caption>
            <thead>
              <tr>
                <th scope="col">
                  {t(
                    type === "branch"
                      ? "Branch"
                      : type === "sport"
                        ? "Sport"
                        : "Date",
                  )}
                </th>
                {[
                  "Sessions",
                  "Booked places",
                  "Utilisation",
                  "Attendance rate",
                  "Absent",
                  "Excused",
                  ...(type !== "day" ? ["Students progressed"] : []),
                ].map((h) => (
                  <th scope="col" key={h}>
                    {t(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{label(row.key, type)}</th>
                  <td>{row.sessions}</td>
                  <td>
                    {row.booked} / {row.capacity}
                  </td>
                  <td>{percent(row.utilization)}</td>
                  <td>{percent(row.attendanceRate)}</td>
                  <td>{row.absent}</td>
                  <td>{row.excused}</td>
                  {type !== "day" && <td>{row.progressedStudents}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ops-muted">{t("No report activity in this period.")}</p>
      )}
    </section>
  );
  const metrics = (items: [string, string | number][]) => (
    <div className="admin-collections-grid">
      {items.map(([name, result]) => (
        <div key={name}>
          <small>{t(name)}</small>
          <strong>{result}</strong>
        </div>
      ))}
    </div>
  );
  return (
    <section className="portal-panel admin-reports">
      <div className="portal-panel-head">
        <h2>{t("Business reports")}</h2>
      </div>
      <p className="ops-muted">
        {t(
          "Complete authorized totals for the selected period. Detail pagination does not affect these figures.",
        )}
      </p>
      <div className="admin-range-panel">
        <label className="admin-range-field">
          {t("From")}
          <input
            type="date"
            value={range.from}
            max={range.to || today}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
        </label>
        <label className="admin-range-field">
          {t("To")}
          <input
            type="date"
            value={range.to}
            min={range.from}
            max={today}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
          />
        </label>
        <button
          className="portal-link"
          onClick={() => setRange({ from: today, to: today })}
        >
          {t("Reset to today")}
        </button>
        <button
          className="portal-link"
          onClick={() =>
            setRange({ from: `${today.slice(0, 7)}-01`, to: today })
          }
        >
          {t("This month")}
        </button>
      </div>
      <label>
        {t("Sport")}
        <select value={sport} onChange={(e) => setSport(e.target.value)}>
          <option value="">{t("All sports")}</option>
          {[
            ...new Set(
              records(data, "branch_sports").map((s) => value(s, "sport")),
            ),
          ]
            .sort()
            .map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
        </select>
      </label>
      <button className="portal-link" onClick={() => setRevision((n) => n + 1)}>
        {t("Refresh report")}
      </button>
      {!report && (
        <p role="status">
          {result.key === queryKey && result.error
            ? result.error
            : t("Loading…")}
        </p>
      )}
      {report && (
        <p className="ops-muted">
          {t("Snapshot time")}:{" "}
          {new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Dubai",
          }).format(new Date(report.asOf))}
        </p>
      )}
      {report && sales && (
        <section>
          <h3>{t("Sales")}</h3>
          {metrics([
            ["Leads", report.sales.total],
            [
              "Conversion rate",
              percent(report.sales.total ? report.sales.conversionRate : null),
            ],
            [
              "Lost rate",
              percent(report.sales.total ? report.sales.lostRate : null),
            ],
          ])}
          <p className="ops-muted">
            {t("Current stages of leads created in this period.")}
          </p>
          <ul className="portal-availability-list">
            {Object.entries(report.sales.byStage).map(([stage, count]) => (
              <li key={stage}>
                {t(stage)}
                <span>{count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {report && operations && (
        <>
          <section>
            <h3>{t("Operations")}</h3>
            {metrics([
              ["Sessions in period", report.operations.total],
              ["Utilisation", percent(report.operations.utilization)],
              ["Attendance rate", percent(report.operations.attendanceRate)],
              ["Absent", report.operations.absent],
              ["Excused", report.operations.excused],
            ])}
            <p className="ops-muted">
              {t(
                "Utilisation is booked places divided by capacity, excluding cancelled sessions. Attendance includes only finalized, marked records; excused absences are shown separately.",
              )}
            </p>
            <ul className="portal-availability-list">
              {Object.entries(report.operations.byStatus).map(
                ([status, count]) => (
                  <li key={status}>
                    {t(status)}
                    <span>{count}</span>
                  </li>
                ),
              )}
            </ul>
          </section>
          {workspace !== "coach" &&
            comparison("Branch comparison", report.branches, "branch")}
          {comparison("Sport performance", report.sports, "sport")}
          {comparison("Daily attendance trend", report.trend, "day")}
          <p className="ops-muted">
            {t(
              "Students progressed counts distinct children with an approved level change in this period, excluding reversed changes.",
            )}
          </p>
        </>
      )}
      {finance && (
        <section>
          <h3>{t("Finance")}</h3>
          <p className="ops-muted">
            {t(
              "Finance covers all sports in the selected branch. Family payments may cover several sports.",
            )}
          </p>
          {metrics([
            ["Invoiced", money(finance.invoicedMinor)],
            ["Received", money(finance.receivedMinor)],
            ["Refunds", money(finance.refundedMinor)],
            ["Outstanding balance (all time)", money(finance.outstandingMinor)],
            ["Active memberships", finance.activeMemberships],
            ["Expiring in period", finance.expiringSoon],
          ])}
        </section>
      )}
      {report && operations && (
        <section>
          <h3>{t("Coaching")}</h3>
          {metrics([
            ["Sessions delivered", report.coaching.deliveredSessions],
            ["Assessments", report.coaching.assessments],
            ["Published assessments", report.coaching.publishedAssessments],
          ])}
          <p className="ops-muted">
            {t(
              "Published assessments use publication date. Delivery counts are completed sessions, not a coach quality score.",
            )}
          </p>
          <ul className="portal-availability-list">
            {Object.entries(report.coaching.byCoach).map(([coach, count]) => (
              <li key={coach}>
                {coachName(coach)}
                <span>{count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
