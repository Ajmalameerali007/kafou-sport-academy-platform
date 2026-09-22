// Synthetic fixtures only; this script cannot run against a hosted project.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
const env = JSON.parse(
  readFileSync("outputs/foundation/local-keys.json", "utf8"),
);
if (new URL(env.API_URL).hostname !== "127.0.0.1")
  throw new Error("Local fixtures only");
const db = createClient(env.API_URL, env.SECRET_KEY, {
  auth: { persistSession: false },
});
const {
  data: { users },
  error,
} = await db.auth.admin.listUsers();
if (error) throw error;
const fixtures = [];
for (const role of ["parent", "branch", "sales", "coach", "super_admin"]) {
  const email = `${role}@kafou.example.test`;
  let user = users.find((u) => u.email === email);
  if (!user) {
    const r = await db.auth.admin.createUser({
      email,
      password: process.env.KAFOU_LOCAL_TEST_PASSWORD || "",
      email_confirm: true,
      user_metadata: { name: `Synthetic ${role}` },
    });
    if (r.error) throw r.error;
    user = r.data.user;
  }
  if (role !== "parent") {
    const r = await db
      .from("role_assignments")
      .upsert({ user_id: user.id, role });
    if (r.error) throw r.error;
  }
  if (["branch", "sales"].includes(role)) {
    const { data } = await db
      .from("branches")
      .select("id")
      .eq("slug", "dubai")
      .single();
    const r = await db
      .from("branch_permissions")
      .upsert({ user_id: user.id, branch_id: data.id });
    if (r.error) throw r.error;
  }
  fixtures.push({ role, id: user.id, email });
}
writeFileSync(
  "outputs/foundation/test-users.json",
  JSON.stringify(fixtures, null, 2),
);
console.log("Five local synthetic accounts prepared.");
