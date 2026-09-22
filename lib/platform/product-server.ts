import { managementSchema, managementTables } from "./management";
import { administratorVerified } from "@/lib/platform/contracts";
import { receiptPdf } from "./receipt-pdf";
import { invoicePdf } from "./invoice-pdf";
import { reportPdf } from "./report-pdf";
import { loadReportDocument, ReportExportError } from "./report-export";
import { coachAttendanceSchema } from "./coach-attendance";
import { coachProfileSchema, coachProfileTables } from "./coach-profile";
import { eventCommands, eventTables } from "./events";
import { filesSchema, fileTables } from "./files";
import { communicationsSchema, communicationTables } from "./communications";
import { scheduleSchema, scheduleTables } from "./schedule";
import { engagementSchema, engagementTables } from "./engagement";
import { z } from "zod";
import { commercialSchema, commercialTables } from "./commercial";
import { developmentSchema, developmentTables } from "./development";
import { academySchema, academyTables } from "./academy";
import { communitySchema, communityTables } from "./community";
import { AppError, databaseError, type sessionClient } from "./server";
import type { AccountContext } from "./contracts";
import { certificatePdf } from "./certificate-pdf";
import certificateFont from "@/public/fonts/noto-sans-arabic-certificate.ttf?inline";
const permissionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("permission.grant"),
    data: z.object({
      user_id: z.string().uuid(),
      permission: z.string().regex(/^[a-z]+\.[a-z_]+$/),
      branch_id: z.string().uuid().optional(),
    }),
  }),
  z.object({
    action: z.literal("permission.revoke"),
    data: z.object({ id: z.string().uuid() }),
  }),
]);
export const productSchema = z.union([
  managementSchema,
  coachAttendanceSchema,
  coachProfileSchema,
  commercialSchema,
  developmentSchema,
  academySchema,
  communitySchema,
  engagementSchema,
  scheduleSchema,
  communicationsSchema,
  filesSchema,
  permissionSchema,
  z.discriminatedUnion("action", eventCommands),
]);
export function productAccess(account: AccountContext, action: string) {
  if (account.roles.includes("super_admin") && !administratorVerified(account))
    throw new AppError(
      "forbidden",
      "Administrator verification is required.",
      403,
    );
  if (
    action.startsWith("permission.") &&
    !account.roles.includes("super_admin")
  )
    throw new AppError(
      "forbidden",
      "Permission management requires an administrator.",
      403,
    );
  if (
    account.roles.length === 1 &&
    account.roles[0] === "sales" &&
    action !== "read" &&
    !action.startsWith("community.notification.")
  )
    throw new AppError(
      "forbidden",
      "This action is outside your sales workspace.",
      403,
    );
  // Record, branch, assignment, permission and family checks run again inside the transaction.
}
export const productTables = [
  ...managementTables,
  "coach_conversations",
  "coach_messages",
  "development_automation_policies",
  "coach_message_policies",
  "product_permissions",
  "product_events",
  "notifications",
  "delivery_outbox",
  ...coachProfileTables,
  ...commercialTables,
  ...developmentTables,
  ...academyTables,
  ...communityTables,
  ...engagementTables,
  ...scheduleTables,
  ...communicationTables,
  ...fileTables,
  ...eventTables,
] as const;
type DB = Awaited<ReturnType<typeof sessionClient>>;
export async function readProduct(db: DB, offset: number, branch?: string) {
  const result: Record<string, unknown> = {};
  let more = false;
  // Schema-checked table manifest; the read aggregator intentionally returns unshaped rows.
  const reader = db as unknown as {
    from(table: (typeof productTables)[number]): {
      select(columns: string): {
        order(column: string): {
          range(
            from: number,
            to: number,
          ): PromiseLike<{
            data: Record<string, unknown>[] | null;
            error: { code?: string; message?: string } | null;
          }>;
        };
      };
    };
  };
  await Promise.all(
    productTables.map(async (table) => {
      const r = branch
        ? await db.rpc("branch_records", {
            p_table: table,
            p_branch: branch,
            p_offset: offset,
          })
        : await reader
            .from(table)
            .select("*")
            .order(
              table === "package_offer_versions"
                ? "package_id"
                : table === "development_assessment_notes"
                  ? "assessment_id"
                  : table === "development_certificate_revocations"
                    ? "certificate_id"
                    : "id",
            )
            .range(offset, offset + 199);
      if (r.error) throw databaseError(r.error);
      result[table] = r.data || [];
      more ||= Array.isArray(r.data) && r.data.length === 200;
    }),
  );
  const linkedBranches = await db
    .from("family_branches")
    .select("family_id,branch_id")
    .order("family_id")
    .order("branch_id")
    .range(offset, offset + 199);
  if (linkedBranches.error) throw databaseError(linkedBranches.error);
  result.family_branches = (linkedBranches.data || []).filter(
    (r) => !branch || r.branch_id === branch,
  );
  more ||= linkedBranches.data?.length === 200;
  const attendance = await db.rpc("coach_attendance_sessions");
  if (attendance.error) throw databaseError(attendance.error);
  result.coach_attendance_sessions = attendance.data;
  const sessions = await db.rpc("development_sessions");
  if (sessions.error) throw databaseError(sessions.error);
  const family = await db.rpc("family_schedule");
  if (family.error) throw databaseError(family.error);
  result.family_schedule = family.data;
  result.development_sessions =
    branch && Array.isArray(sessions.data)
      ? sessions.data.filter(
          (r) =>
            r &&
            typeof r === "object" &&
            "branch_id" in r &&
            r.branch_id === branch,
        )
      : sessions.data;
  result.product_pagination = [{ offset, more }];
  return result;
}
export async function downloadCertificate(db: DB, id: string) {
  const record = await db
    .from("development_certificates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (record.error) throw databaseError(record.error);
  if (!record.data)
    throw new AppError(
      "not_found",
      "Certificate not found or no longer available.",
      404,
    );
  const row = record.data;
  const pdf = await certificatePdf(
    {
      reference: row.reference,
      recipient_name: row.recipient_name,
      sport: row.sport,
      level_name: row.level_name,
      title: row.title,
      issued_at: row.issued_at,
    },
    Uint8Array.from(atob(certificateFont.split(",")[1]), (c) =>
      c.charCodeAt(0),
    ),
  );
  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="KAFOU-${row.reference.replace(/[^A-Za-z0-9-]/g, "")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function downloadReport(db: DB, id: string, locale: "en" | "ar") {
  try {
    const report = await loadReportDocument(db, id);
    const bytes = await reportPdf(
      report,
      Uint8Array.from(atob(certificateFont.split(",")[1]), (c) =>
        c.charCodeAt(0),
      ),
      locale,
    );
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="KAFOU-Report-${report.month.slice(0, 7)}-v${report.version}-${report.id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ReportExportError)
      throw new AppError(
        error.status === 404 ? "not_found" : "unavailable",
        error.message,
        error.status,
      );
    throw error;
  }
}

/** An invoice PDF is an authorized accounting snapshot, not a tax document. */
export async function downloadInvoice(db: DB, id: string, locale: "en" | "ar") {
  const invoice = await db
    .from("commercial_invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (invoice.error) throw databaseError(invoice.error);
  if (!invoice.data)
    throw new AppError("not_found", "Invoice is not available.", 404);
  const [lines, allocations, adjustments, family, branch] = await Promise.all([
    db
      .from("commercial_invoice_lines")
      .select("*", { count: "exact" })
      .eq("invoice_id", id)
      .order("line_position")
      .limit(1000),
    db
      .from("commercial_allocations")
      .select("*", { count: "exact" })
      .eq("invoice_id", id)
      .limit(1000),
    db
      .from("commercial_adjustments")
      .select("*", { count: "exact" })
      .eq("invoice_id", id)
      .order("created_at")
      .limit(1000),
    db
      .from("families")
      .select("id,name")
      .eq("id", invoice.data.family_id)
      .maybeSingle(),
    db
      .from("branches")
      .select("id,name")
      .eq("id", invoice.data.branch_id)
      .maybeSingle(),
  ]);
  for (const result of [lines, allocations, adjustments]) {
    if (result.error) throw databaseError(result.error);
    if (result.count !== result.data?.length)
      throw new AppError(
        "unavailable",
        "The complete invoice could not be loaded.",
        503,
      );
  }
  if (family.error) throw databaseError(family.error);
  if (branch.error) throw databaseError(branch.error);
  if (!family.data || !branch.data || !lines.data?.length)
    throw new AppError(
      "unavailable",
      "The complete invoice could not be loaded.",
      503,
    );
  const payments = new Map<string, string>();
  for (const allocation of allocations.data || []) {
    if (payments.has(allocation.payment_id)) continue;
    const payment = await db
      .from("commercial_payments")
      .select("id,reference,family_id,branch_id")
      .eq("id", allocation.payment_id)
      .maybeSingle();
    if (payment.error) throw databaseError(payment.error);
    if (
      !payment.data ||
      payment.data.family_id !== invoice.data.family_id ||
      payment.data.branch_id !== invoice.data.branch_id
    )
      throw new AppError(
        "unavailable",
        "The complete invoice could not be loaded.",
        503,
      );
    payments.set(payment.data.id, payment.data.reference);
  }
  const bytes = await invoicePdf(
    {
      reference: invoice.data.reference,
      issued_at: invoice.data.created_at,
      as_of: new Date().toISOString(),
      currency: "AED",
      family_name: family.data.name,
      branch_name: branch.data.name,
      lines: lines.data.map((line) => ({
        description: line.description,
        description_ar: line.description_ar,
        quantity: line.quantity,
        unit_minor: line.unit_minor,
      })),
      allocations: (allocations.data || []).map((allocation) => ({
        reference: payments.get(allocation.payment_id)!,
        amount_minor: allocation.amount_minor,
      })),
      adjustments: (adjustments.data || []).map((adjustment) => ({
        kind: adjustment.kind as "discount" | "writeoff" | "reversal",
        amount_minor: adjustment.amount_minor,
        reason: adjustment.reason,
      })),
    },
    Uint8Array.from(atob(certificateFont.split(",")[1]), (c) =>
      c.charCodeAt(0),
    ),
    locale,
  );
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="KAFOU-Invoice-${invoice.data.reference.replace(/[^A-Za-z0-9-]/g, "")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** A receipt is an authorized accounting projection, never provider settlement proof. */
export async function downloadReceipt(db: DB, id: string, locale: "en" | "ar") {
  const receipt = await db
    .from("commercial_receipts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (receipt.error) throw databaseError(receipt.error);
  if (!receipt.data)
    throw new AppError("not_found", "Receipt is not available.", 404);
  const payment = await db
    .from("commercial_payments")
    .select("*")
    .eq("id", receipt.data.payment_id)
    .maybeSingle();
  if (payment.error) throw databaseError(payment.error);
  if (!payment.data)
    throw new AppError("not_found", "Receipt is not available.", 404);
  const [allocations, refunds] = await Promise.all([
    db
      .from("commercial_allocations")
      .select("*", { count: "exact" })
      .eq("payment_id", payment.data.id)
      .limit(1000),
    db
      .from("commercial_refunds")
      .select("*", { count: "exact" })
      .eq("payment_id", payment.data.id)
      .limit(1000),
  ]);
  for (const result of [allocations, refunds]) {
    if (result.error) throw databaseError(result.error);
    if (result.count !== result.data?.length)
      throw new AppError(
        "unavailable",
        "The complete receipt could not be loaded.",
        503,
      );
  }
  const amounts = new Map<string, number>();
  for (const a of allocations.data || [])
    amounts.set(
      a.invoice_id,
      (amounts.get(a.invoice_id) || 0) + a.amount_minor,
    );
  const lines: { invoice_reference: string; amount_minor: number }[] = [];
  for (const [invoiceId, amount] of amounts) {
    const invoice = await db
      .from("commercial_invoices")
      .select("reference,family_id,branch_id")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invoice.error) throw databaseError(invoice.error);
    if (
      !invoice.data ||
      invoice.data.family_id !== payment.data.family_id ||
      invoice.data.branch_id !== payment.data.branch_id ||
      amount < 0
    )
      throw new AppError(
        "unavailable",
        "The complete receipt could not be loaded.",
        503,
      );
    lines.push({
      invoice_reference: invoice.data.reference,
      amount_minor: amount,
    });
  }
  const method = payment.data.method;
  if (
    method !== "cash" &&
    method !== "bank_transfer" &&
    method !== "external_terminal"
  )
    throw new AppError(
      "unavailable",
      "Unsupported receipt payment method.",
      503,
    );
  const bytes = await receiptPdf(
    {
      reference: receipt.data.reference,
      issued_at: receipt.data.created_at,
      payment: {
        amount_minor: payment.data.amount_minor,
        currency: "AED",
        method,
        reference: payment.data.reference,
        recorded_at: payment.data.created_at,
      },
      allocations: lines,
      refunded_minor: (refunds.data || []).reduce(
        (n, r) => n + r.amount_minor,
        0,
      ),
      as_of: new Date().toISOString(),
    },
    Uint8Array.from(atob(certificateFont.split(",")[1]), (c) =>
      c.charCodeAt(0),
    ),
    locale,
  );
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="KAFOU-${receipt.data.reference.replace(/[^A-Za-z0-9-]/g, "")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
