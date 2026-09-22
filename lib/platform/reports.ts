import {
  records,
  value,
  dubaiDay,
  type PortalData,
  type PortalRow,
} from "./portal-model";
import { invoiceBalance } from "./commercial";

export interface DateRange {
  from: string;
  to: string;
}

/** Aggregate business figures for the Admin/Owner reports view.
 * Every number is derived only from already-loaded, authorized records. */
export function businessReports(data: PortalData, range: DateRange) {
  const r = (key: string) => records(data, key);
  const inRange = (v: unknown) => {
    if (!v) return false;
    const d = dubaiDay(String(v));
    return d >= range.from && d <= range.to;
  };

  const leads = r("leads").filter((l) => inRange(l.created_at));
  const byStage: Record<string, number> = {};
  for (const l of leads)
    byStage[value(l, "stage")] = (byStage[value(l, "stage")] || 0) + 1;
  const converted = byStage.converted || 0;
  const lost = byStage.lost || 0;
  const sales = {
    total: leads.length,
    byStage,
    conversionRate: leads.length ? converted / leads.length : 0,
    lostRate: leads.length ? lost / leads.length : 0,
  };

  const sessions = r("class_sessions").filter((s) => inRange(s.starts_at));
  const byStatus: Record<string, number> = {};
  for (const s of sessions)
    byStatus[value(s, "status")] = (byStatus[value(s, "status")] || 0) + 1;
  const finalizedIds = new Set(
    sessions
      .filter((s) => s.finalized_at && s.status !== "cancelled")
      .map((s) => s.id),
  );
  const finalizedRoster = r("session_roster").filter(
    (row) =>
      finalizedIds.has(row.session_id) &&
      !row.cancelled &&
      ["present", "late", "absent", "excused"].includes(
        value(row, "attendance"),
      ),
  );
  const present = finalizedRoster.filter((row) =>
    ["present", "late"].includes(value(row, "attendance")),
  ).length;
  const operations = {
    total: sessions.length,
    byStatus,
    attendanceRate: finalizedRoster.length
      ? present / finalizedRoster.length
      : null,
  };

  const invoices = r("commercial_invoices").filter((i) =>
    inRange(i.created_at),
  );
  const invoiceLines = r("commercial_invoice_lines"),
    allocations = r("commercial_allocations"),
    adjustments = r("commercial_adjustments");
  const invoicedMinor = invoiceLines
    .filter((l) => invoices.some((i) => i.id === l.invoice_id))
    .reduce((n, l) => n + Number(l.quantity) * Number(l.unit_minor), 0);
  const receivedMinor = r("commercial_payments")
    .filter((p) => inRange(p.created_at))
    .reduce((n, p) => n + Number(p.amount_minor), 0);
  const outstandingMinor = r("commercial_invoices").reduce(
    (n, i) =>
      n +
      Math.max(
        0,
        invoiceBalance(String(i.id), invoiceLines, allocations, adjustments),
      ),
    0,
  );
  const memberships = r("commercial_memberships");
  const activeMemberships = memberships.filter(
    (m) => m.status === "active",
  ).length;
  const expiringSoon = memberships.filter(
    (m) =>
      m.status === "active" &&
      dubaiDay(value(m, "expires_on")) <= range.to &&
      dubaiDay(value(m, "expires_on")) >= range.from,
  ).length;
  const finance = {
    invoicedMinor,
    receivedMinor,
    outstandingMinor,
    activeMemberships,
    expiringSoon,
  };

  const visibleSessionIds = new Set(r("class_sessions").map((s) => s.id));
  const assessmentScope = r("development_assessments").filter(
    (a) =>
      !r("display_branch_id").length || visibleSessionIds.has(a.session_id),
  );
  const assessments = assessmentScope.filter((a) => inRange(a.created_at));
  const publishedAssessments = assessmentScope.filter((a) =>
    inRange(a.published_at),
  ).length;
  const bySession = new Map<string, number>();
  for (const s of sessions.filter(
    (s) => s.delivered_by && s.status !== "cancelled",
  )) {
    const coach = value(s, "delivered_by");
    bySession.set(coach, (bySession.get(coach) || 0) + 1);
  }
  const coaching = {
    deliveredSessions: sessions.filter(
      (s) => s.delivered_by && s.status !== "cancelled",
    ).length,
    byCoach: Object.fromEntries(bySession),
    assessments: assessments.length,
    publishedAssessments,
  };

  const classes = new Map(r("academy_classes").map((c) => [c.id, c]));
  const allSessions = new Map(r("class_sessions").map((s) => [s.id, s]));
  const allAssessments = new Map(
    r("development_assessments").map((a) => [a.id, a]),
  );
  const reversed = new Set(
    r("development_level_reversals").map((x) => x.history_id),
  );
  const progressions = r("development_level_history").filter(
    (h) => inRange(h.created_at) && !reversed.has(h.id),
  );
  const liveSessions = sessions.filter((s) => s.status !== "cancelled");
  const summarize = (subset: PortalRow[]) => {
    const ids = new Set(subset.map((s) => s.id));
    const roster = r("session_roster").filter(
      (x) => !x.cancelled && ids.has(x.session_id),
    );
    const marked = finalizedRoster.filter((x) => ids.has(x.session_id));
    const attended = marked.filter((x) =>
      ["present", "late"].includes(value(x, "attendance")),
    ).length;
    const capacity = subset.reduce((n, s) => n + Number(s.capacity || 0), 0);
    return {
      sessions: subset.length,
      booked: roster.length,
      capacity,
      utilization: capacity ? roster.length / capacity : null,
      attendanceRate: marked.length ? attended / marked.length : null,
      absent: marked.filter((x) => x.attendance === "absent").length,
      excused: marked.filter((x) => x.attendance === "excused").length,
    };
  };
  const group = (kind: "branch" | "sport" | "day") => {
    const keyFor = (session: PortalRow) =>
      kind === "day"
        ? dubaiDay(value(session, "starts_at"))
        : value(
            classes.get(session.class_id) || session,
            kind === "branch" ? "branch_id" : "sport",
          );
    const groups = new Map<string, PortalRow[]>();
    for (const session of liveSessions) {
      const key = keyFor(session);
      if (key) groups.set(key, [...(groups.get(key) || []), session]);
    }
    // A promotion belongs to the assessment's original session branch,
    // not every branch the athlete subsequently attends.
    const improved = new Map<string, Set<unknown>>();
    if (kind !== "day")
      for (const h of progressions) {
        const assessment = allAssessments.get(h.assessment_id);
        const session = assessment && allSessions.get(assessment.session_id);
        if (r("display_branch_id").length && !session) continue;
        const key =
          kind === "sport" ? value(h, "sport") : session ? keyFor(session) : "";
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        const children = improved.get(key) || new Set();
        children.add(h.child_id);
        improved.set(key, children);
      }
    return [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rows]) => ({
        key,
        ...summarize(rows),
        progressedStudents: improved.get(key)?.size || 0,
      }));
  };
  return {
    range,
    sales,
    operations: { ...operations, ...summarize(liveSessions) },
    finance,
    coaching,
    branches: group("branch"),
    sports: group("sport"),
    trend: group("day"),
  };
}
