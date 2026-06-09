export function safeRedirect(path: string | null | undefined, fallback = "/events"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }
  return path;
}
