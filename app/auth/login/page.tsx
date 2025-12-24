import { redirect } from "next/navigation";

import { i18nConfig } from "@internal/i18n";

export default function AuthLoginRedirect() {
  redirect(`/${i18nConfig.defaultLocale}/login`);
}
