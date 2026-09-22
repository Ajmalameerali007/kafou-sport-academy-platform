import { writeFile } from "node:fs/promises";
import { buildPlan, readPlan, LIMITS } from "./plan";
const usage =
  "Usage: node --import tsx scripts/migration/cli.ts --manifest <manifest.json> --out <new-private-report.json> [--previous <previous-report.json>]";
async function main() {
  const values = new Map<string, string>();
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log(usage);
    return;
  }
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (
      !["--manifest", "--out", "--previous"].includes(key) ||
      !value ||
      value.startsWith("--") ||
      values.has(key)
    )
      throw new Error(usage);
    values.set(key, value);
  }
  const manifest = values.get("--manifest"),
    out = values.get("--out");
  if (!manifest || !out) throw new Error(usage);
  const previous = values.get("--previous");
  const plan = await buildPlan(
    manifest,
    previous ? await readPlan(previous) : undefined,
  );
  const report = JSON.stringify(plan, null, 2) + "\n";
  if (Buffer.byteLength(report) > LIMITS.reportBytes)
    throw new Error(
      "Report file limit exceeded; reduce the explicitly scoped source dataset.",
    );
  try {
    await writeFile(out, report, { flag: "wx", mode: 0o600 });
  } catch {
    throw new Error(
      "Report could not be created. Choose a new file in an existing private directory; existing files are never overwritten.",
    );
  }
  console.log(
    `${plan.status}: ${plan.rows.length} validated source rows, ${plan.exceptions.length} exceptions. Plan ${plan.planId}. Dry run only; no data imported.`,
  );
  if (plan.status === "blocked") process.exitCode = 2;
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Migration dry run failed.",
  );
  process.exitCode = 1;
});
