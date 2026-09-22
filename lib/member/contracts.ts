import { z } from "zod";
/** Version 1 deliberately exposes customer commands only; never forward arbitrary RPC names. */
export const memberActions = [
  "family.create", "family.update", "child.save", "child.sport", "consent.record",
  "trial.book", "trial.cancel", "academy.makeup.book", "academy.makeup.cancel",
  "academy.waitlist.join", "academy.waitlist.accept", "commercial.membership.renew",
  "community.notification.read", "community.ticket.open", "community.ticket.reply",
  "community.contact.save", "community.document.accept", "files.withdraw",
  "events.register", "events.cancel_registration", "engagement.challenge.join",
  "engagement.completion.submit", "schedule.acknowledge",
] as const;
export const resources = ["families", "children", "sessions", "progress", "memberships", "notifications", "documents", "credits", "waitlist", "waitlist-options", "levels", "invoices", "receipts", "support", "consents", "events", "challenges", "recognition", "trials"] as const;
export const memberQuery = z.object({
  resource: z.enum(resources), child: z.string().uuid().nullable(),
  cursor: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const memberCommand = z.object({ action: z.enum(memberActions), data: z.record(z.unknown()), key: z.string().uuid() }).strict();
export interface MemberAction { action: typeof memberActions[number]; data: Record<string, unknown> }
/** Closed projection, not a database row. Optional domain fields are absent where inapplicable. */
export interface MemberRecord {
  id: string; kind: string; title: string; title_ar?: string; detail?: string; status?: string;
  child_id?: string; family_id?: string; branch_id?: string; sport?: string;
  starts_at?: string; ends_at?: string; date?: string; attendance?: string;
  amount_minor?: number; currency?: "AED"; available?: number; reserved?: number; consumed?: number;
  document_path?: string; actions: MemberAction[];
}
export interface MemberPage { items: MemberRecord[]; next_cursor: number | null; server_time: string }
