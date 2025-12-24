"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";

import { setWorkspaceAction } from "../_lib/workspace-actions";

type WorkspaceOption = {
  id: string;
  label: string;
};

export function WorkspaceSwitcher({
  options,
  currentId,
  label = "Workspace",
  disabled = false,
}: {
  options: WorkspaceOption[];
  currentId: string;
  label?: string;
  disabled?: boolean;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const pathname = usePathname() ?? "/dashboard";

  return (
    <form ref={formRef} action={setWorkspaceAction} className="flex w-full flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/70">
        {label}
      </label>
      <input name="redirectTo" type="hidden" value={pathname} />
      <select
        className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        defaultValue={currentId}
        name="subjectAccountId"
        onChange={() => formRef.current?.requestSubmit()}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </form>
  );
}
