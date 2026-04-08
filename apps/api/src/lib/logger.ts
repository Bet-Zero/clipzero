type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

function getCircularReplacer() {
  const seen = new WeakSet<object>();

  return (_key: string, value: unknown) => {
    if (typeof value !== "object" || value === null) {
      return value;
    }

    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);
    return value;
  };
}

function write(level: LogLevel, message: string, meta: LogMeta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    meta,
  };

  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    line = JSON.stringify(entry, getCircularReplacer());
  }

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function serializeError(error: unknown): LogMeta {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    };
  }

  return { errorMessage: String(error) };
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    write("info", message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    write("warn", message, meta);
  },
  error(message: string, meta?: LogMeta) {
    write("error", message, meta);
  },
};
