"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import styles from "../segment-page.module.css";

type HowTimelineStep = {
  title: string;
  body: string;
};

type HowStepsTimelineProps = {
  steps: ReadonlyArray<HowTimelineStep>;
  className?: string;
};

export function HowStepsTimeline({ steps, className }: HowStepsTimelineProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [observedIndex, setObservedIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  const activeIndex = prefersReducedMotion ? Math.max(steps.length - 1, 0) : observedIndex;

  useEffect(() => {
    if (prefersReducedMotion || typeof IntersectionObserver !== "function") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let highestIndex = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const indexValue = Number(entry.target.getAttribute("data-step-index"));
          if (!Number.isFinite(indexValue)) {
            continue;
          }
          highestIndex = Math.max(highestIndex, indexValue);
        }

        if (highestIndex === 0) {
          return;
        }

        setObservedIndex((current) => Math.max(current, highestIndex));
      },
      {
        threshold: 0.6,
        rootMargin: "0px 0px -15% 0px",
      },
    );

    for (const stepRef of stepRefs.current) {
      if (!stepRef) {
        continue;
      }
      observer.observe(stepRef);
    }

    return () => observer.disconnect();
  }, [prefersReducedMotion, steps.length]);

  const progress = useMemo(() => {
    if (steps.length <= 1) {
      return 1;
    }
    return Math.min(1, Math.max(0, activeIndex / (steps.length - 1)));
  }, [activeIndex, steps.length]);

  return (
    <div
      className={cn(styles.timeline, className)}
      data-testid="how-steps-timeline"
      style={
        {
          "--timeline-progress": progress,
        } as CSSProperties
      }
    >
      <div aria-hidden className={styles.timelineRail}>
        <span className={styles.timelineRailFill} />
      </div>
      <ol className={styles.timelineList}>
        {steps.map((step, index) => {
          const active = prefersReducedMotion || index <= activeIndex;
          return (
            <li
              className={styles.timelineItem}
              data-step-index={index}
              key={step.title}
              ref={(node) => {
                stepRefs.current[index] = node;
              }}
            >
              <div className={cn(styles.timelineMarker, active ? styles.timelineMarkerActive : "")}>
                {index + 1}
              </div>
              <article className={cn(styles.timelineCard, active ? styles.timelineCardActive : "")}>
                <h3 className={styles.timelineTitle}>{step.title}</h3>
                <p className={styles.timelineBody}>{step.body}</p>
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
