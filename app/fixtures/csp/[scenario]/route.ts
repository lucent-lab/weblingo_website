type ScenarioId = "strict-eval-carousel" | "compat-eval-carousel" | "strict-non-eval-widget";

type ScenarioPayload = {
  csp: string;
  html: string;
};

const STRICT_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; base-uri 'self'; object-src 'none';";
const COMPAT_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; base-uri 'self'; object-src 'none';";

const SCENARIOS: Record<ScenarioId, ScenarioPayload> = {
  "strict-eval-carousel": {
    csp: STRICT_CSP,
    html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>WebLingo CSP Fixture: strict eval carousel</title>
  </head>
  <body data-weblingo-scenario-id="strict-eval-carousel">
    <section id="carousel-shell" data-weblingo-scenario="eval-carousel">
      <div id="carousel-root"></div>
    </section>
    <script>
      try {
        const initFactory = new Function("return function build(){ return true; }");
        initFactory();
        const root = document.getElementById("carousel-root");
        root.setAttribute("data-type", "carousel");
        root.innerHTML =
          '<button aria-label="Prev Slide">Prev</button>' +
          '<button aria-label="Play automatic slide show">Play</button>' +
          '<button aria-label="Next Slide">Next</button>';
      } catch (error) {
        console.error("fixture-eval-bootstrap-failed", error && error.message ? error.message : String(error));
      }
    </script>
  </body>
</html>`,
  },
  "compat-eval-carousel": {
    csp: COMPAT_CSP,
    html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>WebLingo CSP Fixture: compat eval carousel</title>
  </head>
  <body data-weblingo-scenario-id="compat-eval-carousel">
    <section id="carousel-shell" data-weblingo-scenario="eval-carousel">
      <div id="carousel-root"></div>
    </section>
    <script>
      try {
        const initFactory = new Function("return function build(){ return true; }");
        initFactory();
        const root = document.getElementById("carousel-root");
        root.setAttribute("data-type", "carousel");
        root.innerHTML =
          '<button aria-label="Prev Slide">Prev</button>' +
          '<button aria-label="Play automatic slide show">Play</button>' +
          '<button aria-label="Next Slide">Next</button>';
      } catch (error) {
        console.error("fixture-eval-bootstrap-failed", error && error.message ? error.message : String(error));
      }
    </script>
  </body>
</html>`,
  },
  "strict-non-eval-widget": {
    csp: STRICT_CSP,
    html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>WebLingo CSP Fixture: strict non-eval widget</title>
  </head>
  <body data-weblingo-scenario-id="strict-non-eval-widget">
    <section id="widget-shell" data-weblingo-scenario="non-eval-widget">
      <button id="toggle" aria-controls="panel" aria-expanded="false">Toggle</button>
      <div id="panel" hidden>Visible panel</div>
    </section>
    <script>
      const toggle = document.getElementById("toggle");
      const panel = document.getElementById("panel");
      toggle.addEventListener("click", () => {
        if (panel.hasAttribute("hidden")) {
          panel.removeAttribute("hidden");
          toggle.setAttribute("aria-expanded", "true");
        } else {
          panel.setAttribute("hidden", "");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    </script>
  </body>
</html>`,
  },
};

const RESPONSE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=60",
  "x-weblingo-csp-fixture": "1",
};

function isScenarioId(value: string): value is ScenarioId {
  return value in SCENARIOS;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ scenario: string }> },
): Promise<Response> {
  const { scenario } = await context.params;

  if (!isScenarioId(scenario)) {
    return new Response(`Unknown CSP fixture scenario: ${scenario}`, {
      status: 404,
      headers: {
        ...RESPONSE_HEADERS,
      },
    });
  }

  const payload = SCENARIOS[scenario];
  return new Response(payload.html, {
    status: 200,
    headers: {
      ...RESPONSE_HEADERS,
      "content-security-policy": payload.csp,
      "x-weblingo-csp-scenario": scenario,
    },
  });
}
