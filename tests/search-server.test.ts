import test from "node:test";
import assert from "node:assert/strict";
import { readSearchRecord } from "../lib/platform/search-server";

test("targeted coach hydration feeds both existing session views with the same authorized projection", async () => {
  const id = "97000000-0000-4000-8000-000000000001";
  const projection = {
    id,
    name: "Assigned session",
    students: [{ id: "kid", name: "Roster child" }],
    can_coach: true,
  };
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
    rpc: async (name: string, args: unknown) => {
      assert.equal(name, "workspace_search_session");
      assert.deepEqual(args, { p_id: id });
      return { data: projection, error: null };
    },
  } as unknown as Parameters<typeof readSearchRecord>[0];
  const result = await readSearchRecord(
    db,
    new URLSearchParams({ kind: "session", id }),
  );
  assert.deepEqual(result.data.coach_sessions, [projection]);
  assert.deepEqual(result.data.development_sessions, [projection]);
  assert.deepEqual(result.pagination, {});
});
test("a known but revoked coach session produces 404 without an empty success", async () => {
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
    rpc: async () => ({ data: null, error: null }),
  } as unknown as Parameters<typeof readSearchRecord>[0];
  await assert.rejects(
    readSearchRecord(
      db,
      new URLSearchParams({
        kind: "session",
        id: "97000000-0000-4000-8000-000000000001",
      }),
    ),
    { status: 404, code: "not_found" },
  );
});

test("branch session hydration uses canonical RLS records instead of the coach-only projection", async () => {
  const id = "97000000-0000-4000-8000-000000000001";
  const rows: Record<string, unknown> = {
    class_sessions: { id, class_id: "class-id" },
    academy_classes: { id: "class-id", branch_id: "allowed-branch" },
  };
  const db = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: rows[table], error: null }),
          order: () => ({
            range: async () => ({
              data: [{ id: "roster-id", session_id: id }],
              count: 101,
              error: null,
            }),
          }),
        }),
      }),
    }),
    rpc: async () => {
      throw new Error("Coach projection is not a staff permission substitute");
    },
  } as unknown as Parameters<typeof readSearchRecord>[0];
  const result = await readSearchRecord(
    db,
    new URLSearchParams({ kind: "session", id }),
  );
  assert.deepEqual(result.data.class_sessions, [rows.class_sessions]);
  assert.deepEqual(result.data.academy_classes, [rows.academy_classes]);
  assert.equal(result.pagination.session_roster.next_offset, 100);
  assert.equal(result.data.coach_sessions, undefined);
});
