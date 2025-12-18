"use server";

import { requireWebhooksToken } from "@internal/dashboard/auth";

type WebhooksToken = {
  token: string;
  expiresAt: string;
};

export async function getWebhooksToken(): Promise<WebhooksToken> {
  return requireWebhooksToken();
}

export async function withWebhooksToken<T>(
  callback: (token: string, expiresAt: string) => Promise<T>,
) {
  const { token, expiresAt } = await getWebhooksToken();
  return callback(token, expiresAt);
}
