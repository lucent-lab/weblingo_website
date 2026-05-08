// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { KnownWebhookEventType } from "@internal/dashboard/webhooks";

import { WebhookSettingsFields } from "./webhook-settings-fields";

const baseProps = {
  title: "Webhook integrations",
  description: "Send signed lifecycle events.",
  urlLabel: "Webhook URL",
  urlHelp: "Webhook URL help",
  secretLabel: "Signing secret",
  secretHelp: "Signing secret help",
  eventsLabel: "Events",
  eventsHelp: "Events help",
  selectAllLabel: "Select all",
  disableAllLabel: "Disable all",
  webhookUrl: "https://hooks.example.com/weblingo",
  onWebhookUrlChange: vi.fn(),
  webhookSecret: "secret",
  onWebhookSecretChange: vi.fn(),
  webhookEvents: ["translation.completed", "translation.failed"] as KnownWebhookEventType[],
  onWebhookEventsChange: vi.fn(),
};

describe("WebhookSettingsFields", () => {
  it("does not submit webhook fields while rendered read-only", () => {
    const { container } = render(<WebhookSettingsFields {...baseProps} canEdit={false} />);
    expect(container.querySelector('input[name="webhookEvents"]')).toBeNull();
  });

  it("submits webhook events when editing is allowed", () => {
    const { container } = render(<WebhookSettingsFields {...baseProps} canEdit />);
    const hiddenInput = container.querySelector<HTMLInputElement>('input[name="webhookEvents"]');
    expect(hiddenInput?.value).toBe('["translation.completed","translation.failed"]');
  });

  it("does not submit an empty signing secret field", () => {
    const { container } = render(<WebhookSettingsFields {...baseProps} webhookSecret="" canEdit />);
    expect(container.querySelector<HTMLInputElement>("#webhookSecret")?.value).toBe("");
    expect(container.querySelector('input[name="webhookSecret"]')).toBeNull();
  });
});
