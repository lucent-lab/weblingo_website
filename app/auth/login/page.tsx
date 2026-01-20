import { notFound, redirect } from "next/navigation";

import { env } from "@internal/core";
import { i18nConfig } from "@internal/i18n";

export default function AuthLoginRedirect() {
  if (env.PUBLIC_PORTAL_MODE !== "enabled") {
    notFound();
  }
  redirect(`/${i18nConfig.defaultLocale}/login`);
}
