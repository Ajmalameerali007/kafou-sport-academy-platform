/** Full synthetic LOCAL database recovery rehearsal. No hosted calls; no existing DB reset. */
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  chmod,
  writeFile,
  readFile,
  rm,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
const container = "supabase_db_kafou-local";
const target = `kafou_restore_${Date.now()}_${process.pid}`;
if (!/^kafou_restore_\d+_\d+$/.test(target))
  throw new Error("Unsafe disposable database name");
const temporary = await mkdtemp(join(tmpdir(), "kafou-local-recovery-"));
await chmod(temporary, 0o700);
const output = resolve(
  "outputs/local-restore",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
await mkdir(output, { recursive: true, mode: 0o700 });
const evidence = {
  startedAt: new Date().toISOString(),
  container,
  source: "postgres",
  disposableDatabase: target,
  result: "incomplete",
  cleanup: "not-created",
  scope:
    "Full synthetic local PostgreSQL data and schema only. No hosted backup, provider configuration, globals, or uploaded file bytes.",
};
let created = false;
function run(args, input) {
  const r = spawnSync(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    { input, encoding: "utf8", maxBuffer: 100 * 1024 * 1024, timeout: 120000 },
  );
  if (r.error || r.status !== 0)
    throw new Error(
      `Local restore command ${args[0]} failed (exit ${r.status}); raw data-bearing output intentionally suppressed.`,
    );
  return r.stdout;
}
function query(database, input, user = "postgres") {
  return run(
    ["psql", "-X", "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", "-At"],
    input,
  );
}
const fingerprintSql = `select format('select json_build_object(''table'',%L,''rows'',count(*),''sha256'',encode(extensions.digest(coalesce(string_agg(to_jsonb(t)::text,E''\\n'' order by to_jsonb(t)::text),''''),''sha256''),''hex''))::text from %I.%I t;',n.nspname||'.'||c.relname,n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','storage') and c.relkind in ('r','p') order by n.nspname,c.relname
\\gexec
`;
function fingerprints(database) {
  return query(database, fingerprintSql)
    .trim()
    .split("\n")
    .map((s) => JSON.parse(s));
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
try {
  evidence.runnerSha256 = createHash("sha256")
    .update(await readFile("scripts/verify-local-restore.mjs"))
    .digest("hex");
  evidence.sourceBefore = fingerprints("postgres");
  const dump = run([
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "--no-owner",
  ]);
  const file = join(temporary, "synthetic-local-database.sql");
  await writeFile(file, dump, { mode: 0o600 });
  evidence.dumpSha256 = createHash("sha256").update(dump).digest("hex");
  evidence.dumpBytes = Buffer.byteLength(dump);
  evidence.sourceAfterDump = fingerprints("postgres");
  if (!equal(evidence.sourceBefore, evidence.sourceAfterDump))
    throw new Error(
      "Source changed during backup; this rehearsal cannot establish an identical snapshot. Retry after local writes stop.",
    );
  run(["createdb", "-U", "postgres", target]);
  created = true;
  evidence.cleanup = "pending";
  query(target, await readFile(file, "utf8"), "supabase_admin");
  evidence.restored = fingerprints(target);
  evidence.tablesCompared = evidence.sourceAfterDump.length;
  evidence.rowsCompared = evidence.sourceAfterDump.reduce(
    (n, t) => n + t.rows,
    0,
  );
  evidence.fingerprintsMatch = equal(
    evidence.sourceAfterDump,
    evidence.restored,
  );
  if (!evidence.fingerprintsMatch)
    throw new Error(
      "Restored row fingerprints differ from the unchanged source snapshot.",
    );
  const seqSql =
    "select schemaname,sequencename,last_value from pg_sequences where schemaname in ('public','private','auth','storage') order by schemaname,sequencename;";
  evidence.sourceSequences = query("postgres", seqSql).trim();
  evidence.restoredSequences = query(target, seqSql).trim();
  evidence.sequencesMatch =
    evidence.sourceSequences === evidence.restoredSequences;
  if (!evidence.sequencesMatch)
    throw new Error("Restored sequence positions differ from source.");
  evidence.sourceAtEnd = fingerprints("postgres");
  evidence.sourceUnchanged = equal(evidence.sourceBefore, evidence.sourceAtEnd);
  if (!evidence.sourceUnchanged)
    throw new Error(
      "Concurrent source writes prevent before/after unchanged assertion.",
    );
  evidence.result = "local_full_database_restore_passed";
  console.log(
    `Local full restore passed: ${evidence.tablesCompared} tables, ${evidence.rowsCompared} rows, matching SHA-256 fingerprints and sequence positions. Source unchanged.`,
  );
} catch (error) {
  evidence.result = "failed";
  evidence.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  if (created) {
    try {
      run(["dropdb", "-U", "postgres", target]);
      evidence.cleanup = "disposable_database_dropped";
    } catch {
      evidence.cleanup = "drop_failed";
      process.exitCode = 1;
    }
  }
  await rm(temporary, { recursive: true, force: true });
  evidence.privateDumpDeleted = true;
  evidence.finishedAt = new Date().toISOString();
  await writeFile(
    join(output, "evidence.json"),
    JSON.stringify(evidence, null, 2),
    { mode: 0o600 },
  );
  console.log(
    `Evidence: ${output}/evidence.json; ${evidence.cleanup}; private dump deleted.`,
  );
}
