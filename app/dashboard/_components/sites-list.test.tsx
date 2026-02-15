// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { SiteSummary } from "@internal/dashboard/webhooks";

vi.mock("next/link", async () => {
  const React = await import("react");
  type LinkProps = {
    href: string;
    prefetch?: boolean;
    children?: ReactNode;
  } & Record<string, unknown>;
  return {
    default: ({ href, prefetch, children, ...props }: LinkProps) =>
      React.createElement(
        "a",
        {
          href,
          "data-prefetch": String(prefetch),
          ...props,
        },
        children,
      ),
  };
});

import { SitesList } from "./sites-list";

describe("SitesList", () => {
  it("disables prefetch on high-cardinality site links", () => {
    const sites: SiteSummary[] = [
      {
        id: "site-1",
        accountId: "acct-1",
        sourceUrl: "https://example.com",
        status: "active",
        servingMode: "strict",
        maxLocales: null,
        siteProfile: null,
        sourceLang: "en",
        targetLangs: ["fr"],
        localeCount: 1,
        serveEnabledLocaleCount: 1,
        domainCount: 1,
        verifiedDomainCount: 1,
      },
    ];

    render(<SitesList sites={sites} />);

    const manageLink = screen.getByRole("link", { name: "Manage" });
    expect(manageLink.getAttribute("href")).toBe("/dashboard/sites/site-1");
    expect(manageLink.getAttribute("data-prefetch")).toBe("false");
  });
});
