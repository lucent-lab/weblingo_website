import { redirect } from "next/navigation";

import { i18nConfig } from "@internal/i18n";

export default function LegacyLoginRedirect() {
  redirect(`/${i18nConfig.defaultLocale}/login`);
}
