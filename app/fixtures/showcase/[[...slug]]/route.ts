type FixturePage = {
  scenario: "marketing" | "docs" | "app";
  pageId: string;
  title: string;
  description: string;
  canonicalPath: string;
  baseHref?: string;
  heading: string;
  bodyHtml: string;
};

const SOURCE_ORIGIN = "https://weblingo.app";
const ASSET_VERSION = "20260416";
const STRICT_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'self' https://weblingo.app; object-src 'none'; form-action 'self';";

const PAGES: Record<string, FixturePage> = {
  marketing: {
    scenario: "marketing",
    pageId: "marketing-root",
    title: "Showcase Fixture: marketing landing",
    description: "A sales landing page fixture with source-only and translated navigation cases.",
    canonicalPath: "/fixtures/showcase/marketing",
    baseHref: "/fixtures/showcase/marketing/",
    heading: "Translate product pages without losing the buyer path",
    bodyHtml: `
      <section class="fixture-hero" data-fixture-section="hero">
        <p class="fixture-kicker">Showcase marketing fixture</p>
        <p>Use this page to validate sales-critical links, CSS, metadata, forms, and assets.</p>
        <a class="fixture-button" data-check="root-internal" href="/fixtures/showcase/marketing/pricing?utm=nav#buy">View pricing</a>
      </section>
      <nav class="fixture-nav" aria-label="Fixture navigation">
        <a data-check="same-page-query" href="?ref=nav#overview">Overview</a>
        <a data-check="relative-sibling" href="./about?tab=story#team">About relative</a>
        <a data-check="parent-relative" href="../docs/start?from=marketing#setup">Docs relative</a>
        <a data-check="source-fallback-root" href="/fixtures/showcase/original-only?from=marketing#faq">Original only</a>
        <a data-check="external" href="https://developer.mozilla.org/en-US/">External reference</a>
      </nav>
      <article id="overview" class="fixture-panel">
        <h2 data-fixture-accent>Preserve the sales path</h2>
        <p>Buyer journeys need localized canonical tags, stable assets, and translated internal links.</p>
        <img src="/fixtures/showcase/logo.svg?v=${ASSET_VERSION}" width="96" height="96" alt="WebLingo fixture logo" />
      </article>
      <form action="/fixtures/showcase/marketing/contact?source=form#thanks" method="post" data-check="lead-form">
        <label>
          Work email
          <input name="email" type="email" value="buyer@example.com" />
        </label>
        <button type="submit">Request localized preview</button>
      </form>
    `,
  },
  "marketing/pricing": {
    scenario: "marketing",
    pageId: "marketing-pricing",
    title: "Showcase Fixture: pricing",
    description: "A pricing page fixture used to prove deep showcase links remain routable.",
    canonicalPath: "/fixtures/showcase/marketing/pricing",
    heading: "Pricing that keeps translated links stable",
    bodyHtml: `
      <section class="fixture-panel" id="buy">
        <p>Pricing fixture for deep navigation, query strings, and fragments.</p>
        <a data-check="pricing-back" href="/fixtures/showcase/marketing?from=pricing#overview">Back to overview</a>
        <a data-check="pricing-source-only" href="/fixtures/showcase/pricing-original-only?from=pricing#faq">Original pricing FAQ</a>
      </section>
    `,
  },
  "marketing/about": {
    scenario: "marketing",
    pageId: "marketing-about",
    title: "Showcase Fixture: about",
    description: "A relative-link target used by showcase rewriting tests.",
    canonicalPath: "/fixtures/showcase/marketing/about",
    heading: "About the localized showcase fixture",
    bodyHtml: `
      <section class="fixture-panel" id="team">
        <p>This about page exists so relative sibling links can be translated into showcase URLs.</p>
        <a data-check="about-pricing" href="./pricing?from=about#buy">Pricing sibling</a>
      </section>
    `,
  },
  "docs/start": {
    scenario: "docs",
    pageId: "docs-start",
    title: "Showcase Fixture: docs start",
    description: "A documentation fixture with nested paths and language-neutral anchors.",
    canonicalPath: "/fixtures/showcase/docs/start",
    baseHref: "/fixtures/showcase/docs/",
    heading: "Set up translated docs without breaking references",
    bodyHtml: `
      <aside class="fixture-nav" aria-label="Docs navigation">
        <a data-check="docs-api" href="./api?topic=keys#authentication">API reference</a>
        <a data-check="docs-marketing" href="../marketing?from=docs">Marketing home</a>
        <a data-check="docs-source-fallback" href="/fixtures/showcase/docs/source-only?from=docs#legacy">Legacy source only</a>
        <a data-check="docs-fragment" href="#authentication">Jump to authentication</a>
      </aside>
      <section class="fixture-panel" id="authentication">
        <h2>Authentication references</h2>
        <p>Nested docs paths exercise base URL behavior and section-scoped relative navigation.</p>
        <code>curl https://api.example.test/v1/locales</code>
      </section>
    `,
  },
  "docs/api": {
    scenario: "docs",
    pageId: "docs-api",
    title: "Showcase Fixture: docs API",
    description: "A nested documentation page used to verify translated sibling links.",
    canonicalPath: "/fixtures/showcase/docs/api",
    heading: "API reference for localized docs",
    bodyHtml: `
      <section class="fixture-panel" id="authentication">
        <p>The API reference target keeps query strings and fragments stable.</p>
        <a data-check="api-start" href="./start?from=api#authentication">Back to start</a>
      </section>
    `,
  },
  "app/dashboard": {
    scenario: "app",
    pageId: "app-dashboard",
    title: "Showcase Fixture: app dashboard",
    description: "An application-style page with controls, media, and root-relative assets.",
    canonicalPath: "/fixtures/showcase/app/dashboard",
    heading: "Localized app dashboard controls",
    bodyHtml: `
      <section class="fixture-panel fixture-grid" data-fixture-widget>
        <button type="button" data-fixture-toggle aria-expanded="false">Open usage drawer</button>
        <output data-fixture-output>Drawer closed</output>
        <a data-check="app-docs" href="/fixtures/showcase/docs/start?from=dashboard#authentication">Read setup docs</a>
        <a data-check="app-source-fallback" href="/fixtures/showcase/app/source-only?from=dashboard#settings">Original settings</a>
      </section>
    `,
  },
  "original-only": {
    scenario: "marketing",
    pageId: "source-only",
    title: "Showcase Fixture: source only",
    description: "A source-only target that should remain on the source origin when untranslated.",
    canonicalPath: "/fixtures/showcase/original-only",
    heading: "Source-only original page",
    bodyHtml: `
      <section class="fixture-panel" id="faq">
        <p>This page exists as a source-origin fallback sentinel.</p>
      </section>
    `,
  },
  "pricing-original-only": {
    scenario: "marketing",
    pageId: "pricing-source-only",
    title: "Showcase Fixture: pricing source only",
    description: "A pricing source-only target that should not become a fake showcase page.",
    canonicalPath: "/fixtures/showcase/pricing-original-only",
    heading: "Source-only pricing FAQ",
    bodyHtml: `
      <section class="fixture-panel" id="faq">
        <p>This pricing FAQ is a source-origin fallback sentinel.</p>
      </section>
    `,
  },
  "docs/source-only": {
    scenario: "docs",
    pageId: "docs-source-only",
    title: "Showcase Fixture: docs source only",
    description: "A docs source-only target for untranslated fallback behavior.",
    canonicalPath: "/fixtures/showcase/docs/source-only",
    heading: "Legacy docs source-only page",
    bodyHtml: `
      <section class="fixture-panel" id="legacy">
        <p>This docs page is intentionally safe to leave on the source origin.</p>
      </section>
    `,
  },
  "app/source-only": {
    scenario: "app",
    pageId: "app-source-only",
    title: "Showcase Fixture: app source only",
    description: "An app source-only target for untranslated fallback behavior.",
    canonicalPath: "/fixtures/showcase/app/source-only",
    heading: "Original app settings",
    bodyHtml: `
      <section class="fixture-panel" id="settings">
        <p>This settings page is a source-origin fallback sentinel.</p>
      </section>
    `,
  },
};

const RESPONSE_HEADERS = {
  "cache-control": "public, max-age=60",
  "x-weblingo-showcase-fixture": "1",
};

function normalizeSlug(slug: string[] | undefined): string {
  if (!slug || slug.length === 0) {
    return "marketing";
  }
  return slug
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "")
    .toLowerCase();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildFixtureHtml(page: FixturePage): string {
  const canonicalUrl = `${SOURCE_ORIGIN}${page.canonicalPath}`;
  const alternateEnglish = canonicalUrl;
  const alternateFrench = `${SOURCE_ORIGIN}/fr${page.canonicalPath}`;
  const baseTag = page.baseHref ? `    <base href="${escapeHtml(page.baseHref)}" />\n` : "";

  return `<!doctype html>
<html lang="en" data-weblingo-showcase-fixture="${page.scenario}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
${baseTag}    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <link rel="alternate" hreflang="en" href="${escapeHtml(alternateEnglish)}" />
    <link rel="alternate" hreflang="fr" href="${escapeHtml(alternateFrench)}" />
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(alternateEnglish)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}" />
    <link rel="stylesheet" href="/fixtures/showcase/showcase.css?v=${ASSET_VERSION}" />
    <script defer src="/fixtures/showcase/widget.js?v=${ASSET_VERSION}"></script>
  </head>
  <body data-fixture-page="${page.pageId}">
    <main class="fixture-shell">
      <h1>${escapeHtml(page.heading)}</h1>
      ${page.bodyHtml}
    </main>
  </body>
</html>`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug?: string[] }> },
): Promise<Response> {
  const { slug } = await context.params;
  const normalized = normalizeSlug(slug);
  const page = PAGES[normalized];

  if (!page) {
    return new Response("Unknown showcase fixture page.", {
      status: 404,
      headers: {
        ...RESPONSE_HEADERS,
        "content-type": "text/plain; charset=utf-8",
        "content-security-policy": "default-src 'none'; base-uri 'none';",
        "x-weblingo-showcase-scenario": "unknown",
      },
    });
  }

  return new Response(buildFixtureHtml(page), {
    status: 200,
    headers: {
      ...RESPONSE_HEADERS,
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": STRICT_CSP,
      "x-weblingo-showcase-scenario": page.scenario,
      "x-weblingo-showcase-page": page.pageId,
    },
  });
}
