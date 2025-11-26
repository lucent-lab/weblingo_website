"use server";

import { exchangeWebhooksToken, WebhooksApiError } from "@internal/dashboard/webhooks";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type WebhooksToken = {
  token: string;
  expiresAt: string;
};

export async function getWebhooksToken(): Promise<WebhooksToken> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("You must be signed in to access the dashboard.");
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

export async function withWebhooksToken<T>(callback: (token: string, expiresAt: string) => Promise<T>) {
  const { token, expiresAt } = await getWebhooksToken();
  return callback(token, expiresAt);
}
