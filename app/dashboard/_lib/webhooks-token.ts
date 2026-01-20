"use server";

import { requireWebhooksAuth, type WebhooksAuthContext } from "@internal/dashboard/auth";

export async function getWebhooksAuth(): Promise<WebhooksAuthContext> {
  return requireWebhooksAuth();
}

export async function withWebhooksAuth<T>(callback: (auth: WebhooksAuthContext) => Promise<T>) {
  const auth = await getWebhooksAuth();
  return callback(auth);
}
