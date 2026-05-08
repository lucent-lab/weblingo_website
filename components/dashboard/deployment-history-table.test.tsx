// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeploymentHistoryTable } from "./deployment-history-table";

describe("DeploymentHistoryTable", () => {
  it("renders empty state when there are no entries", () => {
    render(
      <DeploymentHistoryTable
        history={{
          targetLang: "fr",
          entries: [],
          pagination: { limit: 10, offset: 0, nextOffset: null },
          generatedAt: "2026-02-17T10:00:00Z",
        }}
      />,
    );
    expect(screen.getByText("No deployment history yet.")).toBeTruthy();
  });

  it("renders customer deployment history rows without raw artifact data", () => {
    render(
      <DeploymentHistoryTable
        locale="en-US"
        history={{
          targetLang: "fr",
          entries: [
            {
              rawStatus: "active",
              customerStatus: "published",
              titleKey: "dashboard.history.deployment.published.title",
              descriptionKey: "dashboard.history.deployment.published.description",
              createdAt: "2026-02-17T09:00:00Z",
              publishedAt: "2026-02-17T10:00:00Z",
              pageCount: null,
              customerError: null,
            },
            {
              rawStatus: "failed",
              customerStatus: "failed",
              titleKey: "dashboard.history.deployment.failed.title",
              descriptionKey: "dashboard.history.deployment.failed.description",
              createdAt: null,
              publishedAt: null,
              pageCount: null,
              customerError: {
                id: "deployment_failed:fr:unknown",
                area: "deployment",
                severity: "danger",
                code: "deployment_failed",
                titleKey: "dashboard.errors.deploymentFailed.title",
                descriptionKey: "dashboard.errors.deploymentFailed.description",
                lastSeenAt: null,
              },
            },
          ],
          pagination: { limit: 10, offset: 0, nextOffset: null },
          generatedAt: "2026-02-17T10:00:00Z",
        }}
      />,
    );

    expect(screen.getByText("dashboard.history.deployment.published.title")).toBeTruthy();
    expect(screen.getByText("published")).toBeTruthy();
    expect(screen.getByText("failed")).toBeTruthy();
    expect(screen.queryByText("artifact")).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
});
