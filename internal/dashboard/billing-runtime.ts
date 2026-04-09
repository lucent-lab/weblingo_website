type StripeBillingUserMetadata = Record<string, unknown> & {
  stripeCustomerId?: unknown;
  lastStripeSubscriptionId?: unknown;
  stripeSubscriptionStatus?: unknown;
  stripeSubscriptionPriceId?: unknown;
  stripeSubscriptionCurrentPeriodEnd?: unknown;
  stripeSubscriptionCancelAtPeriodEnd?: unknown;
};

export type StripeBillingRuntimeState = {
  customerId: string | null;
  subscriptionId: string | null;
  status: string | null;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
};

export function resolveStripeBillingRuntime(
  userMetadata: unknown,
): StripeBillingRuntimeState | null {
  if (userMetadata == null || typeof userMetadata !== "object" || Array.isArray(userMetadata)) {
    return null;
  }

  const metadata = userMetadata as StripeBillingUserMetadata;
  const status =
    typeof metadata.stripeSubscriptionStatus === "string"
      ? metadata.stripeSubscriptionStatus.trim()
      : "";
  const customerId =
    typeof metadata.stripeCustomerId === "string" ? metadata.stripeCustomerId.trim() : "";
  const subscriptionId =
    typeof metadata.lastStripeSubscriptionId === "string"
      ? metadata.lastStripeSubscriptionId.trim()
      : "";
  const priceId =
    typeof metadata.stripeSubscriptionPriceId === "string"
      ? metadata.stripeSubscriptionPriceId.trim()
      : "";
  const currentPeriodEnd =
    typeof metadata.stripeSubscriptionCurrentPeriodEnd === "string"
      ? metadata.stripeSubscriptionCurrentPeriodEnd.trim()
      : "";
  const cancelAtPeriodEnd =
    typeof metadata.stripeSubscriptionCancelAtPeriodEnd === "boolean"
      ? metadata.stripeSubscriptionCancelAtPeriodEnd
      : null;

  if (!status && !customerId && !subscriptionId && !priceId && !currentPeriodEnd) {
    return null;
  }

  return {
    customerId: customerId || null,
    subscriptionId: subscriptionId || null,
    status: status || null,
    priceId: priceId || null,
    currentPeriodEnd: currentPeriodEnd || null,
    cancelAtPeriodEnd,
  };
}

export function formatStripeBillingStatusLabel(
  state: StripeBillingRuntimeState | null,
): string | null {
  if (!state?.status) {
    return null;
  }
  return `Stripe: ${state.status.replaceAll("_", " ")}`;
}
