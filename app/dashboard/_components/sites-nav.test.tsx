// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/sites/site-1",
}));

vi.mock("@/components/ui/sidebar", async () => {
  const React = await import("react");
  return {
    SidebarMenu: ({ children }: { children: ReactNode }) =>
      React.createElement("div", null, children),
    SidebarMenuItem: ({ children }: { children: ReactNode }) =>
      React.createElement("div", null, children),
    SidebarMenuButton: ({
      children,
      asChild,
      ...props
    }: {
      children: ReactNode;
      asChild?: boolean;
      [key: string]: unknown;
    }) => {
      if (asChild && React.isValidElement(children)) {
        const passthroughProps = {
          "aria-current":
            typeof props["aria-current"] === "string" ? props["aria-current"] : undefined,
        };
        return React.cloneElement(children, passthroughProps);
      }
      const buttonProps = {
        type: props.type === "button" ? "button" : undefined,
        onClick: typeof props.onClick === "function" ? props.onClick : undefined,
        "aria-expanded":
          typeof props["aria-expanded"] === "boolean" ? props["aria-expanded"] : undefined,
        "aria-controls":
          typeof props["aria-controls"] === "string" ? props["aria-controls"] : undefined,
      };
      return React.createElement("button", buttonProps, children);
    },
    useSidebar: () => ({ state: "expanded" as const }),
  };
});

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

import { SitesNav } from "./sites-nav";

afterEach(() => cleanup());

describe("SitesNav", () => {
  it("uses the caller-provided empty label", () => {
    render(<SitesNav emptyLabel="No website yet." sites={[]} />);

    expect(screen.getByText("No website yet.")).toBeTruthy();
    expect(screen.queryByText("No sites yet.")).toBeNull();
  });

  it("disables prefetch for per-site submenu links", () => {
    render(
      <SitesNav
        sites={[
          {
            id: "site-1",
            label: "Example Site",
            status: "active",
          },
        ]}
      />,
    );

    for (const label of [
      "Workspace",
      "Pages & crawl",
      "Source selection",
      "Runtime requests",
      "Translation rules",
      "Settings",
    ]) {
      const link = screen.getByRole("link", { name: label });
      expect(link.getAttribute("data-prefetch")).toBe("false");
    }
  });

  it("preserves the dashboard locale on per-site submenu links", () => {
    render(
      <SitesNav
        dashboardLocale="fr"
        sites={[
          {
            id: "site-1",
            label: "Example Site",
            status: "active",
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Workspace" }).getAttribute("href")).toBe(
      "/dashboard/sites/site-1?locale=fr",
    );
    expect(screen.getByRole("link", { name: "Pages & crawl" }).getAttribute("href")).toBe(
      "/dashboard/sites/site-1/pages?locale=fr",
    );
    expect(screen.getByRole("link", { name: "Runtime requests" }).getAttribute("href")).toBe(
      "/dashboard/sites/site-1/runtime-requests?locale=fr",
    );
  });
});
