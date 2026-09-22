import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  buildPlan,
  buildImportBatch,
  parseCsv,
  parseMoney,
  readPlan,
  LIMITS,
} from "../scripts/migration/plan";

const family = {
  source_id: "family-1",
  name: "Synthetic Family",
  email: "synthetic@example.test",
};
const child = {
  source_id: "child-1",
  family_source_id: "family-1",
  name: "Synthetic Child",
  dob: "2018-02-28",
};
const membership = {
  source_id: "member-1",
  child_source_id: "child-1",
  branch_source_id: "branch-A",
  package_source_id: "package-A",
  starts_on: "2026-09-01",
  ends_on: "2026-09-30",
  remaining_sessions: "4",
  status: "active",
};
const balance = {
  source_id: "balance-1",
  family_source_id: "family-1",
  as_of: "2026-08-31",
  amount: "10.01",
  currency: "AED",
};
const payment = {
  source_id: "payment-1",
  family_source_id: "family-1",
  occurred_at: "2026-08-20T10:00:00Z",
  amount: "25.20",
  currency: "AED",
  kind: "payment",
  method: "cash",
};
const uuidA = "20000000-0000-4000-8000-000000000001";
const uuidB = "20000000-0000-4000-8000-000000000002";
interface Manifest {
  version: number;
  sourceSystem: string;
  sourceAccountId: string;
  datasetId: string;
  snapshotId: string;
  mappingVersion: string;
  exportedAt: string;
  currency: string;
  cutoverDate: string;
  targetMappings: {
    branches: Record<string, string>;
    packages: Record<string, string>;
  };
  files: {
    entity: string;
    path: string;
    format: string;
    columns: Record<string, string>;
    ignoredColumns: Record<string, string>;
    expectedRows: number;
    expectedMinor?: string;
  }[];
}
async function fixture(
  run: (dir: string, manifest: Manifest) => Promise<void>,
) {
  const dir = await mkdtemp(join(tmpdir(), "kafou-migration-"));
  const records: Record<string, Record<string, string>[]> = {
    families: [family],
    children: [child],
    memberships: [membership],
    opening_balances: [balance],
    payment_history: [payment],
  };
  const manifest: Manifest = {
    version: 1,
    sourceSystem: "mindbody",
    sourceAccountId: "synthetic-account",
    datasetId: "synthetic-cutover",
    snapshotId: "snapshot-1",
    mappingVersion: "review-1",
    exportedAt: "2026-09-01T00:00:00Z",
    currency: "AED",
    cutoverDate: "2026-09-01",
    targetMappings: {
      branches: { "branch-A": uuidA },
      packages: { "package-A": uuidB },
    },
    files: Object.entries(records).map(([entity, rows]) => ({
      entity,
      path: `${entity}.json`,
      format: "json",
      columns: Object.fromEntries(Object.keys(rows[0]).map((k) => [k, k])),
      ignoredColumns: {},
      expectedRows: rows.length,
      ...(entity === "opening_balances"
        ? { expectedMinor: "1001" }
        : entity === "payment_history"
          ? { expectedMinor: "2520" }
          : {}),
    })),
  };
  try {
    for (const [entity, rows] of Object.entries(records))
      await writeFile(join(dir, `${entity}.json`), JSON.stringify(rows));
    await run(dir, manifest);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
async function plan(dir: string, manifest: Manifest, previous?: unknown) {
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest));
  return buildPlan(join(dir, "manifest.json"), previous);
}

test("dry run preserves explicit identity and separates exact balances from payment history", async () =>
  fixture(async (dir, manifest) => {
    const p = await plan(dir, manifest);
    assert.equal(p.status, "validated_dry_run");
    assert.equal(p.readyForImport, false);
    assert.equal(p.rows.length, 5);
    assert.equal(p.reconciliation.opening_balances?.actualMinor, "1001");
    assert.equal(p.reconciliation.payment_history?.actualMinor, "2520");
    assert.equal(
      p.rows.find((r) => r.entity === "children")?.references.family,
      p.rows.find((r) => r.entity === "families")?.targetId,
    );
    assert.equal(JSON.stringify(p).includes("Synthetic Family"), false);
    assert.equal(JSON.stringify(p).includes("synthetic@example.test"), false);
  }));

test("same sources produce identical plans and stable target IDs; previous dry runs never imply an import", async () =>
  fixture(async (dir, manifest) => {
    const first = await plan(dir, manifest);
    const repeated = await plan(dir, manifest, first);
    assert.equal(first.planId, repeated.planId);
    assert.deepEqual(
      first.rows.map((r) => r.targetId),
      repeated.rows.map((r) => r.targetId),
    );
    assert.equal(repeated.comparison.unchanged, 5);
    assert.equal(repeated.comparison.added, 0);
    assert.equal(repeated.readyForImport, false);
  }));

test("changed row and missing row block repeat-plan reconciliation", async () =>
  fixture(async (dir, manifest) => {
    const first = await plan(dir, manifest);
    await writeFile(
      join(dir, "families.json"),
      JSON.stringify([{ ...family, name: "Changed Synthetic Family" }]),
    );
    await writeFile(join(dir, "payment_history.json"), "[]");
    manifest.files[4].expectedRows = 0;
    manifest.files[4].expectedMinor = "0";
    const next = await plan(dir, manifest, first);
    assert.equal(next.status, "blocked");
    assert.equal(next.comparison.changed, 1);
    assert.equal(next.comparison.removed, 1);
    assert.ok(next.exceptions.some((e) => e.code === "source_changed"));
    assert.ok(next.exceptions.some((e) => e.code === "source_removed"));
  }));

test("mapping changes and previous-plan tampering fail closed", async () =>
  fixture(async (dir, manifest) => {
    const first = await plan(dir, manifest);
    manifest.targetMappings.branches["branch-A"] = uuidB;
    const next = await plan(dir, manifest, first);
    assert.ok(next.exceptions.some((e) => e.code === "mapping_changed"));
    const tampered = JSON.parse(JSON.stringify(first));
    tampered.rows[0].targetId = uuidB;
    await assert.rejects(plan(dir, manifest, tampered), /previous plan/i);
  }));

test("different source account cannot reuse a previous plan", async () =>
  fixture(async (dir, manifest) => {
    const first = await plan(dir, manifest);
    manifest.sourceAccountId = "another-account";
    await assert.rejects(plan(dir, manifest, first), /source scope/i);
  }));

test("duplicate source IDs block without silently deduplicating", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(
      join(dir, "families.json"),
      JSON.stringify([family, family]),
    );
    manifest.files[0].expectedRows = 2;
    const p = await plan(dir, manifest);
    assert.equal(p.status, "blocked");
    assert.ok(p.exceptions.some((e) => e.code === "duplicate_source_id"));
  }));

test("matching contact information never merges different source identities", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(
      join(dir, "families.json"),
      JSON.stringify([family, { ...family, source_id: "family-2" }]),
    );
    manifest.files[0].expectedRows = 2;
    const p = await plan(dir, manifest);
    assert.equal(p.rows.filter((r) => r.entity === "families").length, 2);
    assert.ok(
      p.exceptions.some((e) => e.code === "possible_duplicate_contact"),
    );
  }));

test("missing family and unmapped package are explicit exceptions", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(
      join(dir, "children.json"),
      JSON.stringify([{ ...child, family_source_id: "missing" }]),
    );
    delete manifest.targetMappings.packages["package-A"];
    const p = await plan(dir, manifest);
    assert.ok(p.exceptions.some((e) => e.code === "missing_reference"));
    assert.ok(p.exceptions.some((e) => e.code === "unmapped_target"));
  }));

test("row controls and exact financial controls reconcile independently", async () =>
  fixture(async (dir, manifest) => {
    manifest.files[0].expectedRows = 2;
    manifest.files[3].expectedMinor = "1000";
    const p = await plan(dir, manifest);
    assert.ok(p.exceptions.some((e) => e.code === "row_count_mismatch"));
    assert.equal(p.reconciliation.opening_balances?.deltaMinor, "1");
    assert.equal(p.reconciliation.payment_history?.deltaMinor, "0");
    assert.equal(p.status, "blocked");
  }));

test("source and column mappings are required, unsupported entities rejected", async () =>
  fixture(async (dir, manifest) => {
    delete manifest.files[0].columns.source_id;
    await assert.rejects(plan(dir, manifest), /mapping/i);
    manifest.files[0].entity = "bookings";
    await assert.rejects(plan(dir, manifest), /manifest/i);
  }));

test("unmapped input columns are rejected unless explicitly ignored with a reason", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(
      join(dir, "families.json"),
      JSON.stringify([{ ...family, secret_notes: "Sensitive source note" }]),
    );
    const p = await plan(dir, manifest);
    assert.ok(p.exceptions.some((e) => e.code === "unmapped_column"));
    assert.equal(JSON.stringify(p).includes("Sensitive source note"), false);
    manifest.files[0].ignoredColumns.secret_notes =
      "Not approved for migration; retain only in access-controlled source archive";
    assert.equal((await plan(dir, manifest)).status, "validated_dry_run");
  }));

test("invalid calendar dates, after-cutover history and number-valued money are rejected", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(
      join(dir, "children.json"),
      JSON.stringify([{ ...child, dob: "2018-02-30" }]),
    );
    await writeFile(
      join(dir, "payment_history.json"),
      JSON.stringify([
        { ...payment, occurred_at: "2026-09-02T10:00:00Z", amount: 25.2 },
      ]),
    );
    const p = await plan(dir, manifest);
    assert.equal(p.status, "blocked");
    assert.ok(p.exceptions.some((e) => e.code === "invalid_row"));
  }));

test("opening snapshots cannot collide within a family/currency or masquerade as receipts", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(
      join(dir, "opening_balances.json"),
      JSON.stringify([balance, { ...balance, source_id: "balance-2" }]),
    );
    manifest.files[3].expectedRows = 2;
    manifest.files[3].expectedMinor = "2002";
    const p = await plan(dir, manifest);
    assert.ok(p.exceptions.some((e) => e.code === "duplicate_opening_balance"));
    assert.equal(
      p.rows.find((r) => r.entity === "opening_balances")?.intent,
      "opening_balance_only",
    );
    assert.equal(
      p.rows.find((r) => r.entity === "payment_history")?.intent,
      "historical_reference_only",
    );
  }));

test("money parsing uses exact decimals and rejects rounding or ambiguous formats", () => {
  assert.equal(parseMoney("90071992547409.91"), "9007199254740991");
  assert.equal(parseMoney("-0.01"), "-1");
  assert.equal(parseMoney("10.10"), "1010");
  for (const value of [
    1.1,
    "1.001",
    "1e3",
    "1,000.00",
    " 1.00",
    "01.00",
    "+1.00",
    "NaN",
  ])
    assert.throws(() => parseMoney(value));
});

test("CSV accepts quoted commas, escaped quotes, multiline fields and BOM", () => {
  assert.deepEqual(
    parseCsv(
      '\ufeffsource_id,name\r\n"id-1","Synthetic, ""family""\nname"\r\n',
    ),
    [{ source_id: "id-1", name: 'Synthetic, "family"\nname' }],
  );
  for (const csv of [
    "a,a\n1,2",
    "a,b\n1",
    'a\n"unterminated',
    'a\n"ok"junk',
    'a\nx"y',
  ])
    assert.throws(() => parseCsv(csv));
});

test("CSV source column names can be mapped without inventing identity", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(
      join(dir, "families.csv"),
      "Client ID,Family Name,Email\r\nfamily-1,Synthetic Family,synthetic@example.test\r\n",
    );
    Object.assign(manifest.files[0], {
      path: "families.csv",
      format: "csv",
      columns: { source_id: "Client ID", name: "Family Name", email: "Email" },
    });
    assert.equal((await plan(dir, manifest)).status, "validated_dry_run");
  }));

test("file and row limits are enforced before creating a plan", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(
      join(dir, "families.json"),
      " ".repeat(LIMITS.fileBytes + 1),
    );
    await assert.rejects(plan(dir, manifest), /file limit/i);
    assert.throws(
      () =>
        parseCsv(
          "source_id\n" +
            Array.from(
              { length: LIMITS.rowsPerFile + 1 },
              (_, i) => `id-${i}`,
            ).join("\n"),
        ),
      /row limit/i,
    );
  }));

test("parent paths, absent files, and malformed previous-plan files fail safely", async () =>
  fixture(async (dir, manifest) => {
    manifest.files[0].path = "../outside.json";
    await assert.rejects(plan(dir, manifest), /source path/i);
    manifest.files[0].path = "missing.json";
    await assert.rejects(plan(dir, manifest), /source file/i);
    await writeFile(join(dir, "previous.json"), '{"not":"a plan"}');
    await assert.rejects(
      readPlan(join(dir, "previous.json")),
      /previous plan/i,
    );
  }));

test("CLI writes a private report, refuses overwrites and never offers an apply mode", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest));
    const args = [
      "--import",
      "tsx",
      "scripts/migration/cli.ts",
      "--manifest",
      join(dir, "manifest.json"),
      "--out",
      join(dir, "report.json"),
    ];
    const first = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(first.status, 0, first.stderr);
    const report = JSON.parse(await readFile(join(dir, "report.json"), "utf8"));
    assert.equal(report.readyForImport, false);
    assert.equal(first.stdout.includes("Synthetic Family"), false);
    assert.notEqual(
      spawnSync(process.execPath, args, { encoding: "utf8" }).status,
      0,
    );
    assert.notEqual(
      spawnSync(process.execPath, [...args, "--apply"], { encoding: "utf8" })
        .status,
      0,
    );
  }));

test("refund control is signed and unsupported target amounts are held for review", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(
      join(dir, "payment_history.json"),
      JSON.stringify([
        payment,
        { ...payment, source_id: "refund-1", kind: "refund", amount: "5.10" },
      ]),
    );
    manifest.files[4].expectedRows = 2;
    manifest.files[4].expectedMinor = "2010";
    assert.equal(
      (await plan(dir, manifest)).reconciliation.payment_history?.actualMinor,
      "2010",
    );
    await writeFile(
      join(dir, "opening_balances.json"),
      JSON.stringify([{ ...balance, amount: "10000000.01" }]),
    );
    manifest.files[3].expectedMinor = "1000000001";
    assert.ok(
      (await plan(dir, manifest)).exceptions.some(
        (e) => e.code === "target_money_limit",
      ),
    );
  }));

test("stale opening snapshots cannot be accepted as a cutover balance", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(
      join(dir, "opening_balances.json"),
      JSON.stringify([{ ...balance, as_of: "2025-01-01" }]),
    );
    assert.ok(
      (await plan(dir, manifest)).exceptions.some(
        (e) => e.code === "invalid_row",
      ),
    );
  }));

test("unmapped CSV headers are detected even when the export has zero rows", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(
      join(dir, "families.csv"),
      "source_id,name,unreviewed_field\n",
    );
    manifest.files = [
      {
        entity: "families",
        path: "families.csv",
        format: "csv",
        columns: { source_id: "source_id", name: "name" },
        ignoredColumns: {},
        expectedRows: 0,
      },
    ];
    assert.ok(
      (await plan(dir, manifest)).exceptions.some(
        (e) => e.code === "unmapped_column",
      ),
    );
  }));

test("duplicate JSON keys never overwrite source identities or mapping controls", async () =>
  fixture(async (dir, manifest) => {
    await writeFile(
      join(dir, "families.json"),
      '[{"source_id":"family-2","source_id":"family-1","name":"Synthetic"}]',
    );
    await assert.rejects(plan(dir, manifest), /Malformed families source/);
  }));

test("source checksums cover the original UTF-8 bytes including a BOM", async () =>
  fixture(async (dir, manifest) => {
    const raw = "\ufeff" + JSON.stringify([family]);
    await writeFile(join(dir, "families.json"), raw);
    const p = await plan(dir, manifest);
    assert.equal(
      p.sourceFiles.find((f) => f.entity === "families")?.sha256,
      createHash("sha256").update(Buffer.from(raw)).digest("hex"),
    );
  }));

test("Import payload uses the exact validated source reads and preserves snapshot intents", () =>
  fixture(async (dir, manifest) => {
    const p = await plan(dir, manifest);
    const payload = await buildImportBatch(join(dir, "manifest.json"));
    assert.deepEqual(payload.plan, p);
    assert.equal(
      payload.rows.find((r) => r.entity === "families")?.value.name,
      "Synthetic Family",
    );
    assert.equal(
      payload.rows.find((r) => r.entity === "memberships")?.intent,
      "membership_snapshot_only",
    );
    assert.equal(JSON.stringify(p).includes("Synthetic Family"), false);
    manifest.files[0].expectedRows = 2;
    await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest));
    await assert.rejects(
      buildImportBatch(join(dir, "manifest.json")),
      /resolve every planner exception/,
    );
  }));
