import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { envServer } from "@internal/core/env-server";
import { resolvePreferredLocale } from "@internal/i18n";

export default async function AuthLoginRedirect() {
  if (envServer.PUBLIC_PORTAL_MODE !== "enabled") {
    notFound();
  }
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  redirect(`/${locale}/login`);
}
