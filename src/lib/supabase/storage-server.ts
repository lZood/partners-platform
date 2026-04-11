"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function getPublicUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Upload a buffer to storage (server-side, for PDFs etc).
 */
export async function uploadBuffer(
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string = "application/pdf"
): Promise<{ url: string } | { error: string }> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { upsert: true, contentType });

  if (error) {
    return { error: error.message };
  }

  if (bucket === "receipts") {
    return { url: path };
  }

  return { url: getPublicUrl(bucket, path) };
}

/**
 * Delete a file from a bucket (server-side).
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
