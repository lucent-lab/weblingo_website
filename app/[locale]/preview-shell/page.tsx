import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  PreviewShell,
  PreviewShellFallback,
  type PreviewShellCopy,
} from "@/components/preview-shell";
import { envPreview } from "@internal/core/preview-env";
import { createLocalizedMetadata, normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

export function isAllowedPreviewUrlForBase(value: string, baseUrl: string): boolean {
  try {
    const previewUrl = new URL(value);
    const previewBase = new URL(baseUrl);
    return previewUrl.origin === previewBase.origin && previewUrl.pathname.startsWith("/_preview/");
  } catch {
    return false;
  }
}

function isAllowedPreviewUrl(value: string): boolean {
  return isAllowedPreviewUrlForBase(value, envPreview.PREVIEW_BASE_URL);
}

async function loadPreviewHtml(previewUrl: string): Promise<string> {
  const response = await fetch(previewUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load preview HTML (${response.status})`);
  }
  return response.text();
}

function buildPreviewShellCopy(
  locale: string,
  t: (key: string, fallback?: string, vars?: Record<string, string>) => string,
): PreviewShellCopy {
  return {
    title: t("preview.shell.title", "Preview shell"),
    description: t(
      "preview.shell.description",
      "The page renders in a live iframe so links, scripts, and relative assets keep working.",
    ),
    openPreviewLabel: t("preview.shell.openPreview", "Open preview in a new tab"),
    previewFrameTitle: t("preview.shell.previewFrameTitle", "Live preview"),
    fallbackTitle: t("preview.shell.fallback.title", "Unable to load preview"),
    fallbackDescription: t(
      "preview.shell.fallback.description",
      "This preview could not be loaded. Return to the Try page and request a fresh preview.",
    ),
    fallbackActionLabel: t("preview.shell.fallback.action", "Back to Try"),
    overlay: {
      lang: locale,
      eyebrow: t("preview.shell.overlay.eyebrow", "Preview feedback"),
      title: t("preview.shell.overlay.title", "Preview feedback"),
      description: t(
        "preview.shell.overlay.description",
        "Floating on top of the page and isolated from preview styles.",
      ),
      translationQualityLabel: t(
        "preview.shell.overlay.translationQualityLabel",
        "Translation quality",
      ),
      designFidelityLabel: t("preview.shell.overlay.designFidelityLabel", "Design fidelity"),
      commentLabel: t("preview.shell.overlay.commentLabel", "Any comment?"),
      commentPlaceholder: t(
        "preview.shell.overlay.commentPlaceholder",
        "Leave a short note about this preview.",
      ),
      collapsedSummary: t(
        "preview.shell.overlay.collapsedSummary",
        "Minimized. Drag the header to move this panel.",
      ),
      expandedSummary: t(
        "preview.shell.overlay.expandedSummary",
        "Drag the header to move this panel.",
      ),
      openLabel: t("preview.shell.overlay.openLabel", "Open"),
      collapseLabel: t("preview.shell.overlay.collapseLabel", "Minimize"),
      openAriaLabel: t("preview.shell.overlay.openAriaLabel", "Open preview feedback"),
      collapseAriaLabel: t("preview.shell.overlay.collapseAriaLabel", "Minimize preview feedback"),
    },
  };
}

export default async function PreviewShellPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const previewUrl = typeof resolvedSearchParams?.src === "string" ? resolvedSearchParams.src : "";
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const copy = buildPreviewShellCopy(locale, t);

  if (!previewUrl || !isAllowedPreviewUrl(previewUrl)) {
    return <PreviewShellFallback copy={copy} href={`/${locale}/try`} />;
  }

  let previewHtml: string;
  try {
    previewHtml = await loadPreviewHtml(previewUrl);
  } catch {
    return <PreviewShellFallback copy={copy} href={`/${locale}/try`} />;
  }
  return <PreviewShell previewHtml={previewHtml} previewUrl={previewUrl} copy={copy} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    return {};
  }
  const metadata = await createLocalizedMetadata(Promise.resolve({ locale }), {
    titleKey: "preview.shell.meta.title",
    descriptionKey: "preview.shell.meta.description",
    titleFallback: "Iframe preview",
    descriptionFallback:
      "View a live localized preview inside the WebLingo shell and inspect the feedback overlay.",
  });
  return { ...metadata, robots: { index: false, follow: false } };
}
