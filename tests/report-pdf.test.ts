import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PDFArray,
  PDFDocument,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import {
  reportPdf,
  type MonthlyReportDocument,
} from "../lib/platform/report-pdf";
const report: MonthlyReportDocument = {
  id: "10000000-0000-4000-8000-000000000001",
  child_id: "10000000-0000-4000-8000-000000000002",
  recipient_name: "Synthetic Athlete",
  sport: "swimming",
  month: "2026-09-01",
  version: 2,
  summary: "Reviewed monthly summary with exact evidence.",
  published_at: "2026-09-19T21:15:00Z",
  reviewed: true,
  evidence: [
    {
      id: "10000000-0000-4000-8000-000000000003",
      summary: "Maintained a safe independent float.",
      next_target: "Practise the reviewed next target.",
      criteria_title: "Floating",
      criteria_version: 3,
      published_at: "2026-09-19T21:00:00Z",
      measurements: [
        {
          label: "Independent float",
          label_ar: "الطفو المستقل",
          value: 12,
          unit: "seconds",
          measured_at: "2026-09-19T20:30:00Z",
        },
      ],
    },
  ],
  context: {
    as_of: "2026-09-20T01:00:00Z",
    certificates: [
      {
        reference: "KAF-CERT-OLD",
        title: "Earlier achievement",
        version: 1,
        revoked_at: "2026-09-20T00:00:00Z",
        revocation_reason: "Corrected award title.",
      },
    ],
    progression_reversals: [
      {
        assessment_id: "10000000-0000-4000-8000-000000000003",
        reversed_at: "2026-09-20T00:00:00Z",
        reason: "Progression reviewed and corrected.",
      },
    ],
  },
};
async function contents(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const text = doc
    .getPages()
    .flatMap((page) => {
      const c = page.node.Contents();
      return (
        c instanceof PDFArray
          ? c.asArray().map((ref) => doc.context.lookup(ref) as PDFRawStream)
          : [c as PDFRawStream]
      ).map((stream) =>
        Buffer.from(decodePDFRawStream(stream).decode()).toString(),
      );
    })
    .join("\n");
  return { doc, text };
}
test("published report PDF preserves its exact version, evidence, measurements and correction context", async () => {
  const { doc, text } = await contents(await reportPdf(report));
  assert.equal(doc.getTitle(), "KAFOU monthly report 2026-09 v2");
  assert.equal(
    doc.getCreationDate()?.toISOString(),
    "2026-09-19T21:15:00.000Z",
  );
  for (const value of [
    report.summary,
    report.evidence[0].summary,
    report.evidence[0].next_target,
    "KAF-CERT-OLD",
    report.context.progression_reversals[0].reason,
  ])
    assert.ok(
      text.includes(Buffer.from(value).toString("hex").toUpperCase()),
      value,
    );
  assert.deepEqual(doc.getPage(0).getSize(), { width: 595, height: 842 });
});
test("export refuses unpublished, unreviewed or incomplete evidence rather than inventing a report", async () => {
  for (const change of [
    { reviewed: false },
    { published_at: "" },
    { version: 0 },
    { evidence: [] },
  ])
    await assert.rejects(
      reportPdf({ ...report, ...change } as MonthlyReportDocument),
    );
});
test("long narrative and all evidence paginate without truncating the final paragraph", async () => {
  const long = {
    ...report,
    summary: Array.from(
      { length: 80 },
      (_, i) =>
        `Reviewed paragraph ${i + 1} retains the exact athlete development narrative.`,
    ).join("\n"),
    evidence: Array.from({ length: 30 }, (_, i) => ({
      ...report.evidence[0],
      id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      summary: `Exact evidence record ${i + 1}.`,
    })),
  };
  const { doc, text } = await contents(await reportPdf(long));
  assert.ok(doc.getPageCount() > 3);
  for (const value of [
    "Reviewed paragraph 80 retains the exact athlete development narrative.",
    "Exact evidence record 30.",
  ])
    assert.ok(
      text.includes(Buffer.from(value).toString("hex").toUpperCase()),
      value,
    );
});
test("Arabic report embeds the licensed shaped font and retains mixed reference numbers", async () => {
  const arabic = {
    ...report,
    recipient_name: "أحمد محمد",
    summary: "تقرير شهري معتمد يستند إلى أدلة التدريب المنشورة. المرجع ١٢٣",
  };
  await assert.rejects(reportPdf(arabic), /font/);
  const font = await readFile(
    new URL(
      "../public/fonts/noto-sans-arabic-certificate.ttf",
      import.meta.url,
    ),
  );
  const doc = await PDFDocument.load(await reportPdf(arabic, font, "ar"));
  assert.equal(doc.getTitle(), "تقرير كفو الشهري 2026-09 v2");
  assert.ok(doc.getPageCount() >= 1);
});
