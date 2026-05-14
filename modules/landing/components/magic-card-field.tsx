"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import styles from "../segment-page.module.css";

type MagicCardFieldProps = {
  children: ReactNode;
  className?: string;
};

export function MagicCardField({ children, className }: MagicCardFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window.matchMedia !== "function") {
      return;
    }

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(pointer: fine)").matches
    ) {
      return;
    }

    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-magic-card]"));
    const cardRects = new Map<HTMLElement, DOMRect>();
    let rectsAreStale = true;
    let animationFrame: number | null = null;

    const readCardRects = () => {
      cardRects.clear();
      for (const card of cards) {
        cardRects.set(card, card.getBoundingClientRect());
      }
      rectsAreStale = false;
    };

    const markRectsStale = () => {
      rectsAreStale = true;
    };

    const updateCards = (clientX: number, clientY: number) => {
      if (rectsAreStale) {
        readCardRects();
      }

      for (const card of cards) {
        const rect = cardRects.get(card);
        if (!rect) {
          continue;
        }

        card.style.setProperty("--magic-x", `${clientX - rect.left}px`);
        card.style.setProperty("--magic-y", `${clientY - rect.top}px`);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const { clientX, clientY } = event;

      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        updateCards(clientX, clientY);
      });
    };

    const onPointerEnter = (event: PointerEvent) => {
      markRectsStale();
      updateCards(event.clientX, event.clientY);
    };

    const resizeObserver = new ResizeObserver(markRectsStale);
    resizeObserver.observe(root);
    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("pointerenter", onPointerEnter, { passive: true });
    window.addEventListener("scroll", markRectsStale, { passive: true });

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      resizeObserver.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerenter", onPointerEnter);
      window.removeEventListener("scroll", markRectsStale);
    };
  }, []);

  return (
    <div ref={rootRef} className={cn(styles.magicCardField, className)}>
      {children}
    </div>
  );
}
