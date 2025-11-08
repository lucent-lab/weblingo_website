"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SubmissionState = "idle" | "loading" | "success" | "error";

const STORAGE_KEY = "weblingo-launch-banner-dismissed";

export function LaunchBanner() {
  const [email, setEmail] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [status, setStatus] = useState<SubmissionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === "1") {
      setHidden(true);
    }
  }, []);

  if (hidden) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email) {
      setErrorMessage("Please add your email.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          siteUrl: siteUrl || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to save your request right now.");
      }

      setStatus("success");
      setEmail("");
      setSiteUrl("");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  function handleDismiss() {
    setHidden(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      <div className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-primary/40 bg-primary p-4 text-primary-foreground shadow-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="text-sm sm:flex-1">
            <p className="font-semibold uppercase tracking-[0.2em] text-primary-foreground/80">
              Final boarding call
            </p>
            <p className="text-base font-medium">
              WebLingo is almost ready. Drop your email{` `}
              <span className="hidden sm:inline">(and optional site)</span> for launch updates + a free
              month.
            </p>
          </div>

          <form className="flex flex-1 flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
            <Input
              aria-label="Email"
              autoComplete="email"
              className="border-white/30 bg-white/15 text-white placeholder:text-white/70 focus-visible:ring-primary-foreground"
              onChange={(event) => setEmail(event.currentTarget.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={email}
            />
            <Input
              aria-label="Website (optional)"
              className="border-white/30 bg-white/10 text-white placeholder:text-white/60 focus-visible:ring-primary-foreground sm:max-w-[220px]"
              onChange={(event) => setSiteUrl(event.currentTarget.value)}
              placeholder="https://your-site.com"
              type="url"
              value={siteUrl}
            />
            <Button
              className="sm:flex-none"
              disabled={status === "loading"}
              type="submit"
              variant="secondary"
            >
              {status === "success" ? "We'll be in touch" : status === "loading" ? "Sending..." : "Notify me"}
            </Button>
          </form>
        </div>
        <div className="mt-2 flex flex-col gap-2 text-xs text-primary-foreground/80 sm:flex-row sm:items-center sm:justify-between">
          <p className="truncate">
            {status === "success"
              ? "Thanks! We'll let you know as soon as WebLingo ships."
              : errorMessage ?? "We'll send updates and a free-month code at launch."}
          </p>
          <button
            className="self-start rounded px-2 py-1 text-primary-foreground/80 transition hover:text-white"
            onClick={handleDismiss}
            type="button"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
