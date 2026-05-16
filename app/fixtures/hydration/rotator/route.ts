const STATES = ["conversions", "bookings", "signups", "revenue"] as const;
const PREFIX = "Turn international traffic into";

const PAGE_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; base-uri 'self'; object-src 'none';";
const FIXTURE_ROBOTS = "noindex, nofollow, noarchive";

const ROUTE_DATA_BODY = [
  "0:[",
  JSON.stringify({
    prefix: PREFIX,
    outcomes: STATES,
    title: `${PREFIX} conversions`,
  }),
  "]",
].join("");

function html(): string {
  return `<!doctype html>
<html lang="en" data-weblingo-fixture="hydration-rotator">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hydration Rotator Fixture</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #151515;
        background: #f7f7f4;
      }

      main {
        width: min(880px, calc(100vw - 32px));
      }

      h1 {
        font-size: clamp(2.25rem, 6vw, 5rem);
        line-height: 1;
        letter-spacing: 0;
      }

      .rotator {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0.35rem;
      }

      .rotator-word-wrap {
        position: relative;
        display: inline-grid;
        min-inline-size: 12ch;
        white-space: nowrap;
      }

      .rotator-word-layer {
        grid-area: 1 / 1;
      }

      .rotator-word-incoming {
        animation: fixture-rotator-in 280ms ease-out both;
      }

      .rotator-word-outgoing {
        animation: fixture-rotator-out 180ms ease-in both;
      }

      @keyframes fixture-rotator-in {
        from {
          opacity: 0;
          transform: translateY(0.35em);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes fixture-rotator-out {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(-0.25em);
        }
      }

      .sr-only {
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
    </style>
  </head>
  <body>
    <main>
      <h1>
        <span
          class="rotator"
          data-testid="fixture-client-rotator"
          data-fixture-source-owned="true"
          data-rotator-index="0"
          data-rotator-tick="0"
        >
          <span class="rotator-prefix">${PREFIX}</span>
          <span aria-atomic="true" aria-live="polite" class="rotator-word-wrap">
            <span class="sr-only">${PREFIX} conversions</span>
            <span aria-hidden="true" class="rotator-word-layer rotator-word">conversions</span>
          </span>
        </span>
      </h1>
      <p>This fixture must keep rotating after translation runtime repair.</p>
    </main>
    <script>
      (self.__next_f = self.__next_f || []).push([1, ${JSON.stringify(ROUTE_DATA_BODY)}]);
    </script>
    <script>
      (function () {
        var states = ${JSON.stringify(STATES)};
        var prefix = ${JSON.stringify(PREFIX)};
        var root = document.querySelector('[data-testid="fixture-client-rotator"]');
        if (!root) return;
        var wordWrap = root.querySelector(".rotator-word-wrap");
        var liveText = wordWrap && wordWrap.querySelector(".sr-only");
        var currentLayer = wordWrap && wordWrap.querySelector(".rotator-word");
        var index = 0;
        var tick = 0;

        function render(nextIndex) {
          if (!wordWrap || !liveText || !currentLayer) return;
          var previous = currentLayer;
          var nextState = states[nextIndex % states.length];
          var outgoing = previous.cloneNode(true);
          outgoing.className = "rotator-word-layer rotator-word-outgoing";
          previous.replaceWith(outgoing);

          var incoming = document.createElement("span");
          incoming.setAttribute("aria-hidden", "true");
          incoming.className = "rotator-word-layer rotator-word rotator-word-incoming";
          incoming.textContent = nextState;
          wordWrap.appendChild(incoming);

          liveText.textContent = prefix + " " + nextState;
          root.setAttribute("data-rotator-index", String(nextIndex % states.length));
          tick += 1;
          root.setAttribute("data-rotator-tick", String(tick));
          currentLayer = incoming;

          window.setTimeout(function () {
            if (outgoing.parentNode) {
              outgoing.parentNode.removeChild(outgoing);
            }
            incoming.classList.remove("rotator-word-incoming");
          }, 320);
        }

        window.__WEBLINGO_FIXTURE_ROTATOR_STATES__ = states.slice();
        window.setInterval(function () {
          index = (index + 1) % states.length;
          render(index);
        }, 650);

        window.fetch(window.location.pathname + "?_rsc=fixture", {
          headers: { RSC: "1", Accept: "text/x-component" },
          credentials: "same-origin",
        }).catch(function () {});
      })();
    </script>
  </body>
</html>`;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.has("_rsc") || request.headers.get("rsc") === "1") {
    return new Response(ROUTE_DATA_BODY, {
      status: 200,
      headers: {
        "cache-control": "public, max-age=60",
        "content-type": "text/x-component; charset=utf-8",
        "x-robots-tag": FIXTURE_ROBOTS,
        "x-weblingo-hydration-fixture": "rotator",
        "x-weblingo-fixture-route-data": "1",
      },
    });
  }

  return new Response(html(), {
    status: 200,
    headers: {
      "cache-control": "public, max-age=60",
      "content-security-policy": PAGE_CSP,
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": FIXTURE_ROBOTS,
      "x-weblingo-hydration-fixture": "rotator",
    },
  });
}
