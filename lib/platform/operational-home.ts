import {
  portalSnapshot,
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
/** Counts are explicitly scoped to authorized loaded records, never organization totals. */
export function operationalHome(
  data: PortalData,
  now = new Date(),
  range?: DateRange,
) {
  const snap = portalSnapshot(data, now),
    r = (key: string) => records(data, key);
  const day = dubaiDay(now),
    through = dubaiDay(new Date(now.getTime() + 7 * 86400000));
  const effectiveRange: DateRange =
    range?.from && range?.to && range.from <= range.to
      ? range
      : { from: day, to: day };
  const inRange = (v: unknown) => {
    if (!v) return false;
    const d = dubaiDay(String(v));
    return d >= effectiveRange.from && d <= effectiveRange.to;
  };
  const rangeSessions = r("class_sessions").filter(
    (x) => x.status !== "cancelled" && inRange(x.starts_at),
  );
  const rangeInvoices = r("commercial_invoices").filter((x) =>
    inRange(x.created_at),
  );
  const rangeInvoiceIds = new Set(rangeInvoices.map((x) => x.id));
  const invoiceLines = r("commercial_invoice_lines"),
    allocations = r("commercial_allocations"),
    adjustments = r("commercial_adjustments");
  const invoicedMinor = invoiceLines
    .filter((l) => rangeInvoiceIds.has(l.invoice_id))
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
  const followUpCutoff = dubaiDay(new Date(now.getTime() - 14 * 86400000));
  const rosterBySession = r("session_roster");
  const cancelledFollowUp = r("class_sessions")
    .filter(
      (x) =>
        x.status === "cancelled" &&
        dubaiDay(value(x, "starts_at")) >= followUpCutoff,
    )
    .map((session) => {
      const rosterIds = new Set(
        rosterBySession
          .filter((row) => row.session_id === session.id)
          .map((row) => row.id),
      );
      const openCredits = r("makeup_credits").filter(
        (c) => rosterIds.has(c.source_roster_id) && c.status === "available",
      ).length;
      return { ...session, _openCredits: openCredits } as PortalRow & {
        _openCredits: number;
      };
    })
    .filter((session) => session._openCredits > 0)
    .sort((a, b) => value(b, "starts_at").localeCompare(value(a, "starts_at")));
  const current = snap.today.find(
    (s) =>
      s.status === "scheduled" &&
      new Date(value(s, "starts_at")) <= now &&
      new Date(value(s, "ends_at")) > now,
  );
  const next = snap.upcoming.find(
    (s) => s.status === "scheduled" && new Date(value(s, "starts_at")) > now,
  );
  const focus = current || next;
  const arrivals = r("session_roster").filter(
    (s) => !s.cancelled && focus && s.session_id === focus.id,
  );
  const expiring = r("commercial_memberships")
    .filter(
      (m) =>
        m.status === "active" &&
        value(m, "expires_on") >= day &&
        value(m, "expires_on") <= through,
    )
    .sort((a, b) =>
      value(a, "expires_on").localeCompare(value(b, "expires_on")),
    );
  const classesById = new Map(r("academy_classes").map((c) => [c.id, c]));
  const availableCoach = (id: unknown, branch: unknown) =>
    r("coach_directory").some(
      (c) =>
        c.id === id &&
        Array.isArray(c.branch_ids) &&
        c.branch_ids.includes(branch),
    );
  // The management directory includes only active coaches with a live role.
  // Branch/parent workspaces do not expose this management-only queue.
  const staffingAlerts = snap.upcoming.filter((session) => {
    if (session.status !== "scheduled" || !Array.isArray(data.coach_directory))
      return false;
    const cls = classesById.get(session.class_id);
    if (!cls || availableCoach(cls.coach_id, cls.branch_id)) return false;
    return !r("coach_substitutions").some(
      (sub) =>
        sub.session_id === session.id &&
        !sub.revoked_at &&
        availableCoach(sub.coach_id, cls.branch_id) &&
        Date.parse(value(sub, "starts_at")) <=
          Date.parse(value(session, "starts_at")) &&
        Date.parse(value(sub, "ends_at")) >=
          Date.parse(value(session, "ends_at")),
    );
  });
  const branchIds = new Set(
    r("academy_classes")
      .map((c) => c.branch_id)
      .filter(Boolean),
  );
  return {
    ...snap,
    current,
    staffingAlerts,
    next,
    focus,
    arrivals,
    expiring,
    range: effectiveRange,
    rangeSessions,
    cancelledFollowUp,
    collections: {
      receivedMinor,
      invoicedMinor,
      outstandingMinor,
    },
    arrived: arrivals.filter((x) =>
      ["present", "late"].includes(value(x, "attendance")),
    ).length,
    awaiting: arrivals.filter(
      (x) => !x.attendance || x.attendance === "unmarked",
    ).length,
    branchSummary: [...branchIds].map((id) => {
      const classes = new Set(
        r("academy_classes")
          .filter((c) => c.branch_id === id)
          .map((c) => c.id),
      );
      const sessions = snap.today.filter((s) => classes.has(s.class_id)),
        ids = new Set(sessions.map((s) => s.id));
      return {
        id: String(id),
        sessions: sessions.length,
        expected: r("session_roster").filter(
          (x) => !x.cancelled && ids.has(x.session_id),
        ).length,
        pending: snap.pendingAttendance.filter((s) => classes.has(s.class_id))
          .length,
      };
    }),
  };
}
