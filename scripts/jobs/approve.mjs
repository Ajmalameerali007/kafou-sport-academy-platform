/** Guarded operator approval using an EXISTING real owner AAL2 token. No passwords, elevation or cron installation. */
import { createClient } from "@supabase/supabase-js";
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(
    "Usage: node --env-file=<private-file> scripts/jobs/approve.mjs --local|--staging --branch=<uuid> [--approve|--pause --confirm-synthetic-staging --reason=<review-reason>]\nDefault: read-only checks. Requires SUPABASE_PUBLISHABLE_KEY and KAFOU_OWNER_ACCESS_TOKEN from an existing real AAL2 session. Never use a service key, fabricated JWT, or password. No cron schedule is created.",
  );
  process.exit(0);
}
const mode = args.includes("--local")
  ? "local"
  : args.includes("--staging")
    ? "staging"
    : null;
const branch = args.find((a) => a.startsWith("--branch="))?.slice(9);
const reason = args.find((a) => a.startsWith("--reason="))?.slice(9);
const approve = args.includes("--approve"),
  pause = args.includes("--pause");
const allowed = [
  "--local",
  "--staging",
  "--approve",
  "--pause",
  "--confirm-synthetic-staging",
];
if (
  !mode ||
  (args.includes("--local") && args.includes("--staging")) ||
  (approve && pause) ||
  args.some(
    (a) =>
      !allowed.includes(a) &&
      !a.startsWith("--branch=") &&
      !a.startsWith("--reason="),
  ) ||
  !/^[0-9a-f-]{36}$/.test(branch || "")
)
  throw Error("Explicit target and branch required; use --help");
if (
  (approve || pause) &&
  (!args.includes("--confirm-synthetic-staging") ||
    !reason ||
    reason.trim().length < 8 ||
    reason.trim().length > 300)
)
  throw Error(
    "Mutation requires explicit synthetic acknowledgement and reviewed reason",
  );
const url =
  mode === "local"
    ? "http://127.0.0.1:56321"
    : "https://cwdazidovxqeevmpicng.supabase.co";
const ref = mode === "local" ? "kafou-local" : "cwdazidovxqeevmpicng";
if (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== url)
  throw Error("Configured URL differs from the exact selected environment");
const key = process.env.SUPABASE_PUBLISHABLE_KEY,
  token = process.env.KAFOU_OWNER_ACCESS_TOKEN;
if (!key || key.startsWith("sb_secret_") || !token)
  throw Error(
    "Publishable key and existing real owner AAL2 access token required",
  );
function claims(value) {
  try {
    return JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString());
  } catch {
    return {};
  }
}
if (key.startsWith("ey") && claims(key).role !== "anon")
  throw Error("Service or privileged API keys are prohibited");
const jwt = claims(token);
if (
  jwt.iss !== `${url}/auth/v1` ||
  jwt.aal !== "aal2" ||
  jwt.role !== "authenticated" ||
  jwt.exp * 1000 <= Date.now()
)
  throw Error(
    "Current AAL2 token from this exact project required; no session elevation is performed",
  );
const db = createClient(url, key, {
  global: { headers: { Authorization: `Bearer ${token}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});
const verified = await db.auth.getUser(token);
if (verified.error || !verified.data.user)
  throw Error("Provider rejected the owner session");
const { data: account, error: accountError } = await db.rpc("account_context");
if (
  accountError ||
  !account?.roles?.includes("super_admin") ||
  account.active === false
)
  throw Error("Current database-backed owner authority required");
const { data: record, error } = await db
  .from("branches")
  .select("id,synthetic,active,provisional")
  .eq("id", branch)
  .single();
if (
  error ||
  !record ||
  !record.synthetic ||
  (approve && (!record.active || record.provisional))
)
  throw Error(
    "Protected synthetic branch provenance and current eligibility required",
  );
if (approve || pause) {
  const result = await db.rpc("scheduler_configure", {
    p_branch: branch,
    p_enabled: approve,
    p_target: ref,
    p_reason: reason.trim(),
  });
  if (result.error)
    throw Error(
      `Owner approval rejected (${result.error.code || "unknown"}); no secrets or raw provider details logged`,
    );
  console.log(
    JSON.stringify({
      target: ref,
      branch,
      approval: result.data,
      enabled: approve,
      cronInstalled: false,
    }),
  );
} else
  console.log(
    JSON.stringify({
      target: ref,
      branch,
      checked: true,
      mutation: false,
      cronInstalled: false,
    }),
  );
