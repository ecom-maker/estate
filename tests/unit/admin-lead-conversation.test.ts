import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard for the admin lead-conversation viewer (see the page's own header).
 *
 * Staff open a lead's chat from the leads table. That chat belongs to the
 * visitor, not the admin — and WhatsApp sessions have no `userId` at all — so
 * it MUST go through an admin viewer authorised on a staff permission, never
 * the owner-locked end-user viewer at /agent/chat-history/[id].
 *
 * These are deliberately strict string checks so that any future change which
 * would reintroduce the 404 (repointing the link, deleting the admin viewer,
 * or adding an ownership gate to it) turns this test red and has to be
 * confirmed, not merged silently. If you are changing this on purpose, update
 * the assertions in the same commit.
 */
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const LEADS_LIST = "app/admin/leads/page.tsx";
const ADMIN_VIEWER = "app/admin/leads/[sessionId]/page.tsx";

describe("admin lead conversation viewer", () => {
  it("the admin viewer exists", () => {
    expect(existsSync(join(root, ADMIN_VIEWER))).toBe(true);
  });

  it("the leads table links to the admin viewer, not the owner-locked one", () => {
    const src = read(LEADS_LIST);
    expect(src).toContain("/admin/leads/${lead.sessionId}");
    expect(src).not.toContain("/agent/chat-history/");
  });

  it("the admin viewer is gated on the staff permission", () => {
    const src = read(ADMIN_VIEWER);
    expect(src).toContain('assertPermission("customers.view")');
  });

  it("the admin viewer does NOT enforce chat ownership", () => {
    // The owner check is what 404s WhatsApp/visitor chats for staff. It must
    // not appear here; access is by staff permission only.
    const src = read(ADMIN_VIEWER);
    expect(src).not.toMatch(/chat\.userId\s*!==/);
    expect(src).not.toMatch(/userId\s*!==\s*session/);
  });
});
