export interface ProbeInfo {
  timestamp: string;
  status?: number;
  etag?: string | null;
  contentLength?: number | null;
  error?: string | null;
}

export interface RuntimeInfo {
  packageVersion: string | null;
  gitSha: string | null;
  buildTimestamp: string | null;
  entrypoint: string | null;
}

export interface CacheSummaryItem {
  cacheName: string;
  totalEntries: number;
  validEntries: number;
  legacyEntries: number;
  expiredEntries: number;
}

export interface CacheSummary {
  generatedAt: string;
  totalEntries: number;
  validEntries: number;
  legacyEntries: number;
  expiredEntries: number;
  caches: CacheSummaryItem[];
}

export interface HealthPayload {
  ok: boolean;
  disabled: boolean;
  videoCdnAvailable: boolean;
  timestamp: string;
  // Optional short-lived probe evidence for ops/debugging
  probe?: ProbeInfo;
  // Runtime/build marker so operators can verify what binary is serving.
  runtime?: RuntimeInfo;
  // Optional cache hygiene snapshot, exposed only in debug mode.
  cacheSummary?: CacheSummary;
}

export function buildHealthResponse(
  disabled: boolean,
  videoCdnAvailable: boolean,
  timestamp: string = new Date().toISOString(),
  probe?: ProbeInfo,
  runtime?: RuntimeInfo,
  cacheSummary?: CacheSummary,
): { statusCode: number; payload: HealthPayload } {
  const payload: HealthPayload = {
    ok: !disabled,
    disabled,
    videoCdnAvailable,
    timestamp,
  };

  if (probe) {
    payload.probe = probe;
  }

  if (runtime) {
    payload.runtime = runtime;
  }

  if (cacheSummary) {
    payload.cacheSummary = cacheSummary;
  }

  return {
    statusCode: disabled ? 503 : 200,
    payload,
  };
}
