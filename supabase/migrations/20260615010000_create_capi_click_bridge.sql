-- CAPI attribution bridge. The conversion (texting Flynn) happens off-site in
-- iMessage, so we can't tie it to the Meta ad click from the browser alone.
-- When a visitor taps "Message Flynn" we mint a short ref token, store the
-- browser's Meta identifiers here, and slip the token into the pre-filled
-- iMessage body. The inbound webhook reads the token back and attaches these
-- identifiers to the user, so the server-side Activated event attributes to the
-- original ad click. Service-role only; rows are short-lived attribution data.

CREATE TABLE IF NOT EXISTS public.capi_click_bridge (
  ref              text PRIMARY KEY,
  event_id         text,            -- shared with the browser Pixel MessagedFlynn (dedup)
  fbp              text,            -- _fbp cookie (browser id)
  fbc              text,            -- _fbc cookie (click id)
  fbclid           text,            -- raw click id, fallback for fbc
  event_source_url text,
  utm              jsonb,
  user_phone       text,            -- filled in once the user texts (claimed)
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capi_click_bridge_phone_idx ON public.capi_click_bridge (user_phone);
CREATE INDEX IF NOT EXISTS capi_click_bridge_created_idx ON public.capi_click_bridge (created_at);

ALTER TABLE public.capi_click_bridge ENABLE ROW LEVEL SECURITY;  -- service-role only
