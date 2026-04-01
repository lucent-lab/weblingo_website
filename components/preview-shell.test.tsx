// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  buildPreviewShellDocument,
  injectPreviewBaseHref,
  PreviewShell,
  PreviewShellFallback,
  type PreviewShellCopy,
} from "./preview-shell";

const copy: PreviewShellCopy = {
  title: "Preview shell",
  description:
    "The page renders in a live iframe so links, scripts, and relative assets keep working.",
  openPreviewLabel: "Open preview in a new tab",
  previewFrameTitle: "Live preview",
  fallbackTitle: "Unable to load preview",
  fallbackDescription:
    "This preview could not be loaded. Return to the Try page and request a fresh preview.",
  fallbackActionLabel: "Back to Try",
  overlay: {
    lang: "en",
    eyebrow: "Preview feedback",
    title: "Preview feedback",
    description: "Floating on top of the page and isolated from preview styles.",
    translationQualityLabel: "Translation quality",
    designFidelityLabel: "Design fidelity",
    commentLabel: "Any comment?",
    commentPlaceholder: "Leave a short note about this preview.",
    collapsedSummary: "Minimized. Drag the header to move this panel.",
    expandedSummary: "Drag the header to move this panel.",
    openLabel: "Open",
    collapseLabel: "Minimize",
    openAriaLabel: "Open preview feedback",
    collapseAriaLabel: "Minimize preview feedback",
  },
};

describe("injectPreviewBaseHref", () => {
  it("adds a base href inside the head", () => {
    const html = '<html><head><meta charset="utf-8"></head><body></body></html>';
    const injected = injectPreviewBaseHref(html, "https://preview.example.com/_preview/abc");

    expect(injected).toContain('<base href="https://preview.example.com/_preview/">');
  });
});

describe("buildPreviewShellDocument", () => {
  it("keeps the base href and strips the backend overlay payload", () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><main>Preview</main><div data-weblingo-preview-overlay="1"></div><style data-weblingo-preview-overlay-style="1">body{color:red}</style><script data-weblingo-preview-overlay-script="1">void 0;</script></body></html>`;
    const sanitized = buildPreviewShellDocument(html, "https://preview.example.com/_preview/abc");

    expect(sanitized).toContain('<base href="https://preview.example.com/_preview/">');
    expect(sanitized).toContain("<main>Preview</main>");
    expect(sanitized).not.toContain("data-weblingo-preview-overlay");
    expect(sanitized).not.toContain("data-weblingo-preview-overlay-script");
    expect(sanitized).not.toContain("data-weblingo-preview-overlay-style");
  });
});

describe("PreviewShell", () => {
  it("renders the iframe preview shell with localized chrome and iframe-backed documents", () => {
    render(
      <PreviewShell
        copy={copy}
        previewUrl="https://preview.example.com/_preview/abc"
        previewHtml={
          '<html><head><meta charset="utf-8"></head><body><main>Preview</main></body></html>'
        }
      />,
    );

    expect(screen.getByRole("heading", { name: "Preview shell" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open preview in a new tab" })).toBeTruthy();

    const previewIframe = screen.getByTitle("Live preview") as HTMLIFrameElement;
    const previewSrcDoc = previewIframe.getAttribute("srcdoc") ?? "";
    expect(previewSrcDoc).toContain('<base href="https://preview.example.com/_preview/">');
    expect(previewSrcDoc).toContain("<main>Preview</main>");
    expect(previewIframe.getAttribute("sandbox")).toBe(
      "allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts",
    );

    const feedbackIframe = screen.getByTitle("Preview feedback") as HTMLIFrameElement;
    const feedbackSrcDoc = feedbackIframe.getAttribute("srcdoc") ?? "";
    expect(feedbackSrcDoc).toContain("Preview feedback");
    expect(feedbackSrcDoc).toContain("Minimized. Drag the header to move this panel.");
  });
});

describe("PreviewShellFallback", () => {
  it("renders a localized fallback for preview load failures", () => {
    render(<PreviewShellFallback copy={copy} href="/en/try" />);

    expect(screen.getByRole("heading", { name: "Unable to load preview" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Try" })).toBeTruthy();
  });
});
