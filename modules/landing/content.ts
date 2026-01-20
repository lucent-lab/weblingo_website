import type { LucideIcon } from "lucide-react";
import { Briefcase, Clock, Laptop, Plane, Search, TrendingDown } from "lucide-react";

type StatItem = {
  valueKey: string;
  labelKey: string;
};

type IconItem = {
  titleKey: string;
  bodyKey: string;
  icon: LucideIcon;
};

type LandingContent = {
  hero: {
    taglineKey: string;
    titleKey: string;
    subtitleKey: string;
  };
  stats: StatItem[];
  pain: {
    titleKey: string;
    subtitleKey: string;
    costTitleKey: string;
    costBodyKey: string;
    items: IconItem[];
  };
  useCases: {
    titleKey: string;
    subtitleKey: string;
    items: IconItem[];
  };
  how: {
    titleKey: string;
    items: Array<{
      titleKey: string;
      bodyKey: string;
    }>;
  };
  cta: {
    titleKey: string;
    subtitleKey: string;
    primaryKey: string;
    secondaryKey: string;
  };
  metadata: {
    titleKey: string;
    descriptionKey: string;
    titleFallback: string;
    descriptionFallback: string;
  };
};

export const landingSegments = ["expansion", "saas", "tourism", "agency"] as const;
export type LandingSegment = (typeof landingSegments)[number];

const sharedStats: StatItem[] = [
  {
    valueKey: "landing.expansion.stats.1.value",
    labelKey: "landing.expansion.stats.1.label",
  },
  {
    valueKey: "landing.expansion.stats.2.value",
    labelKey: "landing.expansion.stats.2.label",
  },
  {
    valueKey: "landing.expansion.stats.3.value",
    labelKey: "landing.expansion.stats.3.label",
  },
];

const sharedPain = {
  titleKey: "landing.expansion.pain.title",
  subtitleKey: "landing.expansion.pain.subtitle",
  costTitleKey: "landing.expansion.cost.title",
  costBodyKey: "landing.expansion.cost.body",
  items: [
    {
      titleKey: "landing.expansion.pain.items.1.title",
      bodyKey: "landing.expansion.pain.items.1.body",
      icon: Search,
    },
    {
      titleKey: "landing.expansion.pain.items.2.title",
      bodyKey: "landing.expansion.pain.items.2.body",
      icon: TrendingDown,
    },
    {
      titleKey: "landing.expansion.pain.items.3.title",
      bodyKey: "landing.expansion.pain.items.3.body",
      icon: Clock,
    },
  ],
} satisfies LandingContent["pain"];

const sharedUseCases = {
  titleKey: "landing.expansion.useCases.title",
  subtitleKey: "landing.expansion.useCases.subtitle",
  items: [
    {
      titleKey: "landing.expansion.useCases.items.1.title",
      bodyKey: "landing.expansion.useCases.items.1.body",
      icon: Plane,
    },
    {
      titleKey: "landing.expansion.useCases.items.2.title",
      bodyKey: "landing.expansion.useCases.items.2.body",
      icon: Laptop,
    },
    {
      titleKey: "landing.expansion.useCases.items.3.title",
      bodyKey: "landing.expansion.useCases.items.3.body",
      icon: Briefcase,
    },
  ],
} satisfies LandingContent["useCases"];

const sharedHow = {
  titleKey: "landing.expansion.how.title",
  items: [
    {
      titleKey: "landing.expansion.how.items.1.title",
      bodyKey: "landing.expansion.how.items.1.body",
    },
    {
      titleKey: "landing.expansion.how.items.2.title",
      bodyKey: "landing.expansion.how.items.2.body",
    },
    {
      titleKey: "landing.expansion.how.items.3.title",
      bodyKey: "landing.expansion.how.items.3.body",
    },
  ],
} satisfies LandingContent["how"];

const sharedCta = {
  titleKey: "landing.expansion.cta.title",
  subtitleKey: "landing.expansion.cta.subtitle",
  primaryKey: "landing.expansion.cta.primary",
  secondaryKey: "landing.expansion.cta.secondary",
} satisfies LandingContent["cta"];

export const landingContent: Record<LandingSegment, LandingContent> = {
  expansion: {
    hero: {
      taglineKey: "landing.expansion.tagline",
      titleKey: "landing.expansion.title",
      subtitleKey: "landing.expansion.subtitle",
    },
    stats: sharedStats,
    pain: sharedPain,
    useCases: sharedUseCases,
    how: sharedHow,
    cta: sharedCta,
    metadata: {
      titleKey: "landing.expansion.title",
      descriptionKey: "landing.expansion.subtitle",
      titleFallback: "Turn international traffic into conversions and revenue",
      descriptionFallback:
        "WebLingo helps you localize and host your site so global visitors convert. Launch a private preview in minutes.",
    },
  },
  saas: {
    hero: {
      taglineKey: "landing.saas.tagline",
      titleKey: "landing.saas.title",
      subtitleKey: "landing.saas.subtitle",
    },
    stats: sharedStats,
    pain: sharedPain,
    useCases: sharedUseCases,
    how: sharedHow,
    cta: sharedCta,
    metadata: {
      titleKey: "landing.saas.title",
      descriptionKey: "landing.saas.subtitle",
      titleFallback: "Stop paying for traffic you can’t convert",
      descriptionFallback:
        "WebLingo publishes SEO-ready localized pages that stay in sync with every release.",
    },
  },
  tourism: {
    hero: {
      taglineKey: "landing.tourism.tagline",
      titleKey: "landing.tourism.title",
      subtitleKey: "landing.tourism.subtitle",
    },
    stats: sharedStats,
    pain: sharedPain,
    useCases: sharedUseCases,
    how: sharedHow,
    cta: sharedCta,
    metadata: {
      titleKey: "landing.tourism.title",
      descriptionKey: "landing.tourism.subtitle",
      titleFallback: "Turn international searches into direct bookings",
      descriptionFallback:
        "WebLingo localizes your pages so guests trust, book, and stay in sync with every update.",
    },
  },
  agency: {
    hero: {
      taglineKey: "landing.agency.tagline",
      titleKey: "landing.agency.title",
      subtitleKey: "landing.agency.subtitle",
    },
    stats: sharedStats,
    pain: sharedPain,
    useCases: sharedUseCases,
    how: sharedHow,
    cta: sharedCta,
    metadata: {
      titleKey: "landing.agency.title",
      descriptionKey: "landing.agency.subtitle",
      titleFallback: "Localization without the maintenance burden",
      descriptionFallback:
        "Deliver localized pages for clients without rebuilding or maintaining every language.",
    },
  },
};
