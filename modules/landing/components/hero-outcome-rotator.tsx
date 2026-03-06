"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import styles from "../segment-page.module.css";

type HeroOutcomeRotatorProps = {
  prefix: string;
  outcomes: ReadonlyArray<string>;
  intervalMs?: number;
  className?: string;
};

const ROTATION_ANIMATION_MS = 380;

export function HeroOutcomeRotator({
  prefix,
  outcomes,
  intervalMs = 3_000,
  className,
}: HeroOutcomeRotatorProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const resolvedOutcomes = useMemo(() => {
    const filtered = outcomes.map((item) => item.trim()).filter((item) => item.length > 0);
    return filtered.length > 0 ? filtered : [""];
  }, [outcomes]);
  const [index, setIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const indexRef = useRef(index);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (prefersReducedMotion || resolvedOutcomes.length <= 1) {
      return;
    }

    const rotate = () => {
      const current = indexRef.current % resolvedOutcomes.length;
      const next = (current + 1) % resolvedOutcomes.length;
      setPreviousIndex(current);
      setIndex(next);
      indexRef.current = next;
    };

    const timer = window.setInterval(() => {
      rotate();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, prefersReducedMotion, resolvedOutcomes.length]);

  useEffect(() => {
    if (previousIndex === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPreviousIndex(null);
    }, ROTATION_ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [previousIndex]);

  const widestWordLength = useMemo(
    () => resolvedOutcomes.reduce((currentMax, item) => Math.max(currentMax, item.length), 0),
    [resolvedOutcomes],
  );
  const safeIndex = index % resolvedOutcomes.length;
  const activeOutcome = resolvedOutcomes[safeIndex] ?? resolvedOutcomes[0] ?? "";
  const hasAnimatedTransition =
    !prefersReducedMotion && previousIndex !== null && previousIndex !== safeIndex;
  const previousOutcome =
    hasAnimatedTransition && previousIndex !== null
      ? (resolvedOutcomes[previousIndex % resolvedOutcomes.length] ?? "")
      : null;

  return (
    <span className={cn(styles.heroRotator, className)} data-testid="hero-outcome-rotator">
      <span className={styles.heroRotatorPrefix}>{prefix}</span>
      <span
        aria-atomic="true"
        aria-live="polite"
        className={styles.heroRotatorWordWrap}
        style={
          {
            "--rotator-min-ch": widestWordLength + 1,
          } as CSSProperties
        }
      >
        <span className="sr-only">{`${prefix} ${activeOutcome}`}</span>
        {previousOutcome ? (
          <span
            aria-hidden="true"
            className={cn(styles.heroRotatorWordLayer, styles.heroRotatorWordOutgoing)}
          >
            {previousOutcome}
          </span>
        ) : null}
        <span
          aria-hidden="true"
          className={cn(
            styles.heroRotatorWordLayer,
            styles.heroRotatorWord,
            hasAnimatedTransition ? styles.heroRotatorWordIncoming : undefined,
          )}
        >
          {activeOutcome}
        </span>
      </span>
    </span>
  );
}
