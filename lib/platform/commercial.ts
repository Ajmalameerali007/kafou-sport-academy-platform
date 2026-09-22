import { z } from "zod";
const id = z.string().uuid(),
  reason = z.string().trim().min(5).max(500);
const amount = z.coerce.number().int().min(1).max(1_000_000_000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
const command = <A extends string, T extends z.ZodTypeAny>(
  action: A,
  data: T,
) => z.object({ action: z.literal(action), data });
export const commercialSchema = z.discriminatedUnion("action", [
  command(
    "commercial.invoice.create",
    z
      .object({
        family_id: id,
        branch_id: id,
        reference: z.string().trim().min(3).max(100),
        lines: z
          .array(
            z
              .object({
                child_id: id,
                package_id: id,
                quantity: z.coerce.number().int().min(1).max(100),
              })
              .strict(),
          )
          .min(1)
          .max(20)
          .refine(
            (lines) =>
              new Set(
                lines.map((line) => `${line.child_id}:${line.package_id}`),
              ).size === lines.length,
            "Combine repeated child and package lines using quantity.",
          ),
      })
      .strict(),
  ),
  command(
    "commercial.package.create",
    z.object({
      branch_id: id,
      sport: z.enum(["swimming", "football", "karate", "badminton"]),
      level_id: id.optional(),
      name: z.string().trim().min(2).max(100),
      name_ar: z.string().max(100).default(""),
      price_minor: amount.or(z.literal(0)),
      session_allowance: z.coerce.number().int().min(1).max(100),
      terms: z.string().trim().min(5).max(2000),
      terms_ar: z.string().max(2000).default(""),
    }),
  ),
  command("commercial.package.status", z.object({ id, active: z.boolean() })),
  command(
    "commercial.membership.start",
    z.object({
      child_id: id,
      package_id: id,
      starts_on: date,
      accepted: z.literal(true),
    }),
  ),
  command(
    "commercial.membership.renew",
    z
      .object({
        id,
        accepted: z.literal(true),
        expected_expires_on: date.optional(),
        expected_package_id: id.optional(),
      })
      .refine(
        (x) =>
          Boolean(x.expected_expires_on) === Boolean(x.expected_package_id),
        "Review requires both the period and offer",
      ),
  ),
  command(
    "commercial.membership.freeze",
    z.object({
      id,
      frozen: z.boolean(),
      reason,
      extend_days: z.coerce.number().int().min(0).max(366).default(0),
    }),
  ),
  command(
    "commercial.membership.cancel.preview",
    z
      .object({
        id,
        policy: z.enum(["none", "unused_calendar_days", "unused_entitlements"]),
      })
      .strict(),
  ),
  command(
    "commercial.membership.cancel",
    z.object({ preview_id: id, reason }).strict(),
  ),
  command(
    "commercial.payment.record",
    z.object({
      family_id: id,
      branch_id: id,
      amount_minor: amount,
      method: z.enum(["cash", "bank_transfer", "external_terminal"]),
      reference: z.string().trim().min(3).max(100),
      invoice_id: id.optional(),
    }),
  ),
  command(
    "commercial.payment.allocate",
    z.object({ payment_id: id, invoice_id: id, amount_minor: amount }),
  ),
  command(
    "commercial.payment.allocate-split",
    z.object({
      payment_id: id,
      allocations: z
        .array(z.object({ invoice_id: id, amount_minor: amount }).strict())
        .min(2)
        .max(10)
        .refine(
          (rows) => new Set(rows.map((r) => r.invoice_id)).size === rows.length,
          "Each invoice can only be listed once",
        ),
    }),
  ),
  command(
    "commercial.payment.unallocate",
    z.object({ allocation_id: id, amount_minor: amount.optional(), reason }),
  ),
  command(
    "commercial.payment.refund",
    z.object({
      payment_id: id,
      amount_minor: amount,
      reason,
      reference: z.string().trim().min(3).max(100),
    }),
  ),
  command(
    "commercial.invoice.adjust",
    z.object({
      invoice_id: id,
      kind: z.enum(["discount", "writeoff"]),
      amount_minor: amount,
      reason,
    }),
  ),
  command("commercial.invoice.reverse-adjustment", z.object({ id, reason })),
  command(
    "commercial.credit.approve",
    z.object({ invoice_id: id, reason, expires_on: date }),
  ),
  command("commercial.credit.revoke", z.object({ id, reason })),
  command("commercial.renewals.queue", z.object({ branch_id: id })),
  command(
    "commercial.compensation.rate",
    z
      .object({
        coach_id: id,
        branch_id: id,
        amount_minor: amount,
        effective_from: date,
        effective_to: date,
      })
      .refine((v) => v.effective_to > v.effective_from),
  ),
  command("commercial.compensation.accrue", z.object({ session_id: id })),
  command(
    "commercial.compensation.settle",
    z.object({ id, reference: z.string().trim().min(3).max(100), reason }),
  ),
  command(
    "commercial.compensation.reverse",
    z.object({ id, reference: z.string().trim().min(3).max(100), reason }),
  ),
  command(
    "commercial.compensation.review",
    z.object({ id, decision: z.enum(["approved", "rejected"]), reason }),
  ),
]);
export const commercialTables = [
  "commercial_packages",
  "commercial_memberships",
  "commercial_invoices",
  "commercial_invoice_lines",
  "commercial_payments",
  "commercial_allocations",
  "commercial_receipts",
  "commercial_adjustments",
  "commercial_credit_approvals",
  "commercial_refunds",
  "commercial_freezes",
  "commercial_renewal_reminders",
  "entitlement_ledger",
  "commercial_compensation_rates",
  "commercial_compensation_accruals",
  "commercial_compensation_settlements",
  "commercial_membership_extensions",
  "commercial_cancellation_previews",
  "commercial_membership_cancellations",
] as const;
type Row = Record<string, unknown>;
export function invoiceBalance(
  invoiceId: string,
  lines: Row[],
  allocations: Row[],
  adjustments: Row[],
) {
  return (
    lines
      .filter((r) => r.invoice_id === invoiceId)
      .reduce((n, r) => n + Number(r.quantity) * Number(r.unit_minor), 0) -
    allocations
      .filter((r) => r.invoice_id === invoiceId)
      .reduce((n, r) => n + Number(r.amount_minor), 0) -
    adjustments
      .filter((r) => r.invoice_id === invoiceId)
      .reduce((n, r) => n + Number(r.amount_minor), 0)
  );
}
export function entitlementBalance(membershipId: string, entries: Row[]) {
  return entries
    .filter((r) => r.membership_id === membershipId)
    .reduce<{ available: number; reserved: number; consumed: number }>(
      (n, r) => ({
        available: n.available + Number(r.available_delta),
        reserved: n.reserved + Number(r.reserved_delta),
        consumed: n.consumed + Number(r.consumed_delta),
      }),
      { available: 0, reserved: 0, consumed: 0 },
    );
}
export function allocationRemaining(allocation: Row, entries: Row[]) {
  return (
    Number(allocation.amount_minor) +
    entries
      .filter((entry) => entry.reversal_of === allocation.id)
      .reduce((sum, entry) => sum + Number(entry.amount_minor), 0)
  );
}
export function money(minor: number, locale = "en") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    style: "currency",
    currency: "AED",
  }).format(minor / 100);
}

/** Display eligibility from debt and credit expiry even before the next write refreshes status. */
export function membershipStatus(
  member: Row,
  outstanding: number,
  credit: Row[],
  today: string,
) {
  if (member.status === "cancelled") return "cancelled";
  if (String(member.expires_on) <= today) return "Expired";
  if (
    member.status === "active" &&
    outstanding > 0 &&
    !credit.some(
      (c) =>
        !c.revoked_at &&
        String(c.expires_on) >= today &&
        Number(c.amount_minor) >= outstanding,
    )
  )
    return "suspended";
  return String(member.status);
}
