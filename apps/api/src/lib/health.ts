export interface ProbeInfo {
  timestamp: string;
  status?: number;
  etag?: string | null;
  contentLength?: number | null;
  error?: string | null;
}

export interface HealthPayload {
  ok: boolean;
  disabled: boolean;
  videoCdnAvailable: boolean;
  timestamp: string;
  // Optional short-lived probe evidence for ops/debugging
  probe?: ProbeInfo;
}

export function buildHealthResponse(
  disabled: boolean,
  videoCdnAvailable: boolean,
  timestamp: string = new Date().toISOString(),
  probe?: ProbeInfo,
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

  return {
    statusCode: disabled ? 503 : 200,
    payload,
  };
}
