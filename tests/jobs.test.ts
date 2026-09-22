import test from "node:test";
import assert from "node:assert/strict";
import { jobHealth, jobStatusSchema, readJobs } from "../lib/platform/jobs";
import { readJobStatus } from "../lib/platform/jobs-server";
const id = "97000000-0000-4000-8000-000000000001";
const empty = {
  clock_active: false,
  last_success: null,
  controls: [],
  counts: {},
  recent_runs: [],
  staff_queue: [],
};
const control = {
  id,
  branch_id: id,
  target_ref: "kafou-local",
  enabled: true,
  effective_enabled: true,
  approved_by: id,
  created_at: "2026-09-20T01:00:00+00:00",
};
test("scheduler cannot present configured approval as autonomous execution", () => {
  assert.equal(jobHealth(jobStatusSchema.parse(empty)), "inactive");
  assert.equal(
    jobHealth(jobStatusSchema.parse({ ...empty, controls: [control] })),
    "clock_required",
  );
  assert.equal(
    jobHealth(
      jobStatusSchema.parse({
        ...empty,
        clock_active: true,
        controls: [control],
      }),
    ),
    "ready",
  );
  assert.equal(
    jobHealth(
      jobStatusSchema.parse({
        ...empty,
        clock_active: true,
        controls: [control],
        counts: { failed: 1 },
      }),
    ),
    "attention",
  );
  assert.equal(
    jobHealth(
      jobStatusSchema.parse({
        ...empty,
        clock_active: true,
        controls: [{ ...control, effective_enabled: false }],
      }),
    ),
    "inactive",
  );
});
test("scheduler observation rejects malformed counts, raw error text and overlong history", () => {
  assert.equal(
    jobStatusSchema.safeParse({ ...empty, counts: { failed: -1 } }).success,
    false,
  );
  assert.equal(
    jobStatusSchema.safeParse({ ...empty, last_success: "not-a-time" }).success,
    false,
  );
  assert.equal(
    jobStatusSchema.safeParse({ ...empty, recent_runs: Array(51).fill({}) })
      .success,
    false,
  );
});
test("job status HTTP service preserves authorization errors instead of reporting inactivity", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      assert.equal(input, "/api/jobs");
      return Response.json({ ok: true, data: empty });
    };
    assert.deepEqual(await readJobs(), { ok: true, data: empty });
    globalThis.fetch = async () =>
      Response.json({
        ok: false,
        code: "forbidden",
        message: "Access changed",
      });
    assert.equal((await readJobs()).ok, false);
    globalThis.fetch = async () => Response.json({ ok: true, data: {} });
    assert.equal((await readJobs()).ok, false);
  } finally {
    globalThis.fetch = original;
  }
});
test("status server uses caller RPC and propagates current MFA/RLS denial", async () => {
  const db = {
    rpc: async (name: string) => {
      assert.equal(name, "scheduler_status");
      return { data: empty, error: null };
    },
  } as unknown as Parameters<typeof readJobStatus>[0];
  assert.deepEqual(await readJobStatus(db), empty);
  const denied = {
    rpc: async () => ({
      data: null,
      error: { code: "42501", message: "Denied" },
    }),
  } as unknown as Parameters<typeof readJobStatus>[0];
  await assert.rejects(readJobStatus(denied), { status: 403 });
});
