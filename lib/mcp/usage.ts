import "server-only";
import { prisma } from "@/lib/db/prisma";

export type McpUsage = {
  total: number;
  last7d: number;
  errors7d: number;
  byTool: { tool: string; count: number }[];
  byClient: { client: string; count: number }[];
  recent: { tool: string; client: string; ok: boolean; ms: number; at: string }[];
};

const DAY = 24 * 60 * 60 * 1000;

/** Aggregate MCP tool-call usage from the audit log (best-effort). */
export async function getMcpUsage(): Promise<McpUsage> {
  const empty: McpUsage = {
    total: 0,
    last7d: 0,
    errors7d: 0,
    byTool: [],
    byClient: [],
    recent: [],
  };
  try {
    const since30 = new Date(Date.now() - 30 * DAY);
    const since7 = Date.now() - 7 * DAY;
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where: { action: "mcp_call" } }),
      prisma.auditLog.findMany({
        where: { action: "mcp_call", createdAt: { gte: since30 } },
        orderBy: { createdAt: "desc" },
        take: 3000,
        select: { meta: true, createdAt: true },
      }),
    ]);

    const toolCounts = new Map<string, number>();
    const clientCounts = new Map<string, number>();
    let last7d = 0;
    let errors7d = 0;
    const recent: McpUsage["recent"] = [];

    for (const r of rows) {
      const m = (r.meta as Record<string, unknown> | null) ?? {};
      const tool = String(m.tool ?? "unknown");
      const client = String(m.client ?? "anonymous");
      const ok = m.ok !== false;
      const ms = Number(m.ms ?? 0);
      toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
      clientCounts.set(client, (clientCounts.get(client) ?? 0) + 1);
      if (r.createdAt.getTime() >= since7) {
        last7d += 1;
        if (!ok) errors7d += 1;
      }
      if (recent.length < 20) {
        recent.push({ tool, client, ok, ms, at: r.createdAt.toISOString() });
      }
    }

    const sortDesc = (a: { count: number }, b: { count: number }) =>
      b.count - a.count;

    return {
      total,
      last7d,
      errors7d,
      byTool: [...toolCounts.entries()]
        .map(([tool, count]) => ({ tool, count }))
        .sort(sortDesc),
      byClient: [...clientCounts.entries()]
        .map(([client, count]) => ({ client, count }))
        .sort(sortDesc),
      recent,
    };
  } catch {
    return empty;
  }
}
