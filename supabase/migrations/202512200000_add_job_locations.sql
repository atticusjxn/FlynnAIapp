-- Migration: Add pickup and dropoff location fields to jobs table
-- For removalist, delivery, and other multi-location services

-- Add pickup_location column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'jobs'
        AND column_name = 'pickup_location'
    ) THEN
        ALTER TABLE public.jobs ADD COLUMN pickup_location text;
        COMMENT ON COLUMN public.jobs.pickup_location IS 'Origin/pickup address for removal or delivery jobs';
    END IF;
END $$;

-- Add dropoff_location column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'jobs'
        AND column_name = 'dropoff_location'
    ) THEN
        ALTER TABLE public.jobs ADD COLUMN dropoff_location text;
        COMMENT ON COLUMN public.jobs.dropoff_location IS 'Destination/dropoff address for removal or delivery jobs';
    END IF;
END $$;
