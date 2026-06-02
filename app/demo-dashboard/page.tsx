import type { Metadata } from "next";
import { headers } from "next/headers";

import { DemoDashboardEntry } from "./demo-dashboard-entry";
import {
  createTranslator,
  getMessages,
  normalizeLocale,
  resolvePreferredLocale,
  type Messages,
} from "@internal/i18n";

type DemoDashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: DemoDashboardPageProps = {}): Promise<Metadata> {
  const { t } = await resolveDemoDashboardMessages(searchParams);
  return {
    title: t("dashboard.demo.metadata.title"),
    robots: { index: false, follow: false },
  };
}

export default async function DemoDashboardPage({ searchParams }: DemoDashboardPageProps) {
  const { messages } = await resolveDemoDashboardMessages(searchParams);
  return <DemoDashboardEntry messages={messages} />;
}

async function resolveDemoDashboardMessages(
  searchParams?: DemoDashboardPageProps["searchParams"],
): Promise<{
  messages: Messages;
  t: ReturnType<typeof createTranslator>;
}> {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedLocale = getSingleSearchParam(resolvedSearchParams?.locale);
  const locale = requestedLocale
    ? normalizeLocale(requestedLocale)
    : resolvePreferredLocale((await headers()).get("accept-language"));
  const messages = await getMessages(locale);
  return { messages, t: createTranslator(messages) };
}

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
