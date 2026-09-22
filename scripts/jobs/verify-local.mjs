/** Disposable LOCAL-only scheduler concurrency + actual pg_cron proof. No credentials or hosted calls. */
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const container = "supabase_db_kafou-local";
const database = `kafou_jobs_${Date.now()}_${process.pid}`;
const cronName = `kafou-jobs-proof-${process.pid}`;
const output = `outputs/jobs/${new Date().toISOString().replace(/[:.]/g, "-")}`;
await mkdir(output, { recursive: true, mode: 0o700 });
const evidence = {
  startedAt: new Date().toISOString(),
  database,
  scope: "Disposable local database only; temporary local pg_cron",
  checks: [],
  result: "incomplete",
  cleanup: "pending",
};
function docker(args, input) {
  const r = spawnSync(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    { input, encoding: "utf8", maxBuffer: 100 * 1024 * 1024, timeout: 120000 },
  );
  if (r.status !== 0)
    throw new Error(`${args[0]} failed: ${String(r.stderr).slice(-1200)}`);
  return r.stdout;
}
function sql(query, db = database, user = "supabase_admin") {
  return docker(
    ["psql", "-X", "-U", user, "-d", db, "-v", "ON_ERROR_STOP=1", "-At"],
    query,
  ).trim();
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function assert(condition, label) {
  if (!condition) throw new Error(label);
  evidence.checks.push(label);
  console.log(label);
}
let created = false,
  installed = false,
  job = null;
try {
  evidence.migrationSha256 = createHash("sha256")
    .update(
      await readFile(
        "supabase/migrations/20260920020648_product_durable_jobs.sql",
      ),
    )
    .digest("hex");
  const schema = docker([
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "--schema-only",
    "--no-owner",
  ]);
  docker(["createdb", "-U", "postgres", database]);
  created = true;
  sql(schema, database, "supabase_admin");
  sql(`insert into public.organizations(slug,name) values('kafou','Synthetic cron proof');
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values(md5('jobs-proof-owner')::uuid,'jobs-proof-owner@example.test','{"name":"Synthetic cron owner"}',now()),(md5('jobs-proof-parent')::uuid,'jobs-proof-parent@example.test','{"name":"Synthetic cron parent"}',now());
update public.profiles set synthetic=true where id in(md5('jobs-proof-owner')::uuid,md5('jobs-proof-parent')::uuid);
insert into public.role_assignments values(md5('jobs-proof-owner')::uuid,'super_admin');
insert into public.branches(id,slug,name,provisional,synthetic) values(md5('jobs-proof-branch')::uuid,'jobs-proof-branch','Synthetic cron branch',false,true);
insert into public.families(id,name,synthetic) values(md5('jobs-proof-family')::uuid,'Synthetic cron family',true);
insert into public.guardians values(md5('jobs-proof-family')::uuid,md5('jobs-proof-parent')::uuid);
insert into public.family_branches values(md5('jobs-proof-family')::uuid,md5('jobs-proof-branch')::uuid);
-- Direct immutable synthetic fixture approval: no real user is impersonated. Real MFA approval authorization is tested separately by pgTAP.
insert into private.scheduled_job_controls(branch_id,target_ref,enabled,approved_by,reason) values(md5('jobs-proof-branch')::uuid,'kafou-local',true,md5('jobs-proof-owner')::uuid,'Disposable local scheduler verification fixture');
insert into public.communication_templates(id,name,language,purpose,subject,body,version,created_by) values(md5('jobs-proof-template')::uuid,'Cron proof','en','operational','Synthetic cron proof','A synthetic local-only notification.',1,md5('jobs-proof-owner')::uuid);
insert into public.communication_batches(id,template_id,branch_id,scheduled_at,created_by) values(md5('jobs-proof-race')::uuid,md5('jobs-proof-template')::uuid,md5('jobs-proof-branch')::uuid,now(),md5('jobs-proof-owner')::uuid);
insert into public.communication_recipients(batch_id,family_id,user_id) values(md5('jobs-proof-race')::uuid,md5('jobs-proof-family')::uuid,md5('jobs-proof-parent')::uuid);`);
  let firstOutput = "";
  const first = spawn(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-U",
      "supabase_admin",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  first.stdout.on("data", (chunk) => {
    firstOutput += chunk;
  });
  const firstDone = new Promise((resolve, reject) => {
    first.on("error", reject);
    first.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("First concurrent worker failed")),
    );
  });
  first.stdin.end(
    "begin; select pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0)); select 'LOCKED'; select pg_sleep(2); select private.run_scheduled_jobs('kafou-local',20); commit;",
  );
  const barrier = Date.now() + 10000;
  while (!firstOutput.includes("LOCKED") && Date.now() < barrier)
    await sleep(50);
  assert(
    firstOutput.includes("LOCKED"),
    "Actual first connection holds shared operational lock",
  );
  const second = JSON.parse(
    sql("select private.run_scheduled_jobs('kafou-local',20);"),
  );
  assert(
    second.status === "busy" && second.processed === 0,
    "Concurrent worker returns busy without duplicate discovery/effects",
  );
  await firstDone;
  assert(
    sql("select count(*) from public.notifications;") === "1",
    "One notification after concurrent worker completion",
  );
  assert(
    JSON.parse(sql("select private.run_scheduled_jobs('kafou-local',20);"))
      .processed === 0,
    "Post-commit retry is durable and idempotent",
  );
  sql(`insert into public.communication_batches(id,template_id,branch_id,scheduled_at,created_by) values(md5('jobs-proof-cron')::uuid,md5('jobs-proof-template')::uuid,md5('jobs-proof-branch')::uuid,now(),md5('jobs-proof-owner')::uuid);
insert into public.communication_recipients(batch_id,family_id,user_id) values(md5('jobs-proof-cron')::uuid,md5('jobs-proof-family')::uuid,md5('jobs-proof-parent')::uuid);`);
  const existed =
    sql(
      "select exists(select 1 from pg_extension where extname='pg_cron');",
      "postgres",
    ) === "t";
  if (!existed) {
    sql("create extension pg_cron;", "postgres", "supabase_admin");
    installed = true;
  }
  job = sql(
    `select cron.schedule_in_database('${cronName}','5 seconds',$job$select private.run_scheduled_jobs('kafou-local',20);$job$,'${database}','supabase_admin');`,
    "postgres",
  );
  assert(
    /^\d+$/.test(job),
    "Temporary local pg_cron schedule installed for disposable database only",
  );
  const deadline = Date.now() + 45000;
  let actual = 0;
  while (Date.now() < deadline) {
    actual = Number(
      sql(
        "select count(*) from public.notifications n join public.product_events e on e.id=n.event_id where e.entity_id=md5('jobs-proof-cron')::uuid;",
      ),
    );
    if (actual === 1) break;
    await sleep(500);
  }
  assert(
    actual === 1,
    "Actual autonomous pg_cron execution produced the due in-app notification",
  );
  await sleep(5500);
  assert(
    sql(
      "select count(*) from public.notifications n join public.product_events e on e.id=n.event_id where e.entity_id=md5('jobs-proof-cron')::uuid;",
    ) === "1",
    "Second real cron interval does not duplicate delivery",
  );
  evidence.cronRuns = JSON.parse(
    sql(
      `select coalesce(json_agg(x),'[]') from(select status,start_time,end_time from cron.job_run_details where jobid=${job} order by start_time) x;`,
      "postgres",
    ),
  );
  assert(
    evidence.cronRuns.filter((r) => r.status === "succeeded").length >= 2,
    "Provider execution history confirms at least two successful cron intervals",
  );
  assert(
    sql(
      "select count(*) from public.delivery_outbox where status<>'not_configured' or attempts<>0;",
    ) === "0",
    "All external outbox channels remain disabled with zero send attempts",
  );
  assert(
    sql(
      "select count(*) from public.product_events where actor_id is not null;",
    ) === "0",
    "Autonomous events retain system actor; no forged human session",
  );
  assert(
    createHash("sha256")
      .update(
        await readFile(
          "supabase/migrations/20260920020648_product_durable_jobs.sql",
        ),
      )
      .digest("hex") === evidence.migrationSha256,
    "Migration source stayed unchanged during autonomous verification",
  );
  evidence.result = "passed";
} catch (error) {
  evidence.error = String(error.message);
  evidence.result = "failed";
  process.exitCode = 1;
} finally {
  if (job) sql(`select cron.unschedule(${job});`, "postgres");
  if (installed) {
    if (sql("select count(*) from cron.job;", "postgres") === "0") {
      sql("drop extension pg_cron;", "postgres", "supabase_admin");
      evidence.cronCleanup = "temporary extension removed";
    } else
      evidence.cronCleanup =
        "extension retained because another operator installed a job";
  }
  if (created) {
    sql(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname='${database}' and pid<>pg_backend_pid();`,
      "postgres",
    );
    docker(["dropdb", "-U", "postgres", database]);
  }
  evidence.cleanup =
    sql(
      `select exists(select 1 from pg_database where datname='${database}');`,
      "postgres",
    ) === "f"
      ? "disposable database removed"
      : "FAILED";
  evidence.finishedAt = new Date().toISOString();
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(evidence, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      result: evidence.result,
      checks: evidence.checks.length,
      cleanup: evidence.cleanup,
      output,
      error: evidence.error,
    }),
  );
}
