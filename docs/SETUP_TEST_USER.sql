-- Flynn AI Test User Setup Script
-- Purpose: Create test user (2704fmb@gmail.com) with Business tier access
-- Run this in Supabase SQL Editor or via Supabase CLI

-- Step 1: Create auth user
-- NOTE: You'll need to do this via Supabase Dashboard > Authentication > Users > Invite User
-- OR use Supabase Admin API
-- Email: 2704fmb@gmail.com
-- Password: (Set a secure temporary password and share with test user)

-- For this SQL script, we'll assume the user was created via dashboard
-- and we need to retrieve their ID

-- Step 2: Get the user ID (run this query first to get the user_id)
SELECT
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email = '2704fmb@gmail.com';

-- Expected output: user_id (UUID), copy this for the next steps

-- Step 3: Create organization for test user
-- REPLACE 'USER_ID_HERE' with the actual UUID from Step 2
DO $$
DECLARE
  v_user_id uuid := 'USER_ID_HERE'; -- REPLACE THIS
  v_org_id uuid;
  v_org_name text := 'Test Business (Business Plan)';
BEGIN
  -- Check if organization already exists for this user
  SELECT o.id INTO v_org_id
  FROM organizations o
  INNER JOIN org_members om ON o.id = om.org_id
  WHERE om.user_id = v_user_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    -- Create new organization
    INSERT INTO organizations (
      display_name,
      plan,
      status,
      call_allowance,
      calls_used,
      subscription_status,
      onboarded_at,
      created_at,
      updated_at
    ) VALUES (
      v_org_name,
      'enterprise', -- Business tier
      'active',
      350, -- Business plan: 350 calls/month
      0,
      'active',
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_org_id;

    RAISE NOTICE 'Created organization: % with ID: %', v_org_name, v_org_id;

    -- Create org membership
    INSERT INTO org_members (
      org_id,
      user_id,
      role,
      joined_at,
      created_at,
      updated_at
    ) VALUES (
      v_org_id,
      v_user_id,
      'owner', -- Full access
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Added user as owner of organization';

    -- Update user's default_org_id
    UPDATE users
    SET
      default_org_id = v_org_id,
      onboarding_complete = false, -- Allow them to go through full onboarding
      updated_at = NOW()
    WHERE id = v_user_id;

    RAISE NOTICE 'Updated user default_org_id and onboarding status';

  ELSE
    -- Organization already exists, just update to Business tier
    UPDATE organizations
    SET
      plan = 'enterprise',
      status = 'active',
      call_allowance = 350,
      subscription_status = 'active',
      updated_at = NOW()
    WHERE id = v_org_id;

    RAISE NOTICE 'Updated existing organization: % to Business tier', v_org_id;

    -- Ensure onboarding is reset
    UPDATE users
    SET
      onboarding_complete = false,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- Display final status
  RAISE NOTICE 'Test user setup complete!';
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Org ID: %', v_org_id;
  RAISE NOTICE 'Plan: Business (enterprise)';
  RAISE NOTICE 'Call Allowance: 350/month';
END $$;

-- Step 4: Verify setup
-- REPLACE 'USER_ID_HERE' with the actual UUID
SELECT
  u.id as user_id,
  u.email,
  u.onboarding_complete,
  u.business_type,
  u.default_org_id,
  o.display_name as org_name,
  o.plan,
  o.status as org_status,
  o.call_allowance,
  om.role as user_role
FROM users u
LEFT JOIN org_members om ON u.id = om.user_id AND om.org_id = u.default_org_id
LEFT JOIN organizations o ON o.id = u.default_org_id
WHERE u.id = 'USER_ID_HERE'; -- REPLACE THIS

-- Expected output should show:
-- - email: 2704fmb@gmail.com
-- - onboarding_complete: false (so they can test the flow)
-- - plan: enterprise
-- - call_allowance: 350
-- - user_role: owner

-- Step 5: (Optional) Check business_profiles table
SELECT
  bp.*
FROM business_profiles bp
WHERE bp.org_id = (
  SELECT default_org_id FROM users WHERE email = '2704fmb@gmail.com'
);

-- This might be empty initially - it will be populated during onboarding

---
-- ALTERNATIVE: Manual step-by-step SQL (if DO block doesn't work)
---

/*
-- 1. Get user ID
SELECT id FROM auth.users WHERE email = '2704fmb@gmail.com';
-- Copy the ID

-- 2. Create organization (replace USER_ID_HERE)
INSERT INTO organizations (
  display_name,
  plan,
  status,
  call_allowance,
  calls_used,
  subscription_status,
  onboarded_at,
  created_at,
  updated_at
) VALUES (
  'Test Business (Business Plan)',
  'enterprise',
  'active',
  350,
  0,
  'active',
  NOW(),
  NOW(),
  NOW()
)
RETURNING id;
-- Copy the organization ID

-- 3. Create org membership (replace USER_ID_HERE and ORG_ID_HERE)
INSERT INTO org_members (
  org_id,
  user_id,
  role,
  joined_at,
  created_at,
  updated_at
) VALUES (
  'ORG_ID_HERE',
  'USER_ID_HERE',
  'owner',
  NOW(),
  NOW(),
  NOW()
);

-- 4. Update user (replace USER_ID_HERE and ORG_ID_HERE)
UPDATE users
SET
  default_org_id = 'ORG_ID_HERE',
  onboarding_complete = false,
  updated_at = NOW()
WHERE id = 'USER_ID_HERE';

-- 5. Verify
SELECT
  u.id,
  u.email,
  u.onboarding_complete,
  o.plan,
  o.call_allowance,
  om.role
FROM users u
LEFT JOIN org_members om ON u.id = om.user_id
LEFT JOIN organizations o ON o.id = om.org_id
WHERE u.email = '2704fmb@gmail.com';
*/

---
-- CLEANUP (if needed to start over)
---

/*
-- WARNING: This will delete all data for the test user
-- Run only if you need to reset the test user completely

-- 1. Get user ID
SELECT id FROM auth.users WHERE email = '2704fmb@gmail.com';
-- Copy the ID

-- 2. Delete org membership (replace USER_ID_HERE)
DELETE FROM org_members WHERE user_id = 'USER_ID_HERE';

-- 3. Delete organization (replace ORG_ID_HERE)
DELETE FROM organizations WHERE id = 'ORG_ID_HERE';

-- 4. Delete user record (replace USER_ID_HERE)
DELETE FROM users WHERE id = 'USER_ID_HERE';

-- 5. Delete auth user (replace USER_ID_HERE)
DELETE FROM auth.users WHERE id = 'USER_ID_HERE';
*/
