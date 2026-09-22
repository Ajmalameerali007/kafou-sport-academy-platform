import { z } from "zod";
const id = z.string().uuid(),
  reason = z.string().trim().min(5).max(500),
  scope = z.enum(["occurrence", "future", "series"]);
export const scheduleSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("schedule.transfer.review"),
    data: z.object({ id, decision: z.enum(["approved", "declined"]), reason }),
  }),
  z.object({
    action: z.literal("schedule.preview"),
    data: z.object({ session_id: id, scope }),
  }),
  z.object({
    action: z.literal("schedule.move"),
    data: z.object({
      session_id: id,
      scope,
      minutes_delta: z.coerce
        .number()
        .int()
        .min(-180)
        .max(180)
        .refine((v) => v !== 0),
      reason,
    }),
  }),
  z.object({
    action: z.literal("schedule.cancel"),
    data: z.object({ session_id: id, scope, reason }),
  }),
  z.object({
    action: z.literal("schedule.acknowledge"),
    data: z.object({ id }),
  }),
]);
export const scheduleTables = [
  "transfer_decisions",
  "operational_acknowledgements",
] as const;
