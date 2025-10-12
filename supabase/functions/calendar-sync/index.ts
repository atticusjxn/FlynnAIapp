import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Calendar Sync Edge Function
 * Triggered by cron job every 15 minutes to sync calendar events
 * Endpoint: POST /functions/v1/calendar-sync
 */

interface CalendarIntegration {
  id: string;
  user_id: string;
  provider: 'google' | 'apple' | 'outlook';
  calendar_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  is_active: boolean;
  sync_enabled: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decrypt token (matches server.js encryption)
function decryptToken(encryptedToken: string, encryptionKey: string): string | null {
  if (!encryptedToken) return null;

  const parts = encryptedToken.split(':');
  if (parts.length !== 3) return null;

  // For Edge Functions, we'll use Web Crypto API
  // This is a simplified version - in production you'd want proper decryption
  // For now, we'll call the server endpoint to get decrypted tokens
  return null;
}

async function getAccessToken(integrationId: string, serverUrl: string, serviceKey: string): Promise<string> {
  try {
    const response = await fetch(`${serverUrl}/calendar/integrations/${integrationId}/token`, {
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get access token');
    }

    const { accessToken } = await response.json();
    return accessToken;
  } catch (error) {
    console.error('[CalendarSync] Failed to get access token', error);
    throw error;
  }
}

async function syncGoogleCalendar(
  integration: CalendarIntegration,
  accessToken: string,
  supabase: any
): Promise<{ syncedCount: number; errors: any[] }> {
  try {
    // Fetch events from Google Calendar (next 30 days)
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendar_id)}/events`);
    url.searchParams.set('timeMin', now.toISOString());
    url.searchParams.set('timeMax', futureDate.toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Google Calendar events: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const googleEvents = data.items || [];

    console.log('[CalendarSync] Fetched Google events', {
      integrationId: integration.id,
      eventCount: googleEvents.length,
    });

    // Upsert events into Flynn database
    let syncedCount = 0;
    const errors = [];

    for (const gEvent of googleEvents) {
      try {
        const eventData = {
          user_id: integration.user_id,
          integration_id: integration.id,
          external_event_id: gEvent.id,
          title: gEvent.summary || 'Untitled Event',
          description: gEvent.description || null,
          location: gEvent.location || null,
          start_time: gEvent.start.dateTime || gEvent.start.date,
          end_time: gEvent.end.dateTime || gEvent.end.date,
          source: 'google',
        };

        const { error: upsertError } = await supabase
          .from('calendar_events')
          .upsert(eventData, {
            onConflict: 'integration_id,external_event_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          errors.push({ eventId: gEvent.id, error: upsertError.message });
          console.error('[CalendarSync] Failed to upsert event', {
            eventId: gEvent.id,
            error: upsertError,
          });
        } else {
          syncedCount++;
        }
      } catch (eventError: any) {
        errors.push({ eventId: gEvent.id, error: eventError.message });
        console.error('[CalendarSync] Error processing event', eventError);
      }
    }

    return { syncedCount, errors };
  } catch (error) {
    console.error('[CalendarSync] Google Calendar sync failed', error);
    throw error;
  }
}

async function syncCalendarIntegration(
  integration: CalendarIntegration,
  supabase: any,
  serverUrl: string,
  serviceKey: string
): Promise<any> {
  console.log('[CalendarSync] Starting sync', {
    integrationId: integration.id,
    provider: integration.provider,
    userId: integration.user_id,
  });

  try {
    if (!integration.sync_enabled) {
      return {
        success: false,
        message: 'Sync is disabled for this integration',
      };
    }

    // Get access token via server endpoint (handles decryption and refresh)
    const accessToken = await getAccessToken(integration.id, serverUrl, serviceKey);

    let result = { syncedCount: 0, errors: [] };

    if (integration.provider === 'google') {
      result = await syncGoogleCalendar(integration, accessToken, supabase);
    } else if (integration.provider === 'apple') {
      return {
        success: false,
        message: 'Apple Calendar sync is handled by the mobile app',
      };
    } else {
      return {
        success: false,
        message: `Unsupported provider: ${integration.provider}`,
      };
    }

    // Update last_synced_at
    await supabase
      .from('calendar_integrations')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_error: result.errors.length > 0 ? `${result.errors.length} events failed to sync` : null,
      })
      .eq('id', integration.id);

    console.log('[CalendarSync] Sync completed', {
      integrationId: integration.id,
      syncedCount: result.syncedCount,
      errorCount: result.errors.length,
    });

    return {
      success: true,
      syncedCount: result.syncedCount,
      errors: result.errors,
    };
  } catch (error: any) {
    console.error('[CalendarSync] Sync failed', {
      integrationId: integration.id,
      error: error.message,
    });

    // Update sync_error in database
    await supabase
      .from('calendar_integrations')
      .update({
        sync_error: error.message,
      })
      .eq('id', integration.id);

    return {
      success: false,
      error: error.message,
    };
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authorization (cron secret or service role key)
    const authHeader = req.headers.get('authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Check if it's from cron or authorized request
    const token = authHeader.replace('Bearer ', '');
    if (cronSecret && token !== cronSecret && token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      throw new Error('Unauthorized');
    }

    console.log('[CalendarSync] Starting sync for all active integrations');

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get all active integrations
    const { data: integrations, error } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('is_active', true)
      .eq('sync_enabled', true);

    if (error) {
      throw new Error(`Failed to fetch integrations: ${error.message}`);
    }

    if (!integrations || integrations.length === 0) {
      console.log('[CalendarSync] No active integrations to sync');
      return new Response(
        JSON.stringify({
          success: true,
          syncedIntegrations: 0,
          results: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('[CalendarSync] Found integrations to sync', {
      count: integrations.length,
    });

    const serverUrl = Deno.env.get('SERVER_PUBLIC_URL') || 'http://localhost:3000';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Sync each integration
    const results = [];

    for (const integration of integrations) {
      try {
        const result = await syncCalendarIntegration(integration, supabase, serverUrl, serviceKey);
        results.push({
          integrationId: integration.id,
          provider: integration.provider,
          ...result,
        });
      } catch (error: any) {
        results.push({
          integrationId: integration.id,
          provider: integration.provider,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalEvents = results.reduce((sum, r) => sum + (r.syncedCount || 0), 0);

    console.log('[CalendarSync] Batch sync completed', {
      totalIntegrations: integrations.length,
      successfulSyncs: successCount,
      totalEventsSynced: totalEvents,
    });

    return new Response(
      JSON.stringify({
        success: true,
        syncedIntegrations: successCount,
        totalEvents,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[CalendarSync] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
