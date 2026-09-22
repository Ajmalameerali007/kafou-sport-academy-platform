import { z } from "zod";
const id = z.string().uuid(),
  name = z.string().trim().min(2).max(100),
  sport = z.enum(["swimming", "football", "karate", "badminton"]);
const amount = z.coerce.number().int().min(1).max(1_000_000_000);
export const managementSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("commercial.customer.create"),
    data: z.object({
      branch_id: id,
      name,
      mobile: z.string().regex(/^\+?[0-9 ()-]{9,25}$/),
      email: z.union([z.literal(""), z.string().email()]),
      child_name: name,
      age: z.coerce.number().int().min(1).max(17),
      dob: z.string().date().optional(),
      sport,
      level_id: id.optional(),
    }),
  }),
  z.object({
    action: z.literal("commercial.catalogue.save"),
    data: z
      .object({
        id: id.optional(),
        name,
        name_ar: z.string().max(100).default(""),
        sport,
        level_id: id.optional(),
        price_minor: amount,
        session_allowance: z.coerce.number().int().min(1).max(100),
        duration_months: z.coerce.number().int().min(1).max(12),
        min_age: z.coerce.number().int().min(1).max(17),
        max_age: z.coerce.number().int().min(1).max(17),
        terms: z.string().trim().min(5).max(2000),
        terms_ar: z.string().max(2000).default(""),
        offers: z
          .array(
            z.object({
              branch_id: id,
              enabled: z.boolean(),
              price_minor: amount.optional(),
            }),
          )
          .min(1)
          .max(100)
          .refine((v) => new Set(v.map((x) => x.branch_id)).size === v.length),
      })
      .refine((v) => v.max_age >= v.min_age),
  }),
  z.object({
    action: z.literal("commercial.coach.save"),
    data: z.object({
      id,
      name,
      mobile: z.string().max(40),
      active: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("commercial.coach.assign"),
    data: z.object({
      coach_id: id,
      branch_id: id,
      sport,
      level_id: id.optional(),
      venue_id: id.optional(),
    }),
  }),
  z.object({
    action: z.literal("commercial.venue.update"),
    data: z.object({
      id,
      name,
      address: z.string().min(2).max(500),
      operating_information: z.string().max(2000),
    }),
  }),
  z.object({
    action: z.literal("commercial.agreement.create"),
    data: z
      .object({
        coach_id: id,
        branch_id: id,
        amount_minor: amount,
        basis: z.enum(["session", "hour", "month"]),
        sport: sport.optional(),
        effective_from: z.string().date(),
        effective_to: z.string().date(),
        cancellation_rule: z.literal("unpaid"),
        substitute_rule: z.enum(["actual_coach", "exclude"]),
      })
      .refine((v) => v.effective_to > v.effective_from),
  }),
  z.object({
    action: z.literal("commercial.compensation.month"),
    data: z.object({ id, period_start: z.string().date() }),
  }),
]);
export const managementTables = [
  "package_catalogue",
  "package_offer_versions",
  "coach_assignments",
] as const;
export type FinanceBranch = {
  id: string;
  name: string;
  finance: {
    receivedMinor: number;
    outstandingMinor: number;
    invoicedMinor: number;
    refundedMinor: number;
  };
  coachVisible: boolean;
  earnedMinor: number;
  paidMinor: number;
  coachOutstandingMinor: number;
};
export type FinanceSummary = {
  asOf: string;
  from: string;
  to: string;
  branches: FinanceBranch[];
};
