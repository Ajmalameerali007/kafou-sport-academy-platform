import { z } from "zod";
const id = z.string().uuid();
export const eventRegistrationSchema = z
  .object({
    event_id: id,
    family_id: id,
    children: z
      .array(
        z
          .object({ child_id: id, document_id: id, accepted: z.literal(true) })
          .strict(),
      )
      .min(1)
      .max(8)
      .refine(
        (rows) => new Set(rows.map((row) => row.child_id)).size === rows.length,
        "Choose each child once",
      ),
  })
  .strict();
const attendance = z.enum(["present", "absent", "late", "excused"]);
const occurrence = z
  .object({
    venue_id: id,
    coach_id: id,
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
  })
  .strict();
export const campCreateSchema = z
  .object({
    branch_id: id,
    sport: z.enum(["swimming", "football", "karate", "badminton"]),
    level_id: id,
    age_group_id: id,
    document_id: id,
    title: z.string().trim().min(2).max(120),
    capacity: z.number().int().min(1).max(100),
    policy_acknowledged: z.literal(true),
    occurrences: z.array(occurrence).min(2).max(30),
  })
  .strict()
  .superRefine((data, ctx) => {
    const sorted = [...data.occurrences].sort(
      (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
    );
    const day = (n: number) =>
      new Date(n + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
    sorted.forEach((slot, i) => {
      const start = Date.parse(slot.starts_at),
        end = Date.parse(slot.ends_at);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      if (
        end <= start ||
        end - start > 12 * 60 * 60 * 1000 ||
        day(start) !== day(end)
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Each occurrence must fit one Dubai day and last at most twelve hours",
          path: ["occurrences"],
        });
      if (i > 0 && start < Date.parse(sorted[i - 1].ends_at))
        ctx.addIssue({
          code: "custom",
          message: "Camp occurrences cannot overlap",
          path: ["occurrences"],
        });
    });
    if (
      sorted.length &&
      Date.parse(sorted.at(-1)!.ends_at) - Date.parse(sorted[0].starts_at) >
        90 * 24 * 60 * 60 * 1000
    )
      ctx.addIssue({
        code: "custom",
        message: "Camp dates must fit within ninety days",
        path: ["occurrences"],
      });
  });
export const eventAttendanceSchema = z
  .object({
    occurrence_id: id,
    entries: z
      .array(z.object({ registration_id: id, attendance }).strict())
      .min(1)
      .max(100)
      .refine(
        (rows) =>
          new Set(rows.map((row) => row.registration_id)).size === rows.length,
        "Choose each registration once",
      ),
  })
  .strict();
export const eventTables = [
  "academy_events",
  "event_registration_batches",
  "event_registrations",
  "event_consents",
  "event_occurrences",
  "event_attendance",
  "event_attendance_corrections",
  "event_attendance_register",
  "event_coach_directory",
] as const;
export const eventCommands = [
  z.object({ action: z.literal("events.camp.create"), data: campCreateSchema }),
  z.object({
    action: z.literal("events.attendance.save"),
    data: eventAttendanceSchema,
  }),
  z.object({
    action: z.literal("events.attendance.finalize"),
    data: z.object({ occurrence_id: id }).strict(),
  }),
  z.object({
    action: z.literal("events.occurrence.cancel"),
    data: z
      .object({ occurrence_id: id, reason: z.string().trim().min(5).max(500) })
      .strict(),
  }),
  z.object({
    action: z.literal("events.attendance.correct"),
    data: z
      .object({ id, attendance, reason: z.string().trim().min(5).max(500) })
      .strict(),
  }),
  z.object({
    action: z.literal("events.create"),
    data: z
      .object({
        branch_id: id,
        venue_id: id,
        sport: z.enum(["swimming", "football", "karate", "badminton"]),
        level_id: id,
        age_group_id: id,
        document_id: id,
        title: z.string().trim().min(2).max(120),
        starts_at: z.string().datetime({ offset: true }),
        ends_at: z.string().datetime({ offset: true }),
        capacity: z.number().int().min(1).max(100),
        policy_acknowledged: z.literal(true),
      })
      .strict(),
  }),
  z.object({
    action: z.literal("events.register"),
    data: eventRegistrationSchema,
  }),
  z.object({
    action: z.literal("events.cancel_registration"),
    data: z.object({ batch_id: id }).strict(),
  }),
  z.object({
    action: z.literal("events.cancel"),
    data: z
      .object({ event_id: id, reason: z.string().trim().min(5).max(500) })
      .strict(),
  }),
] as const;
