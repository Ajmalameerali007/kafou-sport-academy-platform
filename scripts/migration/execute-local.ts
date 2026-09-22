/** Explicit local synthetic rehearsal. This CLI cannot target a hosted database. */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { buildImportBatch } from "./plan";
const args = process.argv.slice(2);
function option(name: string) {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
}
if (!args.includes("--confirm-synthetic-fixture"))
  throw new Error("Explicit synthetic fixture acknowledgement required.");
const action = option("--action");
const output = option("--out");
if (
  !output ||
  !["apply", "resume", "reconcile", "reverse"].includes(action || "")
)
  throw new Error(
    "Provide --action apply|resume|reconcile|reverse and a new --out evidence file.",
  );
function literal(value: unknown) {
  const tag = `$migration_${randomUUID().replaceAll("-", "")}$`;
  return `${tag}${typeof value === "string" ? value : JSON.stringify(value)}${tag}`;
}
function sql(query: string) {
  const r = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_kafou-local",
      "psql",
      "-X",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: query, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (r.status !== 0)
    throw new Error(
      "Local import transaction refused. Review database constraints and mapping; private row values are not printed.",
    );
  return JSON.parse(r.stdout.trim());
}
let batch = option("--batch");
if (action === "apply" || action === "resume") {
  const manifest = option("--manifest"),
    review = option("--review");
  if (!manifest || !review || review.length < 8)
    throw new Error(
      "Provide reviewed synthetic --manifest and --review reference.",
    );
  const payload = await buildImportBatch(manifest);
  batch = payload.plan.planId;
  sql(
    `select to_jsonb(private.stage_synthetic_migration(${literal(payload)}::jsonb,${literal(review)}));`,
  );
  let remaining = 1;
  while (remaining) {
    const result = sql(
      `select private.apply_synthetic_migration(${literal(batch)},100);`,
    );
    remaining = result.remaining;
    if (!result.applied && remaining)
      throw new Error("Import checkpoint made no progress.");
  }
} else {
  if (!batch || !/^[a-f0-9]{64}$/.test(batch))
    throw new Error("Exact reviewed batch ID required.");
  if (action === "reverse")
    sql(`select private.reverse_synthetic_migration(${literal(batch)});`);
}
const result = sql(
  `select private.reconcile_synthetic_migration(${literal(batch)});`,
);
await writeFile(
  output,
  JSON.stringify(
    {
      environment: "kafou-local",
      synthetic: true,
      batch,
      action,
      result,
      at: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
  { flag: "wx", mode: 0o600 },
);
console.log(
  `Local synthetic ${action} evidence written. No guardian access, live collections or membership activation created.`,
);
