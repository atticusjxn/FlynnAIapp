
-- Make twilio_call_sid nullable since the code uses call_sid instead
ALTER TABLE public.calls ALTER COLUMN twilio_call_sid DROP NOT NULL;

-- Also make caller_number nullable for the same reason
ALTER TABLE public.calls ALTER COLUMN caller_number DROP NOT NULL;

-- Add unique constraint on call_sid if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS calls_call_sid_unique ON public.calls(call_sid);
;
