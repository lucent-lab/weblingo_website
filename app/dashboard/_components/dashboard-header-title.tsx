"use client";

import { usePathname } from "next/navigation";

import { useDashboardTitle } from "./dashboard-title-context";

type TitleItem = {
  href: string;
  label: string;
};

type TitleOverride = {
  match: RegExp;
  label: string;
};

const titleOverrides: TitleOverride[] = [
  { match: /^\/dashboard\/sites\/new(\/|$)/, label: "Add a new site" },
  { match: /^\/dashboard\/sites\/[^/]+\/admin(\/|$)/, label: "Site settings" },
];

function resolveTitle(pathname: string, items: TitleItem[], fallback: string) {
  const override = titleOverrides.find((entry) => entry.match.test(pathname));
  if (override) {
    return override.label;
  }

  const activeHref = items.reduce((best, item) => {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return item.href.length > best.length ? item.href : best;
    }
    return best;
  }, "");

  const match = items.find((item) => item.href === activeHref);
  return match?.label ?? fallback;
}

export function DashboardHeaderTitle({
  items,
  fallback = "Dashboard",
  className = "text-balance text-3xl font-semibold",
}: {
  items: TitleItem[];
  fallback?: string;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const { title: overrideTitle } = useDashboardTitle();
  const title = overrideTitle ?? resolveTitle(pathname, items, fallback);

  return <h1 className={className}>{title}</h1>;
}
