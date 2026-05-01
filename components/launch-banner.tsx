"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SubmissionState = "idle" | "loading" | "success" | "error";

const STORAGE_KEY = "weblingo-launch-banner-dismissed";

type LaunchBannerCopy = {
  badge: string;
  title: string;
  subtitle: string;
  emailPlaceholder: string;
  sitePlaceholder: string;
  buttonIdle: string;
  buttonLoading: string;
  buttonSuccess: string;
  successMessage: string;
  defaultMessage: string;
  dismissLabel: string;
};

type LaunchBannerProps = {
  copy: LaunchBannerCopy;
};

export function LaunchBanner({ copy }: LaunchBannerProps) {
  const pathname = usePathname() ?? "";
  const [email, setEmail] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [status, setStatus] = useState<SubmissionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === "1") {
      setHidden(true);
    }
  }, []);

  const pathParts = pathname.split("/").filter(Boolean);
  const routeSlug = pathParts[1] ?? "";
  const isHomeOrLanding = pathParts.length === 1 || routeSlug === "landing" || routeSlug === "try";

  if (hidden || !isHomeOrLanding) {
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 hidden justify-center px-4 pb-4 sm:flex">
      <div className="pointer-events-auto w-full max-w-4xl overflow-hidden rounded-xl border border-primary/30 bg-primary text-primary-foreground shadow-xl shadow-primary/20">
        <div className="flex items-center gap-3 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{copy.title}</p>
            <p className="truncate text-xs text-primary-foreground/75">{copy.defaultMessage}</p>
          </div>
          <button
            aria-expanded={expanded}
            className="rounded-md bg-white/15 px-3 py-2 text-xs font-semibold transition hover:bg-white/20"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {copy.buttonIdle}
          </button>
          <button
            aria-label={copy.dismissLabel}
            className="rounded-md p-2 text-primary-foreground/75 transition hover:bg-white/15 hover:text-white"
            onClick={handleDismiss}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={expanded ? "block border-t border-white/15" : "hidden"}>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="text-sm sm:flex-1">
              <p className="font-semibold uppercase tracking-[0.2em] text-primary-foreground/80">
                {copy.badge}
              </p>
              <p className="text-base font-medium">{copy.title}</p>
              <p className="text-sm">{copy.subtitle}</p>
            </div>

            <form className="flex flex-1 flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
              <Input
                aria-label="Email"
                autoComplete="email"
                className="border-white/30 bg-white/15 text-white placeholder:text-white/70 focus-visible:ring-primary-foreground"
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder={copy.emailPlaceholder}
                required
                type="email"
                value={email}
              />
              <Input
                aria-label="Website (optional)"
                className="border-white/30 bg-white/10 text-white placeholder:text-white/60 focus-visible:ring-primary-foreground sm:max-w-[220px]"
                onChange={(event) => setSiteUrl(event.currentTarget.value)}
                placeholder={copy.sitePlaceholder}
                type="url"
                value={siteUrl}
              />
              <Button
                className="sm:flex-none"
                disabled={status === "loading"}
                type="submit"
                variant="secondary"
              >
                {status === "success"
                  ? copy.buttonSuccess
                  : status === "loading"
                    ? copy.buttonLoading
                    : copy.buttonIdle}
              </Button>
            </form>
          </div>
          <div className="flex flex-col gap-2 px-4 pb-4 text-xs text-primary-foreground/80 sm:flex-row sm:items-center sm:justify-between">
            <p className="sm:truncate">
              {status === "success" ? copy.successMessage : (errorMessage ?? copy.defaultMessage)}
            </p>
            <button
              className="self-start rounded px-2 py-1 text-primary-foreground/80 transition hover:bg-white/10 hover:text-white"
              onClick={handleDismiss}
              type="button"
            >
              {copy.dismissLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
