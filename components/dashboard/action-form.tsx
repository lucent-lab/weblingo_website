"use client";

import type { ReactNode } from "react";
import { useActionState, useCallback } from "react";
import { useRouter } from "next/navigation";

import type { ActionResponse } from "@/app/dashboard/actions";
import {
  captureAnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "@internal/analytics/client";
import { useActionSettledEffect } from "@internal/dashboard/use-action-settled-effect";
import { useActionToast } from "@internal/dashboard/use-action-toast";

type ActionFormProps = {
  action: (prevState: ActionResponse | undefined, formData: FormData) => Promise<ActionResponse>;
  loading: string;
  success: string;
  error: string;
  confirmMessage?: string;
  className?: string;
  onSuccess?: (state: ActionResponse) => void;
  refreshOnSuccess?: boolean;
  analytics?: {
    event: AnalyticsEventName;
    successEvent?: AnalyticsEventName;
    failureEvent?: AnalyticsEventName;
    properties?: AnalyticsProperties;
  };
  children: ReactNode;
};

const initialState: ActionResponse = { ok: false, message: "" };

export function ActionForm({
  action,
  loading,
  success,
  error,
  confirmMessage,
  className,
  onSuccess,
  refreshOnSuccess,
  analytics,
  children,
}: ActionFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);
  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading,
    success,
    error,
  });
  const handleSettled = useCallback(() => {
    if (analytics) {
      captureAnalyticsEvent(
        state.ok
          ? (analytics.successEvent ?? analytics.event)
          : (analytics.failureEvent ?? analytics.event),
        {
          ...analytics.properties,
          error_code:
            !state.ok && typeof state.meta?.code === "string" ? state.meta.code : undefined,
          outcome: state.ok ? "succeeded" : "failed",
        },
      );
    }

    if (state.ok) {
      onSuccess?.(state);

      const redirectTo =
        typeof state.meta?.redirectTo === "string" ? (state.meta.redirectTo as string) : null;

      if (redirectTo) {
        router.push(redirectTo);
        return;
      }

      const metaRefresh =
        typeof state.meta?.refresh === "boolean" ? (state.meta.refresh as boolean) : undefined;

      const shouldRefresh = refreshOnSuccess ?? metaRefresh ?? false;

      if (shouldRefresh) {
        router.refresh();
      }
    }
  }, [analytics, onSuccess, refreshOnSuccess, router, state]);

  useActionSettledEffect(pending, handleSettled);

  return (
    <form
      action={submitWithToast}
      className={className}
      aria-busy={pending}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        if (analytics) {
          captureAnalyticsEvent(analytics.event, {
            ...analytics.properties,
            outcome: "submitted",
          });
        }
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
