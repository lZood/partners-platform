-- ============================================================================
-- Migration: add the "Emotes/Bailes" product type.
-- Idempotent: ON CONFLICT (name) makes it safe to re-run.
-- (Only the name is shown in the UI; the description is informational.)
-- ============================================================================

INSERT INTO product_types (name, description) VALUES
  ('Emotes/Bailes', 'Emotes y bailes para el creador de personajes (Persona)')
ON CONFLICT (name) DO NOTHING;
