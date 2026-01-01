-- Add receptionist_ack_library to business context function
-- This allows the Deepgram Voice Agent to use custom acknowledgement phrases

CREATE OR REPLACE FUNCTION get_business_context_for_org(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  profile_data JSONB;
  services_data JSONB;
  user_data JSONB;
  result JSONB;
BEGIN
  -- Get profile data
  SELECT to_jsonb(bp.*) INTO profile_data
  FROM business_profiles bp
  WHERE bp.org_id = p_org_id;

  IF profile_data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get services data
  SELECT COALESCE(jsonb_agg(to_jsonb(bs.*)), '[]'::jsonb) INTO services_data
  FROM business_services bs
  WHERE bs.profile_id = (profile_data->>'id')::UUID
    AND bs.available = true;

  -- Get user-specific settings (ack library, greeting, etc.)
  SELECT jsonb_build_object(
    'receptionist_ack_library', COALESCE(u.receptionist_ack_library, '[]'::jsonb),
    'receptionist_greeting', u.receptionist_greeting,
    'receptionist_voice', u.receptionist_voice
  ) INTO user_data
  FROM users u
  WHERE u.id = p_org_id;

  -- Combine into result
  result := profile_data
    || jsonb_build_object('services_list', services_data)
    || COALESCE(user_data, '{}'::jsonb);

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_business_context_for_org IS 'Retrieves complete business context including ack library for AI prompts';
