import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";

const verifyStripeSignature = vi.fn();
const getStripeClient = vi.fn();
vi.mock("@internal/billing", () => ({ verifyStripeSignature, getStripeClient }));

const createServiceRoleClient = vi.fn();
const fetchUserByEmail = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient, fetchUserByEmail }));

const analyticsMocks = vi.hoisted(() => ({
  captureServerAnalyticsEvent: vi.fn(),
  captureServerException: vi.fn(),
  hashAnalyticsIdentifier: vi.fn((namespace: string, value: string | null | undefined) =>
    value ? `${namespace}:hashed` : null,
  ),
}));
vi.mock("@internal/analytics/server", () => analyticsMocks);

const ORIGINAL_ENV = { ...process.env };

function setRequiredEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://example.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://api.example.com/api";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS = "15000";

  process.env.PUBLIC_PORTAL_MODE = "enabled";
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.SUPABASE_SECRET_KEY = "sb_secret";
  process.env.SUPABASE_AUTH_TIMEOUT_MS = "15000";

  process.env.WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_WAITLIST_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_WAITLIST_MAX_BODY_BYTES = "4096";
  process.env.WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_CONTACT_MAX_PER_WINDOW = "10";

  process.env.UPSTASH_REDIS__KV_REST_API_URL = "https://example.com";
  process.env.UPSTASH_REDIS__KV_REST_API_TOKEN = "dummy";
}

function makeRequest(body: string): NextRequest {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "sig_test",
    },
    body,
  }) as unknown as NextRequest;
}

beforeAll(() => {
  process.env = { ...ORIGINAL_ENV };
  setRequiredEnv();
});

beforeEach(() => {
  verifyStripeSignature.mockReset();
  getStripeClient.mockReset();
  createServiceRoleClient.mockReset();
  fetchUserByEmail.mockReset();
  analyticsMocks.captureServerAnalyticsEvent.mockReset();
  analyticsMocks.captureServerException.mockReset();
  analyticsMocks.hashAnalyticsIdentifier.mockClear();
});

describe("POST /api/stripe/webhook", () => {
  it("persists billing runtime metadata for checkout completion", async () => {
    const checkoutPeriodEnd = 1_765_065_600;
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          {
            id: "user-1",
            user_metadata: { existing: true, stripeCustomerId: "cus_123" },
          },
        ],
      },
      error: null,
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const createUser = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      auth: { admin: { listUsers, updateUserById, createUser } },
    });

    const retrieveSubscription = vi.fn().mockResolvedValue({
      id: "sub_123",
      status: "active",
      cancel_at_period_end: false,
      current_period_end: checkoutPeriodEnd,
      items: { data: [{ price: { id: "price_123" } }] },
      customer: "cus_123",
    });
    const retrieveCustomer = vi.fn();
    getStripeClient.mockReturnValue({
      subscriptions: { retrieve: retrieveSubscription },
      customers: { retrieve: retrieveCustomer },
    });

    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          mode: "subscription",
          customer: "cus_123",
          subscription: "sub_123",
          customer_details: { email: "billing@example.com" },
          locale: "en",
        },
      },
    } as unknown as Stripe.Event;
    verifyStripeSignature.mockReturnValueOnce(event);

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(200);
    expect(analyticsMocks.captureServerAnalyticsEvent).toHaveBeenCalledWith(
      "stripe_webhook_received",
      expect.objectContaining({ stripe_event_type: "checkout.session.completed" }),
      expect.any(Object),
    );
    expect(analyticsMocks.captureServerAnalyticsEvent).toHaveBeenCalledWith(
      "stripe_webhook_processed",
      expect.objectContaining({
        stripe_event_type: "checkout.session.completed",
        outcome: "checkout_metadata_upsert_attempted",
      }),
      expect.any(Object),
    );
    expect(retrieveSubscription).toHaveBeenCalledOnce();
    expect(listUsers).toHaveBeenCalled();
    expect(fetchUserByEmail).not.toHaveBeenCalled();
    expect(updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          existing: true,
          stripeCustomerId: "cus_123",
          lastStripeSubscriptionId: "sub_123",
          stripeSubscriptionStatus: "active",
          stripeSubscriptionPriceId: "price_123",
          stripeSubscriptionCurrentPeriodEnd: new Date(checkoutPeriodEnd * 1000).toISOString(),
          stripeSubscriptionCancelAtPeriodEnd: false,
          locale: "en",
        }),
      }),
    );
    expect(createUser).not.toHaveBeenCalled();
  });

  it("continues checkout provisioning when subscription lookup fails", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [],
      },
      error: null,
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const createUser = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      auth: { admin: { listUsers, updateUserById, createUser } },
    });

    const retrieveSubscription = vi.fn().mockRejectedValue(new Error("stripe unavailable"));
    const retrieveCustomer = vi.fn();
    getStripeClient.mockReturnValue({
      subscriptions: { retrieve: retrieveSubscription },
      customers: { retrieve: retrieveCustomer },
    });
    fetchUserByEmail.mockResolvedValue(null);

    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          mode: "subscription",
          customer: "cus_123",
          subscription: "sub_123",
          customer_details: { email: "billing@example.com" },
          locale: "en",
        },
      },
    } as unknown as Stripe.Event;
    verifyStripeSignature.mockReturnValueOnce(event);

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(200);
    expect(retrieveSubscription).toHaveBeenCalledOnce();
    expect(retrieveCustomer).not.toHaveBeenCalled();
    expect(fetchUserByEmail).toHaveBeenCalledWith("billing@example.com");
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "billing@example.com",
        email_confirm: true,
        user_metadata: expect.objectContaining({
          stripeCustomerId: "cus_123",
          lastStripeSubscriptionId: "sub_123",
          stripeSubscriptionStatus: null,
          stripeSubscriptionPriceId: null,
          stripeSubscriptionCurrentPeriodEnd: null,
          stripeSubscriptionCancelAtPeriodEnd: null,
          locale: "en",
        }),
      }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("updates checkout metadata when Stripe omits the customer email", async () => {
    const checkoutPeriodEnd = 1_765_065_600;
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          {
            id: "user-1",
            user_metadata: { existing: true, stripeCustomerId: "cus_123" },
          },
        ],
      },
      error: null,
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const createUser = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      auth: { admin: { listUsers, updateUserById, createUser } },
    });

    const retrieveSubscription = vi.fn().mockResolvedValue({
      id: "sub_123",
      status: "active",
      cancel_at_period_end: false,
      current_period_end: checkoutPeriodEnd,
      items: { data: [{ price: { id: "price_123" } }] },
      customer: "cus_123",
    });
    const retrieveCustomer = vi.fn().mockResolvedValue({ email: null });
    getStripeClient.mockReturnValue({
      subscriptions: { retrieve: retrieveSubscription },
      customers: { retrieve: retrieveCustomer },
    });

    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          mode: "subscription",
          customer: "cus_123",
          subscription: "sub_123",
        },
      },
    } as unknown as Stripe.Event;
    verifyStripeSignature.mockReturnValueOnce(event);

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(200);
    expect(retrieveSubscription).toHaveBeenCalledOnce();
    expect(retrieveCustomer).toHaveBeenCalledWith("cus_123");
    expect(fetchUserByEmail).not.toHaveBeenCalled();
    expect(updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          existing: true,
          stripeCustomerId: "cus_123",
          lastStripeSubscriptionId: "sub_123",
          stripeSubscriptionStatus: "active",
          stripeSubscriptionPriceId: "price_123",
          stripeSubscriptionCurrentPeriodEnd: new Date(checkoutPeriodEnd * 1000).toISOString(),
          stripeSubscriptionCancelAtPeriodEnd: false,
        }),
      }),
    );
    expect(createUser).not.toHaveBeenCalled();
  });

  it("continues checkout provisioning when the Stripe customer email lookup fails", async () => {
    const checkoutPeriodEnd = 1_765_065_600;
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          {
            id: "user-1",
            user_metadata: { existing: true, stripeCustomerId: "cus_123" },
          },
        ],
      },
      error: null,
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const createUser = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      auth: { admin: { listUsers, updateUserById, createUser } },
    });

    const retrieveSubscription = vi.fn().mockResolvedValue({
      id: "sub_123",
      status: "active",
      cancel_at_period_end: false,
      current_period_end: checkoutPeriodEnd,
      items: { data: [{ price: { id: "price_123" } }] },
      customer: "cus_123",
    });
    const retrieveCustomer = vi.fn().mockRejectedValue(new Error("stripe unavailable"));
    getStripeClient.mockReturnValue({
      subscriptions: { retrieve: retrieveSubscription },
      customers: { retrieve: retrieveCustomer },
    });

    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          mode: "subscription",
          customer: "cus_123",
          subscription: "sub_123",
        },
      },
    } as unknown as Stripe.Event;
    verifyStripeSignature.mockReturnValueOnce(event);

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(200);
    expect(retrieveSubscription).toHaveBeenCalledOnce();
    expect(retrieveCustomer).toHaveBeenCalledWith("cus_123");
    expect(fetchUserByEmail).not.toHaveBeenCalled();
    expect(updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          existing: true,
          stripeCustomerId: "cus_123",
          lastStripeSubscriptionId: "sub_123",
          stripeSubscriptionStatus: "active",
          stripeSubscriptionPriceId: "price_123",
          stripeSubscriptionCurrentPeriodEnd: new Date(checkoutPeriodEnd * 1000).toISOString(),
          stripeSubscriptionCancelAtPeriodEnd: false,
        }),
      }),
    );
    expect(createUser).not.toHaveBeenCalled();
  });

  it("updates billing runtime metadata for subscription lifecycle events", async () => {
    const lifecyclePeriodEnd = 1_765_152_000;
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          {
            id: "user-1",
            user_metadata: { stripeCustomerId: "cus_456" },
          },
        ],
      },
      error: null,
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const createUser = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      auth: { admin: { listUsers, updateUserById, createUser } },
    });

    const retrieveSubscription = vi.fn();
    getStripeClient.mockReturnValue({
      subscriptions: { retrieve: retrieveSubscription },
      customers: { retrieve: vi.fn() },
    });

    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_456",
          status: "past_due",
          cancel_at_period_end: true,
          current_period_end: lifecyclePeriodEnd,
          customer: "cus_456",
          items: { data: [{ price: { id: "price_456" } }] },
        },
      },
    } as unknown as Stripe.Event;
    verifyStripeSignature.mockReturnValueOnce(event);

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(200);
    expect(listUsers).toHaveBeenCalled();
    expect(fetchUserByEmail).not.toHaveBeenCalled();
    expect(getStripeClient().customers.retrieve).not.toHaveBeenCalled();
    expect(updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          stripeCustomerId: "cus_456",
          lastStripeSubscriptionId: "sub_456",
          stripeSubscriptionStatus: "past_due",
          stripeSubscriptionPriceId: "price_456",
          stripeSubscriptionCurrentPeriodEnd: new Date(lifecyclePeriodEnd * 1000).toISOString(),
          stripeSubscriptionCancelAtPeriodEnd: true,
        }),
      }),
    );
    expect(createUser).not.toHaveBeenCalled();
  });

  it("updates billing runtime metadata for subscription lifecycle events without customer email", async () => {
    const lifecyclePeriodEnd = 1_765_152_000;
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          {
            id: "user-1",
            user_metadata: { stripeCustomerId: "cus_789" },
          },
        ],
      },
      error: null,
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const createUser = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      auth: { admin: { listUsers, updateUserById, createUser } },
    });

    const retrieveSubscription = vi.fn();
    getStripeClient.mockReturnValue({
      subscriptions: { retrieve: retrieveSubscription },
      customers: { retrieve: vi.fn() },
    });

    const event = {
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_789",
          status: "canceled",
          cancel_at_period_end: false,
          current_period_end: lifecyclePeriodEnd,
          customer: "cus_789",
          items: { data: [{ price: { id: "price_789" } }] },
        },
      },
    } as unknown as Stripe.Event;
    verifyStripeSignature.mockReturnValueOnce(event);

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(200);
    expect(listUsers).toHaveBeenCalled();
    expect(fetchUserByEmail).not.toHaveBeenCalled();
    expect(getStripeClient().customers.retrieve).not.toHaveBeenCalled();
    expect(updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          stripeCustomerId: "cus_789",
          lastStripeSubscriptionId: "sub_789",
          stripeSubscriptionStatus: "canceled",
          stripeSubscriptionPriceId: "price_789",
          stripeSubscriptionCurrentPeriodEnd: new Date(lifecyclePeriodEnd * 1000).toISOString(),
          stripeSubscriptionCancelAtPeriodEnd: false,
        }),
      }),
    );
    expect(createUser).not.toHaveBeenCalled();
  });

  it("does not create billing runtime metadata for subscription lifecycle events when the Supabase user is missing", async () => {
    const lifecyclePeriodEnd = 1_765_152_000;
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [],
      },
      error: null,
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const createUser = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      auth: { admin: { listUsers, updateUserById, createUser } },
    });

    const retrieveCustomer = vi.fn().mockResolvedValue({ email: null });
    getStripeClient.mockReturnValue({
      subscriptions: { retrieve: vi.fn() },
      customers: { retrieve: retrieveCustomer },
    });

    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_abc",
          status: "active",
          cancel_at_period_end: false,
          current_period_end: lifecyclePeriodEnd,
          customer: "cus_abc",
          items: { data: [{ price: { id: "price_abc" } }] },
        },
      },
    } as unknown as Stripe.Event;
    verifyStripeSignature.mockReturnValueOnce(event);

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(200);
    expect(listUsers).toHaveBeenCalled();
    expect(retrieveCustomer).toHaveBeenCalledWith("cus_abc");
    expect(updateUserById).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("keeps paging until it finds a Stripe customer in a later Supabase page", async () => {
    const listUsers = vi.fn().mockImplementation(({ page, perPage }) => {
      if (page < 21) {
        return Promise.resolve({
          data: {
            users: Array.from({ length: perPage }, (_, index) => ({
              id: `user-${page}-${index}`,
              user_metadata: {},
            })),
          },
          error: null,
        });
      }

      return Promise.resolve({
        data: {
          users: [
            {
              id: "user-21",
              user_metadata: { stripeCustomerId: "cus_999" },
            },
          ],
        },
        error: null,
      });
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const createUser = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      auth: { admin: { listUsers, updateUserById, createUser } },
    });

    const retrieveCustomer = vi.fn().mockResolvedValue({ email: null });
    getStripeClient.mockReturnValue({
      subscriptions: { retrieve: vi.fn() },
      customers: { retrieve: retrieveCustomer },
    });

    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_999",
          status: "active",
          cancel_at_period_end: false,
          current_period_end: 1_765_152_000,
          customer: "cus_999",
          items: { data: [{ price: { id: "price_999" } }] },
        },
      },
    } as unknown as Stripe.Event;
    verifyStripeSignature.mockReturnValueOnce(event);

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(200);
    expect(listUsers).toHaveBeenCalledTimes(21);
    expect(retrieveCustomer).not.toHaveBeenCalled();
    expect(updateUserById).toHaveBeenCalledWith(
      "user-21",
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          stripeCustomerId: "cus_999",
          lastStripeSubscriptionId: "sub_999",
        }),
      }),
    );
  });

  it("falls back to Stripe customer email after the Supabase scan cap", async () => {
    const listUsers = vi.fn().mockImplementation(({ page, perPage }) =>
      Promise.resolve({
        data: {
          users: Array.from({ length: perPage }, (_, index) => ({
            id: `user-${page}-${index}`,
            user_metadata: { unrelated: true },
          })),
        },
        error: null,
      }),
    );
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const createUser = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      auth: { admin: { listUsers, updateUserById, createUser } },
    });

    const retrieveCustomer = vi.fn().mockResolvedValue({ email: "billing@example.com" });
    getStripeClient.mockReturnValue({
      subscriptions: { retrieve: vi.fn() },
      customers: { retrieve: retrieveCustomer },
    });
    fetchUserByEmail.mockResolvedValue({
      id: "user-by-email",
      user_metadata: { existing: true },
    });

    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_cap",
          status: "active",
          cancel_at_period_end: false,
          current_period_end: 1_765_152_000,
          customer: "cus_cap",
          items: { data: [{ price: { id: "price_cap" } }] },
        },
      },
    } as unknown as Stripe.Event;
    verifyStripeSignature.mockReturnValueOnce(event);

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(200);
    expect(listUsers).toHaveBeenCalledTimes(25);
    expect(retrieveCustomer).toHaveBeenCalledWith("cus_cap");
    expect(fetchUserByEmail).toHaveBeenCalledWith("billing@example.com");
    expect(updateUserById).toHaveBeenCalledWith(
      "user-by-email",
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          existing: true,
          stripeCustomerId: "cus_cap",
          lastStripeSubscriptionId: "sub_cap",
        }),
      }),
    );
    expect(createUser).not.toHaveBeenCalled();
  });

  it("redacts signature verification errors in production responses", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    try {
      verifyStripeSignature.mockImplementationOnce(() => {
        throw new Error("secret sk_test_leak");
      });

      vi.resetModules();
      const { POST } = await import("./route");
      const response = await POST(makeRequest("{}"));

      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload).toMatchObject({ error: "Invalid Stripe signature" });
      expect(payload.request_id).toBeTruthy();
      expect(JSON.stringify(payload)).not.toContain("sk_test_leak");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    }
  });
});
