// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeploymentCompletenessBadge } from "./deployment-completeness-badge";

describe("DeploymentCompletenessBadge", () => {
  it("renders a partial coverage warning", () => {
    render(
      <DeploymentCompletenessBadge
        completeness={{
          discoveredPages: 10,
          translatedPages: 7,
          pendingPages: 3,
          percentage: 70,
          status: "partial",
        }}
      />,
    );

    expect(screen.getByText("Partial (70%)")).toBeTruthy();
    expect(screen.getByText("7/10 pages translated")).toBeTruthy();
    expect(screen.getByText("3 pages still pending translation coverage.")).toBeTruthy();
  });

  it("renders unknown coverage state", () => {
    render(
      <DeploymentCompletenessBadge
        completeness={{
          discoveredPages: 5,
          translatedPages: 0,
          pendingPages: 5,
          percentage: 0,
          status: "unknown",
        }}
      />,
    );

    expect(screen.getByText("Coverage unknown")).toBeTruthy();
    expect(
      screen.getByText("Unable to derive translated page coverage from this deployment artifact."),
    ).toBeTruthy();
  });
});
