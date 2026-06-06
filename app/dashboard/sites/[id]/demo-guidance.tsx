import Link from "next/link";

import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Globe,
  ListChecks,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Translator } from "@internal/i18n";

type DemoTourStep = {
  title: string;
  description: string;
  href?: string | null;
  label?: string;
};

export function DemoActivationReminder({ href, t }: { href: string; t: Translator }) {
  return (
    <section
      aria-label={t("dashboard.demo.activationReminder.ariaLabel", "Demo activation reminder")}
      className="rounded-lg border border-primary/25 bg-background px-4 py-3 shadow-sm"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <LockKeyhole className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {t("dashboard.demo.activationReminder.title", "Read-only demo workspace")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                "dashboard.demo.activationReminder.description",
                "Activate from the overview when you are ready to save changes for this claimed site.",
              )}
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href={href}>
            {t("dashboard.demo.activationReminder.cta", "Activate demo")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

export function DemoExplanationBanner({ t }: { t: Translator }) {
  return (
    <Alert className="border-primary/25 bg-primary/5 text-foreground">
      <ShieldCheck className="h-4 w-4 text-primary" />
      <AlertTitle>
        {t("dashboard.demo.explanation.title", "This is the real WebLingo dashboard")}
      </AlertTitle>
      <AlertDescription className="text-muted-foreground">
        {t(
          "dashboard.demo.explanation.description",
          "This demo is read-only, scoped to the claimed site, and no changes are saved until activation.",
        )}
      </AlertDescription>
    </Alert>
  );
}

export function DemoTourChecklist({ steps, t }: { steps: readonly DemoTourStep[]; t: Translator }) {
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ListChecks className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>{t("dashboard.demo.tour.title", "Demo walkthrough")}</CardTitle>
            <CardDescription>
              {t(
                "dashboard.demo.tour.description",
                "Follow the buyer path through the real site workspace, then activate when you are ready.",
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 lg:grid-cols-5">
          {steps.map((step, index) => (
            <li
              key={`${index}:${step.title}`}
              className="rounded-md border border-border/60 bg-muted/20 p-3"
            >
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  {step.href ? (
                    <Link
                      href={step.href}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {step.label ?? t("dashboard.demo.tour.open", "Open")}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function DemoSourceComparisonCard({
  sourceUrl,
  t,
  targetLabel,
  translatedUrl,
}: {
  sourceUrl: string;
  t: Translator;
  targetLabel: string;
  translatedUrl: string;
}) {
  return (
    <Card id="source-comparison" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>
              {t("dashboard.demo.comparison.title", "Source vs translated site")}
            </CardTitle>
            <CardDescription>
              {t(
                "dashboard.demo.comparison.description",
                "Open the original and the translated experience side by side when a safe live URL is available.",
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <ComparisonLink
          href={sourceUrl}
          label={t("dashboard.demo.comparison.source", "Source")}
          value={sourceUrl}
        />
        <ComparisonLink
          href={translatedUrl}
          label={t("dashboard.demo.comparison.translated", "Translated {target}", {
            target: targetLabel,
          })}
          value={translatedUrl}
        />
      </CardContent>
    </Card>
  );
}

function ComparisonLink({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <a
      className="group rounded-md border border-border/60 bg-muted/20 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <span className="flex items-center justify-between gap-3 text-sm font-medium text-foreground">
        {label}
        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
      </span>
      <span className="mt-2 block break-all text-xs text-muted-foreground">{value}</span>
    </a>
  );
}
