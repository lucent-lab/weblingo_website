import { cache } from "react";

import type { WebhooksAuthContext } from "./auth";
import { listSites, listSupportedLanguages } from "./webhooks";

export const listSitesCached = cache(async (auth: WebhooksAuthContext) => listSites(auth));

export const listSupportedLanguagesCached = cache(async () => listSupportedLanguages());
