import { z } from "zod";
export const roles = [
  "super_admin",
  "admin",
  "sales",
  "branch",
  "coach",
  "parent",
] as const;
export type AcademyRole = (typeof roles)[number];
export interface AccountContext {
  userId: string;
  name: string;
  active: boolean;
  roles: AcademyRole[];
  branchIds: string[];
  aal: "aal1" | "aal2";
  /** Authenticated server context only; stripped outside the isolated local demo. */
  localDemoMfaExempt?: boolean;
}
export function administratorVerified(account: AccountContext) {
  return account.aal === "aal2" || account.localDemoMfaExempt === true;
}
export interface BranchPreference {
  id: string;
  slug: string;
  name: string;
  name_ar: string;
  area: string;
  provisional: boolean;
}
const name = z.string().trim().min(2).max(100),
  mobile = z
    .string()
    .trim()
    .regex(/^\+?[\d ()-]{9,25}$/),
  id = z.string().uuid();
export const enquirySchema = z.object({
  parentName: name,
  mobile,
  email: z.union([z.literal(""), z.string().email().max(254)]).default(""),
  childName: name,
  age: z
    .string()
    .regex(/^\d{1,2}$/)
    .refine((v) => +v >= 1 && +v <= 17),
  sport: z.enum(["swimming", "football", "karate", "badminton"]),
  preferredBranch: z.string().max(80).optional(),
  experience: z
    .enum(["beginner", "some", "training", "unsure"])
    .default("unsure"),
  childId: id.optional(),
});
export const commandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("family.create"),
    data: z.object({
      name,
      mobile,
      email: z.union([z.literal(""), z.string().email()]),
    }),
  }),
  z.object({
    action: z.literal("family.update"),
    data: z.object({
      id,
      name,
      mobile,
      email: z.union([z.literal(""), z.string().email()]),
    }),
  }),
  z.object({
    action: z.literal("child.save"),
    data: z.object({
      id: id.optional(),
      family_id: id,
      name,
      dob: z.string().max(10).optional(),
      reported_age: z.coerce.number().int().min(1).max(17),
    }),
  }),
  z.object({
    action: z.literal("child.sport"),
    data: z.object({
      child_id: id,
      sport: z.enum(["swimming", "football", "karate", "badminton"]),
      level: z.string().max(40).optional(),
    }),
  }),
  z.object({
    action: z.literal("consent.record"),
    data: z.object({
      family_id: id,
      kind: z.enum(["privacy", "contact", "media"]),
      granted: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("lead.note"),
    data: z.object({ id, note: z.string().trim().min(2).max(2000) }),
  }),
  z.object({
    action: z.literal("lead.update"),
    data: z.object({
      id,
      branch_id: z.union([id, z.literal("")]),
      assigned_to: z.union([id, z.literal("")]),
      stage: z.enum([
        "new",
        "contacted",
        "trial_booked",
        "trial_attended",
        "converted",
        "lost",
      ]),
      lost_reason: z.string().max(500),
      follow_up_at: z.string().max(40),
    }),
  }),
  z.object({
    action: z.literal("lead.convert"),
    data: z.object({ id, family_id: z.union([id, z.literal("")]).optional() }),
  }),
  z.object({
    action: z.literal("branch.save"),
    data: z.object({
      id: id.optional(),
      slug: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(60),
      name,
      name_ar: z.string().max(100),
      area: z.string().max(100),
      provisional: z.boolean(),
      active: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("venue.save"),
    data: z.object({
      branch_id: id,
      name,
      address: z.string().min(2).max(500),
      operating_information: z.string().max(2000),
    }),
  }),
  z.object({
    action: z.literal("branch.sports"),
    data: z.object({
      branch_id: id,
      sports: z
        .array(z.enum(["swimming", "football", "karate", "badminton"]))
        .max(4),
    }),
  }),
  z.object({
    action: z.literal("staff.access"),
    data: z.object({
      user_id: id,
      roles: z.array(z.enum(roles)).min(1).max(6),
      branch_ids: z.array(id).max(30),
      active: z.boolean(),
    }),
  }),
  z.object({ action: z.literal("invitation.accept"), data: z.object({ id }) }),
]);
export function workspaceFor(roles: AcademyRole[]) {
  return roles.length > 1
    ? "/account"
    : `/${roles[0] === "super_admin" ? "admin" : roles[0] || "account"}`;
}
export function canEnter(c: AccountContext, workspace: string) {
  return (
    c.active &&
    (workspace === "account" ||
      c.roles.includes(workspace as AcademyRole) ||
      (workspace === "admin" && c.roles.includes("super_admin")))
  );
}

export function mayCommand(c: AccountContext, action: string) {
  if (
    !c.active ||
    (c.roles.includes("super_admin") && !administratorVerified(c))
  )
    return false;
  const head = c.roles.some((r) => r === "admin" || r === "super_admin");
  if (action === "staff.access")
    return c.roles.includes("super_admin") && administratorVerified(c);
  if (action.startsWith("branch.") || action.startsWith("venue.")) return head;
  if (action === "family.create" || action === "consent.record")
    return c.roles.includes("parent");
  if (action === "lead.convert") return head || c.roles.includes("branch");
  if (action.startsWith("lead."))
    return head || c.roles.some((r) => r === "branch" || r === "sales");
  if (action.startsWith("family.") || action.startsWith("child."))
    return head || c.roles.some((r) => r === "branch" || r === "parent");
  return action === "invitation.accept";
}
