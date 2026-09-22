import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { MonthlyReportDocument } from "./report-pdf";
export type ReportReader = Pick<SupabaseClient<Database>, "from" | "rpc">;
export class ReportExportError extends Error {
  constructor(
    public status: 404 | 503,
    message: string,
  ) {
    super(message);
  }
}
const unavailable = () =>
  new ReportExportError(
    503,
    "The complete published report could not be loaded.",
  );
function complete<T>(result: {
  data: T[] | null;
  error: unknown;
  count: number | null;
}): T[] {
  if (result.error || !result.data || result.count !== result.data.length)
    throw unavailable();
  return result.data;
}
/** No service client, cached authorization or latest-version fallback is used. */
export async function loadReportDocument(
  db: ReportReader,
  id: string,
): Promise<MonthlyReportDocument> {
  const record = await db
    .from("development_reports")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (record.error) throw unavailable();
  const report = record.data;
  if (!report)
    throw new ReportExportError(404, "Published report is not available.");
  if (
    !report.reviewed_by ||
    !report.published_at ||
    !report.evidence_ids.length ||
    new Set(report.evidence_ids).size !== report.evidence_ids.length
  )
    throw unavailable();
  const [
    assessmentResult,
    measurementResult,
    certificateResult,
    historyResult,
    childResult,
  ] = await Promise.all([
    db
      .from("development_assessments")
      .select("*", { count: "exact" })
      .in("id", report.evidence_ids)
      .limit(1000),
    db
      .from("development_results")
      .select("*", { count: "exact" })
      .in("assessment_id", report.evidence_ids)
      .limit(1000),
    db
      .from("development_certificate_records")
      .select("*", { count: "exact" })
      .in("assessment_id", report.evidence_ids)
      .limit(1000),
    db
      .from("development_level_history")
      .select("*", { count: "exact" })
      .in("assessment_id", report.evidence_ids)
      .limit(1000),
    db
      .from("children")
      .select("id,name")
      .eq("id", report.child_id)
      .maybeSingle(),
  ]);
  const assessments = complete(assessmentResult),
    measurements = complete(measurementResult),
    certificates = complete(certificateResult),
    history = complete(historyResult);
  if (
    assessments.length !== report.evidence_ids.length ||
    assessments.some(
      (a) =>
        a.child_id !== report.child_id ||
        a.status !== "published" ||
        !a.published_at,
    )
  )
    throw unavailable();
  const criteria = complete(
    await db
      .from("development_criteria")
      .select("*", { count: "exact" })
      .in("id", [...new Set(assessments.map((a) => a.criteria_id))])
      .limit(1000),
  );
  const reversals = history.length
    ? complete(
        await db
          .from("development_level_reversals")
          .select("*", { count: "exact" })
          .in(
            "history_id",
            history.map((h) => h.id),
          )
          .limit(1000),
      )
    : [];
  if (childResult.error) throw unavailable();
  let name = childResult.data?.name ?? null;
  if (!name) {
    const sessions = await db.rpc("development_sessions");
    if (sessions.error) throw unavailable();
    // Older authorized reports remain exportable even outside this roster projection window.
    if (Array.isArray(sessions.data))
      for (const session of sessions.data) {
        if (
          !session ||
          typeof session !== "object" ||
          Array.isArray(session) ||
          !Array.isArray(session.students)
        )
          continue;
        const child = session.students.find(
          (student) =>
            student &&
            typeof student === "object" &&
            !Array.isArray(student) &&
            student.id === report.child_id,
        );
        if (
          child &&
          typeof child === "object" &&
          !Array.isArray(child) &&
          typeof child.name === "string"
        ) {
          name = child.name;
          break;
        }
      }
  }
  const evidence = report.evidence_ids.map((evidenceId) => {
    const assessment = assessments.find((a) => a.id === evidenceId)!;
    const standard = criteria.find((c) => c.id === assessment.criteria_id);
    if (
      !standard ||
      standard.sport !== report.sport ||
      !Array.isArray(standard.criteria)
    )
      throw unavailable();
    const scores = assessment.scores;
    if (!scores || typeof scores !== "object" || Array.isArray(scores))
      throw unavailable();
    const results = measurements.filter(
      (m) => m.assessment_id === assessment.id,
    );
    const keys = standard.criteria.map((c) =>
      c && typeof c === "object" && !Array.isArray(c) ? c.key : undefined,
    );
    if (
      results.length !== keys.length ||
      !keys.length ||
      keys.some(
        (key) =>
          typeof key !== "string" || !results.some((m) => m.metric_key === key),
      )
    )
      throw unavailable();
    if (
      results.some(
        (m) =>
          m.child_id !== report.child_id ||
          m.criteria_id !== standard.id ||
          m.sport !== report.sport ||
          typeof scores[m.metric_key] !== "number" ||
          Number(m.value) !== scores[m.metric_key],
      )
    )
      throw unavailable();
    return {
      id: assessment.id,
      summary: assessment.summary,
      next_target: assessment.next_target,
      criteria_title: standard.title,
      criteria_version: standard.version,
      published_at: assessment.published_at!,
      measurements: keys.map((key) => {
        const m = results.find((r) => r.metric_key === key)!;
        return {
          label: m.label,
          label_ar: m.label_ar,
          value: Number(m.value),
          unit: m.unit,
          measured_at: m.measured_at,
        };
      }),
    };
  });
  if (
    certificates.some(
      (c) =>
        c.child_id !== report.child_id ||
        !c.reference ||
        !c.title ||
        !c.version,
    ) ||
    history.some((h) => h.child_id !== report.child_id)
  )
    throw unavailable();
  return {
    id: report.id,
    child_id: report.child_id,
    recipient_name: name,
    sport: report.sport,
    month: report.month,
    version: report.version,
    summary: report.summary,
    published_at: report.published_at,
    reviewed: true,
    evidence,
    context: {
      as_of: new Date().toISOString(),
      certificates: certificates
        .filter((c) => c.revoked_at)
        .sort((a, b) => String(a.reference).localeCompare(String(b.reference)))
        .map((c) => ({
          reference: c.reference!,
          title: c.title!,
          version: c.version!,
          revoked_at: c.revoked_at,
          revocation_reason: c.revocation_reason,
        })),
      progression_reversals: reversals.map((r) => ({
        assessment_id: history.find((h) => h.id === r.history_id)!
          .assessment_id,
        reversed_at: r.reversed_at,
        reason: r.reason,
      })),
    },
  };
}
