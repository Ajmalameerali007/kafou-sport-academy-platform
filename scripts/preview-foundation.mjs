// Local Worker verification only. The temporary secret file is removed on exit.
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
import { runLocalPreflight } from "./local-preflight.mjs";
await runLocalPreflight();
const target = "dist/server/.env";
const source = readFileSync(".env.local", "utf8");
if (!source.includes("SUPABASE_URL=http://127.0.0.1:"))
  throw new Error(
    "Use isolated local Supabase for automated Worker verification.",
  );
writeFileSync(
  target,
  source.replace(/^APP_URL=.*$/m, "APP_URL=http://127.0.0.1:3101"),
  { mode: 0o600 },
);
const child = spawn(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config",
    "dist/server/wrangler.json",
    "--local",
    "--persist-to",
    ".wrangler/state",
    "--ip",
    "127.0.0.1",
    "--port",
    "3101",
    "--inspector-port",
    "0",
  ],
  { stdio: "inherit" },
);
const clean = () => {
  try {
    unlinkSync(target);
  } catch {}
};
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    child.kill(signal);
    clean();
  });
child.on("exit", (code) => {
  clean();
  process.exit(code ?? 0);
});
