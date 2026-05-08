import type { ReactNode } from "react";

export function FeatureGate({
  children,
  fallback,
  enabled,
}: {
  children: ReactNode;
  fallback: ReactNode;
  enabled: boolean;
}) {
  return enabled ? <>{children}</> : <>{fallback}</>;
}
