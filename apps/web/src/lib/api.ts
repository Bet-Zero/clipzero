const DEFAULT_API_BASE = "/api";
const MAX_ERROR_DETAIL_LENGTH = 180;

export type GameClipsUnavailableCopy = {
  title: string;
  description: string;
  matchup?: string;
};

export function getApiBase(): string {
  if (typeof window === "undefined") {
    return process.env.INTERNAL_API_URL ?? DEFAULT_API_BASE;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE;
}

export function getApiLabel(): string {
  try {
    return new URL(getApiBase()).host;
  } catch {
    return getApiBase();
  }
}

export function getApiUnavailableMessage(): string {
  return `API unavailable — check the configured API (${getApiLabel()}).`;
}

export function getGameClipsUnavailableCopy(
  matchup?: string,
): GameClipsUnavailableCopy {
  const normalizedMatchup = matchup?.trim();
  return {
    title: "Clips unavailable for this game",
    description:
      "The API is online, but NBA data for this selected game could not be loaded. Try another game or check back later.",
    matchup: normalizedMatchup ? normalizedMatchup : undefined,
  };
}

export function sanitizeApiErrorDetail(detail: unknown): string | undefined {
  if (typeof detail !== "string") return undefined;

  const normalized = detail.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  if (/<(?:!doctype|html|body|head|title|\?xml|Error)\b/i.test(normalized)) {
    return undefined;
  }

  const plainText = normalized
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plainText) return undefined;
  if (plainText.length <= MAX_ERROR_DETAIL_LENGTH) return plainText;

  return `${plainText.slice(0, MAX_ERROR_DETAIL_LENGTH - 3).trimEnd()}...`;
}

function getErrorDetailFromPayload(payload: unknown): string | undefined {
  if (typeof payload === "string") return sanitizeApiErrorDetail(payload);
  if (!payload || typeof payload !== "object") return undefined;

  const detail = ["error", "message", "detail"]
    .map((key) => (payload as Record<string, unknown>)[key])
    .find((value) => typeof value === "string");

  return sanitizeApiErrorDetail(detail);
}

export async function readApiErrorDetail(
  response: Pick<Response, "text" | "statusText">,
): Promise<string | undefined> {
  const rawText = await response.text().catch(() => "");
  if (!rawText) return sanitizeApiErrorDetail(response.statusText);

  try {
    const payload = JSON.parse(rawText) as unknown;
    return (
      getErrorDetailFromPayload(payload) ??
      sanitizeApiErrorDetail(rawText) ??
      sanitizeApiErrorDetail(response.statusText)
    );
  } catch {
    return (
      sanitizeApiErrorDetail(rawText) ??
      sanitizeApiErrorDetail(response.statusText)
    );
  }
}

export function buildApiUrl(
  path: string,
  searchParams?: URLSearchParams,
): string {
  const base = getApiBase();
  const query = searchParams?.toString();
  return query ? `${base}${path}?${query}` : `${base}${path}`;
}
