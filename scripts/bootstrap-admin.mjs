import { createClient } from "@supabase/supabase-js";
const email = process.argv[2];
if (!email || !email.includes("@"))
  throw new Error(
    "Usage: node --env-file=.env.local scripts/bootstrap-admin.mjs verified-owner@example.com",
  );
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
  throw new Error(
    "Configure the explicit staging Supabase URL and server secret first.",
  );
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
let found;
for (let page = 1; page <= 100; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error(error.message);
  found = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (found || data.users.length < 100) break;
}
if (!found?.email_confirmed_at)
  throw new Error(
    "The supplied email must belong to an existing, verified account. No privileges were changed.",
  );
const { error } = await db.rpc("bootstrap_admin", { p_user_id: found.id });
if (error) throw new Error(error.message);
console.log(
  "Initial administrator assigned. Authenticator verification is required before management access.",
);
