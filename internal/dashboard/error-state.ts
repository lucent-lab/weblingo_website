import { WebhooksApiError } from "./webhooks";

export type DashboardErrorKind =
  | "account_missing"
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
};

type DashboardErrorViewFallback = {
  title: string;
  description: string;
  message?: string;
};

export function resolveDashboardErrorView(
  error: unknown,
  fallback: DashboardErrorViewFallback,
): DashboardErrorView {
  const kind = classifyDashboardErrorKind(error);
  const message = resolveDashboardErrorMessage(error, fallback.message);
  if (kind === "account_missing") {
    return {
      kind,
      title: "Account not provisioned",
      description: "You are signed in, but your account is not yet enabled for the dashboard.",
      message,
    };
  }
  if (kind === "timeout") {
    return {
      kind,
      title: "Request timed out",
      description: "The dashboard request took too long. Retry or try again in a moment.",
      message,
    };
  }
  if (kind === "backend_unavailable") {
    return {
      kind,
      title: "Dashboard service unavailable",
      description:
        "The webhooks worker could not answer right now. Retry or return to the dashboard home.",
      message,
    };
  }
  if (kind === "forbidden") {
    return {
      kind,
      title: "Access restricted",
      description: "Your current session cannot view this dashboard data.",
      message,
    };
  }
  if (kind === "not_found") {
    return {
      kind,
      title: "Not found",
      description: "The requested dashboard data could not be found.",
      message,
    };
  }
  return {
    kind: "unknown",
    title: fallback.title,
    description: fallback.description,
    message,
  };
}

function classifyDashboardErrorKind(error: unknown): DashboardErrorKind {
  if (error instanceof WebhooksApiError) {
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
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallbackMessage ?? "Something went wrong while loading the dashboard.";
}
