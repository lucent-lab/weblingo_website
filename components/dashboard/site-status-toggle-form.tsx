"use client";

import { ActionForm } from "./action-form";

import type { ActionResponse } from "@/app/dashboard/actions";
import { Button, type ButtonProps } from "@/components/ui/button";

type SiteStatusToggleFormProps = {
  action: (prevState: ActionResponse | undefined, formData: FormData) => Promise<ActionResponse>;
  siteId: string;
  nextStatus: "active" | "inactive";
  label: string;
  confirmMessage?: string;
  disabled?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
};

export function SiteStatusToggleForm({
  action,
  siteId,
  nextStatus,
  label,
  confirmMessage,
  disabled = false,
  variant,
  size,
  className,
}: SiteStatusToggleFormProps) {
  return (
    <ActionForm
      action={action}
      loading="Updating status..."
      success="Status updated."
      error="Unable to update status."
      confirmMessage={confirmMessage}
      refreshOnSuccess={true}
    >
      <>
        <input name="siteId" type="hidden" value={siteId} />
        <input name="status" type="hidden" value={nextStatus} />
        <Button
          type="submit"
          variant={variant ?? "outline"}
          size={size}
          className={className}
          disabled={disabled}
          title={label}
        >
          {label}
        </Button>
      </>
    </ActionForm>
  );
}
