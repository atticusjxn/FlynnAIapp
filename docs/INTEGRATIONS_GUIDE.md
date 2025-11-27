# Flynn AI Integrations Guide

## Overview

Flynn AI integrates with field service management and calendar platforms to automatically sync jobs created from missed calls directly into your existing workflow tools.

## Supported Integrations

### Field Service Management
- **Jobber** - Job management for home service businesses
- **Fergus** - Field service management (trades & construction)
- **ServiceTitan** - Commercial field service software

### Calendar & Scheduling
- **Google Calendar** - Sync appointments and availability
- **Apple Calendar** - CalDAV integration
- **Calendly** - Check availability and book slots

## How It Works

1. **AI receptionist answers missed call** → Gathers job details
2. **Job created in Flynn AI** → Stored in local database
3. **Auto-sync to connected platform** → Job appears in Jobber/Fergus/ServiceTitan
4. **Two-way sync** → Updates in either system sync back
5. **Conflict resolution** → Smart merging when changes conflict

---

## Jobber Integration

### Setup Instructions

#### 1. Register OAuth Application
1. Go to https://developer.getjobber.com/
2. Sign in with your Jobber account
3. Navigate to **My Apps** → **Create New App**
4. Fill in app details:
   - **App Name**: Flynn AI
   - **Description**: AI receptionist that auto-creates jobs from missed calls
   - **Redirect URI**: `https://your-flynn-domain.com/integrations/jobber/callback`
   - **Scopes**: `jobs:read jobs:write clients:read clients:write`
5. Save and copy your **Client ID** and **Client Secret**

#### 2. Configure Environment Variables
Add to `.env` (Fly.io secrets for production):
```bash
EXPO_PUBLIC_JOBBER_CLIENT_ID=your_client_id_here
JOBBER_CLIENT_SECRET=your_client_secret_here
EXPO_PUBLIC_JOBBER_REDIRECT_URI=https://your-flynn-domain.com/integrations/jobber/callback
```

#### 3. Connect in Flynn AI App
1. Open Flynn AI app
2. Go to **Settings** → **Integrations**
3. Tap **Connect Jobber**
4. Sign in with your Jobber account
5. Authorize Flynn AI to access your jobs and clients
6. Done! Jobs from missed calls will now sync automatically

### Features

✅ **Auto-create jobs** - Jobs from calls instantly appear in Jobber
✅ **Client matching** - Flynn matches or creates clients in Jobber
✅ **Two-way sync** - Updates in Jobber sync back to Flynn
✅ **Conflict resolution** - Smart handling when both systems are updated
✅ **Audit logs** - Track every sync operation

### API Limits
- Jobber API rate limit: 10 requests/second
- Flynn syncs happen in real-time for new jobs
- Bulk sync runs every 15 minutes for updates

---

## Fergus Integration

### Setup Instructions

#### 1. Get API Credentials
1. Log in to Fergus at https://app.fergus.com/
2. Go to **Settings** → **Integrations** → **API Access**
3. Generate a new API key
4. Copy your **API Key** and **Business ID**

#### 2. Configure Environment Variables
```bash
EXPO_PUBLIC_FERGUS_CLIENT_ID=your_api_key_here
FERGUS_CLIENT_SECRET=your_business_id_here
EXPO_PUBLIC_FERGUS_REDIRECT_URI=https://your-flynn-domain.com/integrations/fergus/callback
```

#### 3. Connect in Flynn AI App
1. Settings → Integrations → Connect Fergus
2. Enter your Fergus API key and Business ID
3. Test connection
4. Enable auto-sync

### Features
- Auto-create jobs from calls
- Client and address syncing
- Quote and invoice generation (coming soon)

---

## ServiceTitan Integration

### Setup Instructions

#### 1. Register OAuth App
1. Go to https://developer.servicetitan.io/
2. Create developer account
3. Register OAuth application
4. Get Client ID, Client Secret, and Tenant ID

#### 2. Configure Environment Variables
```bash
EXPO_PUBLIC_SERVICETITAN_CLIENT_ID=your_client_id
SERVICETITAN_CLIENT_SECRET=your_client_secret
SERVICETITAN_TENANT_ID=your_tenant_id
EXPO_PUBLIC_SERVICETITAN_REDIRECT_URI=https://your-flynn-domain.com/integrations/servicetitan/callback
```

#### 3. Connect in Flynn AI
1. Settings → Integrations → Connect ServiceTitan
2. Sign in and authorize
3. Select business units to sync
4. Enable auto-sync

---

## Google Calendar Integration

### Setup Instructions

#### 1. Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Create new project: "Flynn AI Calendar"
3. Enable **Google Calendar API**
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `https://your-flynn-domain.com/integrations/google/callback`

#### 2. Configure Environment Variables
```bash
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
EXPO_PUBLIC_GOOGLE_REDIRECT_URI=https://your-flynn-domain.com/integrations/google/callback
```

#### 3. Connect in Flynn AI
1. Settings → Integrations → Connect Google Calendar
2. Sign in with Google account
3. Grant calendar access
4. Select calendars to sync
5. Jobs will now create calendar events automatically

### Features
- Auto-create calendar events from booked jobs
- Check availability before confirming times
- Send calendar invites to clients
- Two-way sync (updates in either system reflect)

---

## Calendly Integration

### Setup Instructions

#### 1. Register OAuth App
1. Log in to Calendly at https://calendly.com/
2. Go to **Integrations** → **API & Webhooks**
3. Create new OAuth application
4. Copy Client ID and Client Secret

#### 2. Configure Environment Variables
```bash
EXPO_PUBLIC_CALENDLY_CLIENT_ID=your_calendly_client_id
CALENDLY_CLIENT_SECRET=your_calendly_client_secret
EXPO_PUBLIC_CALENDLY_REDIRECT_URI=https://your-flynn-domain.com/integrations/calendly/callback
```

#### 3. Connect in Flynn AI
1. Settings → Integrations → Connect Calendly
2. Sign in and authorize
3. AI will check your Calendly availability before booking
4. Appointments sync automatically

---

## Database Schema

### integration_connections
Stores OAuth credentials and connection status.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| org_id | UUID | Organization ID |
| provider | TEXT | jobber, fergus, servicetitan, etc. |
| type | TEXT | field_service, calendar, accounting |
| status | TEXT | connected, disconnected, error, expired |
| access_token | TEXT | OAuth access token (encrypted) |
| refresh_token | TEXT | OAuth refresh token |
| token_expires_at | TIMESTAMPTZ | Token expiration |
| account_id | TEXT | External account ID |
| account_name | TEXT | External account name |
| metadata | JSONB | Additional provider-specific data |
| last_sync_at | TIMESTAMPTZ | Last successful sync |

### integration_entity_mappings
Maps Flynn entities to external platform IDs.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| provider | TEXT | Platform identifier |
| entity_type | TEXT | job, client, event, invoice |
| flynn_entity_id | UUID | Flynn AI entity ID |
| external_entity_id | TEXT | External platform entity ID |
| flynn_updated_at | TIMESTAMPTZ | Last update in Flynn |
| external_updated_at | TIMESTAMPTZ | Last update externally |
| last_synced_at | TIMESTAMPTZ | Last successful sync |

### integration_sync_logs
Audit log of all sync operations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| connection_id | UUID | Related connection |
| sync_type | TEXT | push, pull, bidirectional |
| entity_type | TEXT | job, client, event, invoice |
| status | TEXT | success, failure, partial |
| records_synced | INTEGER | Number of records synced |
| error_message | TEXT | Error details if failed |
| sync_duration_ms | INTEGER | Sync time in milliseconds |

### integration_sync_conflicts
Tracks conflicts during two-way sync.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| connection_id | UUID | Related connection |
| entity_type | TEXT | job, client |
| flynn_entity_id | UUID | Flynn AI entity |
| external_entity_id | TEXT | External entity |
| conflict_type | TEXT | update_conflict, delete_conflict, duplicate |
| flynn_data | JSONB | Flynn's version |
| external_data | JSONB | External platform's version |
| resolution_strategy | TEXT | flynn_wins, external_wins, manual, merge |
| resolved | BOOLEAN | Conflict resolved? |

---

## Sync Behavior

### Real-Time Sync (Push)
When a job is created from a missed call:
1. Job saved in Flynn AI database
2. Webhook triggers sync to connected platform(s)
3. Job created in external system (Jobber/Fergus/ServiceTitan)
4. Mapping saved (Flynn ID ↔ External ID)
5. User sees job in both systems immediately

### Periodic Sync (Pull)
Every 15 minutes:
1. Fetch updates from external platform
2. Compare with Flynn's local data
3. Apply updates if external data is newer
4. Log sync operation and conflicts

### Conflict Resolution
When both systems have updates:
1. **Last-write-wins** (default): Most recent change wins
2. **Flynn-wins**: Always prefer Flynn's data
3. **External-wins**: Always prefer external data
4. **Manual**: User resolves conflict in UI
5. **Merge**: Combine changes intelligently

---

## Testing & Validation

### Test Checklist

**Jobber:**
- [ ] OAuth connection successful
- [ ] Client created in Jobber from Flynn contact
- [ ] Job created in Jobber from Flynn job
- [ ] Job updates sync back to Flynn
- [ ] Disconnection works properly

**Fergus:**
- [ ] API key connection successful
- [ ] Job creation works
- [ ] Contact syncing works
- [ ] Two-way sync functioning

**ServiceTitan:**
- [ ] OAuth connection successful
- [ ] Customer creation works
- [ ] Job booking works
- [ ] Tenant ID correctly configured

**Google Calendar:**
- [ ] OAuth connection successful
- [ ] Calendar event creation works
- [ ] Availability checking works
- [ ] Event updates sync

---

## Troubleshooting

### Issue: "OAuth connection failed"
**Solution:**
- Verify Client ID and Client Secret are correct
- Check redirect URI matches exactly (including https://)
- Ensure account has proper permissions

### Issue: "Token expired"
**Solution:**
- Flynn AI automatically refreshes tokens
- If persists, disconnect and reconnect integration
- Check token_expires_at in database

### Issue: "Job not syncing"
**Solution:**
- Check connection status in Settings
- View sync logs: `SELECT * FROM integration_sync_logs ORDER BY created_at DESC`
- Verify entity mapping exists
- Check API rate limits not exceeded

### Issue: "Duplicate clients/jobs"
**Solution:**
- Flynn matches by email/phone before creating
- If duplicates exist, use conflict resolution UI
- Merge duplicates manually in external platform

---

## API Rate Limits

| Platform | Rate Limit | Strategy |
|----------|------------|----------|
| Jobber | 10 req/sec | Queued requests |
| Fergus | 60 req/min | Exponential backoff |
| ServiceTitan | 500 req/5min | Request batching |
| Google Calendar | 500 req/100sec | Caching + batching |
| Calendly | 100 req/min | Smart polling |

---

## Security

- OAuth tokens encrypted at rest in database
- RLS policies enforce org-level access control
- Tokens automatically refreshed before expiration
- No credentials stored in frontend code
- All API calls from backend only (except OAuth initiation)

---

## Roadmap

**Phase 2 (Current):**
- ✅ Jobber integration
- ⏳ Fergus integration
- ⏳ ServiceTitan integration

**Phase 3:**
- ⏳ Google Calendar integration
- ⏳ Apple Calendar / CalDAV
- ⏳ Calendly availability checking

**Future:**
- MYOB / QuickBooks / Xero (accounting)
- Slack / Microsoft Teams (notifications)
- Zapier (custom workflows)

---

## Support

- Integration issues: Check sync logs first
- API errors: Review provider documentation
- Flynn AI support: https://flynn.ai/support
- Developer docs: https://docs.flynn.ai/integrations

Last updated: 2025-01-27
