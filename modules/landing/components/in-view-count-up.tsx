"use client";

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

type InViewCountUpProps = {
  target: number;
  suffix?: string;
  durationMs?: number;
  delayMs?: number;
  className?: string;
  ariaLabel?: string;
};

export function InViewCountUp({
  target,
  suffix = "",
  durationMs = 900,
  delayMs = 0,
  className,
  ariaLabel,
}: InViewCountUpProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const [hasEnteredView, setHasEnteredView] = useState(false);
  const [forceRenderFinal, setForceRenderFinal] = useState(false);
  const [count, setCount] = useState(0);
  const shouldRenderFinalImmediately = prefersReducedMotion || forceRenderFinal;
  const hasStarted = hasEnteredView || shouldRenderFinalImmediately;

  useEffect(() => {
    if (shouldRenderFinalImmediately) {
      return;
    }

    const node = rootRef.current;
    if (!node) {
      return;
    }

    if (typeof IntersectionObserver !== "function") {
      const fallbackTimer = window.setTimeout(() => {
        setForceRenderFinal(true);
      }, 0);

      return () => window.clearTimeout(fallbackTimer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        setHasEnteredView(true);
        observer.disconnect();
      },
      {
        threshold: 0.4,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldRenderFinalImmediately]);

  useEffect(() => {
    if (!hasStarted || shouldRenderFinalImmediately || durationMs <= 0) {
      return;
    }

    let delayTimer: number | null = null;
    let tickTimer: number | null = null;
    let cancelled = false;

    const startAnimation = () => {
      const startedAt = Date.now();

      const tick = () => {
        if (cancelled) {
          return;
        }

        const elapsedMs = Date.now() - startedAt;
        const progress = Math.min(1, elapsedMs / durationMs);
        setCount(Math.round(target * progress));

        if (progress < 1) {
          tickTimer = window.setTimeout(tick, 16);
        }
      };

      tickTimer = window.setTimeout(tick, 16);
    };

    if (delayMs > 0) {
      delayTimer = window.setTimeout(startAnimation, delayMs);
    } else {
      startAnimation();
    }

    return () => {
      cancelled = true;
      if (delayTimer !== null) {
        window.clearTimeout(delayTimer);
      }
      if (tickTimer !== null) {
        window.clearTimeout(tickTimer);
      }
    };
  }, [delayMs, durationMs, hasStarted, shouldRenderFinalImmediately, target]);

  const displayValue =
    hasStarted && (shouldRenderFinalImmediately || durationMs <= 0) ? target : count;

  return (
    <span aria-label={ariaLabel} className={className} ref={rootRef}>
      {displayValue}
      {suffix}
    </span>
  );
}
