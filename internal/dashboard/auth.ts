import type { Session, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import type { AccountMe } from "./webhooks";
import { exchangeWebhooksToken, fetchAccountMe, WebhooksApiError } from "./webhooks";
import { createHas, type HasCheck } from "./entitlements";

export type DashboardAuth = {
  user: User | null;
  session: Session | null;
  webhooksToken: string | null;
  webhooksExpiresAt: string | null;
  account: AccountMe | null;
  has: (requirement: HasCheck) => boolean;
};

export const getDashboardAuth = cache(async (): Promise<DashboardAuth> => {
  const supabase = await createClient();
  const [
    {
      data: { session },
    },
    {
      data: { user },
    },
  ] = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

  if (!session || !user) {
    return {
      user: null,
      session: null,
      webhooksToken: null,
      webhooksExpiresAt: null,
      account: null,
      has: () => false,
    };
  }

  const { token, expiresAt } = await exchangeWebhooksToken(session.access_token);
  const account = await fetchAccountMe(token);

  return {
    user,
    session,
    webhooksToken: token,
    webhooksExpiresAt: expiresAt,
    account,
    has: createHas(account),
  };
});

export async function requireDashboardAuth(): Promise<DashboardAuth> {
  const auth = await getDashboardAuth();
  if (!auth.user || !auth.session) {
    redirect("/auth/login");
  }
  if (!auth.webhooksToken || !auth.account) {
    redirect("/dashboard/no-account");
  }
  return auth;
}

export async function requireWebhooksToken(): Promise<{ token: string; expiresAt: string }> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  try {
    const { token, expiresAt } = await exchangeWebhooksToken(session.access_token);
    return { token, expiresAt };
  } catch (error) {
    if (
      error instanceof WebhooksApiError &&
      (error.status === 404 || error.status === 403 || /account not found/i.test(error.message))
    ) {
      redirect("/dashboard/no-account");
    }
    throw error;
  }
}
