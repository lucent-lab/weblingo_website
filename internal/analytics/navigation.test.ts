import { describe, expect, it } from "vitest";

import { buildNavigationAnalyticsProperties } from "./navigation";

describe("navigation analytics helpers", () => {
  it("builds a public navigation payload without query strings", () => {
    expect(
      buildNavigationAnalyticsProperties({ pathname: "/en/contact?email=a@example.com" }),
    ).toEqual({
      dashboard_route: false,
      locale: "en",
      page_path: "/[locale]/contact",
      page_type: "contact",
      route_area: "marketing",
      route_template: "/[locale]/contact",
    });
  });

  it("templates docs, blog, and landing slugs", () => {
    expect(
      buildNavigationAnalyticsProperties({ pathname: "/fr/docs/workflows/invite-team" }),
    ).toMatchObject({
      locale: "fr",
      route_area: "docs",
      route_template: "/[locale]/docs/[...slug]",
    });
    expect(
      buildNavigationAnalyticsProperties({ pathname: "/ja/blog/private-launch-plan" }),
    ).toMatchObject({
      locale: "ja",
      route_area: "docs",
      route_template: "/[locale]/blog/[slug]",
    });
    expect(buildNavigationAnalyticsProperties({ pathname: "/en/landing/expansion" })).toMatchObject(
      {
        locale: "en",
        route_area: "landing",
        route_template: "/[locale]/landing/[segment]",
      },
    );
  });

  it("templates dashboard identifiers before capture", () => {
    expect(
      buildNavigationAnalyticsProperties({
        pathname: "/dashboard/sites/site_1234567890/settings",
      }),
    ).toEqual({
      dashboard_route: true,
      page_path: "/dashboard/sites/[id]/settings",
      page_type: "dashboard",
      route_area: "dashboard",
      route_template: "/dashboard/sites/[id]/settings",
    });

    expect(
      buildNavigationAnalyticsProperties({
        pathname: "/dashboard/ops/accounts/acct_1234567890",
      }),
    ).toMatchObject({
      dashboard_route: true,
      route_template: "/dashboard/ops/accounts/[accountId]",
    });
  });

  it("classifies localized auth and dashboard entry routes", () => {
    expect(buildNavigationAnalyticsProperties({ pathname: "/en/login" })).toMatchObject({
      dashboard_route: false,
      locale: "en",
      route_area: "auth",
      route_template: "/[locale]/login",
    });

    expect(buildNavigationAnalyticsProperties({ pathname: "/fr/dashboard" })).toMatchObject({
      dashboard_route: false,
      locale: "fr",
      route_area: "dashboard",
      route_template: "/[locale]/dashboard",
    });
  });

  it("keeps safe page-specific dimensions on the global navigation event", () => {
    expect(buildNavigationAnalyticsProperties({ pathname: "/en/landing/expansion" })).toMatchObject(
      {
        page_type: "landing",
        segment: "expansion",
        variant: "expansion",
      },
    );

    expect(
      buildNavigationAnalyticsProperties({
        pathname: "/en/checkout/success",
        searchParams: new URLSearchParams({ session_id: "cs_secret_123" }),
      }),
    ).toMatchObject({
      page_type: "checkout_success",
      session_present: true,
    });
  });
});
