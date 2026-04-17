const DEFAULT_API_BASE = "/api";

export function getApiBase(): string {
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

export function buildApiUrl(
  path: string,
  searchParams?: URLSearchParams,
): string {
  const base = getApiBase();
  const query = searchParams?.toString();
  return query ? `${base}${path}?${query}` : `${base}${path}`;
}
