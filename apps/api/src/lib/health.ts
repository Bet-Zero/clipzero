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

export interface HealthPayload {
  ok: boolean;
  disabled: boolean;
  videoCdnAvailable: boolean;
  timestamp: string;
  // Optional short-lived probe evidence for ops/debugging
  probe?: ProbeInfo;
  // Runtime/build marker so operators can verify what binary is serving.
  runtime?: RuntimeInfo;
}

export function buildHealthResponse(
  disabled: boolean,
  videoCdnAvailable: boolean,
  timestamp: string = new Date().toISOString(),
  probe?: ProbeInfo,
  runtime?: RuntimeInfo,
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

  return {
    statusCode: disabled ? 503 : 200,
    payload,
  };
}
