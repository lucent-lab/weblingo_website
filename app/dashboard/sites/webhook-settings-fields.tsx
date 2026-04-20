"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { WEBHOOK_EVENT_TYPES, type KnownWebhookEventType } from "@internal/dashboard/webhooks";

const WEBHOOK_EVENT_LABELS: Record<KnownWebhookEventType, string> = {
  "translation.completed": "Translation completed",
  "translation.failed": "Translation failed",
  "translation.summary": "Translation summary",
};

type WebhookSettingsFieldsProps = {
  title: string;
  description: string;
  urlLabel: string;
  urlHelp: string;
  secretLabel: string;
  secretHelp: string;
  eventsLabel: string;
  eventsHelp: string;
  selectAllLabel: string;
  disableAllLabel: string;
  webhookUrl: string;
  onWebhookUrlChange: (value: string) => void;
  webhookSecret: string;
  onWebhookSecretChange: (value: string) => void;
  webhookEvents: KnownWebhookEventType[];
  onWebhookEventsChange: (value: KnownWebhookEventType[]) => void;
  canEdit: boolean;
};

export function WebhookSettingsFields({
  title,
  description,
  urlLabel,
  urlHelp,
  secretLabel,
  secretHelp,
  eventsLabel,
  eventsHelp,
  selectAllLabel,
  disableAllLabel,
  webhookUrl,
  onWebhookUrlChange,
  webhookSecret,
  onWebhookSecretChange,
  webhookEvents,
  onWebhookEventsChange,
  canEdit,
}: WebhookSettingsFieldsProps) {
  const allSelected = webhookEvents.length === WEBHOOK_EVENT_TYPES.length;
  const anySelected = webhookEvents.length > 0;
  const webhookEventsJson = JSON.stringify(webhookEvents);

  function toggleEvent(eventType: KnownWebhookEventType): void {
    if (webhookEvents.includes(eventType)) {
      onWebhookEventsChange(webhookEvents.filter((entry) => entry !== eventType));
      return;
    }
    onWebhookEventsChange([...webhookEvents, eventType]);
  }

  return (
    <section className="space-y-5 border-t border-border/60 pt-6">
      <div className="border-b border-border/60 pb-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-5 w-1 rounded-full bg-primary/50" aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      <input name="webhookEvents" type="hidden" value={webhookEventsJson} />

      <Field label={urlLabel} htmlFor="webhookUrl" description={urlHelp}>
        <Input
          id="webhookUrl"
          name="webhookUrl"
          type="url"
          value={webhookUrl}
          onChange={(event) => onWebhookUrlChange(event.target.value)}
          placeholder="https://hooks.example.com/weblingo"
          disabled={!canEdit}
          autoComplete="off"
        />
      </Field>

      <Field label={secretLabel} htmlFor="webhookSecret" description={secretHelp}>
        <Input
          id="webhookSecret"
          name="webhookSecret"
          type="password"
          value={webhookSecret}
          onChange={(event) => onWebhookSecretChange(event.target.value)}
          placeholder="whsec_..."
          disabled={!canEdit}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <Field
        label={eventsLabel}
        description={
          <span className="block">
            {eventsHelp}
            {!anySelected
              ? " Webhook delivery is disabled until at least one event is selected."
              : ""}
          </span>
        }
      >
        <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canEdit || allSelected}
              onClick={() => onWebhookEventsChange([...WEBHOOK_EVENT_TYPES])}
            >
              {selectAllLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!canEdit || !anySelected}
              onClick={() => onWebhookEventsChange([])}
            >
              {disableAllLabel}
            </Button>
            <span className="text-xs text-muted-foreground">
              {webhookEvents.length}/{WEBHOOK_EVENT_TYPES.length} selected
            </span>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            {WEBHOOK_EVENT_TYPES.map((eventType) => {
              const checked = webhookEvents.includes(eventType);
              return (
                <label
                  key={eventType}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                    checked ? "border-primary/30 bg-primary/5" : "border-border/60 bg-background",
                    !canEdit ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEvent(eventType)}
                    disabled={!canEdit}
                    className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {WEBHOOK_EVENT_LABELS[eventType]}
                    </span>
                    <span className="text-xs text-muted-foreground">{eventType}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </Field>
    </section>
  );
}
