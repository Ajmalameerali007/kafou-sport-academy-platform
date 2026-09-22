// Explicit local-demo exception; never a migration or hosted deployment step.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const mode = process.argv[2];
if (!["enable", "disable"].includes(mode)) throw Error("Use enable or disable");
const keys = JSON.parse(
  readFileSync("outputs/foundation/local-keys.json", "utf8"),
);
if (keys.API_URL !== "http://127.0.0.1:56321")
  throw Error("Exact local target required");
const container = "supabase_db_kafou-local";
function sql(query) {
  const result = spawnSync(
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
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: query, encoding: "utf8" },
  );
  if (result.status !== 0) throw Error(result.stderr || "Local SQL failed");
  return result.stdout.trim();
}
const backup = "outputs/foundation/local-demo-mfa-original.sql";
if (mode === "disable") {
  if (!existsSync(backup)) throw Error("No local override backup exists");
  sql(
    `begin;\n${readFileSync(backup, "utf8")}\ndrop function if exists private.local_demo_mfa_exempt();\ncommit;`,
  );
  console.log("Local demo MFA requirement restored.");
  process.exit(0);
}
const owner = sql(
  `select p.id from public.profiles p join auth.users u on u.id=p.id where p.synthetic and p.active and u.email='admin.kafou@example.com' and exists(select 1 from public.role_assignments r where r.user_id=p.id and r.role='super_admin');`,
);
if (!/^[a-f0-9-]{36}$/.test(owner))
  throw Error("One active synthetic local owner required");
if (!existsSync(backup)) {
  const original = sql(
    `select pg_get_functiondef(p.oid) || ';' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='private' and p.proname in ('mfa_ready','head_office','super_admin')) or (n.nspname='public' and p.proname='account_context') order by n.nspname,p.proname;`,
  );
  if ((original.match(/CREATE OR REPLACE FUNCTION/g) || []).length !== 4)
    throw Error("Expected four existing security functions");
  mkdirSync("outputs/foundation", { recursive: true });
  writeFileSync(backup, original + "\n", { mode: 0o600 });
}
sql(`begin;
create or replace function private.local_demo_mfa_exempt() returns boolean language sql stable security definer set search_path='' as $$
select auth.uid()='${owner}'::uuid and exists(select 1 from public.profiles where id=auth.uid() and active and synthetic) and private.has_role(array['super_admin']::public.academy_role[])
$$;
revoke all on function private.local_demo_mfa_exempt() from public,anon;
grant execute on function private.local_demo_mfa_exempt() to authenticated,service_role;
create or replace function private.mfa_ready() returns boolean language sql stable security definer set search_path='' as $$
select not exists(select 1 from public.role_assignments where user_id=auth.uid() and role='super_admin') or auth.jwt()->>'aal'='aal2' or private.local_demo_mfa_exempt()
$$;
create or replace function private.head_office() returns boolean language sql stable security definer set search_path='' as $$
select private.has_role(array['admin','super_admin']::public.academy_role[]) and (not private.has_role(array['super_admin']::public.academy_role[]) or auth.jwt()->>'aal'='aal2' or private.local_demo_mfa_exempt())
$$;
create or replace function private.super_admin() returns boolean language sql stable security definer set search_path='' as $$
select private.has_role(array['super_admin']::public.academy_role[]) and (auth.jwt()->>'aal'='aal2' or private.local_demo_mfa_exempt())
$$;
create or replace function public.account_context() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('userId',auth.uid(),'active',p.active,'name',p.name,'roles',coalesce((select jsonb_agg(role) from public.role_assignments where user_id=auth.uid()),'[]'),'branchIds',coalesce((select jsonb_agg(branch_id) from public.branch_permissions where user_id=auth.uid()),'[]'),'aal',coalesce(auth.jwt()->>'aal','aal1'),'localDemoMfaExempt',private.local_demo_mfa_exempt()) from public.profiles p where p.id=auth.uid()
$$;
commit;`);
console.log(
  "Authenticator requirement removed for the verified local synthetic owner only. Real AAL and role checks retained.",
);
