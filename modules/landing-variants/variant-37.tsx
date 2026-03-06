import { i18nConfig } from "@internal/i18n";

import { LandingSegmentPage } from "@modules/landing/segment-page";

export function LandingVariant37() {
  return (
    <LandingSegmentPage
      locale={i18nConfig.defaultLocale}
      segment="expansion"
      tryFormFieldLayout="funnel"
    />
  );
}
