import test from "node:test";
import assert from "node:assert/strict";
import {
  paymentAdapter,
  whatsAppAdapter,
  ProviderInactive,
  paymentMatchesInvoice,
  aiCallCenterAdapter,
  integrationStatus,
} from "../lib/platform/providers/contracts";
test("Inactive providers cannot fabricate checkout, settlement or delivery", async () => {
  const invoice = {
    invoiceId: "00000000-0000-4000-8000-000000000001",
    amountMinor: 12345,
    currency: "AED" as const,
    idempotencyKey: "00000000-0000-4000-8000-000000000002",
  };
  await assert.rejects(
    paymentAdapter.createCheckout(invoice),
    ProviderInactive,
  );
  await assert.rejects(
    paymentAdapter.verifyWebhook(new Uint8Array(), new Headers()),
    ProviderInactive,
  );
  await assert.rejects(paymentAdapter.reconcile("unknown"), ProviderInactive);
  await assert.rejects(
    whatsAppAdapter.sendApprovedTemplate({
      recipient: "synthetic",
      templateId: "unapproved",
      language: "en",
      variables: {},
      idempotencyKey: "synthetic",
    }),
    ProviderInactive,
  );
  await assert.rejects(
    whatsAppAdapter.verifyWebhook(new Uint8Array(), new Headers()),
    ProviderInactive,
  );
  await assert.rejects(
    aiCallCenterAdapter.recommendBranch({
      leadId: invoice.invoiceId,
      locationText: "Synthetic location",
      sport: "swimming",
      permittedBranchIds: [invoice.idempotencyKey],
      idempotencyKey: invoice.idempotencyKey,
    }),
    ProviderInactive,
  );
  await assert.rejects(
    aiCallCenterAdapter.startApprovedCall({
      leadId: invoice.invoiceId,
      recipient: "synthetic",
      language: "en",
      approvedScriptId: "unapproved",
      idempotencyKey: invoice.idempotencyKey,
    }),
    ProviderInactive,
  );
  assert.equal(integrationStatus.aiCallCenter.outbound, false);
  assert.equal(integrationStatus.aiCallCenter.humanReviewRequired, true);
  const event = {
    provider: "unconfigured",
    eventId: "not-an-event",
    paymentId: "not-a-payment",
    invoiceId: invoice.invoiceId,
    amountMinor: 12344,
    currency: "AED" as const,
    status: "pending" as const,
    occurredAt: "2026-09-20T00:00:00Z",
  };
  assert.equal(paymentMatchesInvoice(event, invoice), false);
  assert.equal(
    paymentMatchesInvoice(
      { ...event, amountMinor: 12345, invoiceId: invoice.idempotencyKey },
      invoice,
    ),
    false,
  );
});
