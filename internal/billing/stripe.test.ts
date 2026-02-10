import { describe, expect, it, vi } from "vitest";

let capturedConstructorArgs: unknown[] | null = null;

vi.mock("stripe", () => ({
  default: class StripeMock {
    checkout = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };

    constructor(...args: unknown[]) {
      capturedConstructorArgs = args;
    }
  },
}));

vi.mock("@internal/core/env-server", () => ({
  envServer: {
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
  },
}));

describe("stripe client", () => {
  it("pins Stripe apiVersion explicitly", async () => {
    vi.resetModules();
    capturedConstructorArgs = null;

    // Import triggers Stripe client creation.
    const { getStripeClient } = await import("./stripe");
    expect(getStripeClient()).toBeTruthy();

    expect(capturedConstructorArgs).toBeTruthy();
    const [, config] = capturedConstructorArgs as unknown[] as [string, { apiVersion?: string }];
    expect(config.apiVersion).toBe("2025-10-29.clover");
  });
});

