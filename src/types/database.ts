// Auto-generated from Supabase project zmarvensghcyuwgkowqq
// Custom type aliases for convenience:

export type UserRole = "super_admin" | "admin" | "collaborator";
export type UserType = "system_user" | "virtual_profile";
export type AdjustmentType = "deduction" | "bonus" | "correction";
export type AuditAction = "created" | "updated" | "deleted";
export type CsvImportStatus = "pending" | "processing" | "completed" | "failed";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      adjustments: {
        Row: {
          adjustment_type: string
          amount_usd: number
          created_at: string
          created_by: string
          description: string
          id: string
          monthly_report_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment_type: string
          amount_usd: number
          created_at?: string
          created_by: string
          description: string
          id?: string
          monthly_report_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustment_type?: string
          amount_usd?: number
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          monthly_report_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string
          created_by: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      csv_uploads: {
        Row: {
          created_at: string
          created_by: string
          error_message: string | null
          file_path: string | null
          file_size: number | null
          filename: string
          id: string
          monthly_report_id: string | null
          partner_id: string
          processed_at: string | null
          report_month: string
          row_count: number | null
          status: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          error_message?: string | null
          file_path?: string | null
          file_size?: number | null
          filename: string
          id?: string
          monthly_report_id?: string | null
          partner_id: string
          processed_at?: string | null
          report_month: string
          row_count?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          error_message?: string | null
          file_path?: string | null
          file_size?: number | null
          filename?: string
          id?: string
          monthly_report_id?: string | null
          partner_id?: string
          processed_at?: string | null
          report_month?: string
          row_count?: number | null
          status?: string | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string
          id: string
          month: string
          notes: string | null
          partner_id: string
          updated_at: string
          usd_to_mxn: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          notes?: string | null
          partner_id: string
          updated_at?: string
          usd_to_mxn: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          notes?: string | null
          partner_id?: string
          updated_at?: string
          usd_to_mxn?: number
        }
        Relationships: []
      }
      login_logs: {
        Row: {
          created_at: string | null
          email: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          status: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      monthly_reports: {
        Row: {
          created_at: string
          exchange_rate_id: string
          id: string
          is_locked: boolean | null
          locked_at: string | null
          locked_by: string | null
          partner_id: string
          report_month: string
          total_mxn: number | null
          total_usd: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exchange_rate_id: string
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          partner_id: string
          report_month: string
          total_mxn?: number | null
          total_usd?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exchange_rate_id?: string
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          partner_id?: string
          report_month?: string
          total_mxn?: number | null
          total_usd?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_concepts: {
        Row: {
          amount_usd: number
          concept_date: string
          concept_type: string
          created_at: string | null
          created_by: string
          description: string
          id: string
          is_paid: boolean | null
          partner_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_usd: number
          concept_date?: string
          concept_type: string
          created_at?: string | null
          created_by: string
          description: string
          id?: string
          is_paid?: boolean | null
          partner_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_usd?: number
          concept_date?: string
          concept_type?: string
          created_at?: string | null
          created_by?: string
          description?: string
          id?: string
          is_paid?: boolean | null
          partner_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_items: {
        Row: {
          amount_mxn: number
          amount_usd: number
          description: string
          id: string
          item_type: string
          payment_id: string
          reference_id: string | null
        }
        Insert: {
          amount_mxn: number
          amount_usd: number
          description: string
          id?: string
          item_type: string
          payment_id: string
          reference_id?: string | null
        }
        Update: {
          amount_mxn?: number
          amount_usd?: number
          description?: string
          id?: string
          item_type?: string
          payment_id?: string
          reference_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          created_at: string | null
          created_by: string
          exchange_rate: number
          id: string
          notes: string | null
          paid_at: string
          partner_id: string
          payment_method: string | null
          receipt_url: string | null
          total_mxn: number
          total_usd: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          exchange_rate: number
          id?: string
          notes?: string | null
          paid_at?: string
          partner_id: string
          payment_method?: string | null
          receipt_url?: string | null
          total_mxn: number
          total_usd: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          paid_at?: string
          partner_id?: string
          payment_method?: string | null
          receipt_url?: string | null
          total_mxn?: number
          total_usd?: number
          user_id?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          product_type_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          product_type_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          product_type_id?: string
        }
        Relationships: []
      }
      product_distributions: {
        Row: {
          created_at: string
          id: string
          percentage_share: number
          product_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          percentage_share: number
          product_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          percentage_share?: number
          product_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          lifecycle_status: string | null
          name: string
          partner_id: string
          product_type_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          lifecycle_status?: string | null
          name: string
          partner_id: string
          product_type_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          lifecycle_status?: string | null
          name?: string
          partner_id?: string
          product_type_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_line_items: {
        Row: {
          adjustments_usd: number | null
          after_taxes_usd: number
          created_at: string
          final_mxn: number
          final_usd: number
          gross_usd: number
          id: string
          percentage_applied: number | null
          product_id: string | null
          product_name: string | null
          report_id: string
          tax_breakdown: Json | null
          user_id: string
        }
        Insert: {
          adjustments_usd?: number | null
          after_taxes_usd: number
          created_at?: string
          final_mxn: number
          final_usd: number
          gross_usd: number
          id?: string
          percentage_applied?: number | null
          product_id?: string | null
          product_name?: string | null
          report_id: string
          tax_breakdown?: Json | null
          user_id: string
        }
        Update: {
          adjustments_usd?: number | null
          after_taxes_usd?: number
          created_at?: string
          final_mxn?: number
          final_usd?: number
          gross_usd?: number
          id?: string
          percentage_applied?: number | null
          product_id?: string | null
          product_name?: string | null
          report_id?: string
          tax_breakdown?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      taxes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          partner_id: string
          percentage_rate: number
          priority_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          partner_id: string
          percentage_rate: number
          priority_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          partner_id?: string
          percentage_rate?: number
          priority_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_partner_roles: {
        Row: {
          created_at: string
          id: string
          partner_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          partner_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          partner_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          granted: boolean | null
          id: string
          permission: string
          user_partner_role_id: string
        }
        Insert: {
          granted?: boolean | null
          id?: string
          permission: string
          user_partner_role_id: string
        }
        Update: {
          granted?: boolean | null
          id?: string
          permission?: string
          user_partner_role_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_info: string | null
          id: string
          ip_address: string | null
          last_active_at: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          recovery_codes: string[] | null
          totp_enabled: boolean | null
          totp_secret: string | null
          updated_at: string
          user_type: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          recovery_codes?: string[] | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          updated_at?: string
          user_type: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          recovery_codes?: string[] | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          updated_at?: string
          user_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_partner_ids: { Args: never; Returns: string[] }
      get_app_user_id: { Args: never; Returns: string }
      get_user_partner_ids: { Args: never; Returns: string[] }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
