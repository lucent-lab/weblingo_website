type ScenarioId =
  | "structural-placeholders"
  | "domain-bound-widgets"
  | "inline-composite-boundaries"
  | "source-repair-context";

type ScenarioPayload = {
  csp: string;
  html: string;
};

const SOURCE_ORIGIN = "https://weblingo.app";
const FIXTURE_ROBOTS = "noindex, nofollow, noarchive";

const STRUCTURAL_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.prod.website-files.com; base-uri 'self'; object-src 'none'; form-action 'self';";

const DOMAIN_BOUND_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://challenges.cloudflare.com https://js.hcaptcha.com https://accounts.google.com/gsi/client https://js.stripe.com https://www.paypal.com https://js.hsforms.net https://cdn.prod.website-files.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https://cdn.prod.website-files.com https://*.stripe.com https://www.paypalobjects.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://www.google.com https://challenges.cloudflare.com https://hcaptcha.com https://*.hcaptcha.com https://accounts.google.com https://api.stripe.com https://www.paypal.com https://forms.hsforms.com",
  "frame-src 'self' https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://challenges.cloudflare.com https://hcaptcha.com https://*.hcaptcha.com https://accounts.google.com https://js.stripe.com https://hooks.stripe.com https://www.paypal.com https://form.typeform.com https://calendly.com",
  "form-action 'self' https://www.paypal.com",
].join("; ");

const RESPONSE_HEADERS = {
  "cache-control": "public, max-age=60",
  "x-robots-tag": FIXTURE_ROBOTS,
  "x-weblingo-preview-qa-fixture": "1",
};

const STRUCTURAL_HTML = `<!doctype html>
<html lang="en" data-fixture="preview-qa" data-fixture-scenario="structural-placeholders">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preview QA Fixture: Structural Placeholders</title>
    <link rel="icon" href="data:," />
    <link rel="canonical" href="${SOURCE_ORIGIN}/fixtures/preview-qa/structural-placeholders" />
    <style>
      :root {
        color-scheme: light;
        --ink: #162019;
        --muted: #55635b;
        --line: #c9d5ce;
        --paper: #fbfcf8;
        --accent: #476f55;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--ink);
        background: var(--paper);
      }

      .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 86px;
        padding: 18px clamp(16px, 4vw, 52px);
        border-bottom: 1px solid var(--line);
      }

      .nav_brand_stack {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .nav_mobile_logo,
      .nav_desktop_logo {
        display: inline-flex;
        align-items: center;
        color: inherit;
        text-decoration: none;
      }

      .u-max-width-full {
        max-width: 100%;
      }

      .nav_logo_svg {
        display: block;
        width: 156px;
        height: auto;
      }

      .nav_menu_button {
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 9px 12px;
        color: var(--ink);
        background: #fff;
        font-weight: 700;
      }

      main {
        width: min(960px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 48px 0 72px;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      h1 {
        max-width: 760px;
        font-size: clamp(2.3rem, 5vw, 4.8rem);
        line-height: 1;
      }

      p {
        margin-top: 14px;
        line-height: 1.65;
      }

      .guestbook-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }

      .button,
      .guestbook-button {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        border-radius: 6px;
        padding: 12px 16px;
        color: #fff;
        background: var(--accent);
        font-weight: 800;
        text-decoration: none;
      }

      .u-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .webflow-rich-text {
        margin-top: 36px;
        padding-top: 28px;
        border-top: 1px solid var(--line);
      }

      .structural-only-chain {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-height: 34px;
        margin-top: 28px;
      }

      .structural-only-chain svg {
        display: block;
        width: 28px;
        height: 28px;
      }
    </style>
  </head>
  <body>
    <header class="nav" data-testid="webflow-like-nav">
      <div class="nav_brand_stack" data-testid="ancestor-placeholder-order">
        <a class="nav_mobile_logo w-inline-block" href="/fixtures/preview-qa/structural-placeholders" aria-label="Governor's Mansion home" data-testid="mobile-svg-logo-link">
          <div class="u-max-width-full" data-testid="svg-only-logo-wrapper">
            <svg class="nav_logo_svg" viewBox="0 0 260 72" role="img" aria-labelledby="logo-title logo-desc" xmlns="http://www.w3.org/2000/svg">
              <title id="logo-title">Governor's Mansion</title>
              <desc id="logo-desc">Inline SVG-only logo used to verify identity manifests preserve decorative wrappers.</desc>
              <g fill="none" fill-rule="evenodd">
                <path fill="#476F55" d="M36 5 65 28v36H49V44H23v20H7V28L36 5Z" />
                <path fill="#162019" d="M88 20h9v30h-9zm18 0h33v7h-24v5h21v7h-21v11h-9zm42 0h9v30h-9zm21 0h10l17 18V20h9v30h-9l-18-18v18h-9z" />
              </g>
            </svg>
          </div>
        </a>
        <a class="nav_desktop_logo w-inline-block" href="/fixtures/preview-qa/structural-placeholders" aria-label="Governor's Mansion archive" data-testid="desktop-svg-logo-link">
          <svg class="nav_logo_svg" viewBox="0 0 260 72" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" fill-rule="evenodd">
              <path fill="#476F55" d="M36 8 61 30v31H47V45H25v16H11V30L36 8Z" />
              <path fill="#162019" d="M86 22h96v7H86zm0 14h120v7H86zm0 14h84v7H86z" />
            </g>
          </svg>
        </a>
      </div>
      <button class="nav_menu_button" type="button"><span>Menu</span></button>
    </header>

    <main>
      <h1>Sign the guestbook without losing the historic mansion identity.</h1>
      <p>
        This fixture combines an SVG-only logo wrapper, nested Webflow-style wrappers, hidden
        accessibility text, and short call-to-action copy that can expose destructive placeholder
        replacement or inline suffix leaks.
      </p>
      <section class="structural-only-chain" data-testid="placeholder-only-ancestor" aria-hidden="true">
        <span data-testid="placeholder-only-first-descendant">
          <svg viewBox="0 0 24 24" focusable="false" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4h16v16H4z" fill="#476F55" />
          </svg>
        </span>
        <span data-testid="placeholder-only-second-descendant">
          <svg viewBox="0 0 24 24" focusable="false" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="8" fill="#162019" />
          </svg>
        </span>
        <template data-testid="placeholder-only-template"><span data-template-child="true"></span></template>
      </section>
      <div class="guestbook-actions" id="guestbook">
        <a class="guestbook-button w-inline-block" data-expected-no-external-affix="true" data-testid="guestbook-sign-button" href="/fixtures/preview-qa/structural-placeholders#guestbook">
          <span class="button-text" data-testid="guestbook-sign-visible">Sign</span>
          <span class="u-sr-only" data-testid="guestbook-sign-sr-label">Sign guestbook</span>
        </a>
        <a class="button w-inline-block" data-testid="guestbook-view-button" href="/fixtures/preview-qa/domain-bound-widgets">
          <span>View</span>
          <span class="u-sr-only">View entries</span>
        </a>
        <a class="button w-inline-block" data-testid="ancestor-descendant-text-chain" href="/fixtures/preview-qa/structural-placeholders#inline-heading">
          <span data-testid="chain-icon">
            <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 9h14M9 2v14" stroke="currentColor" stroke-width="2" />
            </svg>
          </span>
          <span data-testid="chain-label">Open archive</span>
        </a>
      </div>
      <section class="webflow-rich-text" aria-labelledby="inline-heading">
        <h2 id="inline-heading">
          Keep <span><strong>inline</strong> labels</span> attached to the words they translate.
        </h2>
        <p>
          The phrase <span><strong>open</strong> guestbook</span> is intentionally short so QA can
          catch target-language text that escapes a fully wrapped inline placeholder.
        </p>
      </section>
    </main>
  </body>
</html>`;

const INLINE_COMPOSITE_HTML = `<!doctype html>
<html lang="en" data-fixture="preview-qa" data-fixture-scenario="inline-composite-boundaries">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preview QA Fixture: Inline Composite Boundaries</title>
    <link rel="icon" href="data:," />
    <link rel="canonical" href="${SOURCE_ORIGIN}/fixtures/preview-qa/inline-composite-boundaries" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #161b22;
        background: #f7f9fc;
      }

      main {
        width: min(960px, calc(100vw - 32px));
      }

      h1,
      p {
        margin: 0;
      }

      h1 {
        max-width: 820px;
        font-size: clamp(2.2rem, 6vw, 5rem);
        line-height: 1;
        letter-spacing: 0;
      }

      p {
        margin-top: 18px;
        max-width: 680px;
        line-height: 1.65;
      }

      .gradient-word {
        color: #2458d3;
      }

      .glitch-word-gray {
        color: #64748b;
      }

      .text-gradient {
        display: inline;
      }
    </style>
  </head>
  <body>
    <main>
      <h1 class="ttile-h1" data-testid="mission-critical-heading">Systems Engineering for <span id="gradient-word" class="gradient-word" data-testid="mission-critical-word">Mission-Critical</span><span class="text-gradient" data-testid="inline-empty-spacer"><strong> </strong></span><span class="glitch-word glitch-word-gray" data-testid="foundations-word">Foundations.</span></h1>
      <p>
        The first heading text node intentionally ends with a space before the gradient span. A
        translated preview should let the whole inline composite own target-language spacing and
        ordering after hydration restores the source phrase.
      </p>
    </main>
    <script>
      (function () {
        function restoreSourceHeading() {
          var heading = document.querySelector('[data-testid="mission-critical-heading"]');
          if (!heading) return;
          heading.innerHTML = 'Systems Engineering for <span id="gradient-word" class="gradient-word" data-testid="mission-critical-word">Mission-Critical</span><span class="text-gradient" data-testid="inline-empty-spacer"><strong> </strong></span><span class="glitch-word glitch-word-gray" data-testid="foundations-word">Foundations.</span>';
          heading.setAttribute("data-fixture-hydration", "source-restored");
          document.documentElement.setAttribute("data-inline-composite-hydrated", "1");
          window.__WEBLINGO_PREVIEW_QA_INLINE_COMPOSITE__ = {
            restored: true,
            firstTextNode: heading.firstChild ? heading.firstChild.textContent : null
          };
        }

        window.setTimeout(restoreSourceHeading, 120);
      })();
    </script>
  </body>
</html>`;

const SOURCE_REPAIR_HTML = `<!doctype html>
<html lang="en" data-fixture="preview-qa" data-fixture-scenario="source-repair-context">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preview QA Fixture: Source Repair Context</title>
    <link rel="icon" href="data:," />
    <link rel="canonical" href="${SOURCE_ORIGIN}/fixtures/preview-qa/source-repair-context" />
    <style>
      body {
        margin: 0;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #172025;
        background: #fafbf8;
      }

      main {
        width: min(900px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 52px 0 80px;
      }

      h1,
      h2,
      p,
      button {
        margin: 0;
      }

      h1 {
        max-width: 760px;
        font-size: clamp(2.25rem, 5vw, 4.6rem);
        line-height: 1;
      }

      p {
        margin-top: 14px;
        line-height: 1.65;
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
        margin-top: 28px;
      }

      .card {
        border: 1px solid #cdd8d2;
        border-radius: 8px;
        padding: 18px;
        background: #fff;
      }

      button {
        margin-top: 18px;
        border: 0;
        border-radius: 6px;
        padding: 12px 16px;
        color: #fff;
        background: #2458d3;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <h1 data-testid="source-repair-hero">Automated accounting</h1>
      <p data-testid="source-repair-intro">
        This page repeats short business phrases in different tags and selectors so translated
        previews can prove source-repair logic chooses the right context after hydration restores
        source text.
      </p>
      <section class="cards" aria-label="Repeated source-repair phrases">
        <article class="card">
          <h2 data-testid="source-repair-card-heading">Automated accounting</h2>
          <p data-testid="source-repair-card-copy">Accounting automation</p>
        </article>
        <article class="card">
          <h2 data-testid="source-repair-second-heading">Automated accounting</h2>
          <button type="button" data-testid="source-repair-button">Accounting automation</button>
        </article>
      </section>
    </main>
    <script>
      (function () {
        var restores = [
          ["source-repair-hero", "Automated accounting"],
          ["source-repair-card-heading", "Automated accounting"],
          ["source-repair-second-heading", "Automated accounting"],
          ["source-repair-card-copy", "Accounting automation"],
          ["source-repair-button", "Accounting automation"]
        ];

        function restoreSourceText() {
          for (var i = 0; i < restores.length; i += 1) {
            var target = document.querySelector('[data-testid="' + restores[i][0] + '"]');
            if (target) target.textContent = restores[i][1];
          }
          document.documentElement.setAttribute("data-source-repair-hydrated", "1");
          window.__WEBLINGO_PREVIEW_QA_SOURCE_REPAIR__ = { restored: true };
        }

        window.setTimeout(restoreSourceText, 120);
      })();
    </script>
  </body>
</html>`;

const DOMAIN_BOUND_HTML = `<!doctype html>
<html lang="en" data-fixture="preview-qa" data-fixture-scenario="domain-bound-widgets">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preview QA Fixture: Domain-Bound External Widgets</title>
    <link rel="icon" href="data:," />
    <link rel="canonical" href="${SOURCE_ORIGIN}/fixtures/preview-qa/domain-bound-widgets" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin data-weblingo-passive-external="font-preconnect" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" data-weblingo-passive-external="font-css" />
    <script>
      window.__WEBLINGO_PREVIEW_QA_EXPECTATIONS__ = {
        domainBoundCandidates: ["recaptcha", "turnstile", "hcaptcha", "google-identity", "auth0", "stripe", "paypal", "hubspot", "typeform", "calendly"],
        passiveControls: ["font-preconnect", "font-css", "webflow-cdn-script", "webflow-cdn-image"]
      };
    </script>
    <script defer src="https://cdn.prod.website-files.com/65a700000000000000000001/preview-qa-passive.js" data-weblingo-passive-external="webflow-cdn-script" data-testid="passive-cdn-script"></script>
    <script async defer src="https://www.google.com/recaptcha/api.js?render=explicit" data-testid="recaptcha-api"></script>
    <script async defer src="https://challenges.cloudflare.com/turnstile/v0/api.js" data-testid="turnstile-api"></script>
    <script async defer src="https://js.hcaptcha.com/1/api.js" data-testid="hcaptcha-api"></script>
    <script async defer src="https://accounts.google.com/gsi/client" data-testid="google-identity-api"></script>
    <script async src="https://js.stripe.com/v3/" data-testid="stripe-sdk"></script>
    <script async src="https://www.paypal.com/sdk/js?client-id=customer-domain-bound-paypal-client-id&currency=USD" data-testid="paypal-sdk"></script>
    <script async defer src="https://js.hsforms.net/forms/embed/v2.js" data-testid="hubspot-forms-api"></script>
    <style>
      body {
        margin: 0;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #172025;
        background: #f8faf7;
      }

      main {
        width: min(1040px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 44px 0 72px;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      h1 {
        max-width: 780px;
        font-size: clamp(2.2rem, 5vw, 4.6rem);
        line-height: 1;
      }

      p {
        margin-top: 12px;
        line-height: 1.65;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
        margin-top: 28px;
      }

      .fixture-panel {
        min-height: 180px;
        border: 1px solid #cad7d0;
        border-radius: 8px;
        padding: 18px;
        background: #fff;
      }

      .passive-control {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 24px;
        border-top: 1px solid #cad7d0;
        padding-top: 20px;
      }

      .passive-control img {
        width: 92px;
        height: 48px;
        object-fit: contain;
      }

      iframe {
        width: 100%;
        min-height: 96px;
        border: 1px solid #cad7d0;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Detect domain-bound external capabilities without flagging passive CDN assets.</h1>
      <p>
        These markers model browser-side providers that often validate origin, domain, referrer,
        site key, redirect URI, or postMessage origin after a prospect showcase moves to a
        generated showcase host.
      </p>

      <section class="grid" aria-label="Domain-bound external widget candidates">
        <article class="fixture-panel" data-weblingo-domain-bound-candidate="verification" data-provider="recaptcha" data-testid="recaptcha-widget">
          <h2>reCAPTCHA</h2>
          <div class="g-recaptcha" data-sitekey="customer-domain-bound-recaptcha-site-key"></div>
        </article>
        <article class="fixture-panel" data-weblingo-domain-bound-candidate="verification" data-provider="turnstile" data-testid="turnstile-widget">
          <h2>Turnstile</h2>
          <div class="cf-turnstile" data-sitekey="customer-domain-bound-turnstile-site-key"></div>
        </article>
        <article class="fixture-panel" data-weblingo-domain-bound-candidate="verification" data-provider="hcaptcha" data-testid="hcaptcha-widget">
          <h2>hCaptcha</h2>
          <div class="h-captcha" data-sitekey="customer-domain-bound-hcaptcha-site-key"></div>
        </article>
        <article class="fixture-panel" data-weblingo-domain-bound-candidate="identity" data-provider="google-identity" data-testid="google-identity-widget">
          <h2>Google Identity</h2>
          <div id="g_id_onload" data-client_id="customer-domain-bound-google-client-id.apps.googleusercontent.com" data-context="signin" data-ux_mode="popup"></div>
          <div class="g_id_signin" data-type="standard"></div>
        </article>
        <article class="fixture-panel" data-weblingo-domain-bound-candidate="identity" data-provider="auth0" data-testid="auth0-link">
          <h2>OAuth redirect</h2>
          <a href="https://weblingo-preview-fixture.auth0.com/authorize?client_id=customer-domain-bound-client&redirect_uri=https%3A%2F%2Fwww.governorsmansion.org%2Fauth%2Fcallback&origin=https%3A%2F%2Fwww.governorsmansion.org">Continue with hosted login</a>
        </article>
        <article class="fixture-panel" data-weblingo-domain-bound-candidate="payments" data-provider="stripe" data-testid="stripe-payment-element">
          <h2>Stripe</h2>
          <div id="payment-element" data-client-secret="pi_customer_domain_bound_secret_preview"></div>
        </article>
        <article class="fixture-panel" data-weblingo-domain-bound-candidate="payments" data-provider="paypal" data-testid="paypal-buttons">
          <h2>PayPal</h2>
          <div id="paypal-button-container" data-client-id="customer-domain-bound-paypal-client-id"></div>
        </article>
        <article class="fixture-panel" data-weblingo-domain-bound-candidate="embedded-form" data-provider="hubspot" data-testid="hubspot-form">
          <h2>HubSpot</h2>
          <div class="hs-form-frame" data-region="na1" data-portal-id="12345678" data-form-id="customer-domain-bound-form-id"></div>
        </article>
        <article class="fixture-panel" data-weblingo-domain-bound-candidate="embedded-form" data-provider="typeform" data-testid="typeform-embed">
          <h2>Typeform</h2>
          <iframe title="Typeform domain-bound fixture" src="https://form.typeform.com/to/customerDomainBound?typeform-source=www.governorsmansion.org"></iframe>
        </article>
        <article class="fixture-panel" data-weblingo-domain-bound-candidate="embedded-form" data-provider="calendly" data-testid="calendly-embed">
          <h2>Calendly</h2>
          <iframe title="Calendly domain-bound fixture" src="https://calendly.com/weblingo/domain-bound-preview?hide_event_type_details=1"></iframe>
        </article>
      </section>

      <section class="passive-control" aria-label="Passive CDN control assets">
        <img src="https://cdn.prod.website-files.com/65a700000000000000000001/preview-qa-logo.svg" alt="Passive Webflow CDN control" data-weblingo-passive-external="webflow-cdn-image" data-testid="passive-cdn-image" />
        <p data-weblingo-passive-external="copy">
          Passive CDN images and fonts are present as controls and should not be reported as
          domain-bound capability failures by static classification alone.
        </p>
      </section>
    </main>
  </body>
</html>`;

const SCENARIOS: Record<ScenarioId, ScenarioPayload> = {
  "structural-placeholders": {
    csp: STRUCTURAL_CSP,
    html: STRUCTURAL_HTML,
  },
  "domain-bound-widgets": {
    csp: DOMAIN_BOUND_CSP,
    html: DOMAIN_BOUND_HTML,
  },
  "inline-composite-boundaries": {
    csp: STRUCTURAL_CSP,
    html: INLINE_COMPOSITE_HTML,
  },
  "source-repair-context": {
    csp: STRUCTURAL_CSP,
    html: SOURCE_REPAIR_HTML,
  },
};

function isScenarioId(value: string): value is ScenarioId {
  return Object.prototype.hasOwnProperty.call(SCENARIOS, value);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ scenario: string }> },
): Promise<Response> {
  const { scenario } = await context.params;

  if (!isScenarioId(scenario)) {
    return new Response("Unknown preview QA fixture scenario.", {
      status: 404,
      headers: {
        ...RESPONSE_HEADERS,
        "content-security-policy": "default-src 'none'; base-uri 'none';",
        "content-type": "text/plain; charset=utf-8",
        "x-weblingo-preview-qa-scenario": "unknown",
      },
    });
  }

  const payload = SCENARIOS[scenario];

  return new Response(payload.html, {
    status: 200,
    headers: {
      ...RESPONSE_HEADERS,
      "content-security-policy": payload.csp,
      "content-type": "text/html; charset=utf-8",
      "x-weblingo-preview-qa-scenario": scenario,
    },
  });
}
