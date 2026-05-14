"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

type ScrambledTextProps = {
  text: string;
  className?: string;
  decorative?: boolean;
  playOnTextChange?: boolean;
};

const SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZéñ文語あカ한글λЖ";
const FRAME_MS = 32;
const REVEAL_STEP = 0.7;

type DisplayState = {
  source: string;
  value: string;
};

function scrambleText(text: string, iteration: number) {
  return Array.from(text, (letter, index) => {
    if (letter.trim().length === 0 || index < iteration) {
      return letter;
    }

    const glyphIndex = Math.floor(Math.random() * SCRAMBLE_GLYPHS.length);
    return SCRAMBLE_GLYPHS[glyphIndex] ?? letter;
  }).join("");
}

export function ScrambledText({
  text,
  className,
  decorative = false,
  playOnTextChange = false,
}: ScrambledTextProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const frameRef = useRef<number | null>(null);
  const iterationRef = useRef(0);
  const lastScrambledTextRef = useRef(text);
  const [displayState, setDisplayState] = useState<DisplayState>({ source: text, value: text });
  const displayText = displayState.source === text || playOnTextChange ? displayState.value : text;

  const stopScramble = useCallback(() => {
    if (frameRef.current !== null) {
      window.clearInterval(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const runScramble = useCallback(() => {
    stopScramble();
    iterationRef.current = 0;

    if (prefersReducedMotion || text.length === 0) {
      setDisplayState({ source: text, value: text });
      return;
    }

    setDisplayState({ source: text, value: scrambleText(text, 0) });

    frameRef.current = window.setInterval(() => {
      const iteration = iterationRef.current;
      const nextText = scrambleText(text, iteration);

      setDisplayState({ source: text, value: nextText });

      if (iteration >= text.length) {
        stopScramble();
        setDisplayState({ source: text, value: text });
        return;
      }

      iterationRef.current += REVEAL_STEP;
    }, FRAME_MS);
  }, [prefersReducedMotion, stopScramble, text]);

  useEffect(() => {
    if (!playOnTextChange) {
      return stopScramble;
    }

    if (lastScrambledTextRef.current === text) {
      return stopScramble;
    }

    lastScrambledTextRef.current = text;
    const timer = window.setTimeout(runScramble, 0);

    return () => {
      window.clearTimeout(timer);
      stopScramble();
    };
  }, [playOnTextChange, runScramble, stopScramble, text]);

  return (
    <span
      aria-hidden={decorative ? true : undefined}
      className={className}
      onPointerEnter={runScramble}
    >
      {decorative ? null : <span className="sr-only">{text}</span>}
      <span aria-hidden="true">{displayText}</span>
    </span>
  );
}
