/** Presentation projections only. Authorization remains in the API and RLS. */
export type PortalRow = Record<string, unknown>;
export type PortalData = Record<string, PortalRow[]>;
export const value = (r: PortalRow, key: string) => String(r[key] ?? "");
export const records = (d: PortalData, key: string) => d[key] || [];
export const dubaiDay = (date: Date | string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
export function scopeOperations(data: PortalData, branch: string): PortalData {
  if (!branch) return data;
  const r = (k: string) => records(data, k),
    ids = (items: PortalRow[]) => new Set(items.map((x) => x.id));
  const classes = r("academy_classes").filter((x) => x.branch_id === branch),
    classIds = ids(classes);
  const sessions = r("class_sessions").filter((x) => classIds.has(x.class_id)),
    sessionIds = ids(sessions);
  const leads = r("leads").filter((x) => x.branch_id === branch),
    leadIds = ids(leads);
  const enquiries = r("trial_enquiries").filter((x) => leadIds.has(x.lead_id)),
    enquiryIds = ids(enquiries);
  const enrollments = r("enrollments").filter((x) => classIds.has(x.class_id));
  const childIds = new Set([
    ...enrollments.map((x) => x.child_id),
    ...enquiries.map((x) => x.child_id),
  ]);
  const familyIds = new Set([
    ...leads.map((x) => x.family_id),
    ...r("children")
      .filter((x) => childIds.has(x.id))
      .map((x) => x.family_id),
  ]);
  // A branch filter is an operational view, not an inferred family-access grant.
  return {
    ...data,
    display_branch_id: [{ id: branch }],
    academy_classes: classes,
    class_sessions: sessions,
    leads,
    trial_enquiries: enquiries,
    enrollments,
    trial_bookings: r("trial_bookings").filter(
      (x) => enquiryIds.has(x.enquiry_id) && sessionIds.has(x.session_id),
    ),
    session_roster: r("session_roster").filter((x) =>
      sessionIds.has(x.session_id),
    ),
    lead_activities: r("lead_activities").filter((x) => leadIds.has(x.lead_id)),
    families: r("families").filter((x) => familyIds.has(x.id)),
    children: r("children").filter((x) => familyIds.has(x.family_id)),
    venues: r("venues").filter((x) => x.branch_id === branch),
    branch_sports: r("branch_sports").filter((x) => x.branch_id === branch),
  };
}
export function portalSnapshot(data: PortalData, now = new Date()) {
  const r = (k: string) => records(data, k),
    day = dubaiDay(now);
  const sessions = r("class_sessions")
    .filter((x) => x.status !== "cancelled")
    .sort((a, b) => value(a, "starts_at").localeCompare(value(b, "starts_at")));
  const today = sessions.filter((x) => dubaiDay(value(x, "starts_at")) === day);
  const todayIds = new Set(today.map((x) => x.id));
  const roster = r("session_roster").filter((x) => !x.cancelled);
  const followups = r("leads").filter(
    (x) =>
      x.follow_up_at &&
      new Date(value(x, "follow_up_at")) <= now &&
      !["converted", "lost"].includes(value(x, "stage")),
  );
  const finalizedIds = new Set(
    today.filter((x) => x.finalized_at).map((x) => x.id),
  );
  const marked = roster.filter(
    (x) =>
      finalizedIds.has(x.session_id) &&
      ["present", "late", "absent", "excused"].includes(value(x, "attendance")),
  );
  return {
    today,
    followups,
    upcoming: sessions.filter((x) => new Date(value(x, "ends_at")) >= now),
    activeStudents: new Set(
      r("enrollments")
        .filter((x) => x.status === "active")
        .map((x) => x.child_id),
    ).size,
    expected: roster.filter((x) => todayIds.has(x.session_id)).length,
    trialsToday: r("trial_bookings").filter(
      (x) =>
        todayIds.has(x.session_id) &&
        !["cancelled", "missed"].includes(value(x, "status")),
    ).length,
    pendingAttendance: sessions.filter(
      (x) =>
        new Date(value(x, "starts_at")) <= now &&
        !x.finalized_at &&
        x.status === "scheduled",
    ),
    conversionReady: r("trial_bookings").filter((x) => x.status === "attended"),
    attendancePercent: marked.length
      ? Math.round(
          (100 *
            marked.filter((x) =>
              ["present", "late"].includes(value(x, "attendance")),
            ).length) /
            marked.length,
        )
      : null,
    occupancy: (id: unknown) =>
      roster.filter((x) => x.session_id === id).length,
  };
}
export interface SearchRecord {
  id: string;
  kind: string;
  title: string;
  detail: string;
  section: string;
  record?: string;
}
export function searchRecords(data: PortalData, query: string): SearchRecord[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  const r = (k: string) => records(data, k);
  const candidates: SearchRecord[] = [
    ...r("families").map((x) => ({
      id: `family-${x.id}`,
      kind: "Family",
      title: value(x, "name"),
      detail: "Family contact information",
      section: "Families",
      record: value(x, "id"),
    })),
    ...r("children").map((x) => ({
      id: `child-${x.id}`,
      kind: "Child",
      title: value(x, "name"),
      detail:
        value(x, "reported_age") +
        " · " +
        value(r("families").find((f) => f.id === x.family_id) || {}, "name"),
      section: "Families",
      record: value(x, "family_id"),
    })),
    ...r("leads").map((x) => ({
      id: `lead-${x.id}`,
      kind: "Lead",
      title: value(x, "parent_name"),
      detail: value(x, "stage"),
      section: "Enquiries",
      record: value(x, "id"),
    })),
    ...r("academy_classes").map((x) => ({
      id: `class-${x.id}`,
      kind: "Class",
      title: value(x, "name"),
      detail: value(x, "sport"),
      section: "Classes / Sessions",
      record: value(x, "id"),
    })),
    ...r("trial_enquiries").map((x) => ({
      id: `trial-${x.id}`,
      kind: "Trial",
      title: value(x, "child_name"),
      detail: value(x, "reference") + " · " + value(x, "sport"),
      section: "Trials",
      record: value(x, "id"),
    })),
    ...r("coach_sessions").map((x) => ({
      id: `coach-${x.id}`,
      kind: "Session",
      title: value(x, "name"),
      detail: value(x, "starts_at"),
      section: "Assigned sessions",
      record: value(x, "id"),
    })),
  ];
  return candidates
    .filter((x) => `${x.title} ${x.detail}`.toLocaleLowerCase().includes(q))
    .slice(0, 30);
}

/** Family schedule contains participation, not merely classes visible under RLS. */
export function familyUpcoming(data: PortalData, now = new Date()) {
  const r = (table: string) => records(data, table);
  const ownChildren = new Set(r("children").map((c) => c.id));
  const activeEnrollments = new Set(
    r("enrollments")
      .filter((e) => e.status === "active" && ownChildren.has(e.child_id))
      .map((e) => e.id),
  );
  const bookings = r("trial_bookings").filter((b) =>
    ["booked", "attended", "converted"].includes(value(b, "status")),
  );
  const bookingIds = new Set(bookings.map((b) => b.id));
  const sessionIds = new Set(
    r("session_roster")
      .filter(
        (row) =>
          !row.cancelled &&
          (activeEnrollments.has(row.enrollment_id) ||
            bookingIds.has(row.trial_booking_id)),
      )
      .map((row) => row.session_id),
  );
  bookings.forEach((b) => sessionIds.add(b.session_id));
  return portalSnapshot(data, now).upcoming.filter((s) => sessionIds.has(s.id));
}
