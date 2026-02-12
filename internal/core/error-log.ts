function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readTextLike(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

const ERROR_METADATA_KEYS = [
  "code",
  "errno",
  "type",
  "syscall",
  "hostname",
  "address",
  "port",
] as const;

function appendErrorMetadata(
  fields: Record<string, unknown>,
  prefix: "error" | "error_cause",
  source: Record<string, unknown>,
) {
  for (const key of ERROR_METADATA_KEYS) {
    const value = source[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      fields[`${prefix}_${key}`] = value;
    }
  }
}

function appendCauseFields(fields: Record<string, unknown>, cause: unknown) {
  if (cause === undefined) {
    return;
  }

  if (cause instanceof Error) {
    fields.error_cause = cause.message;
    fields.error_cause_name = cause.name;
    const causeRecord = asRecord(cause);
    if (causeRecord) {
      appendErrorMetadata(fields, "error_cause", causeRecord);
    }
    return;
  }

  const causeRecord = asRecord(cause);
  if (causeRecord) {
    fields.error_cause = readTextLike(causeRecord.message) ?? "Unknown cause object";
    const causeName = readTextLike(causeRecord.name);
    if (causeName) {
      fields.error_cause_name = causeName;
    }
    appendErrorMetadata(fields, "error_cause", causeRecord);
    return;
  }

  fields.error_cause = String(cause);
}

export function buildErrorLogFields(error: unknown): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (error instanceof Error) {
    fields.error = error.message;
    fields.error_name = error.name;
    const errorRecord = asRecord(error);
    if (errorRecord) {
      appendErrorMetadata(fields, "error", errorRecord);
    }
    appendCauseFields(fields, error.cause);
    return fields;
  }

  const errorRecord = asRecord(error);
  if (errorRecord) {
    fields.error = readTextLike(errorRecord.message) ?? "Unknown error object";
    const errorName = readTextLike(errorRecord.name);
    if (errorName) {
      fields.error_name = errorName;
    }
    appendErrorMetadata(fields, "error", errorRecord);
    appendCauseFields(fields, errorRecord.cause);
    return fields;
  }

  fields.error = String(error);
  return fields;
}
