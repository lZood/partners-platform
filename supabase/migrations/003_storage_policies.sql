-- ============================================================================
-- Storage RLS policies for the 4 app buckets.
-- Idempotent: DROP IF EXISTS before each CREATE so it can be re-run safely.
-- ============================================================================

-- Public read for image buckets (so the public URLs work in <img>)
DROP POLICY IF EXISTS "Public read on image buckets" ON storage.objects;
CREATE POLICY "Public read on image buckets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('avatars', 'logos', 'products'));

-- Authenticated users can upload to image buckets
DROP POLICY IF EXISTS "Authenticated insert on image buckets" ON storage.objects;
CREATE POLICY "Authenticated insert on image buckets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('avatars', 'logos', 'products'));

-- Authenticated users can overwrite (the app uses upsert: true)
DROP POLICY IF EXISTS "Authenticated update on image buckets" ON storage.objects;
CREATE POLICY "Authenticated update on image buckets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('avatars', 'logos', 'products'))
  WITH CHECK (bucket_id IN ('avatars', 'logos', 'products'));

-- Authenticated users can delete (when replacing an image)
DROP POLICY IF EXISTS "Authenticated delete on image buckets" ON storage.objects;
CREATE POLICY "Authenticated delete on image buckets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id IN ('avatars', 'logos', 'products'));

-- ── receipts (private) ──
-- Server actions upload receipts using the user's session, so authenticated
-- access is enough. Public read is intentionally NOT granted.
DROP POLICY IF EXISTS "Authenticated full access on receipts" ON storage.objects;
CREATE POLICY "Authenticated full access on receipts"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'receipts')
  WITH CHECK (bucket_id = 'receipts');
