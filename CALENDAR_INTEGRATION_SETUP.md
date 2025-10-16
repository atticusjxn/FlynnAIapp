# Calendar Integration Setup Guide

This guide will help you deploy the complete calendar integration system for Flynn AI, enabling the AI receptionist to check user availability when responding to calls.

## 🎯 Overview

The calendar integration system consists of:
1. **Frontend**: React Native calendar connection UI in Settings
2. **Backend**: Express.js endpoints for token encryption and management
3. **Sync Service**: Background job to sync calendar events every 15 minutes
4. **Availability Service**: Real-time availability checking for AI receptionist

## 📋 Prerequisites

- Supabase project with database access
- Google Cloud Console account (for Google Calendar OAuth)
- Server with Node.js deployed (for Express backend)
- Supabase CLI installed (for Edge Functions deployment)

---

## Step 1: Database Setup

### Apply Migrations

Run the calendar integration migrations:

```bash
cd /Users/atticus/FlynnAI

# Apply calendar integrations table
supabase db push

# Or manually run:
psql $DATABASE_URL < supabase/migrations/202501121400_add_calendar_integrations.sql
psql $DATABASE_URL < supabase/migrations/202501121500_setup_calendar_sync_cron.sql
```

### Configure Database Settings

Set required app settings in your Supabase SQL Editor:

```sql
-- Set your project reference (find in Supabase dashboard URL)
alter database postgres set app.settings.project_ref = 'your-project-ref-here';

-- Generate a secure cron secret
alter database postgres set app.settings.cron_secret = 'your-secure-random-secret-here';

-- Optional: Direct Edge Function URL
alter database postgres set app.settings.edge_function_url = 'https://your-project-ref.supabase.co/functions/v1/calendar-sync';
```

**Generate secure cron secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 2: Google Cloud Console Setup

### Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google Calendar API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

4. Create OAuth 2.0 Client ID:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Application type: "iOS" (for mobile app)
   - Name: "Flynn AI - iOS"
   - Bundle ID: Your app's bundle ID (e.g., `com.flynnai.app`)

5. Create Web Client ID (for token refresh):
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Name: "Flynn AI - Backend"
   - Authorized redirect URIs: `http://localhost:3000/oauth/google/callback`

6. Note down:
   - **Web Client ID** → `GOOGLE_WEB_CLIENT_ID`
   - **Web Client Secret** → `GOOGLE_CLIENT_SECRET`
   - **iOS Client ID** → Used in app configuration

---

## Step 3: Environment Variables

### Backend Server (.env)

Add these to your server's `.env` file:

```bash
# Calendar Integration
GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
CALENDAR_ENCRYPTION_KEY=your-64-character-hex-encryption-key

# Generate encryption key:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Server URL for sync callbacks
SERVER_PUBLIC_URL=https://your-server-domain.com

# Existing variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Mobile App (.env)

Add these to your React Native app's `.env`:

```bash
# Google Calendar OAuth (iOS Client ID)
GOOGLE_WEB_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
```

---

## Step 4: Deploy Edge Function

### Deploy Calendar Sync Function

```bash
# Navigate to project root
cd /Users/atticus/FlynnAI

# Deploy the Edge Function
supabase functions deploy calendar-sync

# Set environment secrets
supabase secrets set CRON_SECRET=your-secure-cron-secret
supabase secrets set SERVER_PUBLIC_URL=https://your-server-domain.com
```

### Test the Edge Function

```bash
# Test manually
curl -X POST \
  https://your-project-ref.supabase.co/functions/v1/calendar-sync \
  -H "Authorization: Bearer your-cron-secret" \
  -H "Content-Type: application/json"
```

---

## Step 5: Configure iOS App

### Update Info.plist

Add Google Sign-In URL scheme to `ios/FlynnAI/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.YOUR-IOS-CLIENT-ID</string>
    </array>
  </dict>
</array>
```

Replace `YOUR-IOS-CLIENT-ID` with your actual iOS Client ID (reversed).

### Update app.json

Add Google Sign-In configuration:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.flynnai.app",
      "config": {
        "googleSignIn": {
          "reservedClientId": "com.googleusercontent.apps.YOUR-IOS-CLIENT-ID"
        }
      }
    }
  }
}
```

---

## Step 6: Verify Cron Job

### Check Scheduled Jobs

Run in Supabase SQL Editor:

```sql
-- View all cron jobs
select * from cron.job;

-- Check job run history
select * from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'calendar-sync-every-15-minutes')
order by start_time desc
limit 10;
```

### Manual Trigger

Test the sync manually:

```sql
-- Trigger sync now
select public.sync_all_calendars_now();
```

---

## Step 7: Test the Integration

### 1. Connect Calendar in App

1. Open Flynn AI app
2. Go to **Settings** > **Calendar Integration**
3. Tap "Connect Google Calendar"
4. Sign in with Google account
5. Grant calendar permissions
6. Verify connection shows "Connected" status

### 2. Verify Events Sync

```sql
-- Check synced events
select * from calendar_events
where source = 'google'
order by start_time desc
limit 10;

-- Check integration status
select
  id,
  provider,
  calendar_id,
  last_synced_at,
  sync_error,
  is_active
from calendar_integrations;
```

### 3. Test AI Receptionist

1. Add a calendar event for today at 2:00 PM
2. Wait for sync (or trigger manually)
3. Call your Flynn AI number
4. Ask: *"Can I book an appointment for today at 2pm?"*
5. AI should respond: *"I'm sorry, we're not available at that time. Our next available time is..."*

---

## 🔄 Background Sync Details

### How It Works

1. **Cron Job** runs every 15 minutes
2. Triggers `trigger_calendar_sync()` function
3. Calls Edge Function `/functions/v1/calendar-sync`
4. Edge Function:
   - Fetches all active integrations
   - Gets fresh access tokens (auto-refreshes if expired)
   - Syncs events from Google Calendar
   - Updates `calendar_events` table
   - Records sync status and errors

### Sync Frequency Options

Edit cron schedule in migration file:

```sql
-- Every 5 minutes
select cron.schedule('calendar-sync', '*/5 * * * *', $$...$$);

-- Every 30 minutes
select cron.schedule('calendar-sync', '*/30 * * * *', $$...$$);

-- Hourly
select cron.schedule('calendar-sync', '0 * * * *', $$...$$);
```

---

## 🔧 Troubleshooting

### Calendar Won't Connect

**Issue**: OAuth fails with "redirect_uri_mismatch"

**Solution**:
- Check authorized redirect URIs in Google Cloud Console
- For iOS, verify bundle ID matches exactly
- For web, add `http://localhost:3000/oauth/google/callback`

### Tokens Not Refreshing

**Issue**: `Failed to refresh access token`

**Solution**:
- Verify `GOOGLE_CLIENT_SECRET` is set correctly
- Check refresh token is stored in database
- Ensure user granted "offline access" permission

### Sync Not Running

**Issue**: Events not syncing automatically

**Solution**:
```sql
-- Check if cron job exists
select * from cron.job where jobname like '%calendar%';

-- Check recent run history
select * from cron.job_run_details order by start_time desc limit 5;

-- Manually trigger to test
select public.sync_all_calendars_now();
```

### Encryption Errors

**Issue**: `Failed to decrypt access token`

**Solution**:
- Ensure `CALENDAR_ENCRYPTION_KEY` is exactly 64 hex characters (32 bytes)
- Key must be the same across all server instances
- Generate new key if lost: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### AI Not Checking Availability

**Issue**: AI doesn't mention calendar conflicts

**Solution**:
1. Check calendar sync is working: `select * from calendar_events`
2. Verify user has `calendar_sync_enabled = true`: `select calendar_sync_enabled from users`
3. Check availability service logs in server console
4. Test availability query:
   ```sql
   select * from calendar_events
   where user_id = 'your-user-id'
   and start_time >= now()
   order by start_time;
   ```

---

## 📊 Monitoring

### Database Queries

```sql
-- Integration health check
select
  provider,
  count(*) as total,
  sum(case when is_active then 1 else 0 end) as active,
  sum(case when sync_error is not null then 1 else 0 end) as errors
from calendar_integrations
group by provider;

-- Recent sync activity
select
  ci.provider,
  ci.last_synced_at,
  ci.sync_error,
  count(ce.id) as event_count
from calendar_integrations ci
left join calendar_events ce on ce.integration_id = ci.id
group by ci.id, ci.provider, ci.last_synced_at, ci.sync_error;

-- Upcoming events by user
select
  u.business_name,
  ce.title,
  ce.start_time,
  ce.source
from calendar_events ce
join users u on u.id = ce.user_id
where ce.start_time >= now()
and ce.start_time <= now() + interval '7 days'
order by ce.start_time;
```

### Server Logs

Monitor these log patterns:

```bash
# Successful sync
[CalendarSync] Batch sync completed

# Token refresh
[Calendar] Access token expired, refreshing...

# Availability check
[AIConversation] Processing message (hasBusinessContext: true)
[Availability] Next available: Friday, January 12 at 9:00 AM
```

---

## 🔐 Security Considerations

1. **Token Encryption**: All OAuth tokens encrypted with AES-256-GCM before storage
2. **RLS Policies**: Users can only access their own calendar integrations
3. **Service Role**: Edge Function uses service role key for full access
4. **Cron Secret**: Protects Edge Function from unauthorized triggers
5. **HTTPS Only**: All API calls use HTTPS
6. **Token Refresh**: Automatic token refresh prevents re-authentication

---

## 🚀 Production Checklist

- [ ] Database migrations applied
- [ ] Google OAuth credentials created
- [ ] Environment variables configured (server + mobile)
- [ ] Edge Function deployed and tested
- [ ] Cron job scheduled and verified
- [ ] Calendar connection tested in app
- [ ] Event sync verified in database
- [ ] AI availability responses tested
- [ ] Monitoring queries saved
- [ ] Error alerting configured
- [ ] Encryption key backed up securely
- [ ] Documentation shared with team

---

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review server logs for error messages
3. Test each component individually
4. Verify environment variables are set correctly

---

**Last Updated**: January 2025
**Version**: 1.0.0
