import test from "node:test";
import assert from "node:assert/strict";
import {
  exactLocalUrl,
  LOCAL_APP_URL,
  LOCAL_SUPABASE_URL,
} from "../scripts/local-preflight.mjs";

test("local preflight accepts only the exact isolated loopback origins", () => {
  assert.equal(exactLocalUrl(LOCAL_APP_URL, LOCAL_APP_URL, "APP_URL"), LOCAL_APP_URL);
  assert.equal(
    exactLocalUrl(`${LOCAL_SUPABASE_URL}/`, LOCAL_SUPABASE_URL, "SUPABASE_URL"),
    LOCAL_SUPABASE_URL,
  );
  for (const value of [
    "http://localhost:56321",
    "https://127.0.0.1:56321",
    "http://127.0.0.1:56322",
    "http://127.0.0.1:56321/rest/v1",
    "http://user:password@127.0.0.1:56321",
    "http://127.0.0.1:56321?token=secret",
  ])
    assert.throws(() =>
      exactLocalUrl(value, LOCAL_SUPABASE_URL, "SUPABASE_URL"),
    );
});
