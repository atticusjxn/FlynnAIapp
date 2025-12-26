-- Migration: Create Quotes and Invoices System
-- Description: Quote/invoice builder with Stripe Payment Links and PDF generation
-- Allows businesses to create quotes, convert to invoices, and collect payments

-- Quotes Table
CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- References
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL,

  -- Quote identification
  quote_number text NOT NULL, -- e.g., "QT-2025-001"
  title text, -- e.g., "Bathroom Renovation Quote"

  -- Line items stored as JSONB array
  -- [{description: string, quantity: number, unit_price: number, total: number}]
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Pricing
  subtotal decimal(12, 2) NOT NULL DEFAULT 0,
  tax_rate decimal(5, 2) NOT NULL DEFAULT 10.00, -- Australian GST default 10%
  tax_amount decimal(12, 2) NOT NULL DEFAULT 0,
  total decimal(12, 2) NOT NULL DEFAULT 0,

  -- Quote details
  notes text, -- Internal notes
  terms text, -- Terms and conditions shown to customer
  valid_until date, -- Quote expiry date

  -- Customer message
  message text, -- Custom message to include in SMS/email

  -- Status
  status text NOT NULL DEFAULT 'draft', -- draft, sent, viewed, accepted, declined, expired

  -- Stripe integration
  stripe_payment_link_id text,
  stripe_payment_link_url text,

  -- PDF generation
  pdf_url text, -- Supabase Storage URL to generated PDF

  -- Tracking
  sent_at timestamptz,
  sent_to text, -- Phone or email it was sent to
  viewed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,

  -- Metadata
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Invoices Table
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- References
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL, -- Link to original quote if converted

  -- Invoice identification
  invoice_number text NOT NULL, -- e.g., "INV-2025-001"
  title text, -- e.g., "Bathroom Renovation"

  -- Line items stored as JSONB array
  -- [{description: string, quantity: number, unit_price: number, total: number}]
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Pricing
  subtotal decimal(12, 2) NOT NULL DEFAULT 0,
  tax_rate decimal(5, 2) NOT NULL DEFAULT 10.00, -- Australian GST default 10%
  tax_amount decimal(12, 2) NOT NULL DEFAULT 0,
  total decimal(12, 2) NOT NULL DEFAULT 0,
  amount_paid decimal(12, 2) NOT NULL DEFAULT 0,
  amount_due decimal(12, 2) NOT NULL DEFAULT 0,

  -- Invoice details
  notes text, -- Internal notes
  terms text, -- Payment terms shown to customer
  due_date date, -- Payment due date
  issued_date date NOT NULL DEFAULT CURRENT_DATE,

  -- Customer message
  message text, -- Custom message to include in SMS/email

  -- Status
  status text NOT NULL DEFAULT 'draft', -- draft, sent, viewed, partial, paid, overdue, cancelled, refunded

  -- Stripe integration
  stripe_payment_link_id text,
  stripe_payment_link_url text,
  stripe_invoice_id text, -- Stripe invoice object ID if using Stripe Invoices
  stripe_payment_intent_id text, -- Track specific payment

  -- PDF generation
  pdf_url text, -- Supabase Storage URL to generated PDF

  -- Tracking
  sent_at timestamptz,
  sent_to text, -- Phone or email it was sent to
  viewed_at timestamptz,
  paid_at timestamptz,
  payment_method text, -- How customer paid (stripe, cash, bank_transfer, etc.)

  -- Metadata
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Payment Events Table (audit trail for payments)
CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- What was paid
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,

  -- Payment details
  amount decimal(12, 2) NOT NULL,
  payment_method text, -- stripe, cash, bank_transfer, check, etc.

  -- Stripe tracking
  stripe_event_id text, -- Stripe webhook event ID
  stripe_payment_intent_id text,
  stripe_charge_id text,

  -- Status
  status text NOT NULL, -- succeeded, pending, failed, refunded
  failure_reason text,

  -- Metadata
  metadata jsonb, -- Store Stripe webhook payload for debugging
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for quotes
CREATE INDEX idx_quotes_org_id ON quotes(org_id);
CREATE INDEX idx_quotes_job_id ON quotes(job_id);
CREATE INDEX idx_quotes_client_id ON quotes(client_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_quote_number ON quotes(quote_number);
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
CREATE UNIQUE INDEX idx_quotes_org_quote_number ON quotes(org_id, quote_number);

-- Indexes for invoices
CREATE INDEX idx_invoices_org_id ON invoices(org_id);
CREATE INDEX idx_invoices_job_id ON invoices(job_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_quote_id ON invoices(quote_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);
CREATE UNIQUE INDEX idx_invoices_org_invoice_number ON invoices(org_id, invoice_number);

-- Indexes for payment_events
CREATE INDEX idx_payment_events_invoice_id ON payment_events(invoice_id);
CREATE INDEX idx_payment_events_stripe_event_id ON payment_events(stripe_event_id);
CREATE INDEX idx_payment_events_created_at ON payment_events(created_at DESC);

-- Row Level Security (RLS)

-- Enable RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotes
CREATE POLICY "Users can view quotes for their organization"
  ON quotes FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create quotes for their organization"
  ON quotes FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update quotes for their organization"
  ON quotes FOR UPDATE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete quotes for their organization"
  ON quotes FOR DELETE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- RLS Policies for invoices
CREATE POLICY "Users can view invoices for their organization"
  ON invoices FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create invoices for their organization"
  ON invoices FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invoices for their organization"
  ON invoices FOR UPDATE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete invoices for their organization"
  ON invoices FOR DELETE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- RLS Policies for payment_events
CREATE POLICY "Users can view payment events for their organization"
  ON payment_events FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- System can insert payment events (from Stripe webhooks)
CREATE POLICY "System can create payment events"
  ON payment_events FOR INSERT
  WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate next quote number
CREATE OR REPLACE FUNCTION generate_quote_number(p_org_id uuid)
RETURNS text AS $$
DECLARE
  current_year text;
  next_number integer;
  quote_num text;
BEGIN
  current_year := to_char(CURRENT_DATE, 'YYYY');

  -- Get the next number for this year
  SELECT COALESCE(MAX(
    CASE
      WHEN quote_number LIKE 'QT-' || current_year || '-%'
      THEN CAST(SUBSTRING(quote_number FROM LENGTH('QT-' || current_year || '-') + 1) AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO next_number
  FROM quotes
  WHERE org_id = p_org_id;

  -- Format as QT-YYYY-NNN (zero-padded to 3 digits)
  quote_num := 'QT-' || current_year || '-' || LPAD(next_number::text, 3, '0');

  RETURN quote_num;
END;
$$ LANGUAGE plpgsql;

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_org_id uuid)
RETURNS text AS $$
DECLARE
  current_year text;
  next_number integer;
  invoice_num text;
BEGIN
  current_year := to_char(CURRENT_DATE, 'YYYY');

  -- Get the next number for this year
  SELECT COALESCE(MAX(
    CASE
      WHEN invoice_number LIKE 'INV-' || current_year || '-%'
      THEN CAST(SUBSTRING(invoice_number FROM LENGTH('INV-' || current_year || '-') + 1) AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO next_number
  FROM invoices
  WHERE org_id = p_org_id;

  -- Format as INV-YYYY-NNN (zero-padded to 3 digits)
  invoice_num := 'INV-' || current_year || '-' || LPAD(next_number::text, 3, '0');

  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice status based on payments
CREATE OR REPLACE FUNCTION update_invoice_status_from_payments()
RETURNS TRIGGER AS $$
DECLARE
  total_paid decimal(12, 2);
  invoice_total decimal(12, 2);
BEGIN
  -- Calculate total paid amount for this invoice
  SELECT COALESCE(SUM(amount), 0)
  INTO total_paid
  FROM payment_events
  WHERE invoice_id = NEW.invoice_id
    AND status = 'succeeded';

  -- Get invoice total
  SELECT total INTO invoice_total
  FROM invoices
  WHERE id = NEW.invoice_id;

  -- Update invoice
  UPDATE invoices
  SET
    amount_paid = total_paid,
    amount_due = invoice_total - total_paid,
    status = CASE
      WHEN total_paid >= invoice_total THEN 'paid'
      WHEN total_paid > 0 THEN 'partial'
      WHEN due_date < CURRENT_DATE AND status != 'paid' THEN 'overdue'
      ELSE status
    END,
    paid_at = CASE
      WHEN total_paid >= invoice_total AND paid_at IS NULL THEN now()
      ELSE paid_at
    END
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice when payment event is created
CREATE TRIGGER update_invoice_on_payment
  AFTER INSERT ON payment_events
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status_from_payments();

-- Function to check and mark invoices as overdue
CREATE OR REPLACE FUNCTION mark_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE invoices
  SET status = 'overdue'
  WHERE status IN ('sent', 'viewed', 'partial')
    AND due_date < CURRENT_DATE
    AND amount_due > 0;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE quotes IS 'Customer quotes with line items and Stripe payment links';
COMMENT ON TABLE invoices IS 'Customer invoices with payment tracking';
COMMENT ON TABLE payment_events IS 'Audit trail of all payment events from Stripe webhooks';
COMMENT ON COLUMN quotes.line_items IS 'JSONB array of line items: [{description, quantity, unit_price, total}]';
COMMENT ON COLUMN invoices.line_items IS 'JSONB array of line items: [{description, quantity, unit_price, total}]';
COMMENT ON COLUMN quotes.status IS 'Quote status: draft, sent, viewed, accepted, declined, expired';
COMMENT ON COLUMN invoices.status IS 'Invoice status: draft, sent, viewed, partial, paid, overdue, cancelled, refunded';
COMMENT ON COLUMN payment_events.status IS 'Payment status from Stripe: succeeded, pending, failed, refunded';
