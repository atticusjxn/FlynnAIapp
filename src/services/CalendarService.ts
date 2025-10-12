import * as Calendar from 'expo-calendar';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { apiRequest } from './apiClient';

/**
 * CalendarService
 * Handles calendar integration with Google Calendar and device calendar (Apple Calendar)
 * Syncs events to Flynn's database for AI receptionist availability awareness
 */

export interface CalendarIntegration {
  id: string;
  user_id: string;
  provider: 'google' | 'apple' | 'outlook';
  calendar_id: string;
  is_active: boolean;
  sync_enabled: boolean;
  last_synced_at?: string;
  sync_error?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  integration_id?: string;
  external_event_id?: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string; // ISO timestamp
  end_time: string; // ISO timestamp
  source: 'flynn' | 'google' | 'apple' | 'outlook';
  job_id?: string;
  client_id?: string;
  reminder_minutes?: number;
}

export const CalendarService = {
  /**
   * Request calendar permissions (iOS/Android device calendar)
   */
  async requestCalendarPermissions(): Promise<boolean> {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[CalendarService] Failed to request calendar permissions', error);
      return false;
    }
  },

  /**
   * Connect to Google Calendar via OAuth
   */
  async connectGoogleCalendar(): Promise<CalendarIntegration | null> {
    try {
      // Configure Google Sign-In
      GoogleSignin.configure({
        scopes: [
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar.events',
        ],
        webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
      });

      // Sign in and get tokens
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();

      if (!tokens.accessToken) {
        throw new Error('Failed to obtain Google access token');
      }

      // Get user's calendar list
      const calendars = await this.getGoogleCalendars(tokens.accessToken);
      const primaryCalendar = calendars.find(cal => cal.primary) || calendars[0];

      if (!primaryCalendar) {
        throw new Error('No Google Calendar found');
      }

      // Store integration in database via backend (to encrypt tokens)
      const integration = await apiRequest<CalendarIntegration>('/calendar/integrations', {
        method: 'POST',
        body: {
          provider: 'google',
          calendar_id: primaryCalendar.id,
          access_token: tokens.accessToken,
          refresh_token: tokens.idToken, // Note: Google Sign-In uses idToken for refresh
        },
      });

      // Trigger initial sync
      await this.syncCalendar(integration.id);

      return integration;
    } catch (error) {
      console.error('[CalendarService] Failed to connect Google Calendar', error);
      return null;
    }
  },

  /**
   * Get list of Google Calendars
   */
  async getGoogleCalendars(accessToken: string): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
    try {
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch calendars: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('[CalendarService] Failed to get Google calendars', error);
      return [];
    }
  },

  /**
   * Connect to device calendar (Apple Calendar on iOS)
   */
  async connectDeviceCalendar(): Promise<CalendarIntegration | null> {
    try {
      const hasPermission = await this.requestCalendarPermissions();
      if (!hasPermission) {
        throw new Error('Calendar permission not granted');
      }

      // Get default calendar
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(cal => cal.isPrimary) || calendars[0];

      if (!defaultCalendar) {
        throw new Error('No device calendar found');
      }

      // Store integration in database
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: integration, error } = await supabase
        .from('calendar_integrations')
        .insert({
          user_id: user.id,
          provider: 'apple',
          calendar_id: defaultCalendar.id,
          is_active: true,
          sync_enabled: true,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Trigger initial sync
      await this.syncCalendar(integration.id);

      return integration;
    } catch (error) {
      console.error('[CalendarService] Failed to connect device calendar', error);
      return null;
    }
  },

  /**
   * Sync calendar events from external calendar to Flynn database
   */
  async syncCalendar(integrationId: string): Promise<{ success: boolean; eventsSynced?: number; error?: string }> {
    try {
      const { data: integration, error: fetchError } = await supabase
        .from('calendar_integrations')
        .select('*')
        .eq('id', integrationId)
        .single();

      if (fetchError || !integration) {
        throw new Error('Calendar integration not found');
      }

      if (!integration.sync_enabled) {
        return { success: false, error: 'Sync is disabled for this integration' };
      }

      let events: CalendarEvent[] = [];

      if (integration.provider === 'google') {
        events = await this.syncGoogleCalendarEvents(integration);
      } else if (integration.provider === 'apple') {
        events = await this.syncDeviceCalendarEvents(integration);
      }

      // Update last_synced_at
      await supabase
        .from('calendar_integrations')
        .update({
          last_synced_at: new Date().toISOString(),
          sync_error: null,
        })
        .eq('id', integrationId);

      return { success: true, eventsSynced: events.length };
    } catch (error) {
      console.error('[CalendarService] Calendar sync failed', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update sync error
      await supabase
        .from('calendar_integrations')
        .update({ sync_error: errorMessage })
        .eq('id', integrationId);

      return { success: false, error: errorMessage };
    }
  },

  /**
   * Sync events from Google Calendar
   */
  async syncGoogleCalendarEvents(integration: CalendarIntegration): Promise<CalendarEvent[]> {
    try {
      // Get fresh access token from backend (handles token refresh)
      const tokenData = await apiRequest<{ accessToken: string }>(`/calendar/integrations/${integration.id}/token`, {
        method: 'GET',
      });

      // Fetch events from Google Calendar (next 30 days)
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

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
            Authorization: `Bearer ${tokenData.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch Google Calendar events: ${response.statusText}`);
      }

      const data = await response.json();
      const googleEvents = data.items || [];

      // Upsert events into Flynn database
      const events: CalendarEvent[] = [];
      for (const gEvent of googleEvents) {
        const event = await this.upsertCalendarEvent({
          user_id: integration.user_id,
          integration_id: integration.id,
          external_event_id: gEvent.id,
          title: gEvent.summary || 'Untitled Event',
          description: gEvent.description,
          location: gEvent.location,
          start_time: gEvent.start.dateTime || gEvent.start.date,
          end_time: gEvent.end.dateTime || gEvent.end.date,
          source: 'google',
        });

        if (event) {
          events.push(event);
        }
      }

      return events;
    } catch (error) {
      console.error('[CalendarService] Failed to sync Google Calendar events', error);
      throw error;
    }
  },

  /**
   * Sync events from device calendar (Apple Calendar)
   */
  async syncDeviceCalendarEvents(integration: CalendarIntegration): Promise<CalendarEvent[]> {
    try {
      const hasPermission = await this.requestCalendarPermissions();
      if (!hasPermission) {
        throw new Error('Calendar permission not granted');
      }

      // Fetch events from device calendar (next 30 days)
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const deviceEvents = await Calendar.getEventsAsync(
        [integration.calendar_id],
        now,
        futureDate
      );

      // Upsert events into Flynn database
      const events: CalendarEvent[] = [];
      for (const dEvent of deviceEvents) {
        const event = await this.upsertCalendarEvent({
          user_id: integration.user_id,
          integration_id: integration.id,
          external_event_id: dEvent.id,
          title: dEvent.title || 'Untitled Event',
          description: dEvent.notes,
          location: dEvent.location,
          start_time: dEvent.startDate,
          end_time: dEvent.endDate,
          source: 'apple',
        });

        if (event) {
          events.push(event);
        }
      }

      return events;
    } catch (error) {
      console.error('[CalendarService] Failed to sync device calendar events', error);
      throw error;
    }
  },

  /**
   * Upsert calendar event (create or update if already exists)
   */
  async upsertCalendarEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .upsert(
          {
            user_id: event.user_id,
            integration_id: event.integration_id,
            external_event_id: event.external_event_id,
            title: event.title,
            description: event.description,
            location: event.location,
            start_time: event.start_time,
            end_time: event.end_time,
            source: event.source,
            job_id: event.job_id,
            client_id: event.client_id,
            reminder_minutes: event.reminder_minutes,
          },
          {
            onConflict: 'integration_id,external_event_id',
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (error) {
        console.error('[CalendarService] Failed to upsert calendar event', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[CalendarService] Error upserting calendar event', error);
      return null;
    }
  },

  /**
   * Get all calendar integrations for current user
   */
  async listIntegrations(): Promise<CalendarIntegration[]> {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('calendar_integrations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('[CalendarService] Failed to list integrations', error);
      return [];
    }
  },

  /**
   * Disconnect calendar integration
   */
  async disconnectCalendar(integrationId: string): Promise<boolean> {
    try {
      // Delete the integration (cascade will delete associated events)
      const { error } = await supabase
        .from('calendar_integrations')
        .delete()
        .eq('id', integrationId);

      if (error) {
        throw new Error(error.message);
      }

      // If it was Google Calendar, sign out
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        await GoogleSignin.signOut();
      }

      return true;
    } catch (error) {
      console.error('[CalendarService] Failed to disconnect calendar', error);
      return false;
    }
  },

  /**
   * Toggle sync for a calendar integration
   */
  async toggleSync(integrationId: string, enabled: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('calendar_integrations')
        .update({ sync_enabled: enabled })
        .eq('id', integrationId);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error('[CalendarService] Failed to toggle sync', error);
      return false;
    }
  },
};

export default CalendarService;
