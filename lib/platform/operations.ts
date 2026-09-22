import { administratorVerified } from "@/lib/platform/contracts";
import { z } from "zod";
import type { AccountContext } from "./contracts";
const id = z.string().uuid(),
  name = z.string().trim().min(2).max(100),
  sport = z.enum(["swimming", "football", "karate", "badminton"]);
const reason = z.string().trim().min(5).max(500);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(v)));
export const operationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("family.offer"),
    data: z.object({ family_id: id, user_id: id }),
  }),
  z.object({
    action: z.literal("family.accept"),
    data: z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }),
  }),
  z.object({
    action: z.literal("level.save"),
    data: z.object({
      sport,
      name,
      name_ar: z.string().max(100).default(""),
      rank: z.coerce.number().int().min(0).max(100),
      entry_level: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("age.save"),
    data: z
      .object({
        name,
        min_age: z.coerce.number().int().min(1).max(17),
        max_age: z.coerce.number().int().min(1).max(17),
      })
      .refine((v) => v.max_age >= v.min_age),
  }),
  z.object({
    action: z.literal("class.create"),
    data: z.object({
      name,
      branch_id: id,
      venue_id: id,
      coach_id: id,
      sport,
      level_id: id,
      age_group_id: id,
      capacity: z.coerce.number().int().min(1).max(100),
      weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
      local_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      duration_minutes: z.coerce.number().int().min(15).max(240),
    }),
  }),
  z.object({
    action: z.literal("class.status"),
    data: z.object({ id, active: z.boolean() }),
  }),
  z.object({
    action: z.literal("sessions.generate"),
    data: z.object({ class_id: id, from: day, to: day }),
  }),
  z.object({
    action: z.literal("lead.create"),
    data: z.object({
      branch_id: id,
      parent_name: name,
      mobile: z.string().regex(/^\+?[\d ()-]{9,25}$/),
      email: z.union([z.literal(""), z.string().email()]).default(""),
      child_name: name,
      age: z.coerce.number().int().min(1).max(17),
      sport,
      experience: z.enum(["beginner", "some", "training", "unsure"]),
      source: z.enum([
        "website",
        "social",
        "whatsapp",
        "phone",
        "walk_in",
        "referral",
        "ai",
      ]),
    }),
  }),
  z.object({
    action: z.literal("enquiry.level"),
    data: z.object({ id, level_id: id }),
  }),
  z.object({
    action: z.literal("trial.book"),
    data: z.object({
      enquiry_id: id,
      session_id: id,
      override_reason: reason.optional(),
    }),
  }),
  z.object({ action: z.literal("trial.cancel"), data: z.object({ id }) }),
  z.object({
    action: z.literal("session.cancel"),
    data: z.object({ id, reason }),
  }),
  z.object({
    action: z.literal("attendance.finalize"),
    data: z.object({
      session_id: id,
      entries: z
        .array(
          z.object({
            id,
            attendance: z.enum(["present", "absent", "late", "excused"]),
          }),
        )
        .max(100)
        .refine((v) => new Set(v.map((x) => x.id)).size === v.length),
    }),
  }),
  z.object({
    action: z.literal("trial.convert"),
    data: z.object({ id, class_id: id, override_reason: reason.optional() }),
  }),
  z.object({
    action: z.literal("family.claim"),
    data: z.object({ family_id: id }),
  }),
  z.object({
    action: z.literal("family.link"),
    data: z.object({
      enquiry_id: id,
      child_id: id,
      token: z.string().regex(/^[a-f0-9]{48}$/),
    }),
  }),
]);
export type Operation = z.infer<typeof operationSchema>;
export function mayOperate(c: AccountContext, action: string) {
  if (
    !c.active ||
    (c.roles.includes("super_admin") && !administratorVerified(c))
  )
    return false;
  const head = c.roles.some((r) => r === "admin" || r === "super_admin");
  if (
    [
      "level.save",
      "age.save",
      "class.create",
      "class.status",
      "sessions.generate",
    ].includes(action)
  )
    return head;
  if (action === "family.claim" || action === "family.accept")
    return c.roles.includes("parent");
  if (
    [
      "attendance.finalize",
      "session.cancel",
      "trial.convert",
      "enquiry.level",
      "family.link",
      "family.offer",
    ].includes(action)
  )
    return head || c.roles.includes("branch");
  if (action === "lead.create")
    return head || c.roles.some((r) => r === "branch" || r === "sales");
  return (
    ["trial.book", "trial.cancel"].includes(action) &&
    (head || c.roles.some((r) => ["branch", "sales", "parent"].includes(r)))
  );
}
export interface AvailableSession {
  id: string;
  class_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  venue: string;
  level: string;
  level_ar: string;
  places: number;
}
