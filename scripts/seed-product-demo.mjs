// Guarded additive synthetic fixtures. No account, password, role or existing record resets.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
} from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const LOCAL = "http://127.0.0.1:56321";
const STAGING = "https://cwdazidovxqeevmpicng.supabase.co";
const actors = [
  ["super_admin", "admin"],
  ["admin", "headoffice"],
  ["branch", "branch"],
  ["sales", "sales"],
  ["coach", "coach"],
  ["parent", "parent"],
];
export const help = `Usage: node --env-file=.env.test.private scripts/seed-product-demo.mjs [--batch=NAME]\nHosted staging requires both --hosted --confirm-synthetic-staging.\nRequired: KAFOU_DEMO_PASSWORD. Credentials: SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY, or the existing private local/staging key file.\nOnly localhost:56321 or the exact synthetic staging reference is accepted. Existing six demo accounts must already exist and be marked synthetic. No account credentials, roles, or branch scopes are changed.\nRun scripts/product-walkthrough.mjs with the same batch afterward. Optional KAFOU_PRODUCT_APP_URL enables authenticated app/PDF checks.`;
export function fixtureId(namespace) {
  const s = createHash("sha256").update(namespace).digest("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}
export function safeError(label, error) {
  const code = String(error?.code ?? error?.status ?? "service_error")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 50);
  return new Error(`${label} failed (${code})`);
}
export async function unwrap(query, label) {
  const result = await query;
  if (result.error) throw safeError(label, result.error);
  return result.data;
}
export function loadFixtureConfig(
  args = process.argv.slice(2),
  needsSecret = true,
) {
  for (const arg of args)
    if (
      !["--hosted", "--confirm-synthetic-staging", "--help"].includes(arg) &&
      !arg.startsWith("--batch=")
    )
      throw new Error("Unsupported argument; use --help");
  const hosted = args.includes("--hosted");
  if (hosted && !args.includes("--confirm-synthetic-staging"))
    throw new Error("Hosted mode requires --confirm-synthetic-staging");
  const url =
    process.env.SUPABASE_URL ||
    process.env.KAFOU_PRODUCT_SUPABASE_URL ||
    (hosted ? STAGING : LOCAL);
  if (url !== (hosted ? STAGING : LOCAL))
    throw new Error(
      "Target rejected: exact local port or acknowledged synthetic staging URL required",
    );
  const batch =
    args.find((x) => x.startsWith("--batch="))?.slice(8) ||
    `connected-${new Date().toISOString().slice(0, 10)}`;
  if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(batch))
    throw new Error(
      "Batch must use at most 50 lowercase letters, digits and hyphens",
    );
  const password = process.env.KAFOU_DEMO_PASSWORD;
  if (!password)
    throw new Error(
      "KAFOU_DEMO_PASSWORD must be supplied privately; no writes performed",
    );
  let pub =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  let secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pub || (needsSecret && !secret)) {
    let keys;
    try {
      keys = JSON.parse(
        readFileSync(
          process.env.KAFOU_SUPABASE_KEYS_FILE ||
            (hosted
              ? "outputs/foundation/keys.json"
              : "outputs/foundation/local-keys.json"),
          "utf8",
        ),
      );
    } catch {
      throw new Error("Private Supabase key configuration could not be read");
    }
    if (hosted) {
      const records = Array.isArray(keys)
        ? keys
        : keys.keys || keys.api_keys || [];
      pub ||= records.find((x) => x.type === "publishable")?.api_key;
      secret ||= records.find((x) => x.type === "secret")?.api_key;
    } else {
      if (keys.API_URL !== LOCAL)
        throw new Error("Local private key file belongs to another target");
      pub ||= keys.PUBLISHABLE_KEY || keys.ANON_KEY;
      secret ||= keys.SECRET_KEY || keys.SERVICE_ROLE_KEY;
    }
  }
  if (!pub || (needsSecret && !secret))
    throw new Error("Required Supabase credentials are unavailable");
  const directory = resolve("outputs/product");
  const file = resolve(
    directory,
    `${hosted ? "staging" : "local"}-${batch}.json`,
  );
  return { url, pub, secret, password, hosted, batch, directory, file };
}
export function clientFor(config, key = config.pub) {
  return createClient(config.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
export function saveFixture(file, data) {
  mkdirSync(resolve(file, ".."), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, file);
}
export function readFixture(config) {
  let data;
  try {
    data = JSON.parse(readFileSync(config.file, "utf8"));
  } catch {
    throw new Error("Run guarded seed-product-demo.mjs for this batch first");
  }
  if (
    data.url !== config.url ||
    data.batch !== config.batch ||
    data.version !== 1
  )
    throw new Error("Fixture manifest target or version mismatch");
  return data;
}
export async function signInActor(config, account) {
  const client = clientFor(config);
  const response = await client.auth.signInWithPassword({
    email: account.email,
    password: config.password,
  });
  if (response.error)
    throw safeError(`Authenticate ${account.role}`, response.error);
  if (response.data.user?.id !== account.id)
    throw new Error(`Account identity mismatch for ${account.role}`);
  const context = await unwrap(
    client.rpc("account_context"),
    `Read ${account.role} context`,
  );
  if (!context?.active || !context.roles?.includes(account.role))
    throw new Error(`Active ${account.role} role is required`);
  return { client, context };
}
// Setup only: an additional synthetic, unstarted trial occurrence. Attendance and booking
// are deliberately left to separately authenticated users in the walkthrough.
export async function prepareTrialOccurrence(config, fixture) {
  const privilegedConfig = loadFixtureConfig(process.argv.slice(2), true);
  if (
    privilegedConfig.url !== config.url ||
    privilegedConfig.batch !== fixture.batch
  )
    throw new Error("Trial fixture target mismatch");
  const db = clientFor(privilegedConfig, privilegedConfig.secret);
  const id = fixtureId(
    `${config.url}/${config.batch}/session-conversion-trial`,
  );
  const existing = await unwrap(
    db.from("class_sessions").select("*").eq("id", id).maybeSingle(),
    "Read synthetic trial occurrence",
  );
  if (existing) {
    if (existing.class_id !== fixture.ids.class)
      throw new Error("Trial fixture class mismatch");
    return existing;
  }
  const cls = await unwrap(
    db.from("academy_classes").select("*").eq("id", fixture.ids.class).single(),
    "Read synthetic trial class",
  );
  if (
    !cls.synthetic ||
    cls.coach_id !== fixture.accounts.coach.id ||
    cls.branch_id !== fixture.branchId
  )
    throw new Error("Synthetic trial class required");
  const start = new Date(Date.now() + 20000),
    end = new Date(start.getTime() + 30 * 60000);
  const classes = await unwrap(
    db.from("academy_classes").select("id").eq("coach_id", cls.coach_id),
    "Read trial coach schedule",
  );
  const conflicts = await unwrap(
    db
      .from("class_sessions")
      .select("id")
      .in(
        "class_id",
        classes.map((row) => row.id),
      )
      .neq("status", "cancelled")
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString()),
    "Check trial fixture conflict",
  );
  if (conflicts.length)
    throw new Error(
      "A current coach session prevents a safe immediate synthetic trial; existing times were not changed",
    );
  const session = await unwrap(
    db
      .from("class_sessions")
      .insert({
        id,
        class_id: cls.id,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        capacity: cls.capacity,
      })
      .select()
      .single(),
    "Create unstarted synthetic trial occurrence",
  );
  await unwrap(
    db.from("audit_events").insert({
      actor_id: null,
      action: "SYNTHETIC_TRIAL_FIXTURE_SETUP",
      entity: "class_sessions",
      entity_id: id,
      new_value: {
        batch: config.batch,
        source: "guarded_service_role_seed",
        synthetic: true,
        starts_at: session.starts_at,
      },
    }),
    "Audit synthetic trial fixture",
  );
  return session;
}
export async function seedProductDemo() {
  if (process.argv.includes("--help")) {
    console.log(help);
    return;
  }
  const config = loadFixtureConfig();
  const db = clientFor(config, config.secret);
  const listed = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listed.error)
    throw safeError("Read existing demo accounts", listed.error);
  const accounts = {};
  for (const [role, label] of actors) {
    const user = listed.data.users.find(
      (u) => u.email === `${label}.kafou@example.com`,
    );
    if (!user || !user.email_confirmed_at)
      throw new Error(`Existing verified ${role} demo account required`);
    const profile = await unwrap(
      db
        .from("profiles")
        .select("id,synthetic,active")
        .eq("id", user.id)
        .single(),
      `Read ${role} synthetic marker`,
    );
    const roles = await unwrap(
      db.from("role_assignments").select("role").eq("user_id", user.id),
      `Read ${role} grants`,
    );
    if (
      !profile.synthetic ||
      !profile.active ||
      !roles.some((r) => r.role === role)
    )
      throw new Error(
        `Refusing to change non-synthetic or incorrectly configured ${role} account`,
      );
    accounts[role] = { id: user.id, email: user.email, role };
  }
  // Verify supplied credentials before fixture writes; never change them to make authentication pass.
  const verified = await Promise.all(
    Object.values(accounts).map((a) => signInActor(config, a)),
  );
  await Promise.all(
    verified.map(({ client }) => client.auth.signOut({ scope: "local" })),
  );
  const branch = await unwrap(
    db
      .from("branches")
      .select("*")
      .eq("slug", "demo-dubai")
      .eq("synthetic", true)
      .eq("active", true)
      .single(),
    "Read existing synthetic branch",
  );
  for (const role of ["branch", "sales", "coach"]) {
    const scopes = await unwrap(
      db
        .from("branch_permissions")
        .select("branch_id")
        .eq("user_id", accounts[role].id)
        .eq("branch_id", branch.id),
      `Read ${role} branch scope`,
    );
    if (!scopes.length)
      throw new Error(
        `Existing ${role} demo branch scope required; no permission replacement performed`,
      );
  }
  const family = await unwrap(
    db
      .from("families")
      .select("*")
      .eq("name", "DEMO · Family")
      .eq("synthetic", true)
      .single(),
    "Read existing synthetic family",
  );
  const guardian = await unwrap(
    db
      .from("guardians")
      .select("family_id")
      .eq("family_id", family.id)
      .eq("user_id", accounts.parent.id),
    "Verify existing parent guardianship",
  );
  if (!guardian.length)
    throw new Error("Existing demo parent must own the synthetic family");
  const level = await unwrap(
    db
      .from("sport_levels")
      .select("*")
      .eq("sport", "swimming")
      .eq("name", "DEMO · swimming beginner")
      .eq("active", true)
      .single(),
    "Read synthetic starting level",
  );
  let manifest = existsSync(config.file)
    ? readFixture(config)
    : {
        version: 1,
        url: config.url,
        batch: config.batch,
        createdAt: new Date().toISOString(),
        status: "preparing",
        accounts,
        branchId: branch.id,
        familyId: family.id,
        levelId: level.id,
        ids: {},
      };
  if (
    manifest.branchId !== branch.id ||
    manifest.familyId !== family.id ||
    Object.keys(accounts).some(
      (role) => manifest.accounts[role]?.id !== accounts[role].id,
    )
  )
    throw new Error("Existing manifest belongs to different demo identities");
  const anchor = new Date(manifest.createdAt),
    prefix = `DEMO PRODUCT · ${config.batch}`;
  const id = (type) => fixtureId(`${config.url}/${config.batch}/${type}`);
  const ensure = async (table, key, record) => {
    const old = await unwrap(
      db.from(table).select("*").eq("id", key).maybeSingle(),
      `Inspect ${table}`,
    );
    if (old) {
      for (const [field, value] of Object.entries(record)) {
        // Occurrences may have been legitimately moved/resized through the app.
        // Keep their history and current values; verify the owning class below.
        if (
          table === "class_sessions" &&
          ["starts_at", "ends_at", "capacity"].includes(field)
        )
          continue;
        let equal = JSON.stringify(old[field]) === JSON.stringify(value);
        if (field.endsWith("_at") && value)
          equal = Date.parse(old[field]) === Date.parse(value);
        if (!equal)
          throw new Error(
            `Existing ${table} fixture differs at ${field}; refusing to overwrite`,
          );
      }
      return old;
    }
    return unwrap(
      db
        .from(table)
        .insert({ id: key, ...record })
        .select()
        .single(),
      `Create synthetic ${table}`,
    );
  };
  saveFixture(config.file, manifest);
  const birth = new Date(anchor);
  birth.setUTCFullYear(birth.getUTCFullYear() - 7);
  const child = await ensure("children", id("child"), {
    family_id: family.id,
    name: `${prefix} · Child`,
    dob: birth.toISOString().slice(0, 10),
    synthetic: true,
  });
  await ensure("child_sports", id("child-sport"), {
    child_id: child.id,
    sport: "swimming",
    level_id: level.id,
    level: level.name,
    status: "reviewed",
  });
  const age = await ensure("age_groups", id("age"), {
    name: `${prefix} · Ages 5–10`,
    min_age: 5,
    max_age: 10,
  });
  const venue = await ensure("venues", id("venue"), {
    branch_id: branch.id,
    name: `${prefix} · Synthetic pool`,
    address: "Synthetic demonstration only; not a real KAFOU venue",
    operating_information: "Owner-only staging fixture",
  });
  const cls = await ensure("academy_classes", id("class"), {
    branch_id: branch.id,
    venue_id: venue.id,
    coach_id: accounts.coach.id,
    sport: "swimming",
    level_id: level.id,
    age_group_id: age.id,
    name: `${prefix} · Swimming`,
    capacity: 8,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    local_time: "16:00:00",
    duration_minutes: 30,
    synthetic: true,
  });
  if (!manifest.schedule) {
    const classes = await unwrap(
      db.from("academy_classes").select("id").eq("coach_id", accounts.coach.id),
      "Read coach schedule scope",
    );
    const occupied = await unwrap(
      db
        .from("class_sessions")
        .select("starts_at,ends_at")
        .in(
          "class_id",
          classes.map((c) => c.id),
        )
        .neq("status", "cancelled")
        .gt(
          "ends_at",
          `${anchor.toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })}T00:00:00+04:00`,
        )
        .lte(
          "starts_at",
          new Date(anchor.getTime() + 8 * 86400000).toISOString(),
        ),
      "Read schedule conflicts",
    );
    const free = (start, end) =>
      !occupied.some(
        (x) => Date.parse(x.starts_at) < end && Date.parse(x.ends_at) > start,
      );
    const choose = (candidates) => {
      for (const start of candidates) {
        const end = start + 30 * 60000;
        if (free(start, end)) {
          occupied.push({
            starts_at: new Date(start).toISOString(),
            ends_at: new Date(end).toISOString(),
          });
          return {
            starts_at: new Date(start).toISOString(),
            ends_at: new Date(end).toISOString(),
          };
        }
      }
      throw new Error(
        "No safe synthetic coach slot found; no existing schedule was changed",
      );
    };
    const midnight = Date.parse(
      `${anchor.toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })}T00:00:00+04:00`,
    );
    const past = Array.from(
      {
        length: Math.max(
          0,
          Math.floor((anchor.getTime() - midnight) / 60000) - 30,
        ),
      },
      (_, index) => anchor.getTime() - (index + 31) * 60000,
    );
    manifest.schedule = {
      absence: choose(past),
      assessment: choose(past),
      ordinary: choose(
        Array.from(
          { length: 24 },
          (_, n) => anchor.getTime() + 2 * 86400000 + n * 3600000,
        ),
      ),
      makeup: choose(
        Array.from(
          { length: 24 },
          (_, n) => anchor.getTime() + 4 * 86400000 + n * 3600000,
        ),
      ),
    };
    saveFixture(config.file, manifest);
  }
  const sessions = {};
  for (const [name, times] of Object.entries(manifest.schedule))
    sessions[name] = await ensure("class_sessions", id(`session-${name}`), {
      class_id: cls.id,
      ...times,
      capacity: 8,
    });
  const enrollment = await ensure("enrollments", id("enrollment"), {
    child_id: child.id,
    class_id: cls.id,
  });
  const roster = {};
  for (const name of ["absence", "assessment", "ordinary"])
    roster[name] = await ensure("session_roster", id(`roster-${name}`), {
      session_id: sessions[name].id,
      enrollment_id: enrollment.id,
      kind: "enrollment",
    });
  const grants = [
    ["finance.view", branch.id],
    ["finance.packages", branch.id],
    ["finance.memberships", branch.id],
    ["finance.invoices", branch.id],
    ["finance.payment", branch.id],
    ["finance.credit", branch.id],
    ["finance.refund", branch.id],
    ["finance.discount", branch.id],
    ["finance.writeoff", branch.id],
    ["finance.freeze", branch.id],
    ["finance.compensation", branch.id],
    ["finance.compensation_payment", branch.id],
    ["events.manage", branch.id],
    ["engagement.configure", branch.id],
    ["engagement.review", branch.id],
    ["engagement.grant", branch.id],
    ["communications.broadcast", branch.id],
    ["operations.transfer", branch.id],
    ["attendance.correct", branch.id],
    ["development.configure", null],
    ["development.review", branch.id],
    ["development.publish", branch.id],
    ["development.certify", branch.id],
  ];
  const added = [];
  for (const [permission, scope] of grants) {
    let query = db
      .from("product_permissions")
      .select("id")
      .eq("user_id", accounts.admin.id)
      .eq("permission", permission);
    query = scope ? query.eq("branch_id", scope) : query.is("branch_id", null);
    const existing = await unwrap(
      query,
      "Inspect explicit synthetic product grant",
    );
    if (!existing.length) {
      await unwrap(
        db.from("product_permissions").insert({
          user_id: accounts.admin.id,
          permission,
          branch_id: scope,
          granted_by: null,
        }),
        "Add explicit synthetic product grant",
      );
      added.push(permission);
    }
  }
  const auditId = id("fixture-audit");
  const oldAudit = await unwrap(
    db
      .from("audit_events")
      .select("id")
      .eq("entity", "product_demo_fixture")
      .eq("entity_id", auditId),
    "Inspect fixture audit",
  );
  if (!oldAudit.length)
    await unwrap(
      db.from("audit_events").insert({
        actor_id: null,
        action: "SYNTHETIC_FIXTURE_SETUP",
        entity: "product_demo_fixture",
        entity_id: auditId,
        new_value: {
          batch: config.batch,
          source: "guarded_service_role_seed",
          synthetic: true,
          head_office_id: accounts.admin.id,
          explicit_permissions: grants.map(([permission]) => permission),
        },
      }),
      "Record attributable fixture setup audit",
    );
  if (oldAudit.length && added.length)
    await unwrap(
      db
        .from("audit_events")
        .insert({
          actor_id: null,
          action: "SYNTHETIC_FIXTURE_PERMISSIONS_EXTENDED",
          entity: "product_demo_fixture",
          entity_id: auditId,
          new_value: {
            batch: config.batch,
            source: "guarded_service_role_seed",
            synthetic: true,
            head_office_id: accounts.admin.id,
            branch_id: branch.id,
            added_permissions: added,
          },
        }),
      "Audit additive synthetic fixture permissions",
    );
  manifest = {
    ...manifest,
    status: "ready",
    ids: {
      child: child.id,
      class: cls.id,
      enrollment: enrollment.id,
      venue: venue.id,
      age: age.id,
      sessions: Object.fromEntries(
        Object.entries(sessions).map(([key, row]) => [key, row.id]),
      ),
      roster: Object.fromEntries(
        Object.entries(roster).map(([key, row]) => [key, row.id]),
      ),
    },
    startsOn: anchor.toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }),
  };
  saveFixture(config.file, manifest);
  console.log(
    JSON.stringify({
      status: "ready",
      target: config.hosted ? "synthetic-staging" : "local",
      batch: config.batch,
      manifest: config.file,
      child_id: child.id,
      added_permissions: added,
      workflow:
        "Run product-walkthrough.mjs to create real domain transitions; no payment, attendance or publication states were fabricated.",
    }),
  );
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  seedProductDemo().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Synthetic fixture setup failed",
    );
    process.exitCode = 1;
  });
