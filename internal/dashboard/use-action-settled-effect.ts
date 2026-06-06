"use client";

import { useEffect, useRef } from "react";

export function useActionSettledEffect(pending: boolean, onSettled: () => void): void {
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (wasPendingRef.current && !pending) {
      onSettled();
    }
    wasPendingRef.current = pending;
  }, [onSettled, pending]);
}
