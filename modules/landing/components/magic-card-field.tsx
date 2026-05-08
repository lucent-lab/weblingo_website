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

    const onPointerMove = (event: PointerEvent) => {
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--magic-x", `${event.clientX - rect.left}px`);
        card.style.setProperty("--magic-y", `${event.clientY - rect.top}px`);
      }
    };

    root.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => root.removeEventListener("pointermove", onPointerMove);
  }, []);

  return (
    <div ref={rootRef} className={cn(styles.magicCardField, className)}>
      {children}
    </div>
  );
}
