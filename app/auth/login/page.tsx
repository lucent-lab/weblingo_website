import { notFound, redirect } from "next/navigation";

import { envServer } from "@internal/core";
import { i18nConfig } from "@internal/i18n";

export default function AuthLoginRedirect() {
  if (envServer.PUBLIC_PORTAL_MODE !== "enabled") {
    notFound();
  }
  redirect(`/${i18nConfig.defaultLocale}/login`);
}
