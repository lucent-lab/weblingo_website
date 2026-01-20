import type { ReactNode } from "react";

import { getDashboardAuth } from "./auth";
import type { HasCheck } from "./entitlements";

export async function SignedIn(props: { children: ReactNode }) {
  const auth = await getDashboardAuth();
  return auth.user ? props.children : null;
}

export async function SignedOut(props: { children: ReactNode }) {
  const auth = await getDashboardAuth();
  return auth.user ? null : props.children;
}

export async function Has(props: {
  requirement: HasCheck;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const auth = await getDashboardAuth();
  return auth.has(props.requirement) ? props.children : (props.fallback ?? null);
}
