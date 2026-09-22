import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const LOCAL_APP_URL = "http://127.0.0.1:3101";
export const LOCAL_SUPABASE_URL = "http://127.0.0.1:56321";

export function exactLocalUrl(value, expected, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  const canonical = new URL(expected);
  if (
    parsed.protocol !== canonical.protocol ||
    parsed.hostname !== canonical.hostname ||
    parsed.port !== canonical.port ||
    parsed.pathname.replace(/\/$/, "") !== "" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw new Error(`${label} must be exactly ${expected}.`);
  return parsed.origin;
}

function env(text) {
  const result = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) result.set(match[1], match[2]);
  }
  return result;
}

async function request(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(4000),
    });
    return response;
  } catch (error) {
    throw new Error(
      `Local service unavailable at ${new URL(url).origin}: ${error instanceof Error ? error.message : "request failed"}. Start Docker Desktop, run \`supabase start\`, and rerun the preflight.`,
    );
  }
}

async function verifyMigrations(provenance) {
  if (!Array.isArray(provenance.expectedMigrations) || !provenance.expectedMigrations.length)
    throw new Error("Build provenance does not contain expected migrations. Rebuild before previewing.");
  for (const migration of provenance.expectedMigrations) {
    if (!/^supabase\/migrations\/\d+_[a-z0-9_]+\.sql$/.test(migration.path))
      throw new Error("Build provenance contains an invalid migration path.");
    const bytes = await readFile(migration.path);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== migration.sha256)
      throw new Error(`Migration changed after the build: ${migration.path}. Rebuild before previewing.`);
  }
}

export async function runLocalPreflight({ requireApp = false } = {}) {
  const [environment, config, provenanceText] = await Promise.all([
    readFile(".env.local", "utf8"),
    readFile("supabase/config.toml", "utf8"),
    readFile("lib/platform/build-provenance.json", "utf8"),
  ]);
  const values = env(environment);
  const supabaseUrl = exactLocalUrl(
    values.get("SUPABASE_URL") || "",
    LOCAL_SUPABASE_URL,
    "SUPABASE_URL",
  );
  if (!/^project_id\s*=\s*"kafou-local"$/m.test(config) || !/^port\s*=\s*56321$/m.test(config))
    throw new Error("supabase/config.toml does not identify the expected kafou-local API on port 56321.");
  const key = values.get("SUPABASE_PUBLISHABLE_KEY");
  if (!key) throw new Error("SUPABASE_PUBLISHABLE_KEY is missing from .env.local.");
  const provenance = JSON.parse(provenanceText);
  if (!/^[a-f0-9]{64}$/.test(provenance.sourceSha256 || ""))
    throw new Error("Build provenance is missing a source fingerprint. Rebuild before previewing.");
  await verifyMigrations(provenance);
  const health = await request(`${supabaseUrl}/auth/v1/health`);
  if (!health.ok)
    throw new Error(`Local authentication health check failed with HTTP ${health.status}.`);
  const rest = await request(`${supabaseUrl}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!rest.ok)
    throw new Error(`Local database API check failed with HTTP ${rest.status}.`);
  if (requireApp) {
    const app = await request(`${LOCAL_APP_URL}/auth`, { redirect: "manual" });
    if (app.status < 200 || app.status >= 400)
      throw new Error(`Local application check failed with HTTP ${app.status}.`);
  }
  await stat("dist/server/wrangler.json").catch(() => {
    if (requireApp) throw new Error("Compiled Worker artifact is missing. Run `npm run build` first.");
  });
  return {
    project: "kafou-local",
    app: requireApp ? LOCAL_APP_URL : "not checked",
    supabase: supabaseUrl,
    sourceSha256: provenance.sourceSha256,
    migrations: provenance.expectedMigrations.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runLocalPreflight({ requireApp: process.argv.includes("--require-app") });
  console.log(JSON.stringify(result, null, 2));
}
