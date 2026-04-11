import { createClient } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Get the public URL for a file in a public bucket.
 */
export function getPublicUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Upload a file to a Supabase storage bucket (client-side).
 * Returns the public URL on success.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ url: string } | { error: string }> {
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (error) {
    return { error: error.message };
  }

  return { url: getPublicUrl(bucket, path) };
}

/**
 * Get a file extension from a File object.
 */
export function getFileExtension(file: File): string {
  const name = file.name;
  const ext = name.split(".").pop()?.toLowerCase();
  return ext || "jpg";
}
