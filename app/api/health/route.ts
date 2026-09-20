import { success, failure } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { checkSupabaseConnection } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let database: { ok: boolean; provider: string; error?: string } = {
      ok: false,
      provider: "unknown",
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      const url = process.env.DATABASE_URL ?? "";
      database = {
        ok: true,
        provider: /supabase\.(co|com)/.test(url)
          ? "supabase-postgres"
          : /localhost|127\.0\.0\.1/.test(url)
            ? "local-postgres"
            : "postgres",
      };
    } catch (error) {
      database = {
        ok: false,
        provider: "postgres",
        error: error instanceof Error ? error.message : "DB unreachable",
      };
    }

    const supabase = await checkSupabaseConnection();

    return success({
      app: process.env.NEXT_PUBLIC_APP_URL ?? null,
      database,
      supabase,
      ready:
        database.ok &&
        supabase.configured &&
        Boolean(supabase.storage && "ok" in supabase.storage && supabase.storage.ok),
    });
  } catch (error) {
    return failure(
      "HEALTH_ERROR",
      error instanceof Error ? error.message : "Health check failed",
      500,
    );
  }
}
