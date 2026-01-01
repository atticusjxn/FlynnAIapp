-- Migration: Create call_events table for analytics and diagnostics
-- Tracks all call handling events: DTMF presses, SMS sent, mode used, outcomes

-- 1. Create call_events table
CREATE TABLE IF NOT EXISTS call_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    call_sid TEXT NOT NULL, -- Twilio call SID for correlation
    event_type TEXT NOT NULL, -- 'call_started', 'dtmf_pressed', 'sms_sent', 'voicemail_recorded', 'call_ended'
    call_handling_mode TEXT, -- Mode active during this event: 'sms_links', 'ai_receptionist', 'voicemail_only'

    -- DTMF-specific fields
    dtmf_pressed TEXT, -- The digit pressed (1, 2, 3, etc.)
    dtmf_action TEXT, -- What the digit triggered: 'booking_link', 'quote_link', 'voicemail', 'invalid'

    -- SMS-specific fields
    sms_sent BOOLEAN DEFAULT false,
    sms_type TEXT, -- 'booking_link', 'quote_link'
    sms_to_number TEXT, -- Phone number SMS was sent to
    sms_status TEXT, -- 'sent', 'failed', 'queued'
    sms_error TEXT, -- Error message if SMS failed

    -- Call context
    caller_number TEXT, -- From phone number
    caller_number_available BOOLEAN DEFAULT true, -- False if blocked/unavailable

    -- Link tracking
    link_sent TEXT, -- URL that was sent (booking or quote link)
    link_clicked BOOLEAN DEFAULT false, -- Track if link was clicked (requires webhook)
    link_clicked_at TIMESTAMPTZ,

    -- Outcome tracking
    outcome TEXT, -- 'link_sent', 'voicemail_captured', 'ai_handled', 'call_abandoned', 'error'
    error_type TEXT, -- Type of error if outcome = 'error'
    error_message TEXT, -- Detailed error message

    -- Metadata
    duration_seconds INTEGER, -- Call duration in seconds
    metadata JSONB, -- Additional flexible data storage

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_call_events_user_id ON call_events(user_id);
CREATE INDEX IF NOT EXISTS idx_call_events_call_sid ON call_events(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_events_event_type ON call_events(event_type);
CREATE INDEX IF NOT EXISTS idx_call_events_created_at ON call_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_events_mode ON call_events(call_handling_mode);
CREATE INDEX IF NOT EXISTS idx_call_events_outcome ON call_events(outcome);
CREATE INDEX IF NOT EXISTS idx_call_events_dtmf_action ON call_events(dtmf_action);

-- Composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_call_events_user_created ON call_events(user_id, created_at DESC);

-- 3. Create view for call analytics summary
CREATE OR REPLACE VIEW call_analytics_summary AS
SELECT
    user_id,
    call_handling_mode,
    DATE_TRUNC('day', created_at) as day,
    COUNT(*) as total_events,
    COUNT(DISTINCT call_sid) as total_calls,
    SUM(CASE WHEN event_type = 'dtmf_pressed' THEN 1 ELSE 0 END) as dtmf_presses,
    SUM(CASE WHEN dtmf_action = 'booking_link' THEN 1 ELSE 0 END) as booking_requests,
    SUM(CASE WHEN dtmf_action = 'quote_link' THEN 1 ELSE 0 END) as quote_requests,
    SUM(CASE WHEN dtmf_action = 'voicemail' THEN 1 ELSE 0 END) as voicemail_requests,
    SUM(CASE WHEN sms_sent = true THEN 1 ELSE 0 END) as sms_sent_count,
    SUM(CASE WHEN sms_status = 'failed' THEN 1 ELSE 0 END) as sms_failed_count,
    SUM(CASE WHEN link_clicked = true THEN 1 ELSE 0 END) as link_clicks,
    AVG(duration_seconds) as avg_call_duration
FROM call_events
GROUP BY user_id, call_handling_mode, DATE_TRUNC('day', created_at);

-- 4. Add check constraint for valid event types
ALTER TABLE call_events
ADD CONSTRAINT call_events_event_type_check
CHECK (event_type IN (
    'call_started',
    'dtmf_pressed',
    'sms_sent',
    'voicemail_recorded',
    'call_ended',
    'ivr_timeout',
    'error'
));

-- 5. Add check constraint for valid call handling modes
ALTER TABLE call_events
ADD CONSTRAINT call_events_mode_check
CHECK (call_handling_mode IN ('sms_links', 'ai_receptionist', 'voicemail_only'));

-- 6. Add check constraint for valid DTMF actions
ALTER TABLE call_events
ADD CONSTRAINT call_events_dtmf_action_check
CHECK (dtmf_action IS NULL OR dtmf_action IN (
    'booking_link',
    'quote_link',
    'voicemail',
    'invalid',
    'timeout'
));

-- 7. Add check constraint for valid outcomes
ALTER TABLE call_events
ADD CONSTRAINT call_events_outcome_check
CHECK (outcome IS NULL OR outcome IN (
    'link_sent',
    'voicemail_captured',
    'ai_handled',
    'call_abandoned',
    'error',
    'ivr_timeout',
    'caller_hangup'
));

-- 8. Add comments for documentation
COMMENT ON TABLE call_events IS 'Comprehensive event log for all call handling activities';
COMMENT ON COLUMN call_events.event_type IS 'Type of event: call_started, dtmf_pressed, sms_sent, voicemail_recorded, call_ended, ivr_timeout, error';
COMMENT ON COLUMN call_events.dtmf_action IS 'Action triggered by DTMF: booking_link, quote_link, voicemail, invalid, timeout';
COMMENT ON COLUMN call_events.outcome IS 'Final outcome: link_sent, voicemail_captured, ai_handled, call_abandoned, error';
COMMENT ON COLUMN call_events.caller_number_available IS 'False if caller ID blocked or unavailable';
COMMENT ON COLUMN call_events.link_clicked IS 'True if webhook confirms link was clicked (requires tracking implementation)';
COMMENT ON VIEW call_analytics_summary IS 'Aggregated call analytics by user, mode, and day for dashboard metrics';

-- 9. Create function to log call events (helper for backend)
CREATE OR REPLACE FUNCTION log_call_event(
    p_user_id UUID,
    p_call_sid TEXT,
    p_event_type TEXT,
    p_mode TEXT DEFAULT NULL,
    p_dtmf_pressed TEXT DEFAULT NULL,
    p_dtmf_action TEXT DEFAULT NULL,
    p_sms_sent BOOLEAN DEFAULT false,
    p_sms_type TEXT DEFAULT NULL,
    p_sms_to_number TEXT DEFAULT NULL,
    p_sms_status TEXT DEFAULT NULL,
    p_caller_number TEXT DEFAULT NULL,
    p_outcome TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO call_events (
        user_id,
        call_sid,
        event_type,
        call_handling_mode,
        dtmf_pressed,
        dtmf_action,
        sms_sent,
        sms_type,
        sms_to_number,
        sms_status,
        caller_number,
        caller_number_available,
        outcome,
        metadata
    ) VALUES (
        p_user_id,
        p_call_sid,
        p_event_type,
        p_mode,
        p_dtmf_pressed,
        p_dtmf_action,
        p_sms_sent,
        p_sms_type,
        p_sms_to_number,
        p_sms_status,
        p_caller_number,
        p_caller_number IS NOT NULL AND p_caller_number != 'anonymous',
        p_outcome,
        p_metadata
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_call_event IS 'Helper function to insert call events with proper validation';
