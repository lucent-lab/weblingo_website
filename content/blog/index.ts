import type { ComponentType } from "react";

import LaunchWeek, { metadata as launchWeekMeta } from "./launch-week.mdx";
import PreviewWorkflow, { metadata as previewWorkflowMeta } from "./preview-workflow.mdx";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  component: ComponentType;
};

const blogPosts: BlogPost[] = [
  {
    slug: "launch-week",
    title: launchWeekMeta.title,
    description: launchWeekMeta.description ?? "",
    date: launchWeekMeta.date ?? "2025-01-20",
    component: LaunchWeek,
  },
  {
    slug: "preview-workflow",
    title: previewWorkflowMeta.title,
    description: previewWorkflowMeta.description ?? "",
    date: previewWorkflowMeta.date ?? "2025-01-10",
    component: PreviewWorkflow,
  },
];

export const posts = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date));

export function getPostBySlug(slug: string) {
  return blogPosts.find((entry) => entry.slug === slug);
}
