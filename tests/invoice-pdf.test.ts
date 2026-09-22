import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import {
  invoicePdf,
  invoiceSummary,
  type InvoiceDocument,
} from "../lib/platform/invoice-pdf";

const invoice: InvoiceDocument = {
  reference: "INV-REHEARSAL-001",
  issued_at: "2026-09-20T08:00:00Z",
  as_of: "2026-09-20T10:00:00Z",
  currency: "AED",
  family_name: "Rehearsal Family",
  branch_name: "KAFOU Demo Branch",
  lines: [
    {
      description: "Amina · Swimming foundation package",
      description_ar: "أمينة · باقة أساسيات السباحة",
      quantity: 2,
      unit_minor: 12500,
    },
  ],
  allocations: [{ reference: "CASH-REHEARSAL-001", amount_minor: 10000 }],
  adjustments: [
    {
      kind: "discount",
      amount_minor: 2500,
      reason: "Approved rehearsal discount",
    },
  ],
};

test("invoice reconciles posted lines, adjustments, allocations and outstanding balance", () => {
  assert.deepEqual(invoiceSummary(invoice), {
    subtotal_minor: 25000,
    allocated_minor: 10000,
    adjusted_minor: 2500,
    outstanding_minor: 12500,
  });
});

test("invoice rejects invalid money, chronology, lines and adjustment signs", async () => {
  for (const candidate of [
    { ...invoice, currency: "USD" },
    { ...invoice, as_of: "2026-09-19T10:00:00Z" },
    { ...invoice, lines: [] },
    { ...invoice, lines: [{ ...invoice.lines[0], unit_minor: 10.5 }] },
    {
      ...invoice,
      adjustments: [
        { kind: "reversal", amount_minor: 100, reason: "Wrong sign" },
      ],
    },
    {
      ...invoice,
      allocations: [{ reference: "OVERPAY", amount_minor: 999999 }],
    },
  ])
    await assert.rejects(invoicePdf(candidate as InvoiceDocument));
});

test("invoice produces an A4 non-tax PDF with immutable issue metadata", async () => {
  const bytes = await invoicePdf(invoice);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  assert.deepEqual(doc.getPages()[0].getSize(), { width: 595, height: 842 });
  assert.equal(doc.getTitle(), "KAFOU invoice statement INV-REHEARSAL-001");
  assert.equal(
    doc.getSubject(),
    "Operational invoice statement; not a tax invoice or provider settlement proof.",
  );
  assert.equal(
    doc.getCreationDate()?.toISOString(),
    invoice.issued_at.replace("Z", ".000Z"),
  );
});

test("invoice paginates a long line list", async () => {
  const bytes = await invoicePdf({
    ...invoice,
    lines: Array.from({ length: 100 }, (_, index) => ({
      description: `Rehearsal package line ${index + 1}`,
      description_ar: "",
      quantity: 1,
      unit_minor: 100,
    })),
    allocations: [],
    adjustments: [],
  });
  assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 4);
});

test("Arabic invoice embeds the licensed Arabic font and renders bilingual content", async () => {
  await assert.rejects(invoicePdf(invoice, undefined, "ar"), /font/);
  const font = await readFile(
    new URL(
      "../public/fonts/noto-sans-arabic-certificate.ttf",
      import.meta.url,
    ),
  );
  const doc = await PDFDocument.load(await invoicePdf(invoice, font, "ar"));
  assert.equal(doc.getPageCount(), 1);
  assert.equal(doc.getTitle(), "بيان فاتورة كفو INV-REHEARSAL-001");
});
