import { z } from "zod";
/** Vendor-neutral ports. A configured vendor must verify the original raw bytes
 * before constructing either event. No browser return is settlement evidence. */
export const checkoutRequest = z
  .object({
    invoiceId: z.string().uuid(),
    amountMinor: z.number().int().positive().max(1_000_000_000),
    currency: z.literal("AED"),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export type CheckoutRequest = z.infer<typeof checkoutRequest>;
export type VerifiedPayment = {
  provider: string;
  eventId: string;
  paymentId: string;
  invoiceId: string;
  amountMinor: number;
  currency: "AED";
  status: "pending" | "settled" | "failed" | "refunded";
  occurredAt: string;
};
export interface PaymentAdapter {
  readonly vendor: string;
  createCheckout(
    request: CheckoutRequest,
  ): Promise<{ providerReference: string; url: string }>;
  verifyWebhook(raw: Uint8Array, headers: Headers): Promise<VerifiedPayment>;
  reconcile(providerReference: string): Promise<VerifiedPayment>;
}
export interface WhatsAppAdapter {
  readonly vendor: string;
  sendApprovedTemplate(request: {
    recipient: string;
    templateId: string;
    language: "en" | "ar";
    variables: Record<string, string>;
    idempotencyKey: string;
  }): Promise<{ providerMessageId: string; status: "accepted" }>;
  verifyWebhook(
    raw: Uint8Array,
    headers: Headers,
  ): Promise<{
    eventId: string;
    providerMessageId: string;
    status: "delivered" | "read" | "failed";
    occurredAt: string;
  }>;
}
export interface AiCallCenterAdapter {
  readonly vendor: string;
  recommendBranch(request: {
    leadId: string;
    locationText: string;
    sport: "swimming" | "football" | "karate" | "badminton";
    permittedBranchIds: string[];
    idempotencyKey: string;
  }): Promise<{
    branchId: string;
    explanation: string;
    confidence: number;
    requiresHumanReview: true;
  }>;
  startApprovedCall(request: {
    leadId: string;
    recipient: string;
    language: "en" | "ar";
    approvedScriptId: string;
    idempotencyKey: string;
  }): Promise<{ providerCallId: string; status: "accepted" }>;
  verifyWebhook(
    raw: Uint8Array,
    headers: Headers,
  ): Promise<{
    eventId: string;
    providerCallId: string;
    status: "answered" | "completed" | "failed";
    occurredAt: string;
  }>;
}
export class ProviderInactive extends Error {
  readonly code = "provider_not_configured";
  constructor() {
    super(
      "Provider is inactive. Vendor approval and test configuration are required.",
    );
  }
}
// No fake or test-success adapter is installed. These ports cannot mutate ledgers,
// mark an outbox delivered, generate a payment link or perform network requests.
export const paymentAdapter: PaymentAdapter = Object.freeze({
  vendor: "unconfigured",
  async createCheckout() {
    throw new ProviderInactive();
  },
  async verifyWebhook() {
    throw new ProviderInactive();
  },
  async reconcile() {
    throw new ProviderInactive();
  },
});
export const whatsAppAdapter: WhatsAppAdapter = Object.freeze({
  vendor: "unconfigured",
  async sendApprovedTemplate() {
    throw new ProviderInactive();
  },
  async verifyWebhook() {
    throw new ProviderInactive();
  },
});
export const aiCallCenterAdapter: AiCallCenterAdapter = Object.freeze({
  vendor: "unconfigured",
  async recommendBranch() {
    throw new ProviderInactive();
  },
  async startApprovedCall() {
    throw new ProviderInactive();
  },
  async verifyWebhook() {
    throw new ProviderInactive();
  },
});
export const integrationStatus = Object.freeze({
  payment: { state: "not_configured", checkout: false, webhooks: false },
  whatsapp: { state: "not_configured", outbound: false, inbound: false },
  aiCallCenter: {
    state: "not_configured",
    branchRecommendation: false,
    outbound: false,
    webhooks: false,
    humanReviewRequired: true,
  },
});
/** A verified provider event still must match a locked, authorized invoice before
 * any future transactional reconciliation handler posts an append-only entry. */
export function paymentMatchesInvoice(
  event: VerifiedPayment,
  invoice: CheckoutRequest,
) {
  return (
    event.invoiceId === invoice.invoiceId &&
    event.currency === invoice.currency &&
    Number.isSafeInteger(event.amountMinor) &&
    event.amountMinor === invoice.amountMinor
  );
}
