import test from "node:test";
import assert from "node:assert/strict";
import {
  searchRequestSchema,
  searchResponseSchema,
  workspaceSearch,
} from "../lib/platform/search";

test("search query and pagination inputs are bounded and literal", () => {
  assert.equal(
    searchRequestSchema.parse({ query: "  O%Brien  ", kinds: ["child"] }).query,
    "O%Brien",
  );
  for (const input of [
    { query: "a" },
    { query: "x".repeat(81) },
    { query: "valid", limit: 51 },
    { query: "valid", after: "child:not-a-uuid" },
    { query: "valid", kinds: ["audit"] },
    { query: "valid", branch: "not-a-uuid" },
  ])
    assert.equal(searchRequestSchema.safeParse(input).success, false);
});
test("search response requires explicit bounded items and count, not a silent empty fallback", () => {
  assert.equal(searchResponseSchema.safeParse({ items: [] }).success, false);
  assert.deepEqual(
    searchResponseSchema.parse({ items: [], total: 0, next_cursor: null }),
    { items: [], total: 0, next_cursor: null },
  );
  assert.equal(
    searchResponseSchema.safeParse({ items: [], total: -1, next_cursor: null })
      .success,
    false,
  );
});
test("search service transports filters and exact cursor without treating failures as no matches", async () => {
  const original = globalThis.fetch;
  try {
    let requested = "";
    globalThis.fetch = async (input) => {
      requested = String(input);
      return Response.json({
        ok: true,
        data: { items: [], total: 0, next_cursor: null },
      });
    };
    const result = await workspaceSearch({
      query: "Ali & Mariam",
      kinds: ["child"],
      after: "child:00000000-0000-4000-8000-000000000001",
    });
    assert.equal(result.ok, true);
    const u = new URL(requested, "http://localhost");
    assert.equal(u.searchParams.get("q"), "Ali & Mariam");
    assert.equal(u.searchParams.get("kinds"), "child");
    assert.equal(
      u.searchParams.get("after"),
      "child:00000000-0000-4000-8000-000000000001",
    );
    globalThis.fetch = async () =>
      Response.json({
        ok: false,
        code: "forbidden",
        message: "Access changed.",
      });
    const denied = await workspaceSearch({ query: "Ali", kinds: ["child"] });
    assert.equal(denied.ok, false);
  } finally {
    globalThis.fetch = original;
  }
});
