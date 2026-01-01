# Quote Links System - Testing Guide

**Status:** ✅ Ready for Testing
**Last Updated:** 2025-12-30

---

## 🎯 Overview

This guide walks through testing the complete Quote Links system end-to-end, from creating a quote form to receiving submissions.

---

## ✅ Prerequisites

Before testing, ensure:
- ✅ Database schema deployed (6 tables + 8 templates)
- ✅ Quote Portal deployed at: https://quote-portal-qf8pklkt1-atticus-181af93c.vercel.app
- ✅ React Native app with Quote Forms navigation added
- ✅ IVR handler integrated with quoteLinkHandler
- ✅ Environment variables configured:
  - `QUOTE_DOMAIN=flynnai.app`
  - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
  - `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`

---

## 🧪 Test 1: Create Quote Form via React Native App

### Steps:

1. **Launch Flynn AI app** and log in
2. **Navigate to Quote Forms**:
   - From Dashboard → Settings → Quote Forms (or wherever you added the navigation)
   - Alternatively, use direct navigation: `navigation.navigate('QuoteFormsList')`

3. **Create New Quote Form**:
   - Tap "Create Quote Form" button
   - Select a template (e.g., "Plumbing Job Quote")
   - Review pre-filled questions
   - Customize if needed (add/remove/edit questions)
   - Enable "Show price estimate" if you want customers to see instant pricing
   - Enable "Require photos" to make photo uploads mandatory

4. **Publish Form**:
   - Tap "Publish Form"
   - Form will be assigned a unique slug (e.g., `plumbing-quote-joes-plumbing`)
   - Note the generated URL: `https://quote-portal-qf8pklkt1-atticus-181af93c.vercel.app/{slug}`

5. **Set as Default Quote Form** (Optional):
   - Navigate to Settings → Business Profile
   - Link this quote form as your default for IVR calls

### Expected Results:
- ✅ Form created successfully
- ✅ Slug auto-generated
- ✅ Form marked as `is_published = true`
- ✅ URL accessible and shows form intro page

### Verification Query:
```sql
SELECT
  id,
  name,
  slug,
  is_published,
  created_at
FROM business_quote_forms
WHERE org_id = '[your-org-id]'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🧪 Test 2: Customer Fills Out Quote Form (Web Portal)

### Steps:

1. **Open Quote Form URL** in browser:
   ```
   https://quote-portal-qf8pklkt1-atticus-181af93c.vercel.app/{your-slug}
   ```

2. **Complete Form Flow**:
   - **Step 1: Intro** - Read intro message → Tap "Get Started"
   - **Step 2: Questions** - Answer all required questions (text, select, date, etc.)
   - **Step 3: Photos** (if enabled) - Upload 1-3 photos of job site
   - **Step 4: Contact Details** - Enter name, phone, email, address
   - **Step 5: Review** - Review answers → Tap "Submit Quote Request"

3. **Check Price Estimate** (if enabled):
   - After submission, customer sees estimated price range
   - Based on price guide rules applied to their answers

### Expected Results:
- ✅ Multi-step form flow works smoothly
- ✅ Photo upload compresses images before upload
- ✅ All answers saved to `quote_submissions` table
- ✅ Media files saved to `quote_submission_media` table
- ✅ Price estimate calculated and shown (if enabled)
- ✅ Thank you message displayed

### Verification Query:
```sql
-- Check submission
SELECT
  id,
  customer_name,
  customer_phone,
  status,
  estimated_price_min,
  estimated_price_max,
  submitted_at
FROM quote_submissions
WHERE form_id = '[your-form-id]'
ORDER BY submitted_at DESC
LIMIT 5;

-- Check uploaded media
SELECT
  sm.id,
  sm.media_type,
  sm.file_type,
  sm.caption,
  s.customer_name
FROM quote_submission_media sm
JOIN quote_submissions s ON sm.submission_id = s.id
WHERE s.form_id = '[your-form-id]'
ORDER BY sm.created_at DESC;
```

---

## 🧪 Test 3: IVR Quote Link Distribution (Phone Call)

### Prerequisites:
- Business has Twilio phone number configured
- Call forwarding set up to Flynn AI
- Quote form published and linked to business profile

### Steps:

1. **Call Business Twilio Number**:
   - Dial the business's Flynn AI phone number
   - You'll hear the IVR greeting

2. **Listen to IVR Menu**:
   - Greeting: "Thank you for calling [Business Name]..."
   - Menu options (example):
     - "Press 1 to receive a booking link"
     - "Press 2 to receive a quote form link" ← **This option**
     - "Press 3 to leave a voicemail"

3. **Press Digit for Quote Form**:
   - Press **2** (or appropriate digit based on menu)
   - IVR confirms: "Thanks! We've just sent you a text message with a link to our quote form..."

4. **Check Phone for SMS**:
   - Within 2-3 seconds, receive SMS:
     ```
     Hi, this is [Business Name]. Share your project details and photos here:
     https://quote-portal-qf8pklkt1-atticus-181af93c.vercel.app/{slug}

     Reply STOP to opt out.
     ```

5. **Click Link in SMS**:
   - Tap link → Opens quote form in mobile browser
   - Complete form as in Test 2

### Expected Results:
- ✅ IVR menu includes quote link option
- ✅ SMS sent immediately during call (< 3 seconds)
- ✅ SMS contains correct quote form URL
- ✅ Link opens correctly on mobile
- ✅ Call event logged in `call_events` table
- ✅ Quote link event logged in `quote_link_events` table

### Verification Query:
```sql
-- Check call event
SELECT
  user_id,
  call_sid,
  event_type,
  event_data->>'dtmf_pressed' as dtmf,
  event_data->>'dtmf_action' as action,
  created_at
FROM call_events
WHERE event_type IN ('dtmf_pressed', 'quote_link_sent')
ORDER BY created_at DESC
LIMIT 10;

-- Check quote link analytics
SELECT
  form_id,
  event_type,
  event_data->>'source' as source,
  event_data->>'call_sid' as call_sid,
  created_at
FROM quote_link_events
WHERE event_type = 'link_opened'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🧪 Test 4: View Quote Submissions in React Native App

### Steps:

1. **Navigate to Quote Forms List**:
   - Open Flynn AI app
   - Go to Quote Forms screen

2. **Select Your Quote Form**:
   - Tap on the quote form you created
   - View form details and submissions count

3. **View Analytics**:
   - Tap "View Analytics" button
   - See metrics:
     - Total views (link opens)
     - Total submissions
     - Conversion rate (submissions / views)
     - Recent submissions list

4. **Review Submission Details**:
   - Tap on a submission from the list
   - View customer details, answers, and uploaded photos
   - See estimated price (if calculated)

5. **Update Submission Status** (Optional):
   - Mark as "Reviewed", "Quoted", "Converted", or "Declined"
   - Status updates in real-time

### Expected Results:
- ✅ All submissions visible in app
- ✅ Analytics accurately calculated
- ✅ Photos/media accessible via signed URLs
- ✅ Customer contact info displayed
- ✅ All answers formatted and readable

---

## 🧪 Test 5: Price Guide Rules (If Enabled)

### Prerequisites:
- Quote form has price guide configured
- Price guide has rules based on question answers

### Steps:

1. **Create Price Guide**:
   - Navigate to Quote Form settings
   - Configure base price range (e.g., $100 - $300)
   - Add rules:
     - Example: "If `job_type` = 'Emergency', add $100 to min and max"
     - Example: "If `job_size` = 'Large', multiply max by 1.5"

2. **Test Customer Submission**:
   - Fill out quote form as customer
   - Select answers that trigger price rules
   - Submit form

3. **Verify Price Calculation**:
   - Check submission in database
   - Verify `estimated_price_min` and `estimated_price_max` reflect applied rules
   - Verify `price_guide_rules_applied` contains rule details

### Expected Results:
- ✅ Price calculated correctly based on rules
- ✅ Customer sees estimated price range
- ✅ Rules applied are logged for transparency

### Verification Query:
```sql
SELECT
  id,
  customer_name,
  estimated_price_min,
  estimated_price_max,
  price_guide_rules_applied,
  estimate_shown_to_customer
FROM quote_submissions
WHERE form_id = '[your-form-id]'
  AND estimated_price_min IS NOT NULL
ORDER BY submitted_at DESC;
```

---

## 📊 Analytics Queries

### Overall System Health:
```sql
-- Quote Forms Summary
SELECT
  COUNT(*) as total_forms,
  COUNT(*) FILTER (WHERE is_published = true) as published_forms,
  COUNT(*) FILTER (WHERE is_published = false) as draft_forms
FROM business_quote_forms;

-- Submissions Summary (Last 7 Days)
SELECT
  COUNT(*) as total_submissions,
  COUNT(DISTINCT customer_phone) as unique_customers,
  COUNT(*) FILTER (WHERE status = 'new') as new,
  COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed,
  COUNT(*) FILTER (WHERE status = 'converted') as converted
FROM quote_submissions
WHERE submitted_at >= NOW() - INTERVAL '7 days';

-- Media Upload Rate
SELECT
  COUNT(DISTINCT s.id) as submissions_with_media,
  ROUND(100.0 * COUNT(DISTINCT s.id) / NULLIF((SELECT COUNT(*) FROM quote_submissions), 0), 1) as media_upload_rate
FROM quote_submissions s
JOIN quote_submission_media sm ON s.id = sm.submission_id;
```

### Conversion Funnel:
```sql
SELECT
  f.name as form_name,
  COUNT(*) FILTER (WHERE e.event_type = 'link_opened') as views,
  COUNT(*) FILTER (WHERE e.event_type = 'form_started') as starts,
  COUNT(*) FILTER (WHERE e.event_type = 'form_submitted') as submissions,
  ROUND(100.0 * COUNT(*) FILTER (WHERE e.event_type = 'form_submitted') /
    NULLIF(COUNT(*) FILTER (WHERE e.event_type = 'link_opened'), 0), 1) as conversion_rate
FROM business_quote_forms f
LEFT JOIN quote_link_events e ON f.id = e.form_id
WHERE f.is_published = true
GROUP BY f.id, f.name
ORDER BY submissions DESC;
```

---

## 🐛 Common Issues & Troubleshooting

### Issue: Quote form URL returns 404
**Cause:** Form not found or slug incorrect
**Fix:** Verify `is_published = true` and slug matches URL

### Issue: SMS not sent during IVR call
**Cause:** Quote form not linked to business profile
**Fix:** Update `business_profiles.quote_form_id` to point to published form

### Issue: Photos not uploading
**Cause:** Storage bucket permissions or client-side compression failing
**Fix:** Check Supabase storage RLS policies and browser console for errors

### Issue: Price estimate not showing
**Cause:** Price guide not configured or `show_price_estimate = false`
**Fix:** Enable price estimates and configure base price range

### Issue: IVR menu doesn't include quote option
**Cause:** `quote_form_id` is NULL in `business_profiles`
**Fix:** Link published quote form to business profile

---

## ✅ Test Completion Checklist

- [ ] Created quote form via React Native app
- [ ] Published form and verified slug generation
- [ ] Opened quote form URL in browser
- [ ] Completed full form flow as customer
- [ ] Uploaded photos successfully
- [ ] Received price estimate (if enabled)
- [ ] Called Twilio number and heard IVR menu
- [ ] Pressed digit for quote link
- [ ] Received SMS with quote link
- [ ] Clicked link from SMS and completed form
- [ ] Viewed submission in React Native app
- [ ] Checked analytics and conversion metrics
- [ ] Verified all database records created correctly
- [ ] Tested price guide rules (if applicable)

---

## 🎉 Success Criteria

The Quote Links system is fully functional if:

1. ✅ **Quote forms can be created** from React Native app
2. ✅ **Forms are accessible** at unique URLs
3. ✅ **Customers can submit** forms with photos
4. ✅ **IVR sends quote links** via SMS during calls
5. ✅ **Submissions appear** in React Native app
6. ✅ **Analytics track** views, starts, and conversions
7. ✅ **Price estimates calculate** correctly (if enabled)
8. ✅ **Media uploads work** and photos are viewable

---

## 📚 Related Documentation

- **Deployment Guide:** `/docs/QUOTE_LINKS_DEPLOYMENT_GUIDE.md`
- **Final Deployment Report:** `/QUOTE_LINKS_FINAL_DEPLOYMENT.md`
- **Database Schema:** `/supabase/migrations/20250129000003_create_quote_links_system.sql`
- **Type Definitions:** `/src/types/quoteLinks.ts`

---

**Ready to test?** Start with Test 1 and work through each test sequentially. Report any issues encountered during testing.
