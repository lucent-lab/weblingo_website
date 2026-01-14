"use client";

import { useEffect, useState } from "react";

export function usePoll<T>(options: {
  enabled: boolean;
  intervalMs: number;
  fetcher: () => Promise<T>;
  isTerminal: (value: T) => boolean;
  initial: T;
}): { value: T; error: Error | null; isPolling: boolean } {
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
    let intervalId: ReturnType<typeof setInterval> | null = null;
    setIsPolling(true);

    const tick = async () => {
      try {
        const nextValue = await fetcher();
        if (!active) {
          return;
        }
        setValue(nextValue);
        setError(null);
        if (isTerminal(nextValue)) {
          active = false;
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          setIsPolling(false);
        }
      } catch (err) {
        if (!active) {
          return;
        }
        const nextError = err instanceof Error ? err : new Error("Unable to refresh status.");
        setError(nextError);
      }
    };

    intervalId = setInterval(tick, intervalMs);
    void tick();

    return () => {
      active = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      setIsPolling(false);
    };
  }, [enabled, fetcher, initial, intervalMs, isTerminal]);

  return { value, error, isPolling };
}
