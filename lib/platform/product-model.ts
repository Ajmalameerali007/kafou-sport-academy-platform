import type { ProductData } from "./product";
/** View filters never grant access; these inputs have already passed RLS. */
export function scopeProduct(data: ProductData, branch: string) {
  if (!branch) return data;
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, rows]) => Array.isArray(rows))
      .map(([key, rows]) => [
        key,
        rows.filter((r) => !("branch_id" in r) || r.branch_id === branch),
      ]),
  );
}
export function childJourney(data: ProductData, child: string): ProductData {
  if (!child) return data;
  const r = (key: string) => (Array.isArray(data[key]) ? data[key] : []);
  const enroll = r("enrollments").filter((x) => x.child_id === child),
    enrollIds = new Set(enroll.map((x) => x.id));
  const enquiries = r("trial_enquiries").filter((x) => x.child_id === child),
    enquiryIds = new Set(enquiries.map((x) => x.id));
  const trials = r("trial_bookings").filter((x) =>
      enquiryIds.has(x.enquiry_id),
    ),
    trialIds = new Set(trials.map((x) => x.id));
  const roster = r("session_roster").filter(
    (x) => enrollIds.has(x.enrollment_id) || trialIds.has(x.trial_booking_id),
  );
  const sessions = new Set(roster.map((x) => x.session_id));
  const scoped = Object.fromEntries(
    Object.entries(data)
      .filter(([, rows]) => Array.isArray(rows))
      .map(([key, rows]) => [
        key,
        rows.filter((row) => !("child_id" in row) || row.child_id === child),
      ]),
  );
  return {
    ...scoped,
    children: r("children").filter((x) => x.id === child),
    development_safety_children: r("development_safety_children").filter(
      (x) => x.id === child,
    ),
    enrollments: enroll,
    trial_enquiries: enquiries,
    trial_bookings: trials,
    session_roster: roster,
    class_sessions: r("class_sessions").filter((x) => sessions.has(x.id)),
    family_schedule: r("family_schedule")
      .filter((x) => sessions.has(x.id))
      .map((x) => ({
        ...x,
        students: Array.isArray(x.students)
          ? x.students.filter((s) => s.id === child)
          : [],
      })),
  };
}
