-- Fix booking system policies to use correct table name org_members instead of organization_members

-- Drop and recreate booking_pages policies
DROP POLICY IF EXISTS "Users can view their organization's booking page" ON booking_pages;
CREATE POLICY "Users can view their organization's booking page"
  ON booking_pages FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert booking pages for their organization" ON booking_pages;
CREATE POLICY "Users can insert booking pages for their organization"
  ON booking_pages FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can update their organization's booking page" ON booking_pages;
CREATE POLICY "Users can update their organization's booking page"
  ON booking_pages FOR UPDATE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can delete their organization's booking page" ON booking_pages;
CREATE POLICY "Users can delete their organization's booking page"
  ON booking_pages FOR DELETE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Drop and recreate bookings policies
DROP POLICY IF EXISTS "Users can view bookings for their organization" ON bookings;
CREATE POLICY "Users can view bookings for their organization"
  ON bookings FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update bookings for their organization" ON bookings;
CREATE POLICY "Users can update bookings for their organization"
  ON bookings FOR UPDATE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Drop and recreate cached_available_slots policies
DROP POLICY IF EXISTS "Users can view cached slots for their organization's booking pages" ON cached_available_slots;
CREATE POLICY "Users can view cached slots for their organization's booking pages"
  ON cached_available_slots FOR SELECT
  USING (
    booking_page_id IN (
      SELECT id FROM booking_pages
      WHERE org_id IN (
        SELECT om.org_id
        FROM org_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

-- Drop and recreate quotes policies
DROP POLICY IF EXISTS "Users can view quotes for their organization" ON quotes;
CREATE POLICY "Users can view quotes for their organization"
  ON quotes FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create quotes for their organization" ON quotes;
CREATE POLICY "Users can create quotes for their organization"
  ON quotes FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update quotes for their organization" ON quotes;
CREATE POLICY "Users can update quotes for their organization"
  ON quotes FOR UPDATE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete quotes for their organization" ON quotes;
CREATE POLICY "Users can delete quotes for their organization"
  ON quotes FOR DELETE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Drop and recreate invoices policies
DROP POLICY IF EXISTS "Users can view invoices for their organization" ON invoices;
CREATE POLICY "Users can view invoices for their organization"
  ON invoices FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create invoices for their organization" ON invoices;
CREATE POLICY "Users can create invoices for their organization"
  ON invoices FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update invoices for their organization" ON invoices;
CREATE POLICY "Users can update invoices for their organization"
  ON invoices FOR UPDATE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete invoices for their organization" ON invoices;
CREATE POLICY "Users can delete invoices for their organization"
  ON invoices FOR DELETE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Drop and recreate payment_events policies
DROP POLICY IF EXISTS "Users can view payment events for their organization" ON payment_events;
CREATE POLICY "Users can view payment events for their organization"
  ON payment_events FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );
