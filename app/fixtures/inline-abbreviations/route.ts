const SOURCE_ORIGIN = "https://weblingo.app";

const STRICT_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'self'; object-src 'none'; form-action 'self';";

const RESPONSE_HEADERS = {
  "cache-control": "public, max-age=60",
  "x-weblingo-inline-abbreviation-fixture": "1",
};

const fixtureHtml = `<!doctype html>
<html lang="en" data-fixture="inline-abbreviations">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Inline Abbreviation Translation Fixture</title>
    <link rel="icon" href="data:," />
    <meta
      name="description"
      content="A fixture for nested inline markup, abbreviations, and terminology that creates French translation quirks."
    />
    <link rel="canonical" href="${SOURCE_ORIGIN}/fixtures/inline-abbreviations" />
    <style>
      body {
        margin: 0;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #151a1f;
        background: #f6f8fb;
      }

      main {
        max-width: 980px;
        margin: 0 auto;
        padding: 48px 20px 80px;
      }

      section {
        border-top: 1px solid #d7dee8;
        padding: 28px 0;
      }

      .eyebrow,
      .tag {
        color: #586778;
        font-size: 0.86rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      h1 {
        max-width: 820px;
        font-size: clamp(2.25rem, 6vw, 4.4rem);
        line-height: 0.98;
      }

      h2 {
        margin-bottom: 12px;
        font-size: 1.65rem;
      }

      h3 {
        margin-bottom: 8px;
        font-size: 1.1rem;
      }

      p {
        margin-top: 12px;
        line-height: 1.65;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 18px;
      }

      .card {
        border: 1px solid #d7dee8;
        border-radius: 8px;
        padding: 18px;
        background: #fff;
      }

      .split-word {
        color: #0b6bcb;
      }

      code,
      kbd {
        border: 1px solid #c9d3df;
        border-radius: 4px;
        padding: 0.08rem 0.32rem;
        background: #eef3f8;
        font-family: "SFMono-Regular", Consolas, monospace;
        font-size: 0.9em;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 16px;
        background: #fff;
      }

      th,
      td {
        border: 1px solid #d7dee8;
        padding: 10px;
        text-align: left;
        vertical-align: top;
      }

      button {
        margin-top: 16px;
        border: 0;
        border-radius: 6px;
        padding: 10px 14px;
        color: white;
        background: #151a1f;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">WebLingo inline fixture</p>
      <h1>
        From <span class="split-word">MVP</span> to
        <span class="split-word"><abbr title="General availability">GA</abbr></span> without
        breaking <span><abbr title="Service-level agreement">SLA</abbr>-critical</span> copy.
      </h1>
      <p>
        This page intentionally mixes English abbreviations, expansions, and nested inline tags that
        French or Japanese translation may reorder, expand, contract, or keep unchanged.
      </p>

      <section aria-labelledby="productization-heading">
        <h2 id="productization-heading">
          From Prototype to
          <span class="split-word"><abbr title="Production readiness">Productization</abbr>.</span>
        </h2>
        <p>
          Move the <strong>proof of concept</strong> into a
          <span><em>production-ready</em> <abbr title="Software as a Service">SaaS</abbr></span>
          rollout, while preserving inline emphasis around the term that may become
          <span lang="fr">industrialisation</span>, <span lang="fr">mise en production</span>, or an
          acronym-free phrase.
        </p>
      </section>

      <section aria-labelledby="nested-heading">
        <h2 id="nested-heading">
          <span>Translate the whole <em>CTA</em></span>
          <span>before moving the <abbr title="Call to action">CTA</abbr> label.</span>
        </h2>
        <div class="grid">
          <article class="card">
            <p class="tag">Nested action copy</p>
            <h3>
              Ship <span><strong>AI</strong>-assisted</span>
              <span><abbr title="Quality assurance">QA</abbr></span> in one sprint.
            </h3>
            <p>
              The phrase <span><strong>AI</strong>-assisted <em>QA</em></span> may become a longer
              target-language expression, but the nested bold and emphasis should move with the
              correct words.
            </p>
            <button type="button" aria-label="Start AI-assisted QA review now">
              Start <span><abbr title="Artificial intelligence">AI</abbr>-assisted</span>
              <span><abbr title="Quality assurance">QA</abbr></span>
            </button>
          </article>

          <article class="card">
            <p class="tag">Operational acronym copy</p>
            <h3>
              Keep <span><abbr title="Mean time to recovery">MTTR</abbr></span> low during
              <span><abbr title="Incident command">IC</abbr></span> handoff.
            </h3>
            <p>
              In French, <abbr title="Mean time to recovery">MTTR</abbr> might stay as an acronym,
              while <span><abbr title="Incident command">IC</abbr> handoff</span> may need a
              descriptive phrase such as crisis coordination handoff.
            </p>
          </article>
        </div>
      </section>

      <section aria-labelledby="finance-heading">
        <h2 id="finance-heading">
          Localize <span><abbr title="Annual recurring revenue">ARR</abbr></span>,
          <span><abbr title="Monthly recurring revenue">MRR</abbr></span>, and
          <span><abbr title="Customer acquisition cost">CAC</abbr></span> without losing the formula.
        </h2>
        <p>
          Keep the equation
          <code><abbr title="Lifetime value">LTV</abbr> / <abbr title="Customer acquisition cost">CAC</abbr> &gt; 3</code>
          intact, but translate the surrounding sentence:
          <span>finance teams call it <strong>healthy unit economics</strong>.</span>
        </p>
        <table aria-label="Abbreviation expansion examples">
          <thead>
            <tr>
              <th>Source label</th>
              <th>Nested phrase to translate</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><abbr title="Annual recurring revenue">ARR</abbr></td>
              <td><span>Annual recurring revenue</span> after <em>enterprise</em> upgrades</td>
            </tr>
            <tr>
              <td><abbr title="Customer acquisition cost">CAC</abbr></td>
              <td><strong>Blended</strong> customer acquisition cost for paid channels</td>
            </tr>
            <tr>
              <td><abbr title="Net revenue retention">NRR</abbr></td>
              <td>Net revenue retention with <span><em>expansion</em> MRR</span></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section aria-labelledby="medical-heading">
        <h2 id="medical-heading">
          Avoid false friends in
          <span><abbr title="Emergency medical services">EMS</abbr></span> and
          <span><abbr title="Electronic medical record">EMR</abbr></span> copy.
        </h2>
        <p>
          The phrase
          <span><abbr title="Emergency medical services">EMS</abbr> response time</span> can require
          a target-language expansion, while
          <span><abbr title="Electronic medical record">EMR</abbr> export</span> may remain a
          product feature label. Nested tags should not force both terms to translate the same way.
        </p>
      </section>

      <section aria-labelledby="science-heading">
        <h2 id="science-heading">
          Preserve scientific notation like
          <span>CO<sub>2</sub></span>, <span>H<sub>2</sub>O</span>, and
          <span>p95<sup>th</sup></span> latency.
        </h2>
        <p>
          The sentence says: reduce <strong>CO<sub>2</sub>-equivalent</strong> emissions by
          <span><strong>12%</strong> quarter over quarter</span>, then explain the
          <abbr title="Service-level objective">SLO</abbr> impact in plain language.
        </p>
      </section>

      <section aria-labelledby="keyboard-heading">
        <h2 id="keyboard-heading">
          Translate shortcuts, ARIA labels, and labels around <kbd>⌘</kbd> + <kbd>K</kbd>.
        </h2>
        <p>
          Press <kbd>⌘</kbd> + <kbd>K</kbd> to open the
          <span><abbr title="Command-line interface">CLI</abbr>-style command palette</span>, then
          select <span><strong>Run <abbr title="User acceptance testing">UAT</abbr></strong></span>.
        </p>
        <button type="button" aria-label="Open CLI-style command palette for UAT">
          Open <span><abbr title="Command-line interface">CLI</abbr></span> palette
        </button>
      </section>
    </main>
  </body>
</html>`;

export async function GET(): Promise<Response> {
  return new Response(fixtureHtml, {
    status: 200,
    headers: {
      ...RESPONSE_HEADERS,
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": STRICT_CSP,
    },
  });
}
