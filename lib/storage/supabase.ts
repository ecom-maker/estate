import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function uploadObject(params: {
  bucket: string;
  path: string;
  body: Buffer | Blob | ArrayBuffer;
  contentType: string;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      storage: "local-fallback" as const,
      path: params.path,
      publicUrl: `/uploads/${params.path}`,
    };
  }

  const { error } = await supabase.storage
    .from(params.bucket)
    .upload(params.path, params.body, {
      contentType: params.contentType,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(params.bucket)
    .getPublicUrl(params.path);

  return {
    storage: "supabase" as const,
    path: params.path,
    publicUrl: data.publicUrl,
  };
}
