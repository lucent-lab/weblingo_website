"use client";

import { useEffect, useRef } from "react";

import { env } from "@internal/core";

/**
 * Cloudflare Turnstile widget (M12.3 bot gating).
 *
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, so the feature
 * is fully inert in local dev / CI / preview environments without credentials.
 *
 * Usage:
 * - fetch-based forms: pass `onToken` and send the token in the request body.
 * - server-action forms: render inside the <form>; the widget injects a hidden
 *   `cf-turnstile-response` input that the action reads from FormData.
 */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
};

type TurnstileApi = {
  render: (el: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (id: string) => void;
  reset: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const onLoad = () => resolve();
    const onError = () => {
      // Allow a later attempt to retry script injection.
      scriptPromise = null;
      reject(new Error("turnstile script failed to load"));
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      if (window.turnstile) {
        resolve();
        return;
      }
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export type TurnstileWidgetProps = {
  /** Called with the verification token, or null when it expires/errors. */
  onToken?: (token: string | null) => void;
  className?: string;
  /** Optional Cloudflare analytics label (e.g. "preview", "waitlist", "contact"). */
  action?: string;
};

export function TurnstileWidget({ onToken, className, action }: TurnstileWidgetProps) {
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    let widgetId: string | null = null;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) {
          return;
        }
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token: string) => onTokenRef.current?.(token),
          "error-callback": () => onTokenRef.current?.(null),
          "expired-callback": () => onTokenRef.current?.(null),
          "timeout-callback": () => onTokenRef.current?.(null),
        });
      })
      .catch(() => {
        onTokenRef.current?.(null);
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // Widget already gone; nothing to clean up.
        }
      }
    };
  }, [siteKey, action]);

  if (!siteKey) {
    return null;
  }

  return <div ref={containerRef} className={className} />;
}
