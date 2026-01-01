# Quote Links System - Complete Deployment Guide

## 🎯 Overview

Flynn AI's Quote Links system is now complete! This guide walks you through deploying all components and getting the system live for your users.

### What's Included

✅ **Customer Quote Portal** (Next.js) - Mobile-optimized form with photo/video uploads
✅ **React Native Quote Builder** - UI for businesses to create/edit forms
✅ **Job Card Auto-Creation** - Converts submissions into actionable job cards
✅ **IVR/SMS Integration** - Send quote links during phone calls
✅ **Analytics Dashboard** - Conversion funnel and performance metrics
✅ **Price Estimation Engine** - Rules-based pricing calculator
✅ **8 Industry Templates** - Pre-built forms ready to use

---

## 📋 Prerequisites

Before deploying, ensure you have:

- ✅ Supabase project with existing Flynn AI database
- ✅ Twilio account with phone number provisioned
- ✅ Vercel account (for Next.js deployment)
- ✅ Node.js 18+ and npm/yarn installed locally
- ✅ Access to your Flynn AI GitHub repository

---

## 🗄️ Database Setup

### Step 1: Run Migration

The migration creates all necessary tables, RLS policies, and seeds 8 industry templates.

**Option A: Using Supabase CLI**
```bash
# From Flynn AI root directory
cd supabase
supabase db push
```

**Option B: Manual SQL Execution**
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `/supabase/migrations/20250129000003_create_quote_links_system.sql`
3. Execute the SQL
4. Verify tables created: `business_quote_forms`, `quote_submissions`, `quote_submission_media`, etc.

### Step 2: Create Storage Bucket

Run this in Supabase SQL Editor:

```sql
-- Create quote-submissions storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-submissions', 'quote-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow public uploads to temp folder
CREATE POLICY "Allow public uploads to temp folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'quote-submissions' AND
  (storage.foldername(name))[1] = 'temp'
);

-- RLS: Allow org members to access their submissions
CREATE POLICY "Allow org members to access quote media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'quote-submissions' AND
  EXISTS (
    SELECT 1 FROM quote_submission_media m
    JOIN quote_submissions s ON m.submission_id = s.id
    JOIN org_members om ON s.org_id = om.org_id
    WHERE m.file_url = name AND om.user_id = auth.uid()
  )
);
```

### Step 3: Verify Seed Data

Check that templates were created:

```sql
SELECT id, name, industry, is_active
FROM quote_form_templates
WHERE is_active = true;
```

You should see 8 templates:
- Plumbing Job Quote
- Electrical Work Quote
- Cleaning Service Quote
- Lawn & Garden Quote
- Handyman Service Quote
- Painting Quote
- Removalist Quote
- Beauty Service Quote

---

## 🌐 Deploy Quote Portal (Next.js)

### Step 1: Install Dependencies

```bash
cd quote-portal
npm install
```

### Step 2: Configure Environment Variables

Create `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Domain Configuration
QUOTE_DOMAIN=flynnai.app
```

**Where to find these values:**
- Supabase Dashboard → Settings → API
- Copy Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- Copy `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Test Locally

```bash
npm run dev
```

Visit `http://localhost:3002` - you should see a 404 (expected, no forms yet).

### Step 4: Deploy to Vercel

**Option A: Using Vercel CLI**
```bash
npm install -g vercel
vercel --prod
```

**Option B: Using Vercel Dashboard**
1. Push code to GitHub
2. Go to vercel.com → Import Project
3. Select your repository → `quote-portal` directory
4. Add environment variables from `.env.local`
5. Deploy

**Important:** Set these build settings in Vercel:
- Framework Preset: Next.js
- Root Directory: `quote-portal`
- Build Command: `npm run build`
- Output Directory: (leave empty, auto-detected)

### Step 5: Configure Custom Domain (Optional)

1. Add CNAME record in your DNS:
   ```
   quote.yourdomain.com → cname.vercel-dns.com
   ```
2. In Vercel Dashboard → Domains → Add Domain
3. Update `QUOTE_DOMAIN` env var to `yourdomain.com`

---

## 📱 Deploy React Native Changes

### Step 1: Add Quote Screens to Navigation

Update your navigation config to include quote screens:

**In `src/navigation/AppNavigator.tsx` (or similar):**

```typescript
import QuoteFormsListScreen from '../screens/quotes/QuoteFormsListScreen';
import QuoteFormTemplateSelectorScreen from '../screens/quotes/QuoteFormTemplateSelectorScreen';
import QuoteFormAnalyticsScreen from '../screens/quotes/QuoteFormAnalyticsScreen';

// Inside your Stack.Navigator:
<Stack.Screen
  name="QuoteFormsList"
  component={QuoteFormsListScreen}
  options={{ title: 'Quote Forms' }}
/>
<Stack.Screen
  name="QuoteFormTemplateSelector"
  component={QuoteFormTemplateSelectorScreen}
  options={{ title: 'Choose Template' }}
/>
<Stack.Screen
  name="QuoteFormAnalytics"
  component={QuoteFormAnalyticsScreen}
  options={{ title: 'Analytics' }}
/>
```

### Step 2: Add Quote Forms Tab (Optional)

Add a dedicated tab for Quote Forms in your main navigation:

```typescript
<Tab.Screen
  name="Quotes"
  component={QuoteFormsListScreen}
  options={{
    tabBarIcon: ({ color }) => <Icon name="file-text" size={24} color={color} />,
  }}
/>
```

Or add as a menu item in Settings/Dashboard.

### Step 3: Build and Test

```bash
# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

---

## 🔧 Configure Backend Services

### Step 1: Update IVR Handler

Integrate quote link handler into your existing IVR system.

**In `telephony/ivrHandler.js`, add:**

```javascript
const quoteLinkHandler = require('./quoteLinkHandler');

// Inside your generateIVRTwiML function:
async function generateIVRTwiML(businessProfile, callSid, userId) {
  const twiml = new twilio.twiml.VoiceResponse();

  // Generate greeting
  const greeting = await getGreetingScript(businessProfile);
  twiml.say({ voice: 'Polly.Amy' }, greeting);

  // Generate menu options (now includes quote link)
  const menuOptions = quoteLinkHandler.generateQuoteLinkMenuOption(businessProfile);

  const gather = twiml.gather({
    numDigits: 1,
    action: `/ivr/handle-dtmf?userId=${userId}&callSid=${callSid}`,
    method: 'POST',
  });

  gather.say({ voice: 'Polly.Amy' }, menuOptions);

  return twiml.toString();
}

// Inside your handleDTMF function:
async function handleDTMF(digit, userId, callSid, callerNumber, twilioNumber) {
  // Try quote link handler first
  const quoteTwiml = await quoteLinkHandler.handleQuoteLinkDTMF(
    digit,
    userId,
    callSid,
    callerNumber,
    twilioNumber
  );

  if (quoteTwiml) {
    return quoteTwiml; // Quote link was handled
  }

  // Fall back to existing booking link / voicemail handlers
  // ... existing code ...
}
```

### Step 2: Set Up Auto Job Creation

Add a webhook or cron job to auto-create jobs from new quote submissions.

**Option A: Supabase Database Webhook**

```sql
-- Create function to trigger job creation
CREATE OR REPLACE FUNCTION create_job_from_quote_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Call your backend API to create job
  PERFORM net.http_post(
    url := 'https://your-api.com/api/quotes/create-job',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object(
      'submissionId', NEW.id,
      'orgId', NEW.org_id
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER on_quote_submission_created
  AFTER INSERT ON quote_submissions
  FOR EACH ROW
  EXECUTE FUNCTION create_job_from_quote_submission();
```

**Option B: Node.js Cron Job**

Create `server/jobs/processQuoteSubmissions.js`:

```javascript
const QuoteToJobService = require('../src/services/QuoteToJobService');

async function processNewQuoteSubmissions() {
  // Get all orgs
  const { data: orgs } = await supabase.from('organizations').select('id');

  for (const org of orgs) {
    await QuoteToJobService.autoCreateJobForNewSubmissions(org.id);
  }
}

// Run every 5 minutes
setInterval(processNewQuoteSubmissions, 5 * 60 * 1000);
```

### Step 3: Add API Endpoints (Optional)

If you want manual job creation from the app:

**In `server.js`:**

```javascript
const QuoteToJobService = require('./src/services/QuoteToJobService');

app.post('/api/quotes/create-job', async (req, res) => {
  try {
    const { submissionId, scheduledDate, assignedTo } = req.body;

    const job = await QuoteToJobService.createJobFromQuote({
      submissionId,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      assignedTo,
    });

    res.json({ success: true, job });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quotes/:orgId/jobs', async (req, res) => {
  try {
    const { orgId } = req.params;
    const jobs = await QuoteToJobService.getJobsFromQuotes(orgId);
    res.json({ jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## 🧪 Testing the Complete Flow

### Test 1: Create Quote Form via App

1. Open Flynn AI mobile app
2. Navigate to Quote Forms (new tab/menu item)
3. Tap "Create Quote Form"
4. Choose "Plumbing Job Quote" template
5. Customize if needed → Publish
6. Copy the quote link

### Test 2: Fill Out Customer Form

1. Open quote link in mobile browser
2. Complete intro → Answer questions → Upload 2 photos
3. Enter contact details → Review → Submit
4. Verify confirmation screen shows

### Test 3: Verify Job Card Created

1. Back in Flynn AI app
2. Go to Jobs/Events tab
3. You should see new job card with:
   - Customer name and contact
   - All question answers
   - 2 uploaded photos
   - Estimated price (if configured)

### Test 4: IVR Phone Call Flow

1. Call your Twilio number
2. Listen for IVR greeting
3. Press digit for "quote form link" (usually 2)
4. Check phone for SMS with link
5. Click link → Complete form
6. Verify job created

### Test 5: Analytics Dashboard

1. In app, tap quote form → Analytics
2. Verify metrics show:
   - 1 link opened
   - 1 form started
   - 1 form submitted
   - 100% conversion rate

---

## 🚀 Going Live Checklist

### Pre-Launch

- [ ] Database migration completed successfully
- [ ] Storage bucket created with RLS policies
- [ ] Quote portal deployed and accessible
- [ ] At least 1 quote form created and published
- [ ] IVR integration tested end-to-end
- [ ] Job auto-creation working
- [ ] Analytics tracking events properly

### Launch Day

- [ ] Update IVR greeting to mention new quote option
- [ ] Send announcement to users about quote forms
- [ ] Monitor Supabase logs for errors
- [ ] Check Vercel analytics for portal traffic
- [ ] Test on multiple devices (iOS, Android, Desktop)

### Post-Launch

- [ ] Monitor conversion rates in analytics
- [ ] Review first 10 submissions for quality
- [ ] Adjust IVR scripts based on feedback
- [ ] Optimize photo upload speeds if needed
- [ ] Add more industry templates based on demand

---

## 📊 Monitoring & Maintenance

### Key Metrics to Watch

**Supabase Dashboard → Database:**
- `quote_submissions` table size
- `quote_submission_media` file count
- Storage bucket usage

**Vercel Dashboard:**
- Page load times (should be <3s)
- Error rate (should be <1%)
- Bandwidth usage

**Analytics Queries:**

```sql
-- Daily submissions
SELECT
  DATE(submitted_at) as date,
  COUNT(*) as submissions,
  COUNT(*) FILTER (WHERE status = 'won') as conversions
FROM quote_submissions
WHERE submitted_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(submitted_at)
ORDER BY date DESC;

-- Conversion funnel
SELECT
  event_type,
  COUNT(*) as count
FROM quote_link_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;

-- Top performing forms
SELECT
  f.title,
  COUNT(s.id) as submissions,
  COUNT(s.id) FILTER (WHERE s.status = 'won') as won,
  ROUND(100.0 * COUNT(s.id) FILTER (WHERE s.status = 'won') / NULLIF(COUNT(s.id), 0), 1) as win_rate
FROM business_quote_forms f
LEFT JOIN quote_submissions s ON f.id = s.form_id
WHERE s.submitted_at >= NOW() - INTERVAL '30 days'
GROUP BY f.id, f.title
ORDER BY submissions DESC;
```

### Common Issues

**Issue: Photos not uploading**
- Check Supabase Storage bucket exists
- Verify RLS policies allow temp folder uploads
- Check `SUPABASE_SERVICE_ROLE_KEY` in quote-portal env

**Issue: IVR not sending SMS**
- Check Twilio account balance
- Verify `quote_form_id` set in business_profiles
- Check quote form is published (`is_published = true`)
- Review Twilio logs for delivery failures

**Issue: Jobs not auto-creating**
- Check trigger/cron job is running
- Verify `jobs` table has correct schema
- Check `clients` table for permission issues
- Review server logs for errors

---

## 🔒 Security Best Practices

### Production Checklist

- [ ] Rotate Supabase service role key if exposed
- [ ] Enable rate limiting on quote portal (10 submissions/IP/hour)
- [ ] Set up monitoring alerts for suspicious activity
- [ ] Implement file scanning for uploaded media
- [ ] Enable CORS restrictions on API routes
- [ ] Use signed URLs with expiration for media access
- [ ] Regularly backup database (Supabase auto-backups enabled)

### Recommended Tools

- **File Scanning**: ClamAV or VirusTotal API
- **Rate Limiting**: Vercel Edge Middleware or Upstash
- **Monitoring**: Sentry or LogRocket for error tracking
- **Uptime**: UptimeRobot or Pingdom

---

## 📚 Additional Resources

### Documentation

- Quote Portal README: `/quote-portal/README.md`
- Database Schema: `/supabase/migrations/20250129000003_create_quote_links_system.sql`
- Type Definitions: `/src/types/quoteLinks.ts`

### Support

- GitHub Issues: For bugs and feature requests
- Supabase Dashboard: For database queries and logs
- Vercel Dashboard: For deployment and performance
- Twilio Console: For SMS logs and debugging

---

## 🎉 Success Metrics

Track these KPIs to measure success:

- **Conversion Rate**: Target >20% (visitors → submissions)
- **Completion Rate**: Target >60% (started → submitted)
- **Time to Submit**: Target <3 minutes average
- **Media Upload Rate**: Target >40% include photos
- **Win Rate**: Target >30% (submissions → won jobs)
- **Response Time**: Target <24 hours to quote

---

## 🚧 Future Enhancements

Consider building next:

1. **Email notifications** for new submissions
2. **WhatsApp integration** for quote links
3. **Multi-language support** for forms
4. **Video transcoding** for uploaded videos
5. **AI-assisted quote generation** from photos
6. **Zapier integration** for CRM sync
7. **Advanced conditional logic** for questions
8. **A/B testing** for form variations

---

**🎯 You're ready to launch! The Quote Links system is production-ready and will help Flynn AI users capture more leads and close more jobs.**

For questions or issues, refer to the codebase documentation or create a GitHub issue.
