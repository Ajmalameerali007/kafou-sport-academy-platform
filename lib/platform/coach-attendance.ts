import { z } from "zod";

export const coachAttendanceSchema = z
  .object({
    action: z.literal("coach_attendance.finalize"),
    data: z
      .object({
        session_id: z.string().uuid(),
        entries: z
          .array(
            z
              .object({
                id: z.string().uuid(),
                attendance: z.enum(["present", "absent", "late", "excused"]),
              })
              .strict(),
          )
          .max(100)
          .refine(
            (entries) =>
              new Set(entries.map((entry) => entry.id)).size === entries.length,
            "Supply each roster entry exactly once",
          ),
      })
      .strict(),
  })
  .strict();
