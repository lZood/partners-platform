"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type NotificationType =
  | "report_generated"
  | "payment_registered"
  | "payment_received"
  | "user_assigned"
  | "concept_added";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(
  userId: string
): Promise<number> {
  const supabase = createServerSupabaseClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return count ?? 0;
}

/**
 * Get notifications for a user.
 */
export async function getNotifications(
  userId: string,
  limit: number = 15
): Promise<AppNotification[]> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((n: any) => ({
    id: n.id,
    userId: n.user_id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    isRead: n.is_read,
    createdAt: n.created_at,
  }));
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(
  notificationId: string
): Promise<{ success: boolean }> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
  if (error) return { success: false };
  return { success: true };
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(
  userId: string
): Promise<{ success: boolean }> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) return { success: false };
  revalidatePath("/");
  return { success: true };
}

/**
 * Create a notification for a user. Internal helper.
 */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}): Promise<{ success: boolean }> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link ?? null,
  });
  if (error) {
    console.error("Failed to create notification:", error.message);
    return { success: false };
  }
  return { success: true };
}

/**
 * Notify multiple users at once (batch).
 */
export async function createNotificationsBatch(
  notifications: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }[]
): Promise<void> {
  if (notifications.length === 0) return;
  const supabase = createServerSupabaseClient();
  const rows = notifications.map((n) => ({
    user_id: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link ?? null,
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error("Failed to create batch notifications:", error.message);
  }
}
