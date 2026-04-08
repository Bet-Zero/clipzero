export const ACCESS_COOKIE_NAME = "clipzero_access";

export function isAccessGateEnabled(): boolean {
  return Boolean(
    process.env.CLIPZERO_APP_PASSWORD?.trim() &&
      process.env.CLIPZERO_ACCESS_TOKEN?.trim(),
  );
}

export function isAccessDisabled(): boolean {
  return (
    process.env.CLIPZERO_DISABLE_ACCESS === "1" ||
    process.env.CLIPZERO_DISABLE_ACCESS === "true"
  );
}

export function getAccessToken(): string {
  return process.env.CLIPZERO_ACCESS_TOKEN?.trim() ?? "";
}

export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}
