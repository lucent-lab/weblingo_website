// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteHeader } from "./site-header";

vi.mock("../../actions", () => ({
  updateSiteStatusAction: vi.fn(),
}));

describe("SiteHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps settings and dashboard links on the explicit dashboard locale", () => {
    render(
      <SiteHeader
        site={{ id: "site-1", sourceUrl: "https://example.com", status: "active" }}
        canEdit={false}
        canPauseTranslations={false}
        canResumeTranslations={false}
        deactivateLabel="Pause"
        reactivateLabel="Reactivate"
        deactivateConfirm="Pause translations?"
        activateHelpLabel="Activation help"
        activateHelp="Activate to make changes."
        dashboardLocale="fr"
      />,
    );

    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe(
      "/dashboard/sites/site-1/settings?locale=fr",
    );
    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe(
      "/dashboard?locale=fr",
    );
  });
});
