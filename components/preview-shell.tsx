import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { PreviewDocumentSurface } from "@/components/preview-document-surface";

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value);
}

export type PreviewShellOverlayCopy = {
  lang: string;
  eyebrow: string;
  title: string;
  description: string;
  translationQualityLabel: string;
  designFidelityLabel: string;
  commentLabel: string;
  commentPlaceholder: string;
  collapsedSummary: string;
  expandedSummary: string;
  openLabel: string;
  collapseLabel: string;
  openAriaLabel: string;
  collapseAriaLabel: string;
};

export type PreviewShellCopy = {
  title: string;
  description: string;
  openPreviewLabel: string;
  previewFrameTitle: string;
  fallbackTitle: string;
  fallbackDescription: string;
  fallbackActionLabel: string;
  overlay: PreviewShellOverlayCopy;
};

export function injectPreviewBaseHref(previewHtml: string, previewUrl: string): string {
  const baseHref = new URL("./", previewUrl).toString();
  if (/<base[\s>]/i.test(previewHtml)) {
    return previewHtml;
  }
  if (/<head[^>]*>/i.test(previewHtml)) {
    return previewHtml.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`);
  }
  return `<base href="${baseHref}">${previewHtml}`;
}

export function stripInjectedPreviewFeedbackOverlay(previewHtml: string): string {
  const overlayPattern =
    /<div\b[^>]*data-weblingo-preview-overlay="1"[\s\S]*?<script\b[^>]*data-weblingo-preview-overlay-script="1"[\s\S]*?<\/script>/i;
  if (overlayPattern.test(previewHtml)) {
    return previewHtml.replace(overlayPattern, "");
  }

  return previewHtml
    .replace(/<style\b[^>]*data-weblingo-preview-overlay-style="1"[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[^>]*data-weblingo-preview-overlay-script="1"[\s\S]*?<\/script>/gi, "")
    .replace(/<div\b[^>]*data-weblingo-preview-overlay="1"[\s\S]*?<\/div>/gi, "");
}

export function buildPreviewShellDocument(previewHtml: string, previewUrl: string): string {
  return stripInjectedPreviewFeedbackOverlay(injectPreviewBaseHref(previewHtml, previewUrl));
}

function buildFeedbackOverlaySrcDoc(copy: PreviewShellOverlayCopy): string {
  const escapedCommentPlaceholder = escapeHtmlAttribute(copy.commentPlaceholder);
  const collapsedSummary = JSON.stringify(copy.collapsedSummary);
  const expandedSummary = JSON.stringify(copy.expandedSummary);
  const openLabel = JSON.stringify(copy.openLabel);
  const collapseLabel = JSON.stringify(copy.collapseLabel);
  const openAriaLabel = JSON.stringify(copy.openAriaLabel);
  const collapseAriaLabel = JSON.stringify(copy.collapseAriaLabel);
  return `<!doctype html>
<html lang="${escapeHtmlAttribute(copy.lang)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; height: 100%; }
      body {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: rgba(250, 250, 248, 0.96);
        color: #111827;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .panel {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        border: 1px solid rgba(17, 24, 39, 0.12);
        border-radius: 20px;
        box-shadow: 0 16px 40px rgba(17, 24, 39, 0.16);
        backdrop-filter: blur(14px);
      }
      .eyebrow {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(17, 24, 39, 0.52);
      }
      .title {
        margin: 0;
        font-size: 15px;
        font-weight: 650;
        line-height: 1.2;
      }
      .subtitle {
        margin: 4px 0 0;
        font-size: 12px;
        line-height: 1.4;
        color: rgba(17, 24, 39, 0.68);
      }
      [data-weblingo-preview-overlay="1"] {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        width: min(19rem, calc(100vw - 32px));
        max-width: calc(100vw - 32px);
        pointer-events: none;
      }
      [data-weblingo-preview-overlay-shell="1"] {
        pointer-events: auto;
        overflow: hidden;
        border: 1px solid rgba(17, 24, 39, 0.16);
        border-radius: 20px;
        box-shadow: 0 20px 50px rgba(17, 24, 39, 0.22);
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(14px);
        transition: width 180ms ease, box-shadow 180ms ease, transform 180ms ease;
      }
      [data-weblingo-preview-overlay-header="1"] {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
      [data-weblingo-preview-overlay-header="1"] .weblingo-preview-overlay-labels {
        min-width: 0;
        display: grid;
        gap: 2px;
      }
      [data-weblingo-preview-overlay-header="1"] .weblingo-preview-overlay-eyebrow {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(17, 24, 39, 0.52);
      }
      [data-weblingo-preview-overlay-header="1"] .weblingo-preview-overlay-title {
        font-size: 14px;
        font-weight: 650;
        line-height: 1.2;
        color: #111827;
      }
      [data-weblingo-preview-overlay-summary="1"] {
        font-size: 12px;
        line-height: 1.4;
        color: rgba(17, 24, 39, 0.64);
      }
      [data-weblingo-preview-overlay-toggle="1"] {
        flex: 0 0 auto;
        border: 1px solid rgba(17, 24, 39, 0.12);
        border-radius: 999px;
        background: rgba(249, 250, 251, 0.96);
        padding: 10px 14px;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        color: #111827;
        cursor: pointer;
      }
      [data-weblingo-preview-overlay-body="1"] {
        border-top: 1px solid rgba(17, 24, 39, 0.1);
      }
      .ratings { display: grid; gap: 12px; }
      .rating-label {
        margin: 0 0 6px;
        font-size: 12px;
        font-weight: 600;
      }
      .stars {
        display: inline-flex;
        gap: 6px;
        color: #8b5cf6;
        font-size: 18px;
        line-height: 1;
      }
      textarea {
        width: 100%;
        min-height: 74px;
        resize: none;
        border: 1px solid rgba(17, 24, 39, 0.12);
        border-radius: 12px;
        padding: 10px 12px;
        outline: none;
        background: rgba(255, 255, 255, 0.9);
        font: inherit;
        font-size: 13px;
        color: inherit;
      }
      textarea::placeholder {
        color: rgba(17, 24, 39, 0.42);
      }
    </style>
  </head>
  <body>
    <div
      data-weblingo-preview-overlay="1"
      data-state="collapsed"
      aria-hidden="false"
    >
      <div
        data-weblingo-preview-overlay-shell="1"
      >
        <div
          data-weblingo-preview-overlay-header="1"
        >
          <div class="weblingo-preview-overlay-labels">
            <div class="weblingo-preview-overlay-eyebrow">
              ${escapeHtmlText(copy.eyebrow)}
            </div>
            <div class="weblingo-preview-overlay-title">
              ${escapeHtmlText(copy.title)}
            </div>
            <div data-weblingo-preview-overlay-summary="1">
              ${escapeHtmlText(copy.collapsedSummary)}
            </div>
          </div>
          <button
            type="button"
            data-weblingo-preview-overlay-toggle="1"
            aria-expanded="false"
            aria-label="${escapeHtmlAttribute(copy.openAriaLabel)}"
          >
            ${escapeHtmlText(copy.openLabel)}
          </button>
        </div>
        <div
          data-weblingo-preview-overlay-body="1"
          hidden
        >
          <section class="panel">
            <div>
              <p class="subtitle">${escapeHtmlText(copy.description)}</p>
            </div>

            <div class="ratings">
              <div>
                <p class="rating-label">${escapeHtmlText(copy.translationQualityLabel)}</p>
                <div class="stars" aria-label="${escapeHtmlAttribute(copy.translationQualityLabel)}">★★★★★</div>
              </div>
              <div>
                <p class="rating-label">${escapeHtmlText(copy.designFidelityLabel)}</p>
                <div class="stars" aria-label="${escapeHtmlAttribute(copy.designFidelityLabel)}">★★★★★</div>
              </div>
            </div>

            <label>
              <p class="rating-label">${escapeHtmlText(copy.commentLabel)}</p>
              <textarea placeholder="${escapedCommentPlaceholder}"></textarea>
            </label>
          </section>
        </div>
      </div>
    </div>
    <script>
      (() => {
        const overlay = document.querySelector('[data-weblingo-preview-overlay="1"]');
        if (!(overlay instanceof HTMLElement)) {
          return;
        }
        const shell = overlay.querySelector('[data-weblingo-preview-overlay-shell="1"]');
        const header = overlay.querySelector('[data-weblingo-preview-overlay-header="1"]');
        const body = overlay.querySelector('[data-weblingo-preview-overlay-body="1"]');
        const summary = overlay.querySelector('[data-weblingo-preview-overlay-summary="1"]');
        const toggle = overlay.querySelector('[data-weblingo-preview-overlay-toggle="1"]');
        if (
          !(shell instanceof HTMLElement) ||
          !(header instanceof HTMLElement) ||
          !(body instanceof HTMLElement) ||
          !(summary instanceof HTMLElement) ||
          !(toggle instanceof HTMLButtonElement)
        ) {
          return;
        }

        const collapsedSummary = ${collapsedSummary};
        const expandedSummary = ${expandedSummary};
        const openLabel = ${openLabel};
        const collapseLabel = ${collapseLabel};
        const openAriaLabel = ${openAriaLabel};
        const collapseAriaLabel = ${collapseAriaLabel};
        const stateKey = 'weblingo-preview-overlay:${escapeHtmlAttribute(copy.lang)}';
        const collapsedWidth = 'min(19rem, calc(100vw - 32px))';
        const expandedWidth = 'min(22rem, calc(100vw - 32px))';
        const shellWidthPadding = 8;
        let isOpen = false;
        let dragging = false;
        let pointerId = null;
        let dragOriginX = 0;
        let dragOriginY = 0;
        let dragStartLeft = 0;
        let dragStartTop = 0;

        function readState() {
          try {
            const value = window.sessionStorage.getItem(stateKey);
            if (!value) {
              return null;
            }
            const parsed = JSON.parse(value);
            if (!parsed || typeof parsed !== 'object') {
              return null;
            }
            return parsed;
          } catch {
            return null;
          }
        }

        function writeState() {
          try {
            const left = overlay.style.left ? Number.parseFloat(overlay.style.left) : null;
            const top = overlay.style.top ? Number.parseFloat(overlay.style.top) : null;
            window.sessionStorage.setItem(
              stateKey,
              JSON.stringify({
                open: isOpen,
                left: Number.isFinite(left) ? left : null,
                top: Number.isFinite(top) ? top : null,
              }),
            );
          } catch {
            return;
          }
        }

        function setPosition(left, top) {
          overlay.style.left = Math.round(left) + 'px';
          overlay.style.top = Math.round(top) + 'px';
          overlay.style.right = 'auto';
          overlay.style.bottom = 'auto';
        }

        function clampPosition(left, top) {
          const maxLeft = Math.max(shellWidthPadding, window.innerWidth - overlay.offsetWidth - shellWidthPadding);
          const maxTop = Math.max(shellWidthPadding, window.innerHeight - overlay.offsetHeight - shellWidthPadding);
          return {
            left: Math.min(Math.max(shellWidthPadding, left), maxLeft),
            top: Math.min(Math.max(shellWidthPadding, top), maxTop),
          };
        }

        function applyViewportClamp() {
          if (!overlay.style.left || !overlay.style.top) {
            return;
          }
          const left = Number.parseFloat(overlay.style.left);
          const top = Number.parseFloat(overlay.style.top);
          if (!Number.isFinite(left) || !Number.isFinite(top)) {
            return;
          }
          const clamped = clampPosition(left, top);
          setPosition(clamped.left, clamped.top);
        }

        function syncState() {
          overlay.dataset.state = isOpen ? 'open' : 'collapsed';
          shell.style.width = isOpen ? expandedWidth : collapsedWidth;
          body.hidden = !isOpen;
          toggle.textContent = isOpen ? collapseLabel : openLabel;
          toggle.setAttribute('aria-expanded', String(isOpen));
          toggle.setAttribute('aria-label', isOpen ? collapseAriaLabel : openAriaLabel);
          summary.textContent = isOpen ? expandedSummary : collapsedSummary;
          requestAnimationFrame(() => {
            applyViewportClamp();
          });
          writeState();
        }

        const storedState = readState();
        if (storedState && typeof storedState === 'object') {
          if (typeof storedState.left === 'number' && typeof storedState.top === 'number') {
            setPosition(storedState.left, storedState.top);
          }
          if (typeof storedState.open === 'boolean') {
            isOpen = storedState.open;
          }
        }

        syncState();

        toggle.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          isOpen = !isOpen;
          syncState();
        });

        header.addEventListener('pointerdown', (event) => {
          if (event.button !== 0) {
            return;
          }
          if (event.target instanceof Element && event.target.closest('button')) {
            return;
          }
          const rect = overlay.getBoundingClientRect();
          if (!overlay.style.left || !overlay.style.top) {
            setPosition(rect.left, rect.top);
          }
          dragOriginX = event.clientX;
          dragOriginY = event.clientY;
          dragStartLeft = Number.parseFloat(overlay.style.left || String(rect.left));
          dragStartTop = Number.parseFloat(overlay.style.top || String(rect.top));
          dragging = true;
          pointerId = event.pointerId;
          header.setPointerCapture(pointerId);
          header.style.cursor = 'grabbing';
        });

        header.addEventListener('pointermove', (event) => {
          if (!dragging || event.pointerId !== pointerId) {
            return;
          }
          const nextLeft = dragStartLeft + (event.clientX - dragOriginX);
          const nextTop = dragStartTop + (event.clientY - dragOriginY);
          const clamped = clampPosition(nextLeft, nextTop);
          setPosition(clamped.left, clamped.top);
        });

        function endDrag(event) {
          if (!dragging || event.pointerId !== pointerId) {
            return;
          }
          dragging = false;
          pointerId = null;
          header.style.cursor = 'grab';
          try {
            header.releasePointerCapture(event.pointerId);
          } catch {
            // Ignore pointer-capture release failures from browsers that do not retain it.
          }
          writeState();
        }

        header.addEventListener('pointerup', endDrag);
        header.addEventListener('pointercancel', endDrag);
        window.addEventListener('resize', applyViewportClamp);
      })();
    </script>
  </body>
</html>`;
}

type PreviewShellProps = {
  previewHtml: string;
  previewUrl: string;
  copy: PreviewShellCopy;
};

export function PreviewShell({ previewHtml, previewUrl, copy }: PreviewShellProps) {
  const previewDocument = buildPreviewShellDocument(previewHtml, previewUrl);
  const overlaySrcDoc = buildFeedbackOverlaySrcDoc(copy.overlay);

  return (
    <div className="min-h-screen bg-background px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col gap-4">
        <Card className="border-border/80 bg-card/95 shadow-sm backdrop-blur">
          <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">{copy.title}</CardTitle>
                <CardDescription>{copy.description}</CardDescription>
              </div>
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {copy.openPreviewLabel}
              </a>
            </div>
          </CardHeader>
        </Card>

        <Card className="min-h-0 flex-1 overflow-hidden border-border/80 shadow-md">
          <PreviewDocumentSurface
            previewHtml={previewDocument}
            previewTitle={copy.previewFrameTitle}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background/10 via-transparent to-transparent" />
            <div className="absolute right-4 top-4 z-20 w-[22rem] max-w-[calc(100%-2rem)]">
              <div className="pointer-events-auto overflow-hidden rounded-[1.5rem] border border-border/80 bg-card/95 shadow-2xl shadow-foreground/10 backdrop-blur">
                <iframe
                  title={copy.overlay.title}
                  className="h-[18rem] w-full border-0 bg-transparent"
                  srcDoc={overlaySrcDoc}
                />
              </div>
            </div>
          </PreviewDocumentSurface>
        </Card>
      </div>
    </div>
  );
}

type PreviewShellFallbackProps = {
  copy: PreviewShellCopy;
  href: string;
};

export function PreviewShellFallback({ copy, href }: PreviewShellFallbackProps) {
  return (
    <div className="min-h-screen bg-background px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl items-center">
        <Card className="w-full max-w-2xl border-border/80 bg-card/95 shadow-sm backdrop-blur">
          <CardHeader className="border-b border-border/70 px-4 py-4 sm:px-6">
            <CardTitle className="text-base">{copy.fallbackTitle}</CardTitle>
            <CardDescription>{copy.fallbackDescription}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <a
              href={href}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {copy.fallbackActionLabel}
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
