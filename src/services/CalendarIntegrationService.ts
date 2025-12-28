// Calendar Integration Service
// Handles Google Calendar OAuth and calendar event management

import { supabase } from './supabase';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}

interface GoogleCalendarBusyTime {
  start: string; // ISO datetime
  end: string; // ISO datetime
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

class CalendarIntegrationService {
  private clientId = process.env.GOOGLE_CLIENT_ID || '';
  private clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  private redirectUri = AuthSession.makeRedirectUri({
    scheme: 'flynnai',
    path: 'auth/google/callback'
  });

  /**
   * Initialize Google Calendar OAuth flow
   */
  async initiateGoogleAuth(orgId: string): Promise<void> {
    const discovery = {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    };

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
      {
        clientId: this.clientId,
        scopes: [
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar.events',
        ],
        redirectUri: this.redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        extraParams: {
          access_type: 'offline', // Request refresh token
          prompt: 'consent', // Force consent to get refresh token
        },
      },
      discovery
    );

    const result = await promptAsync();

    if (result.type === 'success') {
      const { code } = result.params;

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code, request?.codeVerifier);

      // Get user's calendar list
      const calendars = await this.fetchCalendarList(tokens.access_token);

      // Get primary calendar ID
      const primaryCalendar = calendars.find((cal: any) => cal.primary);
      const calendarId = primaryCalendar?.id || 'primary';

      // Save tokens to booking_pages
      await this.saveGoogleCalendarCredentials(
        orgId,
        calendarId,
        tokens.access_token,
        tokens.refresh_token
      );
    }
  }

  /**
   * Exchange authorization code for access/refresh tokens
   */
  private async exchangeCodeForTokens(
    code: string,
    codeVerifier?: string
  ): Promise<GoogleTokenResponse> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        ...(codeVerifier && { code_verifier: codeVerifier }),
      }).toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    return await response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Save Google Calendar credentials to database
   */
  private async saveGoogleCalendarCredentials(
    orgId: string,
    calendarId: string,
    accessToken: string,
    refreshToken?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('booking_pages')
      .update({
        google_calendar_id: calendarId,
        google_calendar_refresh_token: refreshToken,
      })
      .eq('org_id', orgId);

    if (error) throw error;
  }

  /**
   * Get access token for calendar operations (handles refresh if needed)
   */
  async getAccessToken(orgId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('booking_pages')
      .select('google_calendar_refresh_token')
      .eq('org_id', orgId)
      .single();

    if (error || !data?.google_calendar_refresh_token) {
      return null;
    }

    // Refresh and return new access token
    return await this.refreshAccessToken(data.google_calendar_refresh_token);
  }

  /**
   * Fetch list of user's calendars
   */
  private async fetchCalendarList(accessToken: string): Promise<any[]> {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch calendar list');
    }

    const data = await response.json();
    return data.items || [];
  }

  /**
   * Get busy times from Google Calendar (freebusy API)
   */
  async getGoogleCalendarBusyTimes(
    orgId: string,
    startDate: Date,
    endDate: Date
  ): Promise<GoogleCalendarBusyTime[]> {
    try {
      // Get booking page config
      const { data: bookingPage } = await supabase
        .from('booking_pages')
        .select('google_calendar_id')
        .eq('org_id', orgId)
        .single();

      if (!bookingPage?.google_calendar_id) {
        return [];
      }

      // Get fresh access token
      const accessToken = await this.getAccessToken(orgId);
      if (!accessToken) {
        console.warn('No access token available for Google Calendar');
        return [];
      }

      // Call freebusy API
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            items: [{ id: bookingPage.google_calendar_id }],
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch busy times from Google Calendar');
      }

      const data = await response.json();
      const busyTimes = data.calendars?.[bookingPage.google_calendar_id]?.busy || [];

      return busyTimes.map((busy: any) => ({
        start: busy.start,
        end: busy.end,
      }));
    } catch (error) {
      console.error('Error fetching Google Calendar busy times:', error);
      return [];
    }
  }

  /**
   * Create event in Google Calendar
   */
  async createGoogleCalendarEvent(
    orgId: string,
    eventDetails: {
      summary: string;
      description?: string;
      startTime: string; // ISO datetime
      endTime: string; // ISO datetime
      attendeeEmail?: string;
      attendeeName?: string;
    }
  ): Promise<string | null> {
    try {
      const { data: bookingPage } = await supabase
        .from('booking_pages')
        .select('google_calendar_id, timezone')
        .eq('org_id', orgId)
        .single();

      if (!bookingPage?.google_calendar_id) {
        throw new Error('No Google Calendar configured');
      }

      const accessToken = await this.getAccessToken(orgId);
      if (!accessToken) {
        throw new Error('No access token available');
      }

      const event: GoogleCalendarEvent = {
        id: '', // Will be set by Google
        summary: eventDetails.summary,
        description: eventDetails.description,
        start: {
          dateTime: eventDetails.startTime,
          timeZone: bookingPage.timezone || 'Australia/Sydney',
        },
        end: {
          dateTime: eventDetails.endTime,
          timeZone: bookingPage.timezone || 'Australia/Sydney',
        },
      };

      // Add attendee if provided
      const eventPayload: any = { ...event };
      if (eventDetails.attendeeEmail) {
        eventPayload.attendees = [
          {
            email: eventDetails.attendeeEmail,
            displayName: eventDetails.attendeeName,
            responseStatus: 'needsAction',
          },
        ];
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${bookingPage.google_calendar_id}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventPayload),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create Google Calendar event');
      }

      const createdEvent = await response.json();
      return createdEvent.id;
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      return null;
    }
  }

  /**
   * Update existing Google Calendar event
   */
  async updateGoogleCalendarEvent(
    orgId: string,
    eventId: string,
    updates: {
      summary?: string;
      description?: string;
      startTime?: string;
      endTime?: string;
    }
  ): Promise<boolean> {
    try {
      const { data: bookingPage } = await supabase
        .from('booking_pages')
        .select('google_calendar_id, timezone')
        .eq('org_id', orgId)
        .single();

      if (!bookingPage?.google_calendar_id) {
        throw new Error('No Google Calendar configured');
      }

      const accessToken = await this.getAccessToken(orgId);
      if (!accessToken) {
        throw new Error('No access token available');
      }

      const eventPayload: any = {};
      if (updates.summary) eventPayload.summary = updates.summary;
      if (updates.description) eventPayload.description = updates.description;
      if (updates.startTime) {
        eventPayload.start = {
          dateTime: updates.startTime,
          timeZone: bookingPage.timezone || 'Australia/Sydney',
        };
      }
      if (updates.endTime) {
        eventPayload.end = {
          dateTime: updates.endTime,
          timeZone: bookingPage.timezone || 'Australia/Sydney',
        };
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${bookingPage.google_calendar_id}/events/${eventId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventPayload),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      return false;
    }
  }

  /**
   * Delete Google Calendar event
   */
  async deleteGoogleCalendarEvent(
    orgId: string,
    eventId: string
  ): Promise<boolean> {
    try {
      const { data: bookingPage } = await supabase
        .from('booking_pages')
        .select('google_calendar_id')
        .eq('org_id', orgId)
        .single();

      if (!bookingPage?.google_calendar_id) {
        throw new Error('No Google Calendar configured');
      }

      const accessToken = await this.getAccessToken(orgId);
      if (!accessToken) {
        throw new Error('No access token available');
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${bookingPage.google_calendar_id}/events/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      return false;
    }
  }

  /**
   * Disconnect Google Calendar
   */
  async disconnectGoogleCalendar(orgId: string): Promise<void> {
    const { error } = await supabase
      .from('booking_pages')
      .update({
        google_calendar_id: null,
        google_calendar_refresh_token: null,
      })
      .eq('org_id', orgId);

    if (error) throw error;
  }
}

export default new CalendarIntegrationService();
