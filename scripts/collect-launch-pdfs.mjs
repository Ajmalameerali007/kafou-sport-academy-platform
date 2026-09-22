import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";

const origin = "http://127.0.0.1:3101";
const directory = resolve(
  "outputs/launch-rehearsal/2026-09-21-completion/pdf",
);
mkdirSync(directory, { recursive: true });
const fixture = JSON.parse(
  readFileSync(
    "outputs/product/local-meeting-tuning-2026-09-20.json",
    "utf8",
  ),
);
const finance = JSON.parse(
  readFileSync(
    "outputs/launch-rehearsal/2026-09-21-completion/finance-reconciliation.json",
    "utf8",
  ),
);
const login = await fetch(`${origin}/api/auth/login`, {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({
    identifier: fixture.accounts.admin.email,
    password: process.env.KAFOU_DEMO_PASSWORD,
    remember: false,
  }),
});
assert.equal(login.status, 200, "Synthetic finance actor must authenticate");
const cookie = login.headers
  .getSetCookie()
  .map((value) => value.split(";")[0])
  .join("; ");
const documents = [
  ...(["en", "ar"].map((locale) => ({
    name: `invoice-aed-800-${locale}.pdf`,
    path: `/api/product/invoices/${finance.invoice.id}?locale=${locale}`,
    kind: "invoice",
    locale,
  }))),
  ...finance.receipts.flatMap((receipt, index) =>
    ["en", "ar"].map((locale) => ({
      name: `receipt-${index === 0 ? "partial-aed-600" : "final-aed-200"}-${locale}.pdf`,
      path: `/api/product/receipts/${receipt.id}?locale=${locale}`,
      kind: "receipt",
      locale,
    })),
  ),
];
const manifest = [];
for (const document of documents) {
  const response = await fetch(`${origin}${document.path}`, {
    headers: { Cookie: cookie },
    redirect: "error",
  });
  assert.equal(response.status, 200, `${document.name} must download`);
  assert.match(
    response.headers.get("content-type") || "",
    /^application\/pdf/,
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  const parsed = await PDFDocument.load(bytes);
  assert.ok(parsed.getPageCount() >= 1);
  const file = resolve(directory, document.name);
  writeFileSync(file, bytes, { mode: 0o600 });
  manifest.push({
    ...document,
    file,
    bytes: bytes.length,
    pages: parsed.getPageCount(),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
writeFileSync(
  resolve(directory, "manifest.json"),
  `${JSON.stringify({ at: new Date().toISOString(), synthetic: true, documents: manifest }, null, 2)}\n`,
  { mode: 0o600 },
);
console.log(
  JSON.stringify({ status: "passed", documents: manifest.length, directory }),
);
