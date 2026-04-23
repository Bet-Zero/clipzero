export interface HealthPayload {
  ok: boolean;
  disabled: boolean;
  videoCdnAvailable: boolean;
  timestamp: string;
}

export function buildHealthResponse(
  disabled: boolean,
  videoCdnAvailable: boolean,
  timestamp: string = new Date().toISOString(),
): { statusCode: number; payload: HealthPayload } {
  return {
    statusCode: disabled ? 503 : 200,
    payload: {
      ok: !disabled,
      disabled,
      videoCdnAvailable,
      timestamp,
    },
  };
}
