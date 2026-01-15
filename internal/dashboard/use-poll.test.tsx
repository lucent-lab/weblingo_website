// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useEffect } from "react";

import { usePoll } from "./use-poll";

type UsePollOptions<T> = {
  enabled: boolean;
  intervalMs: number;
  fetcher: () => Promise<T>;
  isTerminal: (value: T) => boolean;
  initial: T;
};

type PollState<T> = {
  value: T;
  error: Error | null;
  isPolling: boolean;
};

function Harness<T>({
  options,
  onUpdate,
}: {
  options: UsePollOptions<T>;
  onUpdate: (state: PollState<T>) => void;
}) {
  const state = usePoll(options);
  useEffect(() => {
    onUpdate(state);
  }, [state.value, state.error, state.isPolling, onUpdate]);
  return null;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("usePoll", () => {
  it("fetches immediately when enabled", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(1);
    let latest: PollState<number> | null = null;

    render(
      <Harness
        options={{
          enabled: true,
          intervalMs: 1000,
          fetcher,
          isTerminal: () => false,
          initial: 0,
        }}
        onUpdate={(state) => {
          latest = state;
        }}
      />,
    );

    await act(async () => {
      await flushMicrotasks();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(latest?.value).toBe(1);
    expect(latest?.isPolling).toBe(true);
  });

  it("waits intervalMs after completion before fetching again", async () => {
    vi.useFakeTimers();
    const deferred = createDeferred<number>();
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => deferred.promise)
      .mockResolvedValueOnce(2);
    let latest: PollState<number> | null = null;

    render(
      <Harness
        options={{
          enabled: true,
          intervalMs: 1000,
          fetcher,
          isTerminal: () => false,
          initial: 0,
        }}
        onUpdate={(state) => {
          latest = state;
        }}
      />,
    );

    await act(async () => {
      await flushMicrotasks();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await flushMicrotasks();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve(1);
      await flushMicrotasks();
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await flushMicrotasks();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(latest?.value).toBe(2);
  });

  it("records errors and keeps polling", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("nope")).mockResolvedValueOnce(2);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let latest: PollState<number> | null = null;

    render(
      <Harness
        options={{
          enabled: true,
          intervalMs: 1000,
          fetcher,
          isTerminal: () => false,
          initial: 0,
        }}
        onUpdate={(state) => {
          latest = state;
        }}
      />,
    );

    await act(async () => {
      await flushMicrotasks();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(latest?.error?.message).toBe("nope");
    expect(errorSpy).toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await flushMicrotasks();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(latest?.value).toBe(2);
    expect(latest?.error).toBeNull();
  });

  it("stops polling when terminal value is reached", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(1);
    let latest: PollState<number> | null = null;

    render(
      <Harness
        options={{
          enabled: true,
          intervalMs: 1000,
          fetcher,
          isTerminal: () => true,
          initial: 0,
        }}
        onUpdate={(state) => {
          latest = state;
        }}
      />,
    );

    await act(async () => {
      await flushMicrotasks();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(latest?.isPolling).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await flushMicrotasks();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
