"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AuditLogEntry {
  id: string;
  tableName: string;
  recordId: string;
  actionType: "created" | "updated" | "deleted";
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  createdAt: string;
  createdByName: string | null;
  createdByEmail: string | null;
  createdByAvatar: string | null;
}

export interface AuditLogFilters {
  tableName?: string;
  actionType?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogResult {
  entries: AuditLogEntry[];
  totalCount: number;
  page: number;
  totalPages: number;
}

const PAGE_SIZE = 25;

export async function getAuditLogs(
  filters: AuditLogFilters = {}
): Promise<{ success: true; data: AuditLogResult } | { success: false; error: string }> {
  try {
    const supabase = createServerSupabaseClient();
    const page = filters.page ?? 1;
    const limit = filters.limit ?? PAGE_SIZE;
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("audit_logs")
      .select("id, table_name, record_id, action_type, old_values, new_values, created_at, created_by, users (name, email, avatar_url)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.tableName) {
      query = query.eq("table_name", filters.tableName);
    }
    if (filters.actionType) {
      query = query.eq("action_type", filters.actionType);
    }

    const { data, count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const entries: AuditLogEntry[] = (data ?? []).map((row: any) => ({
      id: row.id,
      tableName: row.table_name,
      recordId: row.record_id,
      actionType: row.action_type,
      oldValues: row.old_values,
      newValues: row.new_values,
      createdAt: row.created_at,
      createdByName: row.users?.name ?? null,
      createdByEmail: row.users?.email ?? null,
      createdByAvatar: row.users?.avatar_url ?? null,
    }));

    const totalCount = count ?? 0;

    return {
      success: true,
      data: {
        entries,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message ?? "Error al cargar audit logs" };
  }
}
