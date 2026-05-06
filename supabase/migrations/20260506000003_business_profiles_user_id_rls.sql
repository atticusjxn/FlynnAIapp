-- Allow users to manage their own business_profiles row via user_id.
-- The existing org_id-based policies fail when org_id is null (new iOS upserts).
CREATE POLICY "Users can manage own profile by user_id"
ON public.business_profiles
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
