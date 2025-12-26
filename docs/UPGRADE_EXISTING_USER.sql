-- ============================================================================
-- Upgrade Existing User to Business Plan
-- ============================================================================
-- User: 2704fmb@gmail.com (account already exists)
-- Target Plan: Business (enterprise)
-- Call Allowance: 350 calls/month
-- Onboarding: Reset to allow full testing
-- ============================================================================

-- STEP 1: Find the user's ID and current organization
-- Run this first to get the user_id and org_id
-- ============================================================================

SELECT
  u.id as user_id,
  u.email,
  u2.default_org_id,
  om.org_id,
  om.role,
  o.plan as current_plan,
  o.call_allowance,
  o.status as org_status,
  o.subscription_status,
  u2.onboarding_complete
FROM auth.users u
LEFT JOIN users u2 ON u.id = u2.id
LEFT JOIN org_members om ON u2.id = om.user_id
LEFT JOIN organizations o ON om.org_id = o.id
WHERE u.email = '2704fmb@gmail.com';

-- Copy the user_id and org_id from the results above
-- Then update the variables in STEP 2 below


-- ============================================================================
-- STEP 2: Upgrade the user's organization to Business plan
-- IMPORTANT: Replace 'USER_ID_HERE' and 'ORG_ID_HERE' with actual values from Step 1
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID := 'USER_ID_HERE';  -- Replace with actual user ID from Step 1
  v_org_id UUID := 'ORG_ID_HERE';    -- Replace with actual org ID from Step 1
BEGIN
  -- Update organization to Business (enterprise) plan
  UPDATE organizations
  SET
    plan = 'enterprise',              -- Business tier
    status = 'active',
    call_allowance = 350,             -- 350 AI calls/month
    subscription_status = 'active',
    updated_at = NOW()
  WHERE id = v_org_id;

  RAISE NOTICE 'Updated organization % to Business plan', v_org_id;

  -- Reset onboarding to allow full testing flow
  UPDATE users
  SET
    onboarding_complete = false,      -- User can test full onboarding
    updated_at = NOW()
  WHERE id = v_user_id;

  RAISE NOTICE 'Reset onboarding for user %', v_user_id;

  -- Ensure user is linked to this organization
  -- (Should already exist, but this ensures it)
  INSERT INTO org_members (org_id, user_id, role, created_at, updated_at)
  VALUES (v_org_id, v_user_id, 'owner', NOW(), NOW())
  ON CONFLICT (org_id, user_id)
  DO UPDATE SET
    role = 'owner',
    updated_at = NOW();

  RAISE NOTICE 'Verified user % is owner of org %', v_user_id, v_org_id;

  -- Ensure user's default_org_id points to this organization
  UPDATE users
  SET default_org_id = v_org_id
  WHERE id = v_user_id AND default_org_id IS DISTINCT FROM v_org_id;

  RAISE NOTICE 'Set default org for user %', v_user_id;

END $$;


-- ============================================================================
-- STEP 3: Verify the upgrade was successful
-- ============================================================================

SELECT
  u.email,
  u2.onboarding_complete,
  om.role,
  o.display_name as org_name,
  o.plan,
  o.call_allowance,
  o.status as org_status,
  o.subscription_status,
  o.created_at as org_created_at,
  o.updated_at as org_updated_at
FROM auth.users u
JOIN users u2 ON u.id = u2.id
JOIN org_members om ON u2.id = om.user_id
JOIN organizations o ON om.org_id = o.id
WHERE u.email = '2704fmb@gmail.com';

-- ============================================================================
-- Expected Results:
-- ============================================================================
-- email:                2704fmb@gmail.com
-- onboarding_complete:  false
-- role:                 owner
-- plan:                 enterprise
-- call_allowance:       350
-- org_status:           active
-- subscription_status:  active
-- ============================================================================


-- ============================================================================
-- STEP 4 (Optional): Check what the user will see in the app
-- ============================================================================

-- This query simulates what the app's isPaidPlan() check will return
SELECT
  u.email,
  o.plan,
  CASE
    WHEN o.plan IN ('starter', 'enterprise') THEN 'PAID - No paywall'
    WHEN o.plan = 'free' THEN 'FREE - Will see paywall'
    ELSE 'UNKNOWN PLAN'
  END as paywall_status,
  o.call_allowance as ai_calls_per_month,
  CASE
    WHEN o.plan = 'free' THEN '0 AI calls/month'
    WHEN o.plan = 'starter' THEN '100 AI calls/month ($49/mo)'
    WHEN o.plan = 'enterprise' THEN '350 AI calls/month ($149/mo)'
    ELSE 'Unknown'
  END as plan_details
FROM auth.users u
JOIN users u2 ON u.id = u2.id
JOIN org_members om ON u2.id = om.user_id
JOIN organizations o ON om.org_id = o.id
WHERE u.email = '2704fmb@gmail.com';

-- ============================================================================
-- Expected Result:
-- ============================================================================
-- email:           2704fmb@gmail.com
-- plan:            enterprise
-- paywall_status:  PAID - No paywall
-- ai_calls_per_month: 350
-- plan_details:    350 AI calls/month ($149/mo)
-- ============================================================================


-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If user doesn't have an organization yet, create one:
-- (Only run this if Step 1 shows org_id is NULL)

/*
DO $$
DECLARE
  v_user_id UUID := 'USER_ID_HERE';  -- Replace with user ID from Step 1
  v_new_org_id UUID;
BEGIN
  -- Create new organization
  INSERT INTO organizations (
    display_name,
    plan,
    status,
    call_allowance,
    subscription_status,
    onboarded_at,
    created_at,
    updated_at
  ) VALUES (
    'Test Business (Business Plan)',
    'enterprise',
    'active',
    350,
    'active',
    NOW(),
    NOW(),
    NOW()
  ) RETURNING id INTO v_new_org_id;

  RAISE NOTICE 'Created new organization %', v_new_org_id;

  -- Link user to organization as owner
  INSERT INTO org_members (org_id, user_id, role, created_at, updated_at)
  VALUES (v_new_org_id, v_user_id, 'owner', NOW(), NOW());

  RAISE NOTICE 'Added user % as owner of org %', v_user_id, v_new_org_id;

  -- Set as user's default organization
  UPDATE users
  SET
    default_org_id = v_new_org_id,
    onboarding_complete = false,
    updated_at = NOW()
  WHERE id = v_user_id;

  RAISE NOTICE 'Set default org for user %', v_user_id;
END $$;
*/


-- ============================================================================
-- CLEANUP (if you need to revert changes)
-- ============================================================================

/*
-- Revert to free plan
UPDATE organizations
SET
  plan = 'free',
  call_allowance = 0,
  subscription_status = 'inactive'
WHERE id = 'ORG_ID_HERE';

-- Re-enable onboarding
UPDATE users
SET onboarding_complete = true
WHERE id = 'USER_ID_HERE';
*/
