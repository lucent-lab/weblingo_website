import { describe, expect, it } from "vitest";

import { formatStripeBillingStatusLabel, resolveStripeBillingRuntime } from "./billing-runtime";

describe("stripe billing runtime state", () => {
  it("returns null when metadata is empty", () => {
    expect(resolveStripeBillingRuntime({})).toBeNull();
  });

  it("parses a persisted stripe billing snapshot", () => {
    const state = resolveStripeBillingRuntime({
      stripeCustomerId: "cus_123",
      lastStripeSubscriptionId: "sub_123",
      stripeSubscriptionStatus: "past_due",
      stripeSubscriptionPriceId: "price_123",
      stripeSubscriptionCurrentPeriodEnd: "2026-04-10T00:00:00.000Z",
      stripeSubscriptionCancelAtPeriodEnd: true,
    });

    expect(state).toEqual({
      customerId: "cus_123",
      subscriptionId: "sub_123",
      status: "past_due",
      priceId: "price_123",
      currentPeriodEnd: "2026-04-10T00:00:00.000Z",
      cancelAtPeriodEnd: true,
    });
    expect(formatStripeBillingStatusLabel(state)).toBe("Stripe: past due");
  });
});
