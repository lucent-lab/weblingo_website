"use client";

import { useEffect, useRef, useState } from "react";

export type UsePollOptions<T> = {
  enabled: boolean;
  intervalMs: number;
  fetcher: () => Promise<T>;
  isTerminal: (value: T) => boolean;
  initial: T;
};

export type PollState<T> = {
  value: T;
  error: Error | null;
  isPolling: boolean;
};

export function usePoll<T>(options: UsePollOptions<T>): PollState<T> {
  const { enabled, intervalMs, fetcher, isTerminal, initial } = options;
  const [value, setValue] = useState<T>(initial);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const fetcherRef = useRef(fetcher);
  const isTerminalRef = useRef(isTerminal);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    isTerminalRef.current = isTerminal;
  }, [isTerminal]);

  useEffect(() => {
    if (!enabled) {
      setIsPolling(false);
      return;
    }
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let inFlightToken = 0;
    setIsPolling(true);

    const tick = async () => {
      const token = (inFlightToken += 1);
      try {
        const nextValue = await fetcherRef.current();
        if (!active || token !== inFlightToken) {
          return;
        }
        setValue(nextValue);
        setError(null);
        if (isTerminalRef.current(nextValue)) {
          setIsPolling(false);
          return;
        }
      } catch (err) {
        if (!active || token !== inFlightToken) {
          return;
        }
        const nextError = err instanceof Error ? err : new Error("Unable to refresh status.");
        setError(nextError);
        console.error("[dashboard] usePoll fetch failed:", err);
      }
      if (!active) {
        return;
      }
      timeoutId = setTimeout(tick, intervalMs);
    };

    void tick();

    return () => {
      active = false;
      inFlightToken += 1;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setIsPolling(false);
    };
  }, [enabled, intervalMs]);

  return { value, error, isPolling };
}
