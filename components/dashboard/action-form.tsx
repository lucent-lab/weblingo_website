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
      const redirectTo =
        typeof state.meta?.redirectTo === "string" ? state.meta.redirectTo : null;
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
      onSuccess?.(state);
    }
    wasPending.current = pending;
  }, [pending, state, router, onSuccess]);

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
