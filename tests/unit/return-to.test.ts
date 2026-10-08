import { describe, expect, it } from "vitest";
import { authHref, returnToFrom, safeReturnTo } from "@/lib/auth/return-to";

describe("safeReturnTo", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeReturnTo("/projects/liv-lux")).toBe("/projects/liv-lux");
    expect(safeReturnTo("/search?q=marina&beds=2")).toBe("/search?q=marina&beds=2");
    expect(safeReturnTo("/")).toBe("/");
  });

  it("rejects other sites and odd forms", () => {
    for (const v of ["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "javascript:alert(1)", "", null, undefined]) {
      expect(safeReturnTo(v)).toBeNull();
    }
  });

  it("skips the auth pages themselves", () => {
    for (const v of ["/login", "/login?next=/x", "/signup", "/forgot-password", "/reset-password?t=1", "/api/auth/signin"]) {
      expect(safeReturnTo(v)).toBeNull();
    }
    expect(safeReturnTo("/login-help")).toBe("/login-help");
  });
});

describe("returnToFrom / authHref", () => {
  it("uses the current page, or what an auth page is carrying", () => {
    expect(returnToFrom("/search", "?q=marina")).toBe("/search?q=marina");
    expect(returnToFrom("/login", "?next=%2Fprojects%2Fliv-lux")).toBe("/projects/liv-lux");
    expect(returnToFrom("/signup", "")).toBeNull();
  });

  it("builds the link", () => {
    expect(authHref("/login", "/search?q=marina")).toBe("/login?next=%2Fsearch%3Fq%3Dmarina");
    expect(authHref("/signup", null)).toBe("/signup");
  });
});
