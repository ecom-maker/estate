import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/ai/rag";
import { rateLimit } from "@/lib/security/rate-limit";
import { decodeBase64UrlJson } from "@/lib/encoding";

describe("chunkText", () => {
  it("chunks with overlap", async () => {
    const text = "a".repeat(1000);
    const chunks = await chunkText(text, 400, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.length).toBe(400);
  });
});

describe("rateLimit", () => {
  it("blocks after limit", () => {
    const key = `test-${Date.now()}`;
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(false);
  });
});

describe("decodeBase64UrlJson", () => {
  it("decodes payload", () => {
    const payload = Buffer.from(JSON.stringify({ a: 1 })).toString("base64url");
    expect(decodeBase64UrlJson<{ a: number }>(payload)).toEqual({ a: 1 });
  });
});
