// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  observationsEmpty: "No observations.",
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
  addRule: "Add rule",
  validateDraft: "Validate draft",
  previewReady: "Server validation passed",
  previewBlocked: "Server validation blocked save",
  previewRequired: "Validate before saving.",
  save: "Save policy",
  saving: "Saving",
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

function renderManager(options: { saveAction?: RuntimeRequestsManagerPropsSave } = {}) {
  const saveAction = options.saveAction ?? vi.fn(async () => ({ ok: true, message: "saved" }));
  const lifecycleAction = vi.fn(async () => ({ ok: true, message: "updated" }));
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
      canEdit
      saveAction={saveAction}
      lifecycleAction={lifecycleAction}
      copy={copy}
    />,
  );
  return { saveAction, lifecycleAction };
}

type RuntimeRequestsManagerPropsSave = (
  prev: ActionResponse | undefined,
  formData: FormData,
) => Promise<ActionResponse>;

describe("RuntimeRequestsManager", () => {
  it("creates a draft rule from an observation without saving it", () => {
    const saveAction = vi.fn(async () => ({ ok: true, message: "saved" }));
    renderManager({ saveAction });

    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));

    expect(screen.getByDisplayValue("/api/cart")).toBeTruthy();
    expect(saveAction).not.toHaveBeenCalled();
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

    expect(await screen.findAllByText(/confirmation_required_high_risk_path/)).toHaveLength(2);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save policy" }).disabled).toBe(
      true,
    );
    expect(screen.getByDisplayValue("/api/cart")).toBeTruthy();
    expect(saveAction).not.toHaveBeenCalled();
  });
});
