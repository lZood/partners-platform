-- ============================================================================
-- Migration: Normalize the product_types catalog.
--
-- Target set of product types (Minecraft Marketplace content categories):
--   Addons, Skinpack, Mapas, Resource Pack, Persona Items
--
-- Idempotent: safe to run multiple times.
--   1. Rename legacy "Add-on" -> "Addons" (preserving products that reference it).
--      If both already exist, merge "Add-on" into "Addons" and drop the legacy row.
--   2. Ensure all 5 target types exist.
--   3. Remove any type NOT in the target set, but ONLY when no product uses it
--      (this drops the legacy "Minigame" type when it has no products; it is left
--      in place if any product still references it, since the FK is ON DELETE RESTRICT).
-- ============================================================================

-- 1. Rename / merge the legacy "Add-on" type into "Addons".
DO $$
DECLARE
  v_addon_id  UUID;
  v_addons_id UUID;
BEGIN
  SELECT id INTO v_addon_id  FROM product_types WHERE lower(name) = 'add-on';
  SELECT id INTO v_addons_id FROM product_types WHERE lower(name) = 'addons';

  IF v_addon_id IS NOT NULL AND v_addons_id IS NULL THEN
    -- Simple rename: keeps the same id, so all products stay linked.
    UPDATE product_types SET name = 'Addons' WHERE id = v_addon_id;
  ELSIF v_addon_id IS NOT NULL AND v_addons_id IS NOT NULL THEN
    -- Both exist: repoint products onto "Addons", then drop the legacy "Add-on".
    UPDATE products SET product_type_id = v_addons_id WHERE product_type_id = v_addon_id;
    DELETE FROM product_types WHERE id = v_addon_id;
  END IF;
END $$;

-- 2. Ensure all 5 target types exist (descriptions in es-MX; only the name is shown in the UI).
INSERT INTO product_types (name, description) VALUES
  ('Addons',        'Add-ons y extensiones para productos existentes'),
  ('Skinpack',      'Paquetes de skins cosmeticas'),
  ('Mapas',         'Mundos y mapas jugables'),
  ('Resource Pack', 'Paquetes de texturas y recursos'),
  ('Persona Items', 'Items del creador de personajes (Persona)')
ON CONFLICT (name) DO NOTHING;

-- 3. Drop legacy types that are not in the target set and have no products.
--    (Practically: removes "Minigame" when unused. Types still referenced by a
--     product are left untouched so the migration never fails on the FK.)
DELETE FROM product_types pt
WHERE pt.name NOT IN ('Addons', 'Skinpack', 'Mapas', 'Resource Pack', 'Persona Items')
  AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.product_type_id = pt.id
  );
