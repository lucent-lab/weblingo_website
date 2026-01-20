"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    setValue(initial);
  }, [initial]);

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
        const nextValue = await fetcher();
        if (!active || token !== inFlightToken) {
          return;
        }
        setValue(nextValue);
        setError(null);
        if (isTerminal(nextValue)) {
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
  }, [enabled, fetcher, initial, intervalMs, isTerminal]);

  return { value, error, isPolling };
}
