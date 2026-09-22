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
  receiptPdf,
  receiptSummary,
  type ReceiptDocument,
} from "../lib/platform/receipt-pdf";
const receipt: ReceiptDocument = {
  reference: "RCT-REVIEW-001",
  issued_at: "2026-09-19T21:10:00Z",
  payment: {
    amount_minor: 25010,
    currency: "AED",
    method: "bank_transfer",
    reference: "BANK-REVIEW-001",
    recorded_at: "2026-09-19T21:09:00Z",
  },
  allocations: [{ invoice_reference: "INV-001", amount_minor: 20000 }],
  refunded_minor: 1000,
  as_of: "2026-09-20T00:00:00Z",
};
test("receipt reconciles integer minor units and renders the Dubai record date", () => {
  const summary = receiptSummary(receipt);
  assert.equal(summary.allocated_minor, 20000);
  assert.equal(summary.unallocated_minor, 4010);
  assert.equal(summary.recorded_date, "20 Sept 2026, 01:09");
  assert.equal(summary.amount, "AED 250.10");
});
test("receipt rejects inconsistent accounting, fractional money, provider settlement and invalid dates", async () => {
  for (const change of [
    { refunded_minor: 100000 },
    { refunded_minor: -1 },
    { issued_at: "not a date" },
    { as_of: "not a date" },
    { payment: { ...receipt.payment, amount_minor: 250.1 } },
    { payment: { ...receipt.payment, method: "stripe" } },
    { allocations: [{ invoice_reference: "INV-001", amount_minor: -1 }] },
  ])
    await assert.rejects(
      receiptPdf({ ...receipt, ...change } as ReceiptDocument),
    );
});
test("receipt produces a printable PDF with immutable issue metadata and current accounting snapshot", async () => {
  const bytes = await receiptPdf(receipt);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  assert.deepEqual(doc.getPages()[0].getSize(), { width: 595, height: 842 });
  assert.equal(doc.getTitle(), "KAFOU payment receipt RCT-REVIEW-001");
  assert.equal(
    doc.getSubject(),
    "Offline payment acknowledgment; not provider settlement or a tax invoice.",
  );
  assert.equal(
    doc.getCreationDate()?.toISOString(),
    receipt.issued_at.replace("Z", ".000Z"),
  );
});
test("receipt paginates a long allocation history without dropping invoice references", async () => {
  const allocations = Array.from({ length: 110 }, (_, i) => ({
    invoice_reference: `INV-${i + 1}`,
    amount_minor: 100,
  }));
  const bytes = await receiptPdf({ ...receipt, allocations });
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 3);
  const content = doc
    .getPages()
    .map((page) => {
      const contents = page.node.Contents();
      const streams =
        contents instanceof PDFArray
          ? contents
              .asArray()
            .map((ref) => doc.context.lookup(ref) as PDFRawStream)
          : [contents as PDFRawStream];
      return streams
        .map((stream) =>
          Buffer.from(decodePDFRawStream(stream).decode()).toString(),
        )
        .join("\n");
    })
    .join("\n");
  for (const row of allocations)
    assert.ok(
      content.includes(
        `<${Buffer.from(row.invoice_reference).toString("hex").toUpperCase()}>`,
      ),
      row.invoice_reference,
    );
});
test("Arabic receipts require and embed the licensed Arabic font with shaped text", async () => {
  const arabicReceipt = {
    ...receipt,
    payment: { ...receipt.payment, reference: "مرجع البنك ١٢٣" },
  };
  await assert.rejects(receiptPdf(arabicReceipt), /font/);
  const font = await readFile(
    new URL(
      "../public/fonts/noto-sans-arabic-certificate.ttf",
      import.meta.url,
    ),
  );
  const doc = await PDFDocument.load(
    await receiptPdf(arabicReceipt, font, "ar"),
  );
  assert.equal(doc.getPageCount(), 1);
  assert.equal(doc.getTitle(), "إيصال دفع كفو RCT-REVIEW-001");
});
