// ---------------------------------------------------------------------------
// NBA HTTP client
// ---------------------------------------------------------------------------
// NBA's edge (Akamai Bot Manager) rejects clients whose TLS/HTTP2 handshake
// doesn't look like a real browser. Node's own stack is identifiable, so plain
// axios requests get 403s on cdn.nba.com and hang on stats.nba.com regardless
// of headers or cookies. `impit` performs the request with a Chrome handshake
// signature, which the edge accepts.
//
// This module exposes an axios-shaped surface (`data`/`status`/`headers`, and
// errors carrying `isAxiosError` + `response`) so the existing NBA fetch and
// failure-classification code keeps working unchanged.
// ---------------------------------------------------------------------------

import { Impit } from "impit";

export type NbaHttpOptions = {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
};

export type NbaHttpResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
};

/** Error shaped like an AxiosError so `axios.isAxiosError` accepts it. */
export type NbaHttpError = Error & {
  isAxiosError: true;
  code?: string;
  response?: NbaHttpResponse<unknown>;
};

const DEFAULT_TIMEOUT_MS = 20000;

// One client, reused: it maintains the connection pool.
let client: Impit | null = null;

function getClient(): Impit {
  if (!client) {
    client = new Impit({ browser: "chrome" });
  }
  return client;
}

function buildUrl(url: string, params?: NbaHttpOptions["params"]): string {
  if (!params) return url;

  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    target.searchParams.set(key, String(value));
  }
  return target.toString();
}

function makeError(
  message: string,
  extra: { code?: string; response?: NbaHttpResponse<unknown> },
): NbaHttpError {
  const error = new Error(message) as NbaHttpError;
  error.isAxiosError = true;
  if (extra.code) error.code = extra.code;
  if (extra.response) error.response = extra.response;
  return error;
}

/**
 * Mirror axios's default body handling: attempt JSON, fall back to raw text.
 * Denial pages come back as HTML, and callers inspect that text to classify
 * the failure, so a parse miss must not throw here.
 */
function parseBody<T>(text: string): T {
  const trimmed = text.trim();
  if (!trimmed) return text as unknown as T;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return text as unknown as T;
  }
}

function isTimeoutError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    /timeout/i.test(name) ||
    /timed?\s*out/i.test(message) ||
    /aborted/i.test(message)
  );
}

/**
 * GET an NBA endpoint with a browser-like TLS signature.
 *
 * Resolves for any response the server actually returned below 400; throws an
 * axios-shaped error otherwise, so retry and denial-detection logic upstream
 * behaves exactly as it did with axios.
 */
export async function nbaGet<T>(
  url: string,
  options: NbaHttpOptions = {},
): Promise<NbaHttpResponse<T>> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const target = buildUrl(url, options.params);

  let response;
  try {
    response = await getClient().fetch(target, {
      headers: options.headers,
      timeout,
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      // Match the axios message/code the failure classifier already keys on.
      throw makeError(`timeout of ${timeout}ms exceeded`, {
        code: "ECONNABORTED",
      });
    }
    throw makeError(error instanceof Error ? error.message : String(error), {
      code: (error as { code?: string } | null)?.code ?? "ECONNREFUSED",
    });
  }

  const text = await response.text();
  const parsed: NbaHttpResponse<T> = {
    data: parseBody<T>(text),
    status: response.status,
    headers: response.headers,
  };

  if (response.status >= 400) {
    throw makeError(`Request failed with status code ${response.status}`, {
      response: parsed,
    });
  }

  return parsed;
}
