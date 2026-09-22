import { z } from "zod";
const id = z.string().uuid(),
  reason = z.string().trim().min(5).max(500),
  date = z.string().datetime({ offset: true });
const cmd = <T extends string, S extends z.ZodRawShape>(action: T, data: S) =>
  z.object({ action: z.literal(action), data: z.object(data) });
export const academySchema = z.discriminatedUnion("action", [
  cmd("academy.policy", {
    branch_id: id,
    name: z.string().min(3).max(120),
    makeup_days: z.coerce.number().int().min(1).max(365),
    allow_absent: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .or(z.boolean())
      .default(false),
  }),
  cmd("academy.makeup.book", { credit_id: id, session_id: id }),
  cmd("academy.makeup.cancel", { id }),
  cmd("academy.attendance.correct", {
    roster_id: id,
    attendance: z.enum(["present", "absent", "late", "excused"]),
    reason,
  }),
  cmd("academy.session.complete", { session_id: id }),
  cmd("academy.session.cancel", { session_id: id, reason }),
  cmd("academy.substitute", {
    session_id: id,
    coach_id: id,
    starts_at: date,
    ends_at: date,
    reason,
  }),
  cmd("academy.substitute.revoke", { id }),
  cmd("academy.transfer.request", {
    enrollment_id: id,
    target_class_id: id,
    reason,
  }),
  cmd("academy.waitlist.join", { enrollment_id: id, session_id: id }),
  cmd("academy.waitlist.offer", { session_id: id }),
  cmd("academy.waitlist.accept", { id }),
]);
export const academyTables = [
  "academy_policies",
  "makeup_credits",
  "makeup_bookings",
  "attendance_corrections",
  "coach_substitutions",
  "session_changes",
  "transfer_requests",
  "waitlist_entries",
] as const;
