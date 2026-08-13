export function decodeBase64UrlJson<T = unknown>(value: string): T | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (padded.length % 4)) % 4;
    const base64 = padded + "=".repeat(padLength);
    const json =
      typeof atob === "function"
        ? atob(base64)
        : Buffer.from(value, "base64url").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
