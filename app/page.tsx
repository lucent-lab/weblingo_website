import { redirect } from "next/navigation";

import { i18nConfig } from "@internal/i18n";

export default function RootRedirect() {
  redirect(`/${i18nConfig.defaultLocale}`);
}
