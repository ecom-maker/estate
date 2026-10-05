import { NextResponse } from "next/server";

// The data layer is a public product for AI agents, so responses are
// CORS-open and cacheable.
const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  // Netlify's CDN ignores the query string in its cache key unless told
  // otherwise, so ?limit=50 got the cached ?limit=6 answer. Vercel ignores this.
  "Netlify-Vary": "query",
};

export function apiJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...BASE_HEADERS, ...(init?.headers ?? {}) },
  });
}

export function apiError(status: number, message: string) {
  return NextResponse.json(
    { error: { status, message } },
    { status, headers: BASE_HEADERS },
  );
}

export function apiOptions() {
  return new NextResponse(null, { status: 204, headers: BASE_HEADERS });
}
