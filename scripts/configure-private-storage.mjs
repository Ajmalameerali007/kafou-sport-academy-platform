// Additive staging-only storage configuration. No public object access or real files.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const hosted = process.argv.includes("--hosted");
if (hosted && !process.argv.includes("--confirm-synthetic-staging"))
  throw Error("Explicit staging acknowledgement required");
if (process.argv.some((a) => a.includes("production") || a.includes("reset")))
  throw Error("Unsupported environment");
const url = hosted
  ? "https://cwdazidovxqeevmpicng.supabase.co"
  : "http://127.0.0.1:56321";
const keys = JSON.parse(
  readFileSync(
    hosted
      ? "outputs/foundation/keys.json"
      : "outputs/foundation/local-keys.json",
    "utf8",
  ),
);
const secret = hosted
  ? (Array.isArray(keys) ? keys : keys.keys || keys.api_keys).find(
      (k) => k.type === "secret",
    )?.api_key
  : keys.SECRET_KEY;
if (!secret) throw Error("Private server configuration required");
const db = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const name = "kafou-private-documents";
const existing = await db.storage.getBucket(name);
if (existing.data) {
  if (existing.data.public || existing.data.file_size_limit !== 524288)
    throw Error(
      "Existing bucket configuration differs; review before changing.",
    );
  console.log("Private staging document bucket verified.");
} else {
  const r = await db.storage.createBucket(name, {
    public: false,
    fileSizeLimit: 524288,
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
  });
  if (r.error) throw Error(r.error.message);
  console.log("Private staging document bucket created.");
}
