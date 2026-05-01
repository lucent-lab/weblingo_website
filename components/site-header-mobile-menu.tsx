"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";

type MobileHeaderLink = {
  href: string;
  label: string;
};

type SiteHeaderMobileMenuProps = {
  label: string;
  links: MobileHeaderLink[];
};

export function SiteHeaderMobileMenu({ label, links }: SiteHeaderMobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label={label}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background shadow-sm transition hover:bg-accent hover:text-accent-foreground"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Menu className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 w-64 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-xl">
          <nav className="grid gap-1 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
