// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ManagedAccountPolicy } from "@internal/dashboard/webhooks";

const mocks = vi.hoisted(() => ({
  formAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
  }),
}));

vi.mock("@internal/dashboard/use-action-toast", () => ({
  useActionToast: ({ formAction }: { formAction: (formData: FormData) => unknown }) => formAction,
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [{ ok: false, message: "" }, mocks.formAction, false] as const,
  };
});

vi.mock("./actions", () => ({
  updateAdminAccountPolicyAction: vi.fn(),
}));

import { AccountPolicyForm } from "./account-policy-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AccountPolicyForm", () => {
  it("renders stale customer max-site overrides as cleared form values", () => {
    render(
      <AccountPolicyForm
        account={makeAccount({
          quotas: {
            maxSites: 0,
            freeQuota: null,
            starterQuota: 80_000,
            proQuota: null,
          },
          featureFlags: {
            maxSites: 0,
            glossaryEnabled: true,
          },
        })}
      />,
    );

    const maxSitesInput = screen.getByLabelText("Max sites") as HTMLInputElement;
    const featureFlagsTextarea = screen.getByLabelText(
      "Feature flag overrides (JSON)",
    ) as HTMLTextAreaElement;

    expect(maxSitesInput.value).toBe("");
    expect(featureFlagsTextarea.value).toContain('"glossaryEnabled": true');
    expect(featureFlagsTextarea.value).not.toContain("maxSites");
  });
});

function makeAccount(overrides: Partial<ManagedAccountPolicy> = {}): ManagedAccountPolicy {
  return {
    accountId: "acct-customer",
    accountEmail: "customer@example.com",
    planType: "starter",
    planStatus: "active",
    managedDemo: false,
    createdAt: "2026-05-15T00:00:00.000Z",
    activeSiteCount: 1,
    quotas: {
      maxSites: null,
      freeQuota: null,
      starterQuota: null,
      proQuota: null,
    },
    featureFlags: {},
    agencyLinks: [],
    ...overrides,
  };
}
