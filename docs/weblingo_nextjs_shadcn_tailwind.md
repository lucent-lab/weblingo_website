# WebLingo – Next.js (App Router) + Tailwind + shadcn/ui

Pricing Teaser on **Home** + Stripe **Pricing Table** on **/pricing**.

This gives you:

- Minimal **IA** (Home, Pricing, Try, Docs, Legal)
- A **PricingTeaser** component using **shadcn/ui** (`Card`, `Button`)
- A **/pricing** page embedding **Stripe Pricing Table**
- Starter routes for `/try` and `/docs`
- Setup notes for Tailwind and shadcn/ui

> Replace placeholders like `prctbl_XXXX` and `pk_live_XXXX` with your own Stripe values.

---

## 1) Prereqs

```bash
# New app (with Tailwind)
npx create-next-app@latest webmirror --ts --eslint --tailwind --app

cd webmirror

# Install shadcn/ui and components
npx shadcn@latest init

# Add base components (button, card, input, badge, navigation menu if needed, etc.)
npx shadcn@latest add button card input badge navigation-menu
```

**Tailwind already configured** by `create-next-app` when you pass `--tailwind`.

---

## 2) Project Layout

```
webmirror/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx                # Home (hero + PricingTeaser)
│  ├─ pricing/
│  │  └─ page.tsx            # Stripe Pricing Table embed
│  ├─ try/
│  │  └─ page.tsx            # URL → Translate (placeholder)
│  ├─ docs/
│  │  └─ page.tsx            # Getting Started (placeholder)
│  └─ legal/
│     ├─ terms/page.tsx
│     ├─ privacy/page.tsx
│     └─ notice/page.tsx
├─ components/
│  ├─ pricing-teaser.tsx
│  └─ site-header.tsx
├─ lib/
│  └─ utils.ts
├─ styles/
│  └─ globals.css            # Tailwind base (already present)
└─ .env.local                # STRIPE keys (publishable only on client)
```

---

## 3) Base Layout and Header

**`app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "WebLingo",
  description: "AI-powered website translation with CNAME publishing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

**`components/site-header.tsx`**

```tsx
import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-bold">
          WebLingo
        </Link>
        <nav className="hidden md:flex items-center gap-4">
          <Link href="/pricing" className="text-sm hover:underline">
            Pricing
          </Link>
          <Link href="/docs" className="text-sm hover:underline">
            Docs
          </Link>
          <Link href="/try" className="text-sm hover:underline">
            Try
          </Link>
          <Link href="/login" className="text-sm hover:underline">
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

**`lib/utils.ts`** (standard shadcn util)

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 4) Pricing Teaser Component (shadcn/ui)

**`components/pricing-teaser.tsx`**

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CardDef = {
  name: string;
  price: string;
  bullets: string[];
  popular?: boolean;
};

const cards: CardDef[] = [
  {
    name: "Starter",
    price: "¥4,800/mo",
    bullets: ["1 site · 1 language", "Basic cache & delivery", "Email support"],
  },
  {
    name: "Pro",
    price: "¥9,800/mo",
    bullets: ["3 sites · multi-language", "Analytics & SEO helpers", "Priority support"],
    popular: true,
  },
  {
    name: "Agency",
    price: "¥24,800/mo",
    bullets: ["Unlimited sites", "Client workspaces & API", "SLAs & onboarding"],
  },
];

export function PricingTeaser() {
  return (
    <section className="container mx-auto px-4 py-16">
      <h2 className="text-3xl font-bold text-center mb-10">Simple, transparent pricing</h2>
      <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
        {cards.map((c) => (
          <Card key={c.name} className="relative rounded-2xl p-6">
            {c.popular && (
              <span className="absolute -top-3 right-4 text-xs bg-foreground text-background px-2 py-1 rounded">
                Most popular
              </span>
            )}
            <h3 className="text-xl font-semibold">{c.name}</h3>
            <p className="text-4xl font-bold my-4">{c.price}</p>
            <ul className="space-y-2 text-sm mb-6">
              {c.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button asChild className="w-full">
                <a href="/pricing">See full pricing</a>
              </Button>
              {/* Optional direct checkout link per plan (later) */}
            </div>
          </Card>
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground mt-4">
        Annual billing available on the pricing page.
      </p>
    </section>
  );
}
```

> You can add a secondary **“Buy now”** button per card linking to a Stripe Payment Link or a specific Pricing Table anchor later.

---

## 5) Home Page with Hero + Pricing Teaser

**`app/page.tsx`**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PricingTeaser } from "@/components/pricing-teaser";

export default function HomePage() {
  return (
    <div>
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Translate your website. Publish via CNAME.
        </h1>
        <p className="text-muted-foreground mb-8">
          WebLingo generates and serves translated versions of your site, optimized for speed & SEO.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/try">Try your URL</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </section>

      {/* How it works (quick 3 steps) */}
      <section className="container mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
        {[
          { t: "Connect", d: "Enter your website URL and set your target language(s)." },
          { t: "Translate", d: "We crawl & translate content, preserving layout and links." },
          { t: "Publish", d: "Point a CNAME to serve translated pages on your domain." },
        ].map((s) => (
          <div key={s.t} className="rounded-xl border p-6">
            <h3 className="font-semibold mb-2">{s.t}</h3>
            <p className="text-sm text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </section>

      <PricingTeaser />

      {/* Short FAQ */}
      <section className="container mx-auto px-4 pb-24 max-w-3xl">
        <h2 className="text-2xl font-bold mb-4 text-center">FAQ</h2>
        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Is there a free trial?</p>
            <p>We offer a preview on the Try page. Publishing requires a plan.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I cancel anytime?</p>
            <p>Yes. Manage your subscription via Stripe’s billing portal.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Is SEO preserved?</p>
            <p>We generate clean routes and can output canonical tags per your setup.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
```

---

## 6) /pricing – Stripe Pricing Table Embed

**Env**: add your Stripe publishable key to `.env.local` (used by the client to render Pricing Table)

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_XXXX
NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID=prctbl_XXXX
```

**`app/pricing/page.tsx`**

```tsx
export default function PricingPage() {
  const tableId = process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID;
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  return (
    <main className="container mx-auto px-4 py-14">
      <h1 className="text-3xl font-bold mb-6">Pricing</h1>
      <p className="text-muted-foreground mb-10">Monthly or annual. Cancel anytime.</p>

      <div id="stripe-pricing-table" data-pricing-table-id={tableId} data-publishable-key={pk} />

      {/* Load once on this page */}
      <script async src="https://js.stripe.com/v3/pricing-table.js"></script>

      <section className="mt-12 max-w-3xl">
        <h2 className="text-xl font-semibold mb-3">FAQ</h2>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground font-medium">Do you charge per translated page?</span>{" "}
            Not for MVP; see plan limits.
          </li>
          <li>
            <span className="text-foreground font-medium">Can I switch plans later?</span> Yes,
            upgrades happen immediately.
          </li>
          <li>
            <span className="text-foreground font-medium">How do invoices work?</span> Through
            Stripe; PDF via email.
          </li>
        </ul>
      </section>
    </main>
  );
}
```

> Ensure your Pricing Table in Stripe includes both **monthly** and **annual** prices for the toggle to appear. Handle provisioning via webhooks on your backend.

---

## 7) /try – URL → Translate (placeholder UX)

**`app/try/page.tsx`** (client component demo)

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TryPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onTranslate = async () => {
    if (!url) return;
    setLoading(true);
    try {
      // Call your backend route (e.g., /api/translate) which kicks off crawl/translate
      // This is a placeholder for MVP behavior:
      const encoded = encodeURIComponent(url);
      setPreviewUrl(`/preview?src=${encoded}`); // Swap for your real preview URL
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-14 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Try your website</h1>
      <p className="text-muted-foreground mb-6">
        Enter your site URL. We’ll generate a preview (not indexed). Publishing requires a plan.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="https://example.jp"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={onTranslate} disabled={loading || !url}>
          {loading ? "Translating…" : "Translate"}
        </Button>
      </div>

      {previewUrl && (
        <div className="mt-8 rounded-xl border p-6">
          <p className="mb-3 text-sm text-muted-foreground">Preview ready:</p>
          <a className="text-primary underline" href={previewUrl} target="_blank">
            Open preview
          </a>
          <div className="mt-4">
            <Button asChild>
              <a href="/pricing">Subscribe to publish</a>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
```

---

## 8) /docs – Getting Started (placeholder)

**`app/docs/page.tsx`**

```tsx
export default function DocsPage() {
  return (
    <main className="container mx-auto px-4 py-14 prose">
      <h1>Getting Started</h1>
      <ol>
        <li>
          Subscribe to a plan on the <a href="/pricing">Pricing</a> page.
        </li>
        <li>In your dashboard, add your domain and target language(s).</li>
        <li>Create a CNAME record to point to your translated host.</li>
        <li>Optionally add canonical/meta tags per your SEO policy.</li>
      </ol>
      <h2>CNAME Setup</h2>
      <p>We’ll provide hostnames and TTL suggestions. Registrar-specific guides coming soon.</p>
    </main>
  );
}
```

---

## 9) Legal Pages (placeholders)

**`app/legal/terms/page.tsx`**

```tsx
export default function TermsPage() {
  return (
    <main className="container mx-auto px-4 py-14 prose">
      <h1>Terms of Service</h1>
      <p>Coming soon.</p>
    </main>
  );
}
```

**`app/legal/privacy/page.tsx`**

```tsx
export default function PrivacyPage() {
  return (
    <main className="container mx-auto px-4 py-14 prose">
      <h1>Privacy Policy</h1>
      <p>Coming soon.</p>
    </main>
  );
}
```

**`app/legal/notice/page.tsx`**

```tsx
export default function NoticePage() {
  return (
    <main className="container mx-auto px-4 py-14 prose">
      <h1>Legal Notice</h1>
      <p>Coming soon.</p>
    </main>
  );
}
```

---

## 10) Notes & Next Steps

- **Stripe**: Use **Pricing Table** for speed and PCI safety. Add a server route to handle webhooks:
  - `checkout.session.completed` → provision workspace/limits
  - `customer.subscription.updated` → handle upgrades/downgrades
- **Direct CTAs on Home**: Keep teaser buttons linking to `/pricing`. Later, add plan-specific “Buy now” buttons pointing to Checkout/Payment Links.
- **Analytics**: Track Home → Pricing and Try → Pricing flows.
- **SEO**: Keep `/pricing`, `/docs`, and `/try` indexed; keep live _previews_ noindexed.

Ship it 🚀
