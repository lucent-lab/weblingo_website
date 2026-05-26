"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { resetAnalyticsIdentity } from "@internal/analytics/client";

export function SignOutButton({ onClick, ...props }: ButtonProps) {
  const handleClick: ButtonProps["onClick"] = (event) => {
    resetAnalyticsIdentity();
    onClick?.(event);
  };

  return <Button size="sm" variant="outline" {...props} type="submit" onClick={handleClick} />;
}
