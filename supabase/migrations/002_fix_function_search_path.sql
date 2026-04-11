-- Migration: Fix mutable search_path on all public functions
-- This prevents search_path poisoning attacks where a malicious user
-- could create objects in a schema that shadows the intended ones.
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- 1. update_timestamp()
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 2. audit_log_trigger()
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE auth_user_id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action_type, new_values, created_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'created', to_jsonb(NEW), v_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action_type, old_values, new_values, created_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), v_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action_type, old_values, created_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'deleted', to_jsonb(OLD), v_user_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- 3. get_app_user_id()
CREATE OR REPLACE FUNCTION get_app_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- 4. is_super_admin()
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_partner_roles
    WHERE user_id = public.get_app_user_id() AND role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- 5. get_admin_partner_ids()
CREATE OR REPLACE FUNCTION get_admin_partner_ids()
RETURNS SETOF UUID AS $$
  SELECT partner_id FROM public.user_partner_roles
  WHERE user_id = public.get_app_user_id() AND role IN ('super_admin', 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- 6. get_user_partner_ids()
CREATE OR REPLACE FUNCTION get_user_partner_ids()
RETURNS SETOF UUID AS $$
  SELECT partner_id FROM public.user_partner_roles
  WHERE user_id = public.get_app_user_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;
