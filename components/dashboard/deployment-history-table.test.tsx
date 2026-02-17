// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeploymentHistoryTable } from "./deployment-history-table";

describe("DeploymentHistoryTable", () => {
  it("renders empty state when there are no entries", () => {
    render(<DeploymentHistoryTable history={[]} />);
    expect(screen.getByText("No deployment history yet.")).toBeTruthy();
  });

  it("renders grouped deployment history rows", () => {
    render(
      <DeploymentHistoryTable
        locale="en-US"
        history={[
          {
            targetLang: "fr",
            entries: [
              {
                deploymentId: "dep-fr-2",
                status: "active",
                activatedAt: "2026-02-17T10:00:00Z",
                createdAt: "2026-02-17T09:00:00Z",
                routePrefix: "/fr",
                artifactManifest: "manifest-fr-2",
              },
              {
                deploymentId: "dep-fr-1",
                status: "failed",
                activatedAt: null,
                createdAt: null,
                routePrefix: null,
                artifactManifest: null,
              },
            ],
          },
          {
            targetLang: "ja",
            entries: [
              {
                deploymentId: "dep-ja-1",
                status: "active",
                activatedAt: "2026-02-16T08:00:00Z",
                createdAt: "2026-02-16T07:00:00Z",
                routePrefix: "/ja",
                artifactManifest: null,
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("dep-fr-2")).toBeTruthy();
    expect(screen.getByText("dep-fr-1")).toBeTruthy();
    expect(screen.getByText("dep-ja-1")).toBeTruthy();
    expect(screen.getAllByText("active")).toHaveLength(2);
    expect(screen.getByText("failed")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });
});
