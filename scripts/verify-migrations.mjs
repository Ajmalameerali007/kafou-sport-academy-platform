/** Replay a frozen source snapshot in a disposable LOCAL database. Never reset the running DB. */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const root = process.cwd();
const container = "supabase_db_kafou-local";
const database = `kafou_replay_${Date.now()}_${process.pid}`;
if (!/^kafou_replay_\d+_\d+$/.test(database))
  throw new Error("Invalid disposable database name.");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = resolve(root, "outputs", "migration-replay", stamp);
const env = { ...process.env, DO_NOT_TRACK: "1", NO_COLOR: "1" };
let password = "";
function redact(value) {
  let text = String(value || "");
  if (password) {
    text = text
      .replaceAll(password, "[REDACTED]")
      .replaceAll(encodeURIComponent(password), "[REDACTED]");
  }
  return text.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[LOCAL_DATABASE_URL]");
}
function command(bin, args, input, allowFailure = false) {
  const result = spawnSync(bin, args, {
    cwd: root,
    env,
    input,
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
    timeout: 120000,
  });
  if (result.error) throw new Error(redact(result.error.message));
  if (result.status !== 0 && !allowFailure)
    throw new Error(
      `${bin} failed (${result.status}): ${redact(result.stderr || result.stdout).slice(-6000)}`,
    );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
function docker(args, input, allowFailure) {
  return command(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    input,
    allowFailure,
  );
}
function sql(text, user = "postgres") {
  return docker(
    [
      "psql",
      "-X",
      "-U",
      user,
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-1",
      "-At",
    ],
    text,
  );
}
function digest(contents) {
  return createHash("sha256").update(contents).digest("hex");
}
const evidence = {
  startedAt: new Date().toISOString(),
  container,
  sourceDatabase: "postgres",
  disposableDatabase: database,
  gitHead: "",
  migrations: [],
  tests: [],
  seed: {},
  checks: [],
  drift: [],
  result: "incomplete",
  cleanup: "not-created",
  limitations: [
    "Schema-only infrastructure bootstrap plus empty application-schema replay; not a data backup/restore rehearsal.",
    "No HTTP/Auth/Storage services point at the disposable database; browser/Worker/provider behavior is outside this check.",
  ],
};
let created = false;
await mkdir(join(output, "migrations"), { recursive: true, mode: 0o700 });
await mkdir(join(output, "tests"), { recursive: true, mode: 0o700 });
async function log(name, value) {
  await writeFile(join(output, name), redact(value), { mode: 0o600 });
}
async function snapshot(directory, target, records) {
  for (const name of (await readdir(join(root, directory)))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const content = await readFile(join(root, directory, name));
    records.push({ name, sha256: digest(content), bytes: content.length });
    await writeFile(join(output, target, name), content, { mode: 0o600 });
  }
}
try {
  evidence.gitHead = command("git", ["rev-parse", "HEAD"]).stdout.trim();
  evidence.runnerSha256 = digest(
    await readFile(join(root, "scripts/verify-migrations.mjs")),
  );
  await snapshot("supabase/migrations", "migrations", evidence.migrations);
  await snapshot("tests/database", "tests", evidence.tests);
  const seed = await readFile(join(root, "supabase/seed.sql"));
  evidence.seed = {
    path: "supabase/seed.sql",
    sha256: digest(seed),
    bytes: seed.length,
  };
  await writeFile(join(output, "seed.sql"), seed, { mode: 0o600 });
  console.log(
    `Frozen ${evidence.migrations.length} migrations and ${evidence.tests.length} SQL tests. Disposable DB: ${database}`,
  );
  const dump = docker([
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "--schema-only",
    "--no-owner",
  ]);
  await log("infrastructure-schema.sql", dump.stdout); // Schema definitions only; never copied data or credentials.
  evidence.infrastructureSchemaSha256 = digest(dump.stdout);
  docker(["createdb", "-U", "postgres", database]);
  created = true;
  evidence.cleanup = "pending";
  const restored = sql(dump.stdout, "supabase_admin");
  await log("bootstrap.log", restored.stdout + restored.stderr);
  const cleared = sql(
    `drop schema if exists private cascade; drop schema public cascade; create schema public authorization pg_database_owner; grant usage on schema public to public,postgres,anon,authenticated,service_role; grant create on schema public to postgres;`,
    "supabase_admin",
  );
  await log("empty-application-schema.log", cleared.stdout + cleared.stderr);
  evidence.emptyApplication = sql(
    "select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')) || '|' || (select count(*) from auth.users) || '|' || (select count(*) from storage.objects);",
  ).stdout.trim();
  if (evidence.emptyApplication !== "0|0|0")
    throw new Error(
      "Disposable bootstrap is not empty: application objects/Auth users/Storage objects.",
    );
  for (const migration of evidence.migrations) {
    const content = await readFile(
      join(output, "migrations", migration.name),
      "utf8",
    );
    const result = sql(content);
    await log(`${migration.name}.log`, result.stdout + result.stderr);
    migration.applied = true;
    console.log(`Applied ${migration.name}`);
  }
  await log("seed.log", sql(seed.toString("utf8")).stdout);
  // Storage buckets are operator configuration, deliberately outside application migrations.
  // This isolated metadata fixture mirrors configure-private-storage.mjs; it uploads no bytes.
  const bucketSource = await readFile(
    join(root, "scripts/configure-private-storage.mjs"),
  );
  evidence.privateBucketConfiguration = {
    source: "scripts/configure-private-storage.mjs",
    sourceSha256: digest(bucketSource),
    mode: "disposable_database_metadata_fixture_only",
    bucket: "kafou-private-documents",
    public: false,
    fileSizeLimit: 524288,
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
  };
  await writeFile(
    join(output, "configure-private-storage.mjs.snapshot"),
    bucketSource,
    { mode: 0o600 },
  );
  await log(
    "private-bucket-fixture.log",
    sql(
      "insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('kafou-private-documents','kafou-private-documents',false,524288,array['application/pdf','image/png','image/jpeg']);",
      "supabase_admin",
    ).stdout,
  );

  await log(
    "test-extension.log",
    sql("create extension if not exists pgtap with schema extensions;").stdout,
  );
  // Credentials remain in process memory and child arguments only, never tool output or saved logs.
  password = docker(["printenv", "POSTGRES_PASSWORD"]).stdout.trim();
  if (!password)
    throw new Error(
      "Local database credential is unavailable for CLI verification.",
    );
  const url = `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:56322/${database}?sslmode=disable`;
  const tests = command(
    "supabase",
    ["test", "db", "--db-url", url, join(output, "tests")],
    undefined,
    true,
  );
  await log("pgtap.log", tests.stdout + tests.stderr);
  evidence.checks.push({
    check: "pgTAP snapshot suite",
    exitCode: tests.status,
    log: "pgtap.log",
  });
  console.log(
    `pgTAP exit ${tests.status}: ${redact(tests.stdout + tests.stderr).slice(-3500)}`,
  );
  const advisors = command(
    "supabase",
    [
      "db",
      "advisors",
      "--db-url",
      url,
      "--type",
      "all",
      "--level",
      "info",
      "--fail-on",
      "error",
      "--output",
      "json",
    ],
    undefined,
    true,
  );
  await log("advisors.log", advisors.stdout + advisors.stderr);
  evidence.checks.push({
    check: "CLI advisors all/info",
    exitCode: advisors.status,
    log: "advisors.log",
  });
  try {
    const findings = JSON.parse(advisors.stdout);
    evidence.advisorSummary = {
      total: findings.length,
      byLevel: {},
      byName: {},
    };
    for (const item of findings) {
      evidence.advisorSummary.byLevel[item.level] =
        (evidence.advisorSummary.byLevel[item.level] || 0) + 1;
      evidence.advisorSummary.byName[item.name] =
        (evidence.advisorSummary.byName[item.name] || 0) + 1;
    }
  } catch {
    evidence.advisorSummary = { parseError: true };
  }
  console.log(
    `Local CLI advisors exit ${advisors.status}; redacted results saved.`,
  );
  const lint = command(
    "supabase",
    [
      "db",
      "lint",
      "--db-url",
      url,
      "--schema",
      "public,private",
      "--level",
      "warning",
      "--fail-on",
      "error",
      "--output",
      "json",
    ],
    undefined,
    true,
  );
  await log("database-lint.log", lint.stdout + lint.stderr);
  evidence.checks.push({
    check: "CLI database lint",
    exitCode: lint.status,
    log: "database-lint.log",
  });
  try {
    const findings = JSON.parse(lint.stdout);
    evidence.lintSummary = {
      functions: findings.length,
      issues: findings.reduce((n, f) => n + f.issues.length, 0),
      byLevel: {},
    };
    for (const item of findings.flatMap((f) => f.issues))
      evidence.lintSummary.byLevel[item.level] =
        (evidence.lintSummary.byLevel[item.level] || 0) + 1;
  } catch {
    evidence.lintSummary = { parseError: true };
  }
  console.log(`Local CLI lint exit ${lint.status}; redacted results saved.`);
  // Actual concurrent transactions against only the disposable database.
  if (evidence.tests.some((t) => t.name === "events.sql")) {
    const fixture = (await readFile(join(output, "tests/events.sql"), "utf8"))
      .split("create function pg_temp.ev")[0]
      .replace("begin;", "")
      .replace("select no_plan();", "");
    sql(fixture);
    sql(
      "insert into public.academy_events(id,branch_id,venue_id,sport,level_id,age_group_id,document_id,title,starts_at,ends_at,capacity,created_by) values('fa600000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000002','swimming','fa200000-0000-4000-8000-000000000003','fa200000-0000-4000-8000-000000000004','fa200000-0000-4000-8000-000000000005','Synthetic last-place race',(current_date+9)::timestamptz+interval '8 hours',(current_date+9)::timestamptz+interval '10 hours',1,'fa100000-0000-4000-8000-000000000003');",
    );
    const racingSql = (parent, family, child) =>
      `begin;set local role authenticated;select set_config('request.jwt.claims','{"sub":"${parent}","role":"authenticated","aal":"aal1"}',true); select public.product_command('events.register','${JSON.stringify({ event_id: "fa600000-0000-4000-8000-000000000001", family_id: family, children: [{ child_id: child, document_id: "fa200000-0000-4000-8000-000000000005", accepted: true }] })}',gen_random_uuid());select pg_sleep(1);commit;`;
    const race = (input) =>
      new Promise((resolveRace, reject) => {
        const child = spawn(
          "docker",
          [
            "exec",
            "-i",
            container,
            "psql",
            "-X",
            "-U",
            "postgres",
            "-d",
            database,
            "-v",
            "ON_ERROR_STOP=1",
            "-At",
          ],
          { env },
        );
        let stdout = "",
          stderr = "";
        child.stdout.on("data", (s) => (stdout += s));
        child.stderr.on("data", (s) => (stderr += s));
        child.on("error", reject);
        child.on("close", (status) => resolveRace({ status, stdout, stderr }));
        child.stdin.end(input);
      });
    const races = await Promise.all([
      race(
        racingSql(
          "fa100000-0000-4000-8000-000000000001",
          "fa300000-0000-4000-8000-000000000001",
          "fa400000-0000-4000-8000-000000000001",
        ),
      ),
      race(
        racingSql(
          "fa100000-0000-4000-8000-000000000002",
          "fa300000-0000-4000-8000-000000000002",
          "fa400000-0000-4000-8000-000000000003",
        ),
      ),
    ]);
    const counts = sql(
      "select (select count(*) from public.event_registrations where event_id='fa600000-0000-4000-8000-000000000001' and status='registered')||'|'||(select count(*) from public.event_registration_batches where event_id='fa600000-0000-4000-8000-000000000001')||'|'||(select count(*) from public.event_consents c join public.event_registrations r on r.id=c.registration_id where r.event_id='fa600000-0000-4000-8000-000000000001');",
    ).stdout.trim();
    evidence.eventCapacityRace = {
      exitCodes: races.map((r) => r.status),
      activeRegistrationsBatchesConsents: counts,
      oneCapacityFailure:
        races.filter((r) =>
          r.stderr.includes(
            "Event capacity unavailable for the whole family selection",
          ),
        ).length === 1,
    };
    await log(
      "event-capacity-race.log",
      JSON.stringify(
        { summary: evidence.eventCapacityRace, transactions: races },
        null,
        2,
      ),
    );
    if (
      races.filter((r) => r.status === 0).length !== 1 ||
      counts !== "1|1|1" ||
      !evidence.eventCapacityRace.oneCapacityFailure
    )
      throw new Error(
        "Event capacity race did not preserve exactly one registration/batch/consent.",
      );
    console.log(
      "Concurrent last-place event race passed: one success, one capacity rejection, counts 1|1|1.",
    );
  }
  // Camp and ordinary class resource reservations contend in both directions.
  if (evidence.tests.some((t) => t.name === "event-camps.sql")) {
    const fixture = (
      await readFile(join(output, "tests/event-camps.sql"), "utf8")
    )
      .split("create function pg_temp.ev")[0]
      .replace("begin;", "")
      .replace("select no_plan();", "");
    sql(fixture);
    const runner = await readFile(
      join(root, "scripts/verify-camp-resources.py"),
    );
    evidence.campRaceSources = {
      fixtureSha256: digest(fixture),
      runnerSha256: digest(runner),
    };
    await writeFile(join(output, "camp-concurrency.sql"), fixture, {
      mode: 0o600,
    });
    await writeFile(join(output, "verify-camp-resources.py"), runner, {
      mode: 0o600,
    });
    const race = command(
      "python3",
      [join(output, "verify-camp-resources.py"), database],
      undefined,
      true,
    );
    await log("camp-resource-races.log", race.stdout + race.stderr);
    evidence.checks.push({
      check:
        "Bidirectional camp/class resource contention with observed advisory wait",
      exitCode: race.status,
      log: "camp-resource-races.log",
    });
    if (race.status !== 0)
      throw new Error("Camp/class resource race failed; see saved evidence.");
    evidence.campResourceRaces = race.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    console.log(
      "Camp/class venue/coach reservation races passed in both orders with observed advisory waits.",
    );
  }
  // Partial reversal uniqueness was replaced by a bounded ledger; exercise real contention.
  if (evidence.tests.some((t) => t.name === "commercial-amendments.sql")) {
    const fixture = (
      await readFile(join(output, "tests/commercial-amendments.sql"), "utf8")
    )
      .split("select lives_ok")[0]
      .replace("begin;", "")
      .replace("select no_plan();", "");
    sql(fixture);
    const runner = await readFile(
      join(root, "scripts/verify-commercial-corrections.py"),
    );
    evidence.commercialRaceSources = {
      fixtureSha256: digest(fixture),
      runnerSha256: digest(runner),
    };
    await writeFile(join(output, "commercial-concurrency.sql"), fixture, {
      mode: 0o600,
    });
    await writeFile(join(output, "verify-commercial-corrections.py"), runner, {
      mode: 0o600,
    });
    const race = command(
      "python3",
      [join(output, "verify-commercial-corrections.py"), database],
      undefined,
      true,
    );
    await log("commercial-correction-races.log", race.stdout + race.stderr);
    evidence.checks.push({
      check:
        "Competing partial reversals and refunds never exceed the received payment",
      exitCode: race.status,
      log: "commercial-correction-races.log",
    });
    if (race.status !== 0)
      throw new Error("Commercial correction race failed; see saved evidence.");
    evidence.commercialCorrectionRaces = race.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    console.log(
      "Partial allocation reversal/refund races preserved exact money under real contention.",
    );
  }
  // Competing booking types contend on the same capacity-one session in both orders.
  const raceFixture = await readFile(
    join(root, "tests/fixtures/schedule-concurrency.sql"),
  );
  const raceRunner = await readFile(
    join(root, "scripts/verify-schedule-capacity.py"),
  );
  evidence.scheduleRaceSources = {
    fixtureSha256: digest(raceFixture),
    runnerSha256: digest(raceRunner),
  };
  await writeFile(join(output, "schedule-concurrency.sql"), raceFixture, {
    mode: 0o600,
  });
  await writeFile(join(output, "verify-schedule-capacity.py"), raceRunner, {
    mode: 0o600,
  });
  sql(raceFixture.toString("utf8"));
  const crossRace = command(
    "python3",
    [join(output, "verify-schedule-capacity.py"), database],
    undefined,
    true,
  );
  await log(
    "trial-makeup-capacity-races.log",
    crossRace.stdout + crossRace.stderr,
  );
  evidence.checks.push({
    check:
      "Trial versus makeup races in both orders with observed advisory wait",
    exitCode: crossRace.status,
    log: "trial-makeup-capacity-races.log",
  });
  if (crossRace.status !== 0)
    throw new Error(
      "Cross-type trial/makeup capacity race failed; see redacted private log.",
    );
  evidence.trialMakeupCapacityRaces = crossRace.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  console.log(
    "Trial/makeup competing last-place races passed in both orders with observed advisory lock waits.",
  );

  evidence.postTestCounts = sql(
    "select json_build_object('auth_users',(select count(*) from auth.users),'families',(select count(*) from public.families),'children',(select count(*) from public.children),'branches',(select count(*) from public.branches),'storage_objects',(select count(*) from storage.objects))::text;",
  ).stdout.trim();
  evidence.result =
    tests.status === 0 && advisors.status === 0 && lint.status === 0
      ? "replay_and_checks_passed"
      : "replay_passed_check_failures";
} catch (error) {
  evidence.result = "failed";
  evidence.error = redact(error instanceof Error ? error.message : error);
  console.error(evidence.error);
  process.exitCode = 1;
} finally {
  for (const [directory, records] of [
    ["supabase/migrations", evidence.migrations],
    ["tests/database", evidence.tests],
  ]) {
    const current = (await readdir(join(root, directory)))
      .filter((n) => n.endsWith(".sql"))
      .sort();
    for (const file of current) {
      const known = records.find((r) => r.name === file);
      const sha = digest(await readFile(join(root, directory, file)));
      if (!known || sha !== known.sha256)
        evidence.drift.push({
          path: `${directory}/${file}`,
          currentSha256: sha,
          snapshotSha256: known?.sha256 || null,
        });
    }
    for (const record of records)
      if (!current.includes(record.name))
        evidence.drift.push({
          path: `${directory}/${record.name}`,
          removed: true,
        });
  }
  if (created) {
    const cleanup = docker(
      ["dropdb", "-U", "postgres", database],
      undefined,
      true,
    );
    evidence.cleanup =
      cleanup.status === 0 ? "disposable_database_dropped" : "drop_failed";
    if (cleanup.status !== 0) {
      await log("cleanup.log", cleanup.stdout + cleanup.stderr);
      process.exitCode = 1;
    }
  }
  evidence.finishedAt = new Date().toISOString();
  await log("evidence.json", JSON.stringify(evidence, null, 2));
  console.log(`Evidence saved: ${output}/evidence.json`);
  console.log(
    `Result: ${evidence.result}; cleanup: ${evidence.cleanup}; changed/new source files during run: ${evidence.drift.length}`,
  );
  if (evidence.result !== "replay_and_checks_passed") process.exitCode = 1;
}
