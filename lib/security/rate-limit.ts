import { failure, success } from "@/lib/api/response";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000,
): { ok: boolean; remaining: number } {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (current.count >= limit) {
    return { ok: false, remaining: 0 };
  }
  current.count += 1;
  return { ok: true, remaining: limit - current.count };
}

export function rateLimitResponse(key: string, limit = 30) {
  const result = rateLimit(key, limit);
  if (!result.ok) {
    return failure("RATE_LIMITED", "Too many requests", 429);
  }
  return success({ remaining: result.remaining });
}
