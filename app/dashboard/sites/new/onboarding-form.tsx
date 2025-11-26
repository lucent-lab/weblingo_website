"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { createSiteAction } from "../../actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const languageOptions = ["en", "fr", "ja", "es", "de", "pt", "it"];

const initialProfile = JSON.stringify(
  {
    brandVoice: "Concise, confident, helpful",
    audience: "Growth and marketing teams",
    glossary: ["WebLingo", "translation", "Cloudflare"],
  },
  null,
  2,
);

const initialState = {
  ok: false,
  message: "",
};

export function OnboardingForm() {
  const [state, formAction] = useActionState(createSiteAction, initialState);
  const [targets, setTargets] = useState<string[]>([]);
  const [customTarget, setCustomTarget] = useState("");
  const [pattern, setPattern] = useState("https://{lang}.example.com");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const patternPreview = useMemo(() => {
    const sampleLang = targets[0] || "{lang}";
    const output = pattern.includes("{lang}")
      ? pattern.replace("{lang}", sampleLang)
      : `${pattern}/${sampleLang}`;
    return output.replace(/(?<!:)\/{2,}/g, "/");
  }, [pattern, targets]);

  const handleToggleTarget = (lang: string) => {
    setTargets((current) =>
      current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang],
    );
  };

  const handleAddCustomTarget = () => {
    const trimmed = customTarget.trim();
    if (!trimmed) return;
    setTargets((current) => (current.includes(trimmed) ? current : [...current, trimmed]));
    setCustomTarget("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding wizard</CardTitle>
        <CardDescription>
          Provide your source site, pick target languages, and define the subdomain pattern. We will
          enqueue a crawl immediately after creation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-8">
          <section className="space-y-3">
            <StepHeader
              step={1}
              title="Site basics"
              helper="We use this to crawl your source pages and seed localized routes."
              active={step === 1}
              onClick={() => setStep(1)}
            />
            {step === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="sourceUrl">
                    Source URL
                  </label>
                  <Input
                    id="sourceUrl"
                    name="sourceUrl"
                    placeholder="https://www.example.com"
                    type="url"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The canonical origin we should crawl for translations.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="sourceLang">
                    Source language
                  </label>
                  <Input
                    id="sourceLang"
                    name="sourceLang"
                    placeholder="en"
                    autoComplete="off"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Two-letter code preferred (e.g., en, fr, ja).
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <StepHeader
              step={2}
              title="Target languages & routing"
              helper="Select target locales and preview how subdomains will look."
              active={step === 2}
              onClick={() => setStep(2)}
            />
            {step === 2 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {languageOptions.map((lang) => (
                    <label
                      key={lang}
                      className={cn(
                        "cursor-pointer rounded-lg border px-3 py-2 text-sm shadow-sm",
                        targets.includes(lang)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/40 text-foreground",
                      )}
                    >
                      <input
                        checked={targets.includes(lang)}
                        className="sr-only"
                        name="targetLangs"
                        type="checkbox"
                        value={lang}
                        onChange={() => handleToggleTarget(lang)}
                      />
                      {lang.toUpperCase()}
                    </label>
                  ))}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    className="sm:max-w-xs"
                    placeholder="Add another (e.g., nl)"
                    value={customTarget}
                    onChange={(event) => setCustomTarget(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddCustomTarget();
                      }
                    }}
                  />
                  <Button onClick={handleAddCustomTarget} type="button" variant="outline">
                    Add language
                  </Button>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="subdomainPattern">
                    Subdomain pattern
                  </label>
                  <Input
                    id="subdomainPattern"
                    name="subdomainPattern"
                    placeholder="https://{lang}.example.com"
                    required
                    value={pattern}
                    pattern=".*\\{lang\\}.*"
                    title="Pattern must include {lang}"
                    onChange={(event) => setPattern(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must include <code>{`{lang}`}</code>. We seed domain records and route prefixes from
                    this pattern. Preview: <span className="font-semibold text-foreground">{patternPreview}</span>
                  </p>
                  {!pattern.includes("{lang}") ? (
                    <p className="text-xs text-destructive">Pattern must contain {"{lang}"}.</p>
                  ) : null}
                </div>
                {targets
                  .filter((lang) => !languageOptions.includes(lang))
                  .map((lang) => (
                    <input key={lang} hidden name="targetLangs" readOnly value={lang} />
                  ))}
                {targets.length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Selected:</span>
                    {targets.map((lang) => (
                      <span
                        key={lang}
                        className="rounded-full bg-muted px-2 py-1 text-foreground"
                      >
                        {lang.toUpperCase()}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <StepHeader
              step={3}
              title="Brand voice"
              helper="Share tone and glossary hints. We reject empty objects to keep translations consistent."
              active={step === 3}
              onClick={() => setStep(3)}
            />
            {step === 3 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="siteProfile">
                  Site profile JSON
                </label>
                <Textarea
                  id="siteProfile"
                  name="siteProfile"
                  defaultValue={initialProfile}
                  required
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  Keep it short and structured — values are validated and empty objects are rejected.
                </p>
              </div>
            ) : null}
          </section>

          {state.message ? (
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                state.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              {state.message}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              We will create domains and enqueue a crawl right after this step. You can verify DNS and
              update glossary from the site detail view.
            </p>
            <SubmitButton disabled={targets.length === 0 || step !== 3 || !pattern.includes("{lang}")} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={disabled || pending} type="submit">
      {pending ? "Creating..." : "Create site"}
    </Button>
  );
}

function StepHeader(props: {
  step: number;
  title: string;
  helper: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
        props.active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
      )}
      onClick={props.onClick}
      type="button"
    >
      <div className="mt-0.5 h-7 w-7 rounded-full bg-primary/10 text-center text-sm font-semibold text-primary">
        {props.step}
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">{props.title}</p>
        <p className="text-sm text-muted-foreground">{props.helper}</p>
      </div>
    </button>
  );
}
