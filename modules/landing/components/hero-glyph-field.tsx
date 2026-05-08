"use client";

import { type CSSProperties, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import styles from "../segment-page.module.css";

type HeroGlyphFieldProps = {
  className?: string;
};

type AmbientGlyph = {
  delay: string;
  duration: string;
  glyph: string;
  opacity: number;
  rotate: string;
  size: string;
  x: string;
  y: string;
};

const TRAIL_GLYPHS = ["A", "é", "ñ", "文", "語", "あ", "カ", "한", "글", "λ", "Ж", "Д"] as const;
const TRAIL_ANIMATION_DURATION_MS = 1_500;
const MAX_TRAIL_GLYPHS = 24;
const MIN_TIME_BETWEEN_TRAILS_MS = 250;
const MIN_DISTANCE_BETWEEN_TRAILS_PX = 75;
const AMBIENT_GLYPHS: ReadonlyArray<AmbientGlyph> = [
  {
    glyph: "文",
    x: "2%",
    y: "7%",
    size: "18px",
    opacity: 0.12,
    rotate: "-10deg",
    delay: "-1s",
    duration: "12s",
  },
  {
    glyph: "語",
    x: "8%",
    y: "14%",
    size: "23px",
    opacity: 0.1,
    rotate: "7deg",
    delay: "-6s",
    duration: "14s",
  },
  {
    glyph: "あ",
    x: "14%",
    y: "8%",
    size: "15px",
    opacity: 0.08,
    rotate: "-4deg",
    delay: "-3s",
    duration: "11s",
  },
  {
    glyph: "カ",
    x: "22%",
    y: "5%",
    size: "18px",
    opacity: 0.07,
    rotate: "9deg",
    delay: "-7s",
    duration: "13s",
  },
  {
    glyph: "é",
    x: "77%",
    y: "10%",
    size: "16px",
    opacity: 0.08,
    rotate: "-8deg",
    delay: "-4s",
    duration: "12s",
  },
  {
    glyph: "글",
    x: "87%",
    y: "16%",
    size: "23px",
    opacity: 0.1,
    rotate: "5deg",
    delay: "-9s",
    duration: "15s",
  },
  {
    glyph: "Ж",
    x: "95%",
    y: "7%",
    size: "19px",
    opacity: 0.09,
    rotate: "-6deg",
    delay: "-5s",
    duration: "11s",
  },
  {
    glyph: "λ",
    x: "4%",
    y: "35%",
    size: "17px",
    opacity: 0.08,
    rotate: "8deg",
    delay: "-8s",
    duration: "14s",
  },
  {
    glyph: "ñ",
    x: "12%",
    y: "52%",
    size: "19px",
    opacity: 0.06,
    rotate: "-7deg",
    delay: "-2s",
    duration: "12s",
  },
  {
    glyph: "カ",
    x: "91%",
    y: "48%",
    size: "20px",
    opacity: 0.07,
    rotate: "11deg",
    delay: "-6s",
    duration: "13s",
  },
  {
    glyph: "文",
    x: "82%",
    y: "68%",
    size: "16px",
    opacity: 0.06,
    rotate: "-5deg",
    delay: "-10s",
    duration: "15s",
  },
  {
    glyph: "Д",
    x: "6%",
    y: "78%",
    size: "18px",
    opacity: 0.07,
    rotate: "6deg",
    delay: "-4s",
    duration: "12s",
  },
] as const;

function getAmbientStyle(glyph: AmbientGlyph) {
  return {
    "--glyph-delay": glyph.delay,
    "--glyph-duration": glyph.duration,
    "--glyph-opacity": glyph.opacity,
    "--glyph-rotate": glyph.rotate,
    "--glyph-size": glyph.size,
    "--glyph-x": glyph.x,
    "--glyph-y": glyph.y,
  } as CSSProperties;
}

function pickTrailGlyph(index: number) {
  return TRAIL_GLYPHS[index % TRAIL_GLYPHS.length] ?? TRAIL_GLYPHS[0];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getFallClassName(index: number) {
  if (index % 3 === 1) {
    return styles.heroGlyphTrailFallTwo;
  }

  if (index % 3 === 2) {
    return styles.heroGlyphTrailFallThree;
  }

  return styles.heroGlyphTrailFallOne;
}

export function HeroGlyphField({ className }: HeroGlyphFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trailIndexRef = useRef(0);
  const trailCountRef = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    const heroSection = root?.closest("section");
    if (!root || !heroSection || typeof window.matchMedia !== "function") {
      return;
    }

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(pointer: fine)").matches
    ) {
      return;
    }

    const rect = { height: 1, left: 0, top: 0, width: 1 };
    let lastTrailPosition = { x: 0, y: 0 };
    let lastTrailTimestamp = window.performance.now();
    let lastPointerPosition = { x: 0, y: 0 };

    const updateRect = () => {
      const bounds = heroSection.getBoundingClientRect();
      rect.left = bounds.left;
      rect.top = bounds.top;
      rect.width = Math.max(1, bounds.width);
      rect.height = Math.max(1, bounds.height);
    };

    const pruneTrails = () => {
      while (trailCountRef.current > MAX_TRAIL_GLYPHS) {
        const trail = root.querySelector(`.${styles.heroGlyphTrail}`);
        if (!trail) {
          trailCountRef.current = 0;
          return;
        }
        trail.remove();
        trailCountRef.current -= 1;
      }
    };

    const removeTrail = (trail: HTMLSpanElement) => {
      if (!trail.isConnected) {
        return;
      }
      trail.remove();
      trailCountRef.current = Math.max(0, trailCountRef.current - 1);
    };

    const spawnGlyph = (position: { x: number; y: number }) => {
      const glyphIndex = trailIndexRef.current;
      trailIndexRef.current += 1;

      const trail = document.createElement("span");
      trail.className = cn(styles.heroGlyphTrail, getFallClassName(glyphIndex));
      trail.textContent = pickTrailGlyph(glyphIndex);
      trail.style.left = `${position.x}px`;
      trail.style.top = `${position.y}px`;
      trail.style.setProperty("--glyph-size", `${14 + (glyphIndex % 3) * 4}px`);

      root.append(trail);
      trailCountRef.current += 1;
      pruneTrails();

      const cleanup = () => removeTrail(trail);
      trail.addEventListener("animationend", cleanup, { once: true });
      window.setTimeout(cleanup, TRAIL_ANIMATION_DURATION_MS);
    };

    const onPointerMove = (event: PointerEvent) => {
      const now = window.performance.now();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        lastPointerPosition = { x: 0, y: 0 };
        return;
      }

      const pointerPosition = { x, y };
      if (lastPointerPosition.x === 0 && lastPointerPosition.y === 0) {
        lastPointerPosition = pointerPosition;
      }

      const hasMovedFarEnough =
        Math.hypot(lastTrailPosition.x - x, lastTrailPosition.y - y) >=
        MIN_DISTANCE_BETWEEN_TRAILS_PX;
      const hasBeenLongEnough = now - lastTrailTimestamp > MIN_TIME_BETWEEN_TRAILS_MS;

      if (hasMovedFarEnough || hasBeenLongEnough) {
        spawnGlyph({
          x: clamp(x, 0, rect.width),
          y: clamp(y, 0, rect.height),
        });
        lastTrailPosition = pointerPosition;
        lastTrailTimestamp = now;
      }

      lastPointerPosition = pointerPosition;
    };

    updateRect();
    heroSection.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", updateRect, { passive: true });
    window.addEventListener("resize", updateRect, { passive: true });

    return () => {
      heroSection.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", updateRect);
      window.removeEventListener("resize", updateRect);
      root.querySelectorAll(`.${styles.heroGlyphTrail}`).forEach((trail) => trail.remove());
      trailCountRef.current = 0;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={cn(styles.heroGlyphField, className)}
      data-testid="hero-glyph-field"
    >
      {AMBIENT_GLYPHS.map((glyph, index) => (
        <span
          key={`${glyph.glyph}-${index}`}
          className={styles.heroGlyphAmbient}
          style={getAmbientStyle(glyph)}
        >
          {glyph.glyph}
        </span>
      ))}
    </div>
  );
}
