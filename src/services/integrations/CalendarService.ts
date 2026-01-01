/**
 * Google Calendar Integration Service
 *
 * Handles OAuth authentication and calendar synchronization with Google Calendar.
 * Features:
 * - OAuth 2.0 flow for calendar access
 * - Create booking events in Google Calendar
 * - Check availability to prevent double-booking
 * - Sync booking confirmations/cancellations
 *
 * API Documentation: https://developers.google.com/calendar/api/v3/reference
 */

import { supabase } from '../supabase';
import {
  IntegrationConnection,
} from '../../types/integrations';
import { OrganizationService } from '../organizationService';

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Environment variables (add to .env.example)
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET; // Backend only!
const GOOGLE_REDIRECT_URI = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI;

export class CalendarServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'CalendarServiceError';
  }
}

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string; // ISO 8601 format: 2024-01-15T09:00:00-07:00
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
}

export interface AvailabilitySlot {
  start: string; // ISO 8601 timestamp
  end: string;
  available: boolean;
}

class CalendarServiceClass {
  /**
   * Get OAuth authorization URL for user to connect Google Calendar
   */
  getAuthorizationUrl(state?: string): string {
    if (!GOOGLE_CLIENT_ID) {
      throw new CalendarServiceError(
        'Google Calendar integration not configured',
        'CONFIG_ERROR',
        500
      );
    }

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI || '',
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly', // Read calendar events
        'https://www.googleapis.com/auth/calendar.events',  // Create/update events
      ].join(' '),
      access_type: 'offline', // Get refresh token
      prompt: 'consent',      // Force consent screen to ensure refresh token
      state: state || '',
    });

    return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new CalendarServiceError(
        'Google Calendar integration not configured',
        'CONFIG_ERROR',
        500
      );
    }

    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI || '',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new CalendarServiceError(
          `Failed to exchange code: ${error.error_description || error.error}`,
          'TOKEN_EXCHANGE_FAILED',
          response.status
        );
      }

      const data = await response.json();
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    } catch (error) {
      if (error instanceof CalendarServiceError) throw error;
      throw new CalendarServiceError(
        'Failed to exchange authorization code',
        'TOKEN_EXCHANGE_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new CalendarServiceError(
        'Google Calendar integration not configured',
        'CONFIG_ERROR',
        500
      );
    }

    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
        }),
      });

      if (!response.ok) {
        throw new CalendarServiceError(
          'Failed to refresh token',
          'TOKEN_REFRESH_FAILED',
          response.status
        );
      }

      const data = await response.json();
      return {
        access_token: data.access_token,
        expires_in: data.expires_in,
      };
    } catch (error) {
      if (error instanceof CalendarServiceError) throw error;
      throw new CalendarServiceError(
        'Failed to refresh access token',
        'TOKEN_REFRESH_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Save connection credentials to database
   */
  async saveConnection(
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): Promise<IntegrationConnection> {
    try {
      const { orgId } = await OrganizationService.fetchOnboardingData();
      if (!orgId) {
        throw new CalendarServiceError(
          'Organization not found',
          'ORG_NOT_FOUND',
          404
        );
      }

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Get primary calendar info
      const calendarInfo = await this.getCalendarInfo(accessToken);

      const { data, error } = await supabase
        .from('integration_connections')
        .upsert({
          org_id: orgId,
          provider: 'google_calendar',
          type: 'calendar',
          status: 'connected',
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          account_id: calendarInfo.id,
          account_name: calendarInfo.summary,
          metadata: calendarInfo,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new CalendarServiceError(
          'Failed to save connection',
          'DB_ERROR',
          500,
          error
        );
      }

      return data as IntegrationConnection;
    } catch (error) {
      if (error instanceof CalendarServiceError) throw error;
      throw new CalendarServiceError(
        'Failed to save Google Calendar connection',
        'SAVE_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Get current connection for organization
   */
  async getConnection(): Promise<IntegrationConnection | null> {
    try {
      const { orgId } = await OrganizationService.fetchOnboardingData();
      if (!orgId) return null;

      const { data, error } = await supabase
        .from('integration_connections')
        .select('*')
        .eq('org_id', orgId)
        .eq('provider', 'google_calendar')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new CalendarServiceError(
          'Failed to get connection',
          'DB_ERROR',
          500,
          error
        );
      }

      return data as IntegrationConnection | null;
    } catch (error) {
      if (error instanceof CalendarServiceError) throw error;
      return null;
    }
  }

  /**
   * Disconnect Google Calendar integration
   */
  async disconnect(): Promise<void> {
    try {
      const connection = await this.getConnection();
      if (!connection) return;

      const { error } = await supabase
        .from('integration_connections')
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('id', connection.id);

      if (error) {
        throw new CalendarServiceError(
          'Failed to disconnect',
          'DB_ERROR',
          500,
          error
        );
      }
    } catch (error) {
      if (error instanceof CalendarServiceError) throw error;
      throw new CalendarServiceError(
        'Failed to disconnect Google Calendar',
        'DISCONNECT_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  private async getValidAccessToken(): Promise<string> {
    const connection = await this.getConnection();
    if (!connection || connection.status !== 'connected') {
      throw new CalendarServiceError(
        'Google Calendar not connected',
        'NOT_CONNECTED',
        401
      );
    }

    // Check if token is expired
    if (
      connection.token_expires_at &&
      new Date(connection.token_expires_at) < new Date()
    ) {
      // Refresh token
      const refreshed = await this.refreshAccessToken(
        connection.refresh_token!
      );
      await this.saveConnection(
        refreshed.access_token,
        connection.refresh_token!,
        refreshed.expires_in
      );
      return refreshed.access_token;
    }

    return connection.access_token!;
  }

  /**
   * Get primary calendar information
   */
  private async getCalendarInfo(accessToken: string): Promise<{
    id: string;
    summary: string;
    timeZone: string;
  }> {
    try {
      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new CalendarServiceError(
          `Failed to get calendar info: ${response.status}`,
          'API_ERROR',
          response.status
        );
      }

      const data = await response.json();
      return {
        id: data.id,
        summary: data.summary,
        timeZone: data.timeZone,
      };
    } catch (error) {
      if (error instanceof CalendarServiceError) throw error;
      throw new CalendarServiceError(
        'Failed to get calendar info',
        'API_REQUEST_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Check availability for a given time range
   * This prevents double-booking by checking existing Google Calendar events
   */
  async checkAvailability(
    startTime: string,
    endTime: string,
    timeZone: string = 'UTC'
  ): Promise<boolean> {
    try {
      const accessToken = await this.getValidAccessToken();

      // Use freebusy query to check availability
      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/freeBusy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeMin: startTime,
            timeMax: endTime,
            timeZone: timeZone,
            items: [{ id: 'primary' }],
          }),
        }
      );

      if (!response.ok) {
        throw new CalendarServiceError(
          `Failed to check availability: ${response.status}`,
          'API_ERROR',
          response.status
        );
      }

      const data = await response.json();
      const busySlots = data.calendars?.primary?.busy || [];

      // If there are any busy slots, the time is not available
      return busySlots.length === 0;
    } catch (error) {
      console.error('Failed to check calendar availability:', error);
      // On error, default to available to avoid blocking bookings
      // Log error for monitoring
      return true;
    }
  }

  /**
   * Get available time slots for a given date range
   */
  async getAvailableSlots(
    startDate: string,
    endDate: string,
    slotDuration: number = 60, // minutes
    timeZone: string = 'UTC'
  ): Promise<AvailabilitySlot[]> {
    try {
      const accessToken = await this.getValidAccessToken();

      // Get busy periods
      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/freeBusy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeMin: startDate,
            timeMax: endDate,
            timeZone: timeZone,
            items: [{ id: 'primary' }],
          }),
        }
      );

      if (!response.ok) {
        throw new CalendarServiceError(
          `Failed to get busy times: ${response.status}`,
          'API_ERROR',
          response.status
        );
      }

      const data = await response.json();
      const busySlots = data.calendars?.primary?.busy || [];

      // Convert busy slots to availability slots
      // This is a simplified implementation - full version would need to:
      // 1. Split date range into slots based on slotDuration
      // 2. Check each slot against busy times
      // 3. Respect business hours from booking page settings

      const availableSlots: AvailabilitySlot[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      let current = new Date(start);
      while (current < end) {
        const slotStart = new Date(current);
        const slotEnd = new Date(current.getTime() + slotDuration * 60000);

        const isAvailable = !busySlots.some((busy: { start: string; end: string }) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return (slotStart < busyEnd && slotEnd > busyStart);
        });

        availableSlots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          available: isAvailable,
        });

        current = slotEnd;
      }

      return availableSlots;
    } catch (error) {
      console.error('Failed to get available slots:', error);
      return [];
    }
  }

  /**
   * Create a booking event in Google Calendar
   */
  async createEvent(event: CalendarEvent): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      const accessToken = await this.getValidAccessToken();

      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || `API error: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        eventId: data.id,
      };
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(eventId: string, event: Partial<CalendarEvent>): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await this.getValidAccessToken();

      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || `API error: ${response.status}`,
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await this.getValidAccessToken();

      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok && response.status !== 204) {
        return {
          success: false,
          error: `Failed to delete event: ${response.status}`,
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const CalendarService = new CalendarServiceClass();
