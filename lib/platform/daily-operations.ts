import { z } from "zod";
const id = z.string().uuid(),
  amount = z.number().int().positive().max(1_000_000_000),
  revision = z.number().int().nonnegative();
const branch = id.nullable(),
  reason = z.string().trim().min(5).max(500);
const allocations = z
  .array(z.object({ branch_id: branch, amount_minor: amount }).strict())
  .min(1)
  .max(100);
const command = <T extends z.ZodRawShape>(action: string, data: T) =>
  z
    .object({
      action: z.literal(action),
      data: z.object(data).strict(),
      key: id,
    })
    .strict();
export const dailyCommandSchema = z.union([
  command("shift.in", { branch_id: branch }),
  command("shift.out", { id }),
  command("shift.correct", {
    id,
    revision,
    reason,
    clocked_in_at: z.string().datetime(),
    clocked_out_at: z.string().datetime(),
  }),
  command("session.correct_start", { session_id: id, revision, reason }),
  command("session.start", { session_id: id, reason: reason.optional() }),
  command("student.arrive", { id, revision }),
  command("expense.save", {
    id: id.optional(),
    revision: revision.optional(),
    branch_id: branch,
    cost_date: z.string().date(),
    title: z.string().trim().min(2).max(150),
    category: z.string().trim().min(2).max(80),
    evidence: z.string().max(1000).optional(),
    amount_minor: amount,
  }),
  command("salary.agreement", {
    employee_id: id,
    effective_from: z.string().date(),
    effective_to: z.string().date(),
    amount_minor: amount,
    allocations,
  }),
  command("salary.end", { id, effective_to: z.string().date(), reason }),
  command("cost.reverse", {
    id,
    revision,
    payout_id: id,
    reference: z.string().trim().min(3).max(100),
    reason,
  }),
  command("salary.draft", {
    agreement_id: id,
    period_start: z.string().date(),
    reviewed_amount_minor: amount.optional(),
    reason: reason.optional(),
    allocations: allocations.optional(),
  }),
  command("cost.submit", { id, revision }),
  command("cost.review", {
    id,
    revision,
    reason,
    decision: z.enum(["approved", "rejected"]),
  }),
  command("cost.adjust", {
    id,
    revision,
    reason,
    adjustment_minor: z.number().int().min(-1_000_000_000).max(1_000_000_000),
    allocations,
  }),
  command("cost.pay", {
    id,
    revision,
    amount_minor: amount,
    method: z.enum(["cash", "bank", "card"]),
    reference: z.string().trim().min(3).max(100),
    paid_on: z.string().date(),
    allocations: allocations.optional(),
  }),
]);
export type DailyRow = { id: string; [key: string]: unknown };
export type DailyPage = {
  tasks?: {
    expected: number;
    arrived: number;
    unresolved: number;
    trials: number;
    followups: number;
    staffing: number;
  };
  rows: DailyRow[];
  total: number;
  can_clock_central: boolean;
  can_expenses: boolean;
  can_payroll: boolean;
  can_timekeeping: boolean;
  can_submit_expense: boolean;
  branches: { id: string; name: string }[];
  open_shift: DailyRow | null;
  summary?: {
    approved_cost_minor: number;
    paid_minor: number;
    outstanding_minor: number;
  };
  payouts?: DailyRow[];
  history?: DailyRow[];
  delivery?: DailyRow | null;
  delivered_at?: string | null;
  can_review_delivery?: boolean;
  expected_coach_id?: string;
  arrivals?: DailyRow[];
};
