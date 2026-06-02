import type { Metadata } from "next";
import { headers } from "next/headers";

import { DemoDashboardEntry } from "./demo-dashboard-entry";
import {
  createTranslator,
  getMessages,
  resolvePreferredLocale,
  type Messages,
} from "@internal/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await resolveDemoDashboardMessages();
  return {
    title: t("dashboard.demo.metadata.title"),
    robots: { index: false, follow: false },
  };
}

export default async function DemoDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { messages } = await resolveDemoDashboardMessages();
  const token = (await searchParams).token ?? "";
  return <DemoDashboardEntry accessToken={token} messages={messages} />;
}

async function resolveDemoDashboardMessages(): Promise<{
  messages: Messages;
  t: ReturnType<typeof createTranslator>;
}> {
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const messages = await getMessages(locale);
  return { messages, t: createTranslator(messages) };
}
