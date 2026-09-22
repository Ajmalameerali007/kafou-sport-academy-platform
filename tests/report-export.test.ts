import test from "node:test";
import assert from "node:assert/strict";
import {
  loadReportDocument,
  type ReportReader,
} from "../lib/platform/report-export";
const reportId = "10000000-0000-4000-8000-000000000001",
  childId = "10000000-0000-4000-8000-000000000002",
  assessmentId = "10000000-0000-4000-8000-000000000003",
  criteriaId = "10000000-0000-4000-8000-000000000004";
function fixture() {
  return {
    development_reports: [
      {
        id: reportId,
        session_id: "session",
        child_id: childId,
        sport: "swimming",
        month: "2026-09-01",
        version: 2,
        status: "published",
        summary: "Exact version two summary",
        reviewed_by: "reviewer",
        published_at: "2026-09-20T00:00:00Z",
        evidence_ids: [assessmentId],
      },
    ],
    development_assessments: [
      {
        id: assessmentId,
        child_id: childId,
        criteria_id: criteriaId,
        status: "published",
        summary: "Exact published evidence",
        next_target: "Next target",
        published_at: "2026-09-19T23:00:00Z",
        scores: { float: 12 },
      },
    ],
    development_criteria: [
      {
        id: criteriaId,
        sport: "swimming",
        version: 3,
        title: "Float criteria",
        criteria: [{ key: "float" }],
      },
    ],
    development_results: [
      {
        id: "result",
        assessment_id: assessmentId,
        child_id: childId,
        sport: "swimming",
        criteria_id: criteriaId,
        metric_key: "float",
        label: "Float",
        label_ar: "الطفو",
        value: 12,
        unit: "seconds",
        measured_at: "2026-09-19T21:00:00Z",
      },
    ],
    development_certificate_records: [
      {
        id: "cert",
        assessment_id: assessmentId,
        child_id: childId,
        reference: "CERT-OLD",
        title: "Previous award",
        version: 1,
        revoked_at: "2026-09-20T00:00:00Z",
        revocation_reason: "Public correction",
      },
    ],
    development_level_history: [
      { id: "level-history", assessment_id: assessmentId, child_id: childId },
    ],
    development_level_reversals: [
      {
        id: "reversal",
        history_id: "level-history",
        reason: "Reviewed correction",
        reversed_at: "2026-09-20T00:00:00Z",
      },
    ],
    children: [{ id: childId, name: "Synthetic child" }],
  };
}
function reader(
  rows: Record<string, Record<string, unknown>[]>,
  queries: string[] = [],
  partialTable = "",
): ReportReader {
  return {
    from(table: string) {
      queries.push(table);
      let filtered = [...(rows[table] || [])];
      const q = {
        select() {
          return q;
        },
        eq(k: string, v: unknown) {
          filtered = filtered.filter((row) => row[k] === v);
          return q;
        },
        in(k: string, values: unknown[]) {
          filtered = filtered.filter((row) => values.includes(row[k]));
          return q;
        },
        limit() {
          return q;
        },
        order() {
          return q;
        },
        maybeSingle() {
          return Promise.resolve({ data: filtered[0] ?? null, error: null });
        },
        then(resolve: (x: unknown) => unknown) {
          return Promise.resolve({
            data: filtered,
            error: null,
            count: filtered.length + (partialTable === table ? 1 : 0),
          }).then(resolve);
        },
      };
      return q;
    },
    rpc() {
      return Promise.resolve({ data: [], error: null });
    },
  } as unknown as ReportReader;
}
test("report projection loads exact requested version and public correction context without private notes", async () => {
  const queries: string[] = [];
  const doc = await loadReportDocument(reader(fixture(), queries), reportId);
  assert.equal(doc.version, 2);
  assert.equal(doc.summary, "Exact version two summary");
  assert.equal(doc.evidence[0].criteria_version, 3);
  assert.equal(doc.evidence[0].measurements[0].value, 12);
  assert.equal(
    doc.context.certificates[0].revocation_reason,
    "Public correction",
  );
  assert.equal(
    doc.context.progression_reversals[0].reason,
    "Reviewed correction",
  );
  assert.ok(!queries.includes("development_reviews"));
  assert.ok(!queries.includes("development_assessment_notes"));
});
test("hidden or draft report is unavailable even when caller is staff", async () => {
  for (const status of ["draft", "submitted", "approved", "rejected"]) {
    const rows = fixture();
    rows.development_reports[0].status = status;
    await assert.rejects(loadReportDocument(reader(rows), reportId), {
      status: 404,
    });
  }
  await assert.rejects(
    loadReportDocument(
      reader({ ...fixture(), development_reports: [] }),
      reportId,
    ),
    { status: 404 },
  );
});
test("missing, mismatched or truncated evidence fails closed instead of substituting another version", async () => {
  for (const change of [
    { development_assessments: [] },
    { development_results: [] },
    {
      development_assessments: [
        { ...fixture().development_assessments[0], child_id: "another-child" },
      ],
    },
    {
      development_criteria: [
        { ...fixture().development_criteria[0], sport: "football" },
      ],
    },
  ])
    await assert.rejects(
      loadReportDocument(reader({ ...fixture(), ...change }), reportId),
      { status: 503 },
    );
  await assert.rejects(
    loadReportDocument(reader(fixture(), [], "development_results"), reportId),
    { status: 503 },
  );
});
test("revoked current permissions remain a denial on every new export", async () => {
  const rows = fixture();
  const db = reader(rows);
  await loadReportDocument(db, reportId);
  rows.development_reports = [];
  await assert.rejects(loadReportDocument(db, reportId), { status: 404 });
});
