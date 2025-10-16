const { createClient } = require('@supabase/supabase-js');
const { addDays, parseISO } = require('date-fns');

/**
 * Calendar Sync Service
 * Handles background synchronization of calendar events from external providers
 * Called by cron jobs and manual sync requests
 */

let supabaseClient = null;

const initializeSupabase = () => {
  if (!supabaseClient && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return supabaseClient;
};

/**
 * Get decrypted access token for an integration
 */
const getAccessToken = async (integrationId) => {
  const supabase = initializeSupabase();

  const { data: integration, error } = await supabase
    .from('calendar_integrations')
    .select('*')
    .eq('id', integrationId)
    .single();

  if (error || !integration) {
    throw new Error('Calendar integration not found');
  }

  // Check if we need the decryption - if using the /token endpoint from server
  // For now, we'll need to implement decryption here or call the server endpoint
  // Let's call the server endpoint for token management

  const serverUrl = process.env.SERVER_PUBLIC_URL || 'http://localhost:3000';

  try {
    const tokenResponse = await fetch(`${serverUrl}/calendar/integrations/${integrationId}/token`, {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token');
    }

    const { accessToken } = await tokenResponse.json();
    return accessToken;
  } catch (error) {
    console.error('[CalendarSync] Failed to get access token', error);
    throw error;
  }
};

/**
 * Sync events from Google Calendar
 */
const syncGoogleCalendar = async (integration, accessToken) => {
  const supabase = initializeSupabase();

  try {
    // Fetch events from Google Calendar (next 30 days)
    const now = new Date();
    const futureDate = addDays(now, 30);

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendar_id)}/events?` +
        new URLSearchParams({
          timeMin: now.toISOString(),
          timeMax: futureDate.toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
        }),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

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
      } catch (eventError) {
        errors.push({ eventId: gEvent.id, error: eventError.message });
        console.error('[CalendarSync] Error processing event', eventError);
      }
    }

    return { syncedCount, errors };
  } catch (error) {
    console.error('[CalendarSync] Google Calendar sync failed', error);
    throw error;
  }
};

/**
 * Sync a single calendar integration
 */
const syncCalendarIntegration = async (integration) => {
  const supabase = initializeSupabase();

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

    // Get access token
    const accessToken = await getAccessToken(integration.id);

    let result = { syncedCount: 0, errors: [] };

    if (integration.provider === 'google') {
      result = await syncGoogleCalendar(integration, accessToken);
    } else if (integration.provider === 'apple') {
      // Apple Calendar is synced directly from device, not via backend
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
  } catch (error) {
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
};

/**
 * Sync all active calendar integrations
 * Called by cron job
 */
const syncAllCalendars = async () => {
  const supabase = initializeSupabase();

  console.log('[CalendarSync] Starting sync for all active integrations');

  try {
    // Get all active integrations that need syncing
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
      return {
        success: true,
        syncedIntegrations: 0,
        results: [],
      };
    }

    console.log('[CalendarSync] Found integrations to sync', {
      count: integrations.length,
    });

    // Sync each integration
    const results = [];

    for (const integration of integrations) {
      try {
        const result = await syncCalendarIntegration(integration);
        results.push({
          integrationId: integration.id,
          provider: integration.provider,
          ...result,
        });
      } catch (error) {
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

    return {
      success: true,
      syncedIntegrations: successCount,
      totalEvents,
      results,
    };
  } catch (error) {
    console.error('[CalendarSync] Batch sync failed', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  syncCalendarIntegration,
  syncAllCalendars,
};
