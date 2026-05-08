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
const MAX_TRAIL_GLYPHS = 34;
const MIN_CURSOR_DISTANCE_PX = 24;
const MIN_TRAIL_DISTANCE_PX = 30;
const TRAIL_THROTTLE_MS = 72;
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
    const recentTrails: Array<{ x: number; y: number }> = [];
    let lastPointer: { x: number; y: number } | null = null;
    let lastTrailTime = 0;

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

    const onPointerMove = (event: PointerEvent) => {
      const now = window.performance.now();
      if (now - lastTrailTime < TRAIL_THROTTLE_MS) {
        return;
      }

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        lastPointer = null;
        return;
      }

      const previous = lastPointer;
      lastPointer = { x, y };
      if (!previous) {
        return;
      }

      const velocityX = x - previous.x;
      const velocityY = y - previous.y;
      const speed = Math.hypot(velocityX, velocityY);
      if (speed < 5) {
        return;
      }

      const glyphIndex = trailIndexRef.current;
      const movementLength = Math.max(1, speed);
      const offsetDirectionX = -velocityY / movementLength;
      const offsetDirectionY = velocityX / movementLength;
      const offsetSign = glyphIndex % 2 === 0 ? 1 : -1;
      const offsetDistance = MIN_CURSOR_DISTANCE_PX + (glyphIndex % 3) * 7;
      const spawnX = clamp(x + offsetDirectionX * offsetSign * offsetDistance, 0, rect.width);
      const spawnY = clamp(y + offsetDirectionY * offsetSign * offsetDistance, 0, rect.height);
      const overlapsRecentTrail = recentTrails.some(
        (trail) => Math.hypot(trail.x - spawnX, trail.y - spawnY) < MIN_TRAIL_DISTANCE_PX,
      );
      if (overlapsRecentTrail) {
        return;
      }

      trailIndexRef.current += 1;
      recentTrails.push({ x: spawnX, y: spawnY });
      if (recentTrails.length > 10) {
        recentTrails.splice(0, recentTrails.length - 10);
      }

      const trail = document.createElement("span");
      trail.className = styles.heroGlyphTrail;
      trail.textContent = pickTrailGlyph(glyphIndex);
      trail.style.left = `${spawnX}px`;
      trail.style.top = `${spawnY}px`;
      trail.style.setProperty("--glyph-alpha", speed > 35 ? "0.34" : "0.26");
      trail.style.setProperty(
        "--glyph-drift-x",
        `${Math.max(-30, Math.min(30, velocityX * 0.55))}px`,
      );
      trail.style.setProperty(
        "--glyph-drift-y",
        `${Math.max(-30, Math.min(30, velocityY * 0.55))}px`,
      );
      trail.style.setProperty("--glyph-duration", `${speed > 35 ? 760 : 900}ms`);
      trail.style.setProperty("--glyph-rotate", `${-8 + (glyphIndex % 5) * 4}deg`);
      trail.style.setProperty("--glyph-size", `${18 + (glyphIndex % 4) * 3}px`);
      trail.style.setProperty("--glyph-spin", `${speed > 35 ? 12 : 6}deg`);

      root.append(trail);
      trailCountRef.current += 1;
      pruneTrails();

      const cleanup = () => removeTrail(trail);
      trail.addEventListener("animationend", cleanup, { once: true });
      window.setTimeout(cleanup, 1_200);
      lastTrailTime = now;
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
