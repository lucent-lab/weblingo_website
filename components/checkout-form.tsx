"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClientTranslator, type ClientMessages } from "@internal/i18n";
import { pricingTiers } from "@modules/pricing";

type CheckoutFormProps = {
  locale: string;
  messages: ClientMessages;
  defaultPlanId?: string;
};

export function CheckoutForm({ locale, messages, defaultPlanId }: CheckoutFormProps) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const plans = pricingTiers.filter((tier) => tier.priceIdMonthly && tier.priceIdYearly);
  const initialPlanId = useMemo(() => {
    if (defaultPlanId) {
      const match = plans.find((plan) => plan.id === defaultPlanId);
      if (match) return match.id;
    }
    return (plans.find((plan) => plan.highlighted) ?? plans[0]).id;
  }, [defaultPlanId, plans]);

  const [planId, setPlanId] = useState(initialPlanId);
  const [cadence, setCadence] = useState<"monthly" | "yearly">("monthly");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedPlan = plans.find((plan) => plan.id === planId) ?? plans[0];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          cadence,
          email: email || undefined,
          locale,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? t("checkout.form.error"));
      }

      const body = (await response.json()) as { url?: string };

      if (!body.url) {
        throw new Error(t("checkout.form.error"));
      }

      window.location.href = body.url;
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : t("checkout.form.error"));
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-10 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-foreground">
          {t("checkout.form.plan")}
          <select
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            className="rounded-md border border-input bg-background px-4 py-3 text-base text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {t(plan.nameKey)} — {plan.monthlyPrice}/mo
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-foreground">
          {t("checkout.form.cadence")}
          <select
            value={cadence}
            onChange={(event) => setCadence(event.target.value as "monthly" | "yearly")}
            className="rounded-md border border-input bg-background px-4 py-3 text-base text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <option value="monthly">
              {t("checkout.form.monthly", undefined, { price: selectedPlan.monthlyPrice })}
            </option>
            <option value="yearly">
              {t("checkout.form.yearly", undefined, { price: selectedPlan.yearlyPrice })}
            </option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm text-foreground">
        {t("checkout.form.email")}
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          placeholder="you@example.com"
          required
        />
        <span className="text-xs text-muted-foreground">{t("checkout.form.email.help")}</span>
      </label>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" disabled={status === "loading"} size="lg">
        {status === "loading" ? t("checkout.form.loading") : t("checkout.form.submit")}
      </Button>
    </form>
  );
}
