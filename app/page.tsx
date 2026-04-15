import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resolvePreferredLocale } from "@internal/i18n";

export default async function RootRedirect() {
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  redirect(`/${locale}`);
}
