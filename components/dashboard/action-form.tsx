"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import type { ActionResponse } from "@/app/dashboard/actions";
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
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      onSuccess?.(state);

      const redirectTo =
        typeof state.meta?.redirectTo === "string" ? (state.meta.redirectTo as string) : null;

      if (redirectTo) {
        router.push(redirectTo);
        wasPending.current = pending;
        return;
      }

      const metaRefresh =
        typeof state.meta?.refresh === "boolean" ? (state.meta.refresh as boolean) : undefined;

      const shouldRefresh = refreshOnSuccess ?? metaRefresh ?? false;

      if (shouldRefresh) {
        router.refresh();
      }
    }
    wasPending.current = pending;
  }, [pending, state, router, onSuccess, refreshOnSuccess]);

  return (
    <form
      action={submitWithToast}
      className={className}
      aria-busy={pending}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
