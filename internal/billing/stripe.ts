import "server-only";

import Stripe from "stripe";

import { envServer } from "@internal/core/env-server";
import { SITE_ID, pricingTiers } from "@modules/pricing";

// Pin the API version so Stripe behavior is stable across account defaults.
// Keep this aligned with the Stripe SDK's latest typed API version.
const stripe = new Stripe(envServer.STRIPE_SECRET_KEY, { apiVersion: "2025-10-29.clover" });

function resolvePriceId(planId: string, cadence: "monthly" | "yearly") {
  const plan = pricingTiers.find((tier) => tier.id === planId);
  if (!plan) {
    throw new Error(`Unknown pricing plan: ${planId}`);
  }

  const priceId = cadence === "monthly" ? plan.priceIdMonthly : plan.priceIdYearly;

  if (!priceId) {
    throw new Error(`Missing ${cadence} price for plan: ${planId}`);
  }

  return { priceId, plan };
}

export async function createCheckoutSession({
  planId,
  cadence,
  email,
  successUrl,
  cancelUrl,
}: {
  planId: string;
  cadence: "monthly" | "yearly";
  email?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const { priceId, plan } = resolvePriceId(planId, cadence);

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    metadata: {
      siteId: SITE_ID,
      planId: plan.id,
      cadence,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: {
        siteId: SITE_ID,
        planId: plan.id,
        cadence,
      },
    },
  });
}

export function verifyStripeSignature(payload: Buffer, signature: string) {
  return stripe.webhooks.constructEvent(payload, signature, envServer.STRIPE_WEBHOOK_SECRET);
}

export function getStripeClient() {
  return stripe;
}
