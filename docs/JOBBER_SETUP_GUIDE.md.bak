# Jobber Integration Setup Guide

## Quick Start

This guide will help you set up the Jobber integration for Flynn AI.

---

## Step 1: Create Jobber OAuth App

### 1.1 Go to Jobber Developer Portal
Visit: https://developer.getjobber.com/

### 1.2 Create New App
Click **"New App"** and fill in:

**Details:**
- **App name:** `Flynn AI`
- **Developer name:** `Atticus` (or your name)
- **Callback URL:** `https://flynnai-telephony.fly.dev/integrations/jobber/callback`
- **Manage App URL (Optional):** Leave blank or add `https://flynn.ai/settings/integrations`
- **Short description:**
  ```
  AI receptionist that answers missed calls and automatically creates jobs in Jobber with client details, service requests, and scheduling information.
  ```

**Feature or benefit descriptions** (add 3-5):

1. **Auto-create jobs from missed calls**
   - AI captures client info and service requests, creating jobs instantly in Jobber

2. **Smart client matching**
   - Automatically matches callers to existing clients or creates new ones

3. **Real-time sync**
   - Jobs appear in Jobber immediately after calls end—no manual data entry

4. **24/7 call coverage**
   - Never miss a lead—AI receptionist answers when you can't

5. **Reduces admin time**
   - Eliminates double data entry between calls and job management

**Security information:**
- **Terms of Service URL:** `https://flynn.ai/terms`
- **Privacy Policy URL:** `https://flynn.ai/privacy`

**Scopes** (select these):
- ✅ **Clients** - Read and Write
- ✅ **Jobs** - Read and Write
- ❌ All others (off for MVP)

**Webhooks** (optional - add later):
- `jobs.created` → `https://flynnai-telephony.fly.dev/webhooks/jobber/job-created`
- `jobs.updated` → `https://flynnai-telephony.fly.dev/webhooks/jobber/job-updated`
- `clients.created` → `https://flynnai-telephony.fly.dev/webhooks/jobber/client-created`
- `clients.updated` → `https://flynnai-telephony.fly.dev/webhooks/jobber/client-updated`

**Refresh token rotation:**
- ✅ Enable

### 1.3 Get Credentials
After creating the app, you'll receive:
- **Client ID** (looks like: `1234567890abcdef`)
- **Client Secret** (looks like: `e0348205c8e05f3d9299f0c8be1c1a2f1f5499adb26571730293ba7bb5cae989`)

**IMPORTANT:** Save these securely! You'll need them for the next step.

---

## Step 2: Configure Environment Variables

### 2.1 Local Development
Add to your local `.env` file:
```bash
EXPO_PUBLIC_JOBBER_CLIENT_ID=your_client_id_here
JOBBER_CLIENT_SECRET=e0348205c8e05f3d9299f0c8be1c1a2f1f5499adb26571730293ba7bb5cae989
EXPO_PUBLIC_JOBBER_REDIRECT_URI=https://flynnai-telephony.fly.dev/integrations/jobber/callback
```

### 2.2 Production (Fly.io)
Set secrets on Fly.io:
```bash
# Navigate to project
cd /path/to/FlynnAI

# Set Jobber credentials
flyctl secrets set EXPO_PUBLIC_JOBBER_CLIENT_ID="your_client_id" --app flynnai-telephony
flyctl secrets set JOBBER_CLIENT_SECRET="e0348205c8e05f3d9299f0c8be1c1a2f1f5499adb26571730293ba7bb5cae989" --app flynnai-telephony
flyctl secrets set EXPO_PUBLIC_JOBBER_REDIRECT_URI="https://flynnai-telephony.fly.dev/integrations/jobber/callback" --app flynnai-telephony
```

**Note:** Setting secrets will automatically restart your Fly.io app.

---

## Step 3: Deploy Database Migration

### 3.1 Apply Migration
The integration database schema has already been created in:
`supabase/migrations/202502180930_add_integrations_schema.sql`

Apply it to your Supabase project:
```bash
# If using Supabase CLI
supabase db push

# Or apply manually in Supabase Dashboard:
# 1. Go to https://supabase.com/dashboard
# 2. Select your project
# 3. Navigate to "SQL Editor"
# 4. Paste contents of 202502180930_add_integrations_schema.sql
# 5. Click "Run"
```

### 3.2 Verify Tables Created
Check that these tables exist:
- `integration_connections`
- `integration_entity_mappings`
- `integration_sync_logs`
- `integration_sync_conflicts`

---

## Step 4: Deploy Backend

### 4.1 Deploy to Fly.io
```bash
# Deploy updated server.js with Jobber endpoints
flyctl deploy --app flynnai-telephony

# Monitor deployment
flyctl status --app flynnai-telephony

# Check logs
flyctl logs --app flynnai-telephony
```

### 4.2 Verify Endpoints
Test that the OAuth callback is accessible:
```bash
# Should return HTML (not 404)
curl https://flynnai-telephony.fly.dev/integrations/jobber/callback

# Health check
curl https://flynnai-telephony.fly.dev/health
```

---

## Step 5: Test the Integration

### 5.1 Get Authorization URL
From your frontend (React Native app), generate the OAuth URL:

```typescript
import { JobberService } from './services/integrations/JobberService';
import { OrganizationService } from './services/organizationService';

// Get current org ID
const { orgId } = await OrganizationService.fetchOnboardingData();

// Generate auth URL with org_id as state
const authUrl = JobberService.getAuthorizationUrl(orgId);

// Open in browser
Linking.openURL(authUrl);
```

### 5.2 Authorize Connection
1. User clicks "Connect Jobber" in Flynn AI app
2. Browser opens Jobber authorization page
3. User signs in to Jobber and authorizes Flynn AI
4. Redirected to callback URL
5. Success page displays "✅ Jobber Connected!"

### 5.3 Verify Connection
Check database:
```sql
SELECT * FROM integration_connections
WHERE provider = 'jobber'
ORDER BY created_at DESC
LIMIT 1;
```

Should show:
- `status = 'connected'`
- `access_token` and `refresh_token` populated
- `account_name` showing Jobber account name

---

## Step 6: Test Job Sync

### 6.1 Create Test Job in Flynn AI
When the AI receptionist handles a missed call, it should:
1. Create a job in Flynn AI database
2. Automatically trigger sync to Jobber
3. Job appears in Jobber within seconds

### 6.2 Verify in Jobber
1. Log in to Jobber at https://app.getjobber.com/
2. Go to **Jobs**
3. Look for the newly created job
4. Verify client details match

### 6.3 Check Sync Logs
```sql
SELECT * FROM integration_sync_logs
WHERE connection_id IN (
  SELECT id FROM integration_connections WHERE provider = 'jobber'
)
ORDER BY created_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Issue: "Jobber integration not configured on server"
**Solution:**
- Verify `JOBBER_CLIENT_SECRET` is set in Fly.io secrets
- Check `flyctl secrets list --app flynnai-telephony`
- Redeploy if needed: `flyctl deploy --app flynnai-telephony`

### Issue: "Missing organization identifier"
**Solution:**
- Ensure `org_id` is passed as the `state` parameter in OAuth URL
- Update frontend to pass org_id:
  ```typescript
  const authUrl = JobberService.getAuthorizationUrl(orgId); // Must pass orgId
  ```

### Issue: "Token exchange failed"
**Solution:**
- Verify callback URL matches exactly in Jobber app settings
- Check Fly.io logs: `flyctl logs --app flynnai-telephony | grep "Jobber"`
- Ensure Client ID and Secret are correct

### Issue: Jobs not syncing to Jobber
**Solution:**
- Check connection status: `SELECT status FROM integration_connections WHERE provider = 'jobber'`
- If status = 'expired', reconnect integration
- Check sync logs for errors
- Verify Jobber API scopes include `jobs:write`

### Issue: "GraphQL errors: ..."
**Solution:**
- Check Jobber API version header: `X-JOBBER-GRAPHQL-VERSION: 2024-09-10`
- Review Jobber API docs: https://developer.getjobber.com/docs/
- Check if required fields are missing in mutation

---

## Frontend Integration (React Native)

### 5.1 Add Integration Settings Screen

Create a new screen: `src/screens/settings/IntegrationsScreen.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { JobberService } from '../../services/integrations/JobberService';
import { OrganizationService } from '../../services/organizationService';

export default function IntegrationsScreen() {
  const [jobberConnected, setJobberConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkJobberConnection();
  }, []);

  const checkJobberConnection = async () => {
    try {
      const connection = await JobberService.getConnection();
      setJobberConnected(connection?.status === 'connected');
    } catch (error) {
      console.error('Error checking Jobber connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectJobber = async () => {
    try {
      const { orgId } = await OrganizationService.fetchOnboardingData();
      const authUrl = JobberService.getAuthorizationUrl(orgId);
      await Linking.openURL(authUrl);
    } catch (error) {
      console.error('Error connecting to Jobber:', error);
    }
  };

  const disconnectJobber = async () => {
    try {
      await JobberService.disconnect();
      setJobberConnected(false);
    } catch (error) {
      console.error('Error disconnecting Jobber:', error);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Integrations
      </Text>

      {/* Jobber Integration Card */}
      <View style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
          Jobber
        </Text>
        <Text style={{ color: '#64748b', marginBottom: 16 }}>
          Auto-sync jobs from missed calls to Jobber
        </Text>

        {jobberConnected ? (
          <>
            <Text style={{ color: '#10b981', marginBottom: 12 }}>
              ✅ Connected
            </Text>
            <TouchableOpacity
              onPress={disconnectJobber}
              style={{
                backgroundColor: '#ef4444',
                padding: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                Disconnect
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            onPress={connectJobber}
            style={{
              backgroundColor: '#2563eb',
              padding: 12,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              Connect Jobber
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
```

### 5.2 Add to Navigation

Update your navigation to include the Integrations screen in Settings.

---

## Next Steps

1. ✅ Jobber OAuth working
2. ⏳ Implement auto-sync when jobs are created from calls
3. ⏳ Add webhook handlers for two-way sync
4. ⏳ Build conflict resolution UI
5. ⏳ Add Fergus and ServiceTitan integrations

---

## Support

- **Jobber API Docs:** https://developer.getjobber.com/docs/
- **Flynn AI Docs:** https://docs.flynn.ai/integrations
- **Support:** support@flynnai.com

---

**Last Updated:** 2025-01-27
