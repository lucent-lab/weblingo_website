export type DashboardErrorKind =
  | "account_missing"
  | "contract_mismatch"
  | "timeout"
  | "backend_unavailable"
  | "forbidden"
  | "not_found"
  | "unknown";

export type DashboardErrorView = {
  kind: DashboardErrorKind;
  title: string;
  description: string;
  message: string;
  nextSteps: string[];
  referenceCode: string | null;
  technicalDetails: unknown | null;
};

type DashboardErrorViewFallback = {
  title: string;
  description: string;
  message?: string;
};

type DashboardWebhooksErrorLike = Error & {
  status: number;
  details?: unknown;
};

export function resolveDashboardErrorView(
  error: unknown,
  fallback: DashboardErrorViewFallback,
): DashboardErrorView {
  const kind = classifyDashboardErrorKind(error);
  const message = resolveDashboardErrorMessage(error, fallback.message);
  const referenceCode = resolveDashboardErrorReferenceCode(error);
  const technicalDetails = resolveDashboardErrorTechnicalDetails(error);
  if (kind === "contract_mismatch") {
    return {
      kind,
      title: "This section cannot be shown safely",
      description: "The dashboard received data in a format this screen does not understand yet.",
      message,
      nextSteps: [
        "Retry this section once to rule out a stale response.",
        "Open the site overview to continue managing the workspace.",
        "Contact support if retry shows the same screen.",
      ],
      referenceCode,
      technicalDetails,
    };
  }
  if (kind === "account_missing") {
    return {
      kind,
      title: "Account not provisioned",
      description: "You are signed in, but your account is not yet enabled for the dashboard.",
      message,
      nextSteps: [
        "Sign out and sign in with the account that owns this workspace.",
        "Ask the workspace owner to confirm your account access.",
        "Contact support if this account should already be enabled.",
      ],
      referenceCode,
      technicalDetails,
    };
  }
  if (kind === "timeout") {
    return {
      kind,
      title: "Request timed out",
      description: "The dashboard request took too long. Retry or try again in a moment.",
      message,
      nextSteps: [
        "Retry this section.",
        "Wait a few seconds before retrying if the workspace has active jobs.",
        "Open the site overview while this section reloads.",
      ],
      referenceCode,
      technicalDetails,
    };
  }
  if (kind === "backend_unavailable") {
    return {
      kind,
      title: "Dashboard service unavailable",
      description:
        "The webhooks worker could not answer right now. Retry or return to the dashboard home.",
      message,
      nextSteps: [
        "Retry in a moment.",
        "Open the site overview or dashboard home to keep working elsewhere.",
        "Contact support if this remains blocked.",
      ],
      referenceCode,
      technicalDetails,
    };
  }
  if (kind === "forbidden") {
    return {
      kind,
      title: "Access restricted",
      description: "Your current session cannot view this dashboard data.",
      message,
      nextSteps: [
        "Sign out and sign in with an account that has access.",
        "Return to dashboard home if you need a different workspace.",
        "Contact the workspace owner if this access should be enabled.",
      ],
      referenceCode,
      technicalDetails,
    };
  }
  if (kind === "not_found") {
    return {
      kind,
      title: "Not found",
      description: "The requested dashboard data could not be found.",
      message,
      nextSteps: [
        "Check that the workspace or section is still available.",
        "Return to the site overview or dashboard home.",
        "Contact support if this link came from the dashboard.",
      ],
      referenceCode,
      technicalDetails,
    };
  }
  return {
    kind: "unknown",
    title: fallback.title,
    description: fallback.description,
    message,
    nextSteps: [
      "Retry this section.",
      "Open the site overview or dashboard home to keep working elsewhere.",
      "Contact support if the same screen appears again.",
    ],
    referenceCode,
    technicalDetails,
  };
}

function classifyDashboardErrorKind(error: unknown): DashboardErrorKind {
  if (isDashboardWebhooksError(error)) {
    if (isDashboardContractMismatchCode(readDashboardErrorCode(error))) {
      return "contract_mismatch";
    }
    if (error.status === 504 || /timed out/i.test(error.message)) {
      return "timeout";
    }
    if (error.status === 401 || error.status === 403) {
      if (/account not found/i.test(error.message) || /not provisioned/i.test(error.message)) {
        return "account_missing";
      }
      return "forbidden";
    }
    if (error.status === 404) {
      if (/account not found/i.test(error.message) || /not provisioned/i.test(error.message)) {
        return "account_missing";
      }
      return "not_found";
    }
    if (error.status >= 500) {
      return "backend_unavailable";
    }
  }
  if (error instanceof Error) {
    if (/account not found/i.test(error.message) || /not provisioned/i.test(error.message)) {
      return "account_missing";
    }
    if (/timed out/i.test(error.message)) {
      return "timeout";
    }
    if (/forbidden/i.test(error.message)) {
      return "forbidden";
    }
    if (/not found/i.test(error.message)) {
      return "not_found";
    }
  }
  return "unknown";
}

function resolveDashboardErrorMessage(error: unknown, fallbackMessage?: string): string {
  if (isDashboardWebhooksError(error)) {
    if (isDashboardContractMismatchCode(readDashboardErrorCode(error))) {
      return "No settings, translations, or deployments were changed. This section is paused until it can display the response safely.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Your session cannot view this dashboard data.";
    }
    if (error.status === 404) {
      return "The requested dashboard data could not be found.";
    }
    if (error.status === 504) {
      return "The dashboard request timed out. Retry in a moment.";
    }
    if (error.status >= 500) {
      return "The dashboard service is unavailable right now.";
    }
  }
  return fallbackMessage ?? "Something went wrong while loading the dashboard.";
}

function resolveDashboardErrorReferenceCode(error: unknown): string | null {
  if (isDashboardWebhooksError(error)) {
    return readDashboardErrorCode(error) ?? `webhooks_http_${error.status}`;
  }
  const digest = readErrorDigest(error);
  if (digest !== null) {
    return `next_${digest}`;
  }
  return null;
}

function resolveDashboardErrorTechnicalDetails(error: unknown): unknown | null {
  if (isDashboardWebhooksError(error)) {
    const code = readDashboardErrorCode(error);
    return sanitizeDashboardTechnicalDetails({
      status: error.status,
      code: code ?? `webhooks_http_${error.status}`,
      message: error.message,
      details: error.details ?? null,
    });
  }
  return null;
}

export function readDashboardErrorCode(error: DashboardWebhooksErrorLike): string | null {
  const details = error.details;
  if (
    details === null ||
    details === undefined ||
    typeof details !== "object" ||
    Array.isArray(details)
  ) {
    return null;
  }
  const code = (details as Record<string, unknown>).code;
  return typeof code === "string" && code.trim().length > 0 ? code : null;
}

function isDashboardWebhooksError(error: unknown): error is DashboardWebhooksErrorLike {
  return error instanceof Error && "status" in error && typeof error.status === "number";
}

function isDashboardContractMismatchCode(code: string | null): boolean {
  return code === "response_schema_mismatch" || code?.endsWith("_contract_mismatch") === true;
}

const TECHNICAL_DETAIL_REDACTED_KEYS = [
  "authorization",
  "cookie",
  "credential",
  "password",
  "requestBody",
  "requestHeaders",
  "responseBody",
  "secret",
  "signature",
  "token",
  "webhookSecret",
] as const;

function sanitizeDashboardTechnicalDetails(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return "[truncated]";
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeDashboardTechnicalDetails(item, depth + 1));
  }
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (shouldRedactTechnicalDetailKey(key)) {
      sanitized[key] = "[redacted]";
      continue;
    }
    sanitized[key] = sanitizeDashboardTechnicalDetails(entry, depth + 1);
  }
  return sanitized;
}

function shouldRedactTechnicalDetailKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return TECHNICAL_DETAIL_REDACTED_KEYS.some((redactedKey) =>
    normalized.includes(redactedKey.toLowerCase()),
  );
}

function readErrorDigest(error: unknown): string | null {
  if (error === null || error === undefined || typeof error !== "object") {
    return null;
  }
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.trim().length > 0 ? digest : null;
}
