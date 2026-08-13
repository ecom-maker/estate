import { failure, success } from "@/lib/api/response";
import { uploadObject } from "@/lib/storage/supabase";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id && process.env.NODE_ENV === "production") {
    return failure("UNAUTHORIZED", "Sign in required", 401);
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") ?? "user-uploads");

    if (!(file instanceof File)) {
      return failure("VALIDATION_ERROR", "file is required", 400);
    }
    if (!ALLOWED.has(file.type)) {
      return failure("VALIDATION_ERROR", "Unsupported MIME type", 400);
    }
    if (file.size > MAX_BYTES) {
      return failure("VALIDATION_ERROR", "File exceeds 15MB limit", 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${folder}/${Date.now()}-${safeName}`;
    const uploaded = await uploadObject({
      bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "property-media",
      path,
      body: bytes,
      contentType: file.type,
    });

    const media = await prisma.media.create({
      data: {
        filename: file.name,
        storagePath: uploaded.path,
        mimeType: file.type,
        sizeBytes: file.size,
      },
    });

    return success({
      media,
      publicUrl: uploaded.publicUrl,
      storage: uploaded.storage,
    });
  } catch (error) {
    return failure(
      "UPLOAD_ERROR",
      error instanceof Error ? error.message : "Upload failed",
      500,
    );
  }
}
