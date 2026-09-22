import { z } from "zod";
import { api } from "./client";
import type { ServiceResult } from "../kafou/types";
const id = z.string().uuid();
const date = z.string().datetime({ offset: true });
export const jobStatusSchema = z.object({
  clock_active: z.boolean(),
  last_success: date.nullable(),
  controls: z.array(
    z.object({
      id,
      branch_id: id,
      target_ref: z.enum(["kafou-local", "cwdazidovxqeevmpicng"]),
      enabled: z.boolean(),
      effective_enabled: z.boolean(),
      approved_by: id,
      created_at: date,
    }),
  ),
  counts: z.record(
    z.enum([
      "pending",
      "retry",
      "succeeded",
      "cancelled",
      "staff_review",
      "failed",
    ]),
    z.number().int().nonnegative(),
  ),
  recent_runs: z
    .array(
      z.object({
        id,
        job_id: id,
        entity_id: id,
        branch_id: id,
        control_id: id,
        kind: z.enum([
          "broadcast",
          "renewal",
          "waitlist_expiry",
          "monthly_report",
          "completion_certificate",
        ]),
        creator_id: id.nullable(),
        outcome: z.enum([
          "continued",
          "succeeded",
          "cancelled",
          "staff_review",
          "retry",
          "failed",
        ]),
        error_code: z
          .string()
          .regex(/^[A-Z0-9_]{2,40}$/)
          .nullable(),
        affected: z.number().int().nonnegative(),
        started_at: date,
        finished_at: date,
      }),
    )
    .max(50),
  staff_queue: z
    .array(
      z.object({
        id,
        entity_id: id,
        session_id: id,
        branch_id: id,
        updated_at: date,
      }),
    )
    .max(50),
});
export type JobStatus = z.infer<typeof jobStatusSchema>;
export function jobHealth(
  status: JobStatus,
): "inactive" | "clock_required" | "attention" | "ready" {
  if (!status.controls.some((c) => c.effective_enabled)) return "inactive";
  if (!status.clock_active) return "clock_required";
  return (status.counts.failed || 0) + (status.counts.retry || 0) > 0
    ? "attention"
    : "ready";
}
export async function readJobs(): Promise<ServiceResult<JobStatus>> {
  const result = await api<unknown>("jobs");
  if (!result.ok) return result;
  const parsed = jobStatusSchema.safeParse(result.data);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : {
        ok: false,
        code: "unavailable",
        message: "Scheduled work status could not be loaded. Please try again.",
      };
}
