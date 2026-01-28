import type { ComponentType } from "react";

import GettingStarted, { metadata as gettingStartedMeta } from "./getting-started.mdx";
import SiteSetup, { metadata as siteSetupMeta } from "./site-setup.mdx";
import TranslationPipeline, {
  metadata as translationPipelineMeta,
} from "./translation-pipeline.mdx";
import ApiReference, { metadata as apiReferenceMeta } from "./api-reference.mdx";

export type DocEntry = {
  slug: string[];
  title: string;
  description: string;
  section: string;
  order: number;
  component: ComponentType;
};

const docEntries: DocEntry[] = [
  {
    slug: ["getting-started"],
    title: gettingStartedMeta.title,
    description: gettingStartedMeta.description ?? "",
    section: gettingStartedMeta.section ?? "Basics",
    order: gettingStartedMeta.order ?? 0,
    component: GettingStarted,
  },
  {
    slug: ["site-setup"],
    title: siteSetupMeta.title,
    description: siteSetupMeta.description ?? "",
    section: siteSetupMeta.section ?? "Basics",
    order: siteSetupMeta.order ?? 0,
    component: SiteSetup,
  },
  {
    slug: ["translation-pipeline"],
    title: translationPipelineMeta.title,
    description: translationPipelineMeta.description ?? "",
    section: translationPipelineMeta.section ?? "Pipeline",
    order: translationPipelineMeta.order ?? 0,
    component: TranslationPipeline,
  },
  {
    slug: ["api-reference"],
    title: apiReferenceMeta.title,
    description: apiReferenceMeta.description ?? "",
    section: apiReferenceMeta.section ?? "Developer",
    order: apiReferenceMeta.order ?? 0,
    component: ApiReference,
  },
];

const sectionMap = new Map<string, DocEntry[]>();
for (const entry of docEntries) {
  const current = sectionMap.get(entry.section);
  if (current) {
    current.push(entry);
  } else {
    sectionMap.set(entry.section, [entry]);
  }
}

export const docSections = Array.from(sectionMap, ([title, items]) => ({
  title,
  items: [...items].sort((a, b) => a.order - b.order),
}));

export const docs = [...docEntries].sort((a, b) => a.title.localeCompare(b.title));

export function getDocBySlug(slug: string[]) {
  const key = slug.join("/");
  return docEntries.find((entry) => entry.slug.join("/") === key);
}
