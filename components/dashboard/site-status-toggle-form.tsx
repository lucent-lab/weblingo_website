"use client";

import type { FormEvent } from "react";

import { usePathname } from "next/navigation";

import { Button, type ButtonProps } from "@/components/ui/button";

type SiteStatusToggleFormProps = {
  action: (formData: FormData) => void | Promise<void>;
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
  const pathname = usePathname();
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  };

  return (
    <form action={action} onSubmit={handleSubmit}>
      <input name="siteId" type="hidden" value={siteId} />
      <input name="status" type="hidden" value={nextStatus} />
      {pathname ? <input name="returnTo" type="hidden" value={pathname} /> : null}
      <Button
        type="submit"
        variant={variant ?? "outline"}
        size={size}
        className={className}
        disabled={disabled}
      >
        {label}
      </Button>
    </form>
  );
}
