import { z } from "zod";
const id = z.string().uuid(),
  text = z.string().trim().min(2).max(2000),
  short = z.string().trim().min(2).max(160);
const cmd = <T extends string, S extends z.ZodRawShape>(action: T, data: S) =>
  z.object({ action: z.literal(action), data: z.object(data) });
export const communitySchema = z.discriminatedUnion("action", [
  cmd("community.notification.read", { id }),
  cmd("community.ticket.open", {
    family_id: id,
    branch_id: id,
    child_id: id.optional(),
    session_id: id.optional(),
    invoice_id: id.optional(),
    subject: short,
    message: text,
  }),
  cmd("community.ticket.reply", { id, message: text }),
  cmd("community.ticket.resolve", { id, resolution: text }),
  cmd("community.ticket.assign", { id, user_id: id }),
  cmd("community.contact.save", {
    family_id: id,
    name: short,
    mobile: z.string().min(9).max(25),
    relationship: short,
  }),
  cmd("community.guardian.invite", { family_id: id, user_id: id }),
  cmd("community.guardian.accept", {
    token: z.string().regex(/^[a-f0-9]{48}$/),
  }),
  cmd("community.guardian.revoke", { family_id: id, user_id: id }),
  cmd("community.handover.create", {
    branch_id: id,
    title: short,
    note: text,
    follow_up_at: z.string().datetime({ offset: true }).optional(),
    assigned_to: id.optional(),
  }),
  cmd("community.handover.close", { id, resolution: text }),
  cmd("community.document.create", {
    title: short,
    purpose: z.enum(["privacy", "waiver", "media", "contact"]),
    version: short,
    body: text,
  }),
  cmd("community.document.accept", {
    id,
    family_id: id,
    granted: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .or(z.boolean()),
  }),
  cmd("community.recognition.nominate", {
    child_id: id,
    branch_id: id,
    title: short,
    evidence: text,
  }),
  cmd("community.recognition.review", {
    id,
    decision: z.enum(["approved", "returned"]),
    reason: text,
  }),
]);
export const communityTables = [
  "family_emergency_contacts",
  "support_tickets",
  "support_messages",
  "shift_handovers",
  "document_versions",
  "document_acceptances",
  "recognition_nominations",
] as const;
