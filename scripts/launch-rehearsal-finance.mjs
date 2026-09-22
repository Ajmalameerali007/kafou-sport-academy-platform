import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fixtureId,
  loadFixtureConfig,
  readFixture,
  signInActor,
  unwrap,
} from "./seed-product-demo.mjs";

const config = loadFixtureConfig(process.argv.slice(2), true);
assert.equal(config.hosted, false, "Launch rehearsal finance is local-only");
const fixture = readFixture(config);
assert.equal(fixture.status, "ready");
const actor = await signInActor(config, fixture.accounts.admin);
const key = (label) =>
  fixtureId(`${config.url}/${config.batch}/launch-rehearsal-finance/${label}`);
const command = async (action, data, label) =>
  unwrap(
    actor.client.rpc("product_command", {
      p_action: action,
      p_data: data,
      p_key: key(label),
    }),
    label,
  );
try {
  const productPackage = await command(
    "commercial.package.create",
    {
      branch_id: fixture.branchId,
      sport: "swimming",
      level_id: fixture.levelId,
      name: "DEMO · Launch rehearsal AED 800",
      name_ar: "تجريبي · باقة بروفة الإطلاق ٨٠٠ درهم",
      price_minor: 80000,
      session_allowance: 8,
      terms:
        "Synthetic launch-rehearsal arithmetic only; not approved KAFOU pricing or policy.",
      terms_ar:
        "حسابات تجريبية لبروفة الإطلاق فقط وليست أسعاراً أو سياسة معتمدة من كفو.",
    },
    "package-800",
  );
  const invoice = await command(
    "commercial.invoice.create",
    {
      family_id: fixture.familyId,
      branch_id: fixture.branchId,
      reference: `LR-800-${config.batch}`.slice(0, 100),
      lines: [
        {
          child_id: fixture.ids.child,
          package_id: productPackage.id,
          quantity: 1,
        },
      ],
    },
    "invoice-800",
  );
  const partial = await command(
    "commercial.payment.record",
    {
      family_id: fixture.familyId,
      branch_id: fixture.branchId,
      invoice_id: invoice.id,
      amount_minor: 60000,
      method: "cash",
      reference: `LR-CASH-600-${config.batch}`.slice(0, 100),
    },
    "payment-600",
  );
  const final = await command(
    "commercial.payment.record",
    {
      family_id: fixture.familyId,
      branch_id: fixture.branchId,
      invoice_id: invoice.id,
      amount_minor: 20000,
      method: "external_terminal",
      reference: `LR-CARD-200-${config.batch}`.slice(0, 100),
    },
    "payment-200",
  );
  const [lines, allocations, receipts] = await Promise.all([
    unwrap(
      actor.client
        .from("commercial_invoice_lines")
        .select("id,quantity,unit_minor")
        .eq("invoice_id", invoice.id),
      "invoice lines",
    ),
    unwrap(
      actor.client
        .from("commercial_allocations")
        .select("id,payment_id,amount_minor,created_at")
        .eq("invoice_id", invoice.id)
        .order("created_at"),
      "allocations",
    ),
    unwrap(
      actor.client
        .from("commercial_receipts")
        .select("id,payment_id,reference")
        .in("payment_id", [partial.id, final.id]),
      "receipts",
    ),
  ]);
  const invoiced = lines.reduce(
    (sum, line) => sum + line.quantity * line.unit_minor,
    0,
  );
  const received = allocations.reduce(
    (sum, allocation) => sum + allocation.amount_minor,
    0,
  );
  assert.equal(invoiced, 80000);
  assert.equal(received, 80000);
  assert.equal(invoiced - received, 0);
  assert.equal(receipts.length, 2);
  assert.deepEqual(
    allocations.map((row) => row.amount_minor).sort((a, b) => a - b),
    [20000, 60000],
  );
  const timeline = allocations.map((allocation, index) => {
    const receivedMinor = allocations
      .slice(0, index + 1)
      .reduce((sum, row) => sum + row.amount_minor, 0);
    return {
      payment_id: allocation.payment_id,
      amount_minor: allocation.amount_minor,
      received_minor: receivedMinor,
      outstanding_minor: invoiced - receivedMinor,
      recorded_at: allocation.created_at,
    };
  });
  assert.deepEqual(
    timeline.map((row) => [row.received_minor, row.outstanding_minor]),
    [
      [60000, 20000],
      [80000, 0],
    ],
  );
  const repeated = await command(
    "commercial.invoice.create",
    {
      family_id: fixture.familyId,
      branch_id: fixture.branchId,
      reference: `LR-800-${config.batch}`.slice(0, 100),
      lines: [
        {
          child_id: fixture.ids.child,
          package_id: productPackage.id,
          quantity: 1,
        },
      ],
    },
    "invoice-800",
  );
  assert.equal(repeated.id, invoice.id);
  const evidence = {
    version: 1,
    at: new Date().toISOString(),
    environment: config.url,
    synthetic: true,
    policy:
      "AED 800 / eight-session arithmetic only; not approved KAFOU pricing, tax treatment or launch policy.",
    invoice: {
      id: invoice.id,
      reference: invoice.reference,
      invoiced_minor: invoiced,
      allocations_minor: allocations.map((row) => row.amount_minor),
      received_minor: received,
      outstanding_minor: invoiced - received,
      timeline,
    },
    payments: [partial.id, final.id],
    receipts: receipts.map((row) => ({ id: row.id, reference: row.reference })),
    idempotent_invoice_retry: repeated.id === invoice.id,
    provider_settlement: "not_claimed",
  };
  const directory = resolve(
    "outputs/launch-rehearsal/2026-09-21-completion",
  );
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, "finance-reconciliation.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      status: "passed",
      invoice: invoice.id,
      invoiced_minor: invoiced,
      received_minor: received,
      outstanding_minor: invoiced - received,
      receipts: receipts.length,
      evidence: resolve(directory, "finance-reconciliation.json"),
    }),
  );
} finally {
  await actor.client.auth.signOut({ scope: "local" });
}
