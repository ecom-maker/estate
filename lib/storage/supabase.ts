import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null | undefined;
let anonClient: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    adminClient = null;
    return adminClient;
  }
  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export function getSupabaseAnon(): SupabaseClient | null {
  if (anonClient !== undefined) return anonClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    anonClient = null;
    return anonClient;
  }
  anonClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonClient;
}

export function getStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET ?? "property-media";
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function ensureStorageBucket(bucket = getStorageBucket()) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false as const, reason: "Supabase admin client not configured" };
  }

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    return { ok: false as const, reason: listError.message };
  }

  const exists = buckets?.some((b) => b.name === bucket);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 15 * 1024 * 1024,
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "video/mp4",
      ],
    });
    if (error) {
      return { ok: false as const, reason: error.message };
    }
  }

  return { ok: true as const, bucket };
}

export async function uploadObject(params: {
  bucket?: string;
  path: string;
  body: Buffer | Blob | ArrayBuffer;
  contentType: string;
}) {
  const bucket = params.bucket ?? getStorageBucket();
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      storage: "local-fallback" as const,
      path: params.path,
      publicUrl: `/uploads/${params.path}`,
    };
  }

  await ensureStorageBucket(bucket);

  const { error } = await supabase.storage.from(bucket).upload(params.path, params.body, {
    contentType: params.contentType,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(params.path);
  return {
    storage: "supabase" as const,
    path: params.path,
    publicUrl: data.publicUrl,
  };
}

export async function checkSupabaseConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const configured = isSupabaseConfigured();
  if (!configured) {
    return {
      configured: false,
      url,
      storage: { ok: false, reason: "Missing Supabase env vars" },
      auth: { ok: false, reason: "Missing Supabase env vars" },
    };
  }

  const admin = getSupabaseAdmin()!;
  const storage = await ensureStorageBucket();
  const { error: authError } = await admin.auth.getSession();

  return {
    configured: true,
    url,
    storage,
    auth: {
      ok: !authError,
      reason: authError?.message,
    },
  };
}
