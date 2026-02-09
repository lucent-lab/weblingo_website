import Link from "next/link";

import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";
import type { Messages, Translator } from "@internal/i18n";
import { landingContent } from "@modules/landing/content";

export const LANDING_VARIANT_IDS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
] as const;
export type LandingVariantId = (typeof LANDING_VARIANT_IDS)[number];

export const LANDING_FAQ_ITEMS = [
  { questionKey: "landing.faq.items.1.q", answerKey: "landing.faq.items.1.a" },
  { questionKey: "landing.faq.items.2.q", answerKey: "landing.faq.items.2.a" },
  { questionKey: "landing.faq.items.3.q", answerKey: "landing.faq.items.3.a" },
  { questionKey: "landing.faq.items.4.q", answerKey: "landing.faq.items.4.a" },
  { questionKey: "landing.faq.items.5.q", answerKey: "landing.faq.items.5.a" },
  { questionKey: "landing.faq.items.6.q", answerKey: "landing.faq.items.6.a" },
] as const;

export type LandingVariantContent = typeof landingContent.expansion;

export type LandingVariantProps = {
  locale: string;
  messages: Messages;
  t: Translator;
  content: LandingVariantContent;
  supportedLanguages: SupportedLanguage[];
  hasPreviewConfig: boolean;
};

export function VariantSwitcher({
  current,
  className,
}: {
  current: LandingVariantId;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "fixed bottom-4 right-4 z-50 grid grid-cols-5 gap-1 rounded-2xl border border-border bg-background/80 p-1 text-foreground shadow-sm backdrop-blur sm:grid-cols-10",
        className,
      )}
    >
      {LANDING_VARIANT_IDS.map((id) => (
        <Link
          key={id}
          href={`/landing-variant/${id}`}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-full text-xs font-semibold transition sm:h-8 sm:w-8",
            id === current
              ? "bg-foreground text-background"
              : "text-foreground/70 hover:bg-foreground/10 hover:text-foreground",
          )}
        >
          {id}
        </Link>
      ))}
    </nav>
  );
}
