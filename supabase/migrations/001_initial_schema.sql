-- ============================================================================
-- Partners Platform — Schema SQL Completo para Supabase
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'collaborator');
CREATE TYPE user_type AS ENUM ('system_user', 'virtual_profile');
CREATE TYPE adjustment_type AS ENUM ('deduction', 'bonus', 'correction');
CREATE TYPE audit_action AS ENUM ('created', 'updated', 'deleted');
CREATE TYPE csv_import_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Partners/Business entities
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_partners_active ON partners(is_active);
CREATE INDEX idx_partners_name ON partners(name);

-- Product Types lookup (extensible)
CREATE TABLE product_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_type_id UUID NOT NULL REFERENCES product_types(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(partner_id, name)
);

CREATE INDEX idx_products_partner ON products(partner_id);
CREATE INDEX idx_products_type ON products(product_type_id);
CREATE INDEX idx_products_active ON products(is_active);

-- Users/Collaborators
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  user_type user_type NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT system_user_requires_email CHECK (
    (user_type = 'system_user' AND email IS NOT NULL) OR
    user_type = 'virtual_profile'
  )
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_auth_user ON users(auth_user_id);

-- User membership in partners with role
CREATE TABLE user_partner_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, partner_id)
);

CREATE INDEX idx_upr_user ON user_partner_roles(user_id);
CREATE INDEX idx_upr_partner ON user_partner_roles(partner_id);
CREATE INDEX idx_upr_role ON user_partner_roles(role);

-- Product Distribution (percentage allocation per user)
CREATE TABLE product_distributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  percentage_share NUMERIC(5, 2) NOT NULL,
  CONSTRAINT percentage_range CHECK (percentage_share > 0 AND percentage_share <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

CREATE INDEX idx_pd_product ON product_distributions(product_id);
CREATE INDEX idx_pd_user ON product_distributions(user_id);

-- Taxes (cascade, ordered by priority)
CREATE TABLE taxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  percentage_rate NUMERIC(5, 2) NOT NULL,
  priority_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tax_percentage_range CHECK (percentage_rate >= 0 AND percentage_rate <= 100),
  UNIQUE(partner_id, priority_order)
);

CREATE INDEX idx_taxes_partner ON taxes(partner_id);
CREATE INDEX idx_taxes_priority ON taxes(partner_id, priority_order);

-- Exchange Rates (manual per partner per month)
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- first day of month, e.g. '2026-03-01'
  usd_to_mxn NUMERIC(18, 6) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exchange_rate_positive CHECK (usd_to_mxn > 0),
  UNIQUE(partner_id, month)
);

CREATE INDEX idx_er_partner ON exchange_rates(partner_id);
CREATE INDEX idx_er_month ON exchange_rates(month);

-- Monthly Reports (frozen snapshots)
CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  exchange_rate_id UUID NOT NULL REFERENCES exchange_rates(id) ON DELETE RESTRICT,
  total_usd NUMERIC(18, 6) DEFAULT 0,
  total_mxn NUMERIC(18, 6) DEFAULT 0,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(partner_id, report_month)
);

CREATE INDEX idx_mr_partner ON monthly_reports(partner_id);
CREATE INDEX idx_mr_month ON monthly_reports(report_month);

-- Report Line Items (per-user, per-product breakdown)
CREATE TABLE report_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255), -- snapshot at time of report
  percentage_applied NUMERIC(5, 2), -- snapshot
  gross_usd NUMERIC(18, 6) NOT NULL,
  after_taxes_usd NUMERIC(18, 6) NOT NULL,
  tax_breakdown JSONB, -- snapshot of each tax applied
  adjustments_usd NUMERIC(18, 6) DEFAULT 0,
  final_usd NUMERIC(18, 6) NOT NULL,
  final_mxn NUMERIC(18, 6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, user_id, product_id)
);

CREATE INDEX idx_rli_report ON report_line_items(report_id);
CREATE INDEX idx_rli_user ON report_line_items(user_id);

-- Adjustments (manual modifiers)
CREATE TABLE adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  monthly_report_id UUID NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  adjustment_type adjustment_type NOT NULL,
  amount_usd NUMERIC(18, 6) NOT NULL,
  description VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_adj_report ON adjustments(monthly_report_id);
CREATE INDEX idx_adj_user ON adjustments(user_id);

-- CSV Uploads tracking
CREATE TABLE csv_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_path TEXT, -- Supabase Storage path
  file_size INTEGER,
  status csv_import_status DEFAULT 'pending',
  row_count INTEGER,
  error_message TEXT,
  monthly_report_id UUID REFERENCES monthly_reports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_csv_partner ON csv_uploads(partner_id);
CREATE INDEX idx_csv_status ON csv_uploads(status);

-- Audit Log
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  action_type audit_action NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_table ON audit_logs(table_name);
CREATE INDEX idx_audit_record ON audit_logs(record_id);
CREATE INDEX idx_audit_action ON audit_logs(action_type);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_created_by ON audit_logs(created_by);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate cascade taxes
CREATE OR REPLACE FUNCTION calculate_cascade_taxes(
  p_partner_id UUID,
  p_gross_amount NUMERIC
)
RETURNS TABLE (
  net_amount NUMERIC,
  tax_breakdown JSONB
) AS $$
DECLARE
  v_amount NUMERIC := p_gross_amount;
  v_breakdown JSONB := '[]'::JSONB;
  v_tax RECORD;
  v_deducted NUMERIC;
BEGIN
  FOR v_tax IN
    SELECT name, percentage_rate
    FROM taxes
    WHERE partner_id = p_partner_id AND is_active = true
    ORDER BY priority_order ASC
  LOOP
    v_deducted := ROUND(v_amount * (v_tax.percentage_rate / 100), 6);
    v_amount := v_amount - v_deducted;
    v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object(
      'name', v_tax.name,
      'rate', v_tax.percentage_rate,
      'deducted', v_deducted,
      'remaining', v_amount
    ));
  END LOOP;

  RETURN QUERY SELECT v_amount, v_breakdown;
END;
$$ LANGUAGE plpgsql STABLE;

-- Validate distribution percentages sum to 100%
CREATE OR REPLACE FUNCTION check_distribution_sum(p_product_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(percentage_share), 0)
  INTO v_total
  FROM product_distributions
  WHERE product_id = p_product_id;

  RETURN v_total = 100.00;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_partners_updated BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER tr_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER tr_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER tr_upr_updated BEFORE UPDATE ON user_partner_roles FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER tr_pd_updated BEFORE UPDATE ON product_distributions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER tr_taxes_updated BEFORE UPDATE ON taxes FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER tr_er_updated BEFORE UPDATE ON exchange_rates FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER tr_mr_updated BEFORE UPDATE ON monthly_reports FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER tr_adj_updated BEFORE UPDATE ON adjustments FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Audit log trigger
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Try to get the current authenticated user
  BEGIN
    SELECT id INTO v_user_id FROM users WHERE auth_user_id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  INSERT INTO audit_logs (table_name, record_id, action_type, old_values, new_values, created_by)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE TG_OP
      WHEN 'INSERT' THEN 'created'::audit_action
      WHEN 'UPDATE' THEN 'updated'::audit_action
      WHEN 'DELETE' THEN 'deleted'::audit_action
    END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_user_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Audit triggers on sensitive tables
CREATE TRIGGER tr_audit_pd AFTER INSERT OR UPDATE OR DELETE ON product_distributions FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER tr_audit_adj AFTER INSERT OR UPDATE OR DELETE ON adjustments FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER tr_audit_taxes AFTER INSERT OR UPDATE OR DELETE ON taxes FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER tr_audit_er AFTER INSERT OR UPDATE OR DELETE ON exchange_rates FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER tr_audit_mr AFTER INSERT OR UPDATE OR DELETE ON monthly_reports FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_partner_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: get user_id from auth.uid()
CREATE OR REPLACE FUNCTION get_app_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if current user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_partner_roles
    WHERE user_id = get_app_user_id() AND role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get partner_ids where user is admin
CREATE OR REPLACE FUNCTION get_admin_partner_ids()
RETURNS SETOF UUID AS $$
  SELECT partner_id FROM user_partner_roles
  WHERE user_id = get_app_user_id() AND role IN ('super_admin', 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get partner_ids where user has any role
CREATE OR REPLACE FUNCTION get_user_partner_ids()
RETURNS SETOF UUID AS $$
  SELECT partner_id FROM user_partner_roles
  WHERE user_id = get_app_user_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- PARTNERS
CREATE POLICY "super_admin: full access" ON partners FOR ALL USING (is_super_admin());
CREATE POLICY "admin: read own partners" ON partners FOR SELECT USING (id IN (SELECT get_admin_partner_ids()));

-- PRODUCT_TYPES (read-only for authenticated)
CREATE POLICY "authenticated: read" ON product_types FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "super_admin: manage" ON product_types FOR ALL USING (is_super_admin());

-- PRODUCTS
CREATE POLICY "super_admin: full" ON products FOR ALL USING (is_super_admin());
CREATE POLICY "admin: manage partner products" ON products FOR ALL
  USING (partner_id IN (SELECT get_admin_partner_ids()))
  WITH CHECK (partner_id IN (SELECT get_admin_partner_ids()));
CREATE POLICY "collaborator: read partner products" ON products FOR SELECT
  USING (partner_id IN (SELECT get_user_partner_ids()));

-- USERS
CREATE POLICY "super_admin: full" ON users FOR ALL USING (is_super_admin());
CREATE POLICY "see partner members" ON users FOR SELECT USING (
  id IN (SELECT user_id FROM user_partner_roles WHERE partner_id IN (SELECT get_user_partner_ids()))
  OR id = get_app_user_id()
);
CREATE POLICY "update own profile" ON users FOR UPDATE USING (id = get_app_user_id()) WITH CHECK (id = get_app_user_id());

-- USER_PARTNER_ROLES
CREATE POLICY "super_admin: full" ON user_partner_roles FOR ALL USING (is_super_admin());
CREATE POLICY "admin: manage partner roles" ON user_partner_roles FOR ALL
  USING (partner_id IN (SELECT get_admin_partner_ids()))
  WITH CHECK (partner_id IN (SELECT get_admin_partner_ids()));
CREATE POLICY "collaborator: read own" ON user_partner_roles FOR SELECT
  USING (user_id = get_app_user_id());

-- PRODUCT_DISTRIBUTIONS
CREATE POLICY "super_admin: full" ON product_distributions FOR ALL USING (is_super_admin());
CREATE POLICY "admin: manage" ON product_distributions FOR ALL
  USING (product_id IN (SELECT id FROM products WHERE partner_id IN (SELECT get_admin_partner_ids())))
  WITH CHECK (product_id IN (SELECT id FROM products WHERE partner_id IN (SELECT get_admin_partner_ids())));
CREATE POLICY "collaborator: read" ON product_distributions FOR SELECT
  USING (product_id IN (SELECT id FROM products WHERE partner_id IN (SELECT get_user_partner_ids())));

-- TAXES
CREATE POLICY "super_admin: full" ON taxes FOR ALL USING (is_super_admin());
CREATE POLICY "admin: manage" ON taxes FOR ALL
  USING (partner_id IN (SELECT get_admin_partner_ids()))
  WITH CHECK (partner_id IN (SELECT get_admin_partner_ids()));
CREATE POLICY "collaborator: read" ON taxes FOR SELECT
  USING (partner_id IN (SELECT get_user_partner_ids()));

-- EXCHANGE_RATES
CREATE POLICY "super_admin: full" ON exchange_rates FOR ALL USING (is_super_admin());
CREATE POLICY "admin: manage" ON exchange_rates FOR ALL
  USING (partner_id IN (SELECT get_admin_partner_ids()))
  WITH CHECK (partner_id IN (SELECT get_admin_partner_ids()));
CREATE POLICY "collaborator: read" ON exchange_rates FOR SELECT
  USING (partner_id IN (SELECT get_user_partner_ids()));

-- MONTHLY_REPORTS
CREATE POLICY "super_admin: full" ON monthly_reports FOR ALL USING (is_super_admin());
CREATE POLICY "admin: manage" ON monthly_reports FOR ALL
  USING (partner_id IN (SELECT get_admin_partner_ids()))
  WITH CHECK (partner_id IN (SELECT get_admin_partner_ids()));
CREATE POLICY "collaborator: read" ON monthly_reports FOR SELECT
  USING (partner_id IN (SELECT get_user_partner_ids()));

-- REPORT_LINE_ITEMS
CREATE POLICY "super_admin: full" ON report_line_items FOR ALL USING (
  report_id IN (SELECT id FROM monthly_reports)  AND is_super_admin()
);
CREATE POLICY "admin: manage" ON report_line_items FOR ALL USING (
  report_id IN (SELECT id FROM monthly_reports WHERE partner_id IN (SELECT get_admin_partner_ids()))
);
CREATE POLICY "collaborator: read own" ON report_line_items FOR SELECT USING (
  user_id = get_app_user_id()
);

-- ADJUSTMENTS
CREATE POLICY "super_admin: full" ON adjustments FOR ALL USING (is_super_admin());
CREATE POLICY "admin: manage" ON adjustments FOR ALL USING (
  monthly_report_id IN (SELECT id FROM monthly_reports WHERE partner_id IN (SELECT get_admin_partner_ids()))
);
CREATE POLICY "collaborator: read own" ON adjustments FOR SELECT USING (user_id = get_app_user_id());

-- CSV_UPLOADS
CREATE POLICY "super_admin: full" ON csv_uploads FOR ALL USING (is_super_admin());
CREATE POLICY "admin: manage" ON csv_uploads FOR ALL
  USING (partner_id IN (SELECT get_admin_partner_ids()))
  WITH CHECK (partner_id IN (SELECT get_admin_partner_ids()));

-- AUDIT_LOGS (read-only)
CREATE POLICY "super_admin: read all" ON audit_logs FOR SELECT USING (is_super_admin());
CREATE POLICY "user: read own actions" ON audit_logs FOR SELECT USING (created_by = get_app_user_id());

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO product_types (name, description) VALUES
  ('Skinpack', 'Cosmetic skin packs for Minecraft'),
  ('Minigame', 'Standalone mini-games'),
  ('Add-on', 'Add-ons and extensions for existing products')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
