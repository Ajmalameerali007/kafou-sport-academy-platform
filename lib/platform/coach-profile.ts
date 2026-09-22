import { z } from "zod";

const id = z.string().uuid();
const weekday = z.coerce.number().int().min(0).max(6);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const command = <A extends string, T extends z.ZodTypeAny>(
  action: A,
  data: T,
) => z.object({ action: z.literal(action), data });

export const coachProfileSchema = z.discriminatedUnion("action", [
  command(
    "coach.profile.update",
    z
      .object({
        coach_id: id.optional(),
        bio: z.string().trim().max(2000),
        qualifications: z.array(z.string().trim().min(1).max(200)).max(20),
      })
      .strict(),
  ),
  command(
    "coach.availability.save",
    z
      .object({
        coach_id: id.optional(),
        branch_id: id.optional(),
        weekday,
        start_time: clock,
        end_time: clock,
      })
      .strict(),
  ),
  command(
    "coach.availability.remove",
    z.object({ id }).strict(),
  ),
]);

export const coachProfileTables = ["coach_availability"] as const;
