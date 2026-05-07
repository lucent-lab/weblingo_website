// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActionResponse } from "@/app/dashboard/actions";
import type {
  RuntimeRequestObservationGroup,
  RuntimeRequestPolicyConfig,
} from "@internal/dashboard/webhooks";

import { RuntimeRequestsManager, type RuntimeRequestsCopy } from "./runtime-requests-manager";

const ORIGINAL_FETCH = globalThis.fetch;

const copy: RuntimeRequestsCopy = {
  title: "Runtime requests",
  description: "Runtime request policy.",
  standardMode: "Recommended mode",
  activeRules: "Active rules",
  unreviewedGroups: "Unreviewed groups",
  highRiskGroups: "High risk",
  lastSeen: "Last seen",
  policyVersion: "Served policy",
  propagationReady: "Route cache current",
  propagationStale: "Route cache stale",
  observationsTitle: "Observed requests",
  observationsDescription: "Grouped requests.",
  observationsDeferred: "Load observations when needed.",
  observationsEmpty: "No observations.",
  loadObservations: "Load observations",
  loadingObservations: "Loading observations",
  method: "Method",
  path: "Path",
  likelyType: "Likely type",
  firstSeen: "First / last seen",
  seenFromPage: "Seen from page",
  currentAction: "Current action",
  suggestedAction: "Suggested action",
  risk: "Risk",
  lifecycle: "Lifecycle",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
  ignored: "Ignored",
  createRule: "Create rule",
  rulesTitle: "Policy rules",
  rulesDescription: "Rules.",
  noRules: "No rules.",
  presetsTitle: "Templates",
  presetNeutralizeAnalytics: "Neutralize analytics/beacon",
  presetSearchProxy: "Read-only search proxy",
  presetFeatureConfigProxy: "Read-only feature flag/config proxy",
  presetRouteDataProxy: "Route-data passthrough candidate",
  presetFormSubmitProxy: "Form submit advanced proxy",
  validateDraft: "Validate draft",
  previewReady: "Server validation passed",
  previewBlocked: "Server validation blocked save",
  previewRequired: "Validate before saving.",
  save: "Save policy",
  saving: "Saving",
  saveIncomplete: "The dashboard could not confirm the saved policy.",
  lifecycleUpdateError: "Unable to update the request status.",
  reset: "Reset draft",
  enabled: "Enabled",
  name: "Name",
  pattern: "Path pattern",
  methods: "Methods",
  action: "Action",
  credentials: "Credentials",
  cache: "Cache",
  limits: "Limits",
  headers: "Header allowlists",
  neutralization: "Neutralization",
  confirmations: "Advanced confirmations",
  removeRule: "Remove rule",
  draftStatus: "Draft",
  savedStatus: "Saved",
  standardValue: "Standard",
  standardFallbackVersion: "standard-v1",
  maxBodyBytes: "Max body bytes",
  maxResponseBytes: "Max response bytes",
  timeoutMs: "Timeout ms",
  requestHeaders: "Request header allowlist",
  responseHeaders: "Response header allowlist",
  requestContentTypes: "Request content types",
  responseContentTypes: "Response content types",
  redirectScope: "Redirect scope",
  defaultRuleName: "Runtime request rule",
  previewErrorFallback: "Unable to preview runtime request policy.",
  validationTitle: "Validation",
  warningsTitle: "Warnings",
  matchedGroupsTitle: "Matched observations",
  redactionNote: "Redacted details only.",
};

const emptyPolicy: RuntimeRequestPolicyConfig = {
  schemaVersion: 1,
  mode: "standard",
  enabled: true,
  rules: [],
};

const observation: RuntimeRequestObservationGroup = {
  siteId: "site-1",
  groupingPathHash: "cart-group",
  shapeSignature: "POST:cart-group:high_risk_dynamic:fetch:json",
  path: "/api/cart",
  method: "POST",
  likelyType: "high_risk_dynamic",
  intent: "fetch",
  acceptClass: "json",
  risk: "high",
  riskReasons: ["high_risk_path"],
  firstSeenAt: "2026-05-04T00:00:00.000Z",
  lastSeenAt: "2026-05-04T01:00:00.000Z",
  count: 2,
  seenFromPage: "/pricing",
  currentAction: "observe",
  suggestedAction: "deny",
  policyRuleId: null,
  routePolicyVersion: "site-config:v1",
  routePolicyStale: false,
  lifecycle: "open",
  reviewedAt: null,
  dismissedAt: null,
  ignoredAt: null,
  bodyPresent: true,
  bodySizeBucket: "1-1kb",
};

afterEach(() => {
  cleanup();
  (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

function renderManager(
  options: {
    saveAction?: RuntimeRequestsManagerPropsSave;
    lifecycleAction?: RuntimeRequestsManagerPropsLifecycle;
  } = {},
) {
  const saveAction = options.saveAction ?? vi.fn(async () => ({ ok: true, message: "saved" }));
  const lifecycleAction =
    options.lifecycleAction ?? vi.fn(async () => ({ ok: true, message: "updated" }));
  const loadObservationsAction = vi.fn(async () => ({
    ok: true,
    message: "loaded",
    meta: { groups: [observation] },
  }));
  render(
    <RuntimeRequestsManager
      siteId="site-1"
      initialPolicy={emptyPolicy}
      runtimeRequestPolicyFingerprint="fingerprint-1"
      runtimeRequestPolicyVersion="site-config:v1"
      propagation={{
        servedVersion: "site-config:v1",
        expectedVersion: "site-config:v1",
        stale: false,
      }}
      observations={[observation]}
      observationsLoaded
      canEdit
      loadObservationsAction={loadObservationsAction}
      saveAction={saveAction}
      lifecycleAction={lifecycleAction}
      copy={copy}
    />,
  );
  return { saveAction, lifecycleAction, loadObservationsAction };
}

type RuntimeRequestsManagerPropsSave = (
  prev: ActionResponse | undefined,
  formData: FormData,
) => Promise<ActionResponse>;
type RuntimeRequestsManagerPropsLifecycle = RuntimeRequestsManagerPropsSave;

describe("RuntimeRequestsManager", () => {
  it("creates a draft rule from an observation without saving it", () => {
    const saveAction = vi.fn(async () => ({ ok: true, message: "saved" }));
    renderManager({ saveAction });

    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));

    expect(screen.getByDisplayValue("/api/cart")).toBeTruthy();
    expect(saveAction).not.toHaveBeenCalled();
  });

  it("adds rules only through explicit templates", () => {
    const saveAction = vi.fn(async () => ({ ok: true, message: "saved" }));
    renderManager({ saveAction });

    expect(screen.queryByRole("button", { name: "Add rule" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Read-only search proxy" }));

    expect(screen.getByDisplayValue("/api/search")).toBeTruthy();
    expect(screen.getByDisplayValue("Read-only search proxy")).toBeTruthy();
    expect(saveAction).not.toHaveBeenCalled();
  });

  it("supports dismissing observed request groups", async () => {
    const lifecycleAction = vi.fn(async () => ({ ok: true, message: "updated" }));
    renderManager({ lifecycleAction });

    fireEvent.click(screen.getByRole("button", { name: "Dismissed" }));

    await waitFor(() => expect(lifecycleAction).toHaveBeenCalled());
    const call = lifecycleAction.mock.calls[0] as unknown as [ActionResponse | undefined, FormData];
    const formData = call[1];
    expect(formData.get("lifecycle")).toBe("dismissed");
  });

  it("shows a friendly lifecycle failure when the action rejects", async () => {
    const lifecycleAction = vi.fn(async () => {
      throw new Error("raw lifecycle backend detail");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderManager({ lifecycleAction });

    fireEvent.click(screen.getByRole("button", { name: "Dismissed" }));

    expect(await screen.findByText("Unable to update the request status.")).toBeTruthy();
    expect(screen.queryByText("raw lifecycle backend detail")).toBeNull();
    consoleSpy.mockRestore();
  });

  it("blocks save on server validation errors and preserves the draft", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            runtimeRequestPolicy: emptyPolicy,
            validationErrors: [
              {
                code: "confirmation_required_high_risk_path",
                ruleId: "cart",
                message: "High-risk path confirmation required.",
              },
            ],
            warnings: [],
            collisions: [],
            highRiskConfirmations: [
              { ruleId: "cart", code: "confirmation_required_high_risk_path" },
            ],
            sampleResults: [],
            matchedObservationGroups: [],
            propagation: {
              currentRouteConfigUpdatedAt: "2026-05-04T00:00:00.000Z",
              currentRuntimeRequestPolicyVersion: "site-config:v1",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    const saveAction = vi.fn(async () => ({ ok: true, message: "saved" }));
    renderManager({ saveAction });

    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));
    fireEvent.click(screen.getByRole("button", { name: "Validate draft" }));

    expect(
      await screen.findByText(
        "High-risk request paths need an explicit confirmation before the policy can be saved.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/confirmation_required_high_risk_path/)).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save policy" }).disabled).toBe(
      true,
    );
    expect(screen.getByDisplayValue("/api/cart")).toBeTruthy();
    expect(saveAction).not.toHaveBeenCalled();
  });

  it("does not fabricate saved runtime policy state when save meta is incomplete", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            runtimeRequestPolicy: emptyPolicy,
            validationErrors: [],
            warnings: [],
            collisions: [],
            highRiskConfirmations: [],
            sampleResults: [],
            matchedObservationGroups: [],
            propagation: {
              currentRouteConfigUpdatedAt: "2026-05-04T00:00:00.000Z",
              currentRuntimeRequestPolicyVersion: "site-config:v1",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    const saveAction = vi.fn(async () => ({ ok: true, message: "saved", meta: {} }));
    renderManager({ saveAction });

    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));
    fireEvent.click(screen.getByRole("button", { name: "Validate draft" }));
    expect(await screen.findAllByText("Server validation passed")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Save policy" }));

    await waitFor(() => expect(saveAction).toHaveBeenCalled());
    expect(
      await screen.findByText("The dashboard could not confirm the saved policy."),
    ).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
  });
});
