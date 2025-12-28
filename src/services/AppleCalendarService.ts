// Apple Calendar (CalDAV) Integration Service
// Handles Apple Calendar/iCloud Calendar integration via CalDAV protocol

import { supabase } from './supabase';

interface CalDAVEvent {
  uid: string;
  summary: string;
  description?: string;
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  location?: string;
}

interface AppleCalendarBusyTime {
  start: string; // ISO datetime
  end: string; // ISO datetime
}

class AppleCalendarService {
  // iCloud CalDAV server
  private readonly caldavServer = 'https://caldav.icloud.com';

  /**
   * Save Apple Calendar credentials
   */
  async connectAppleCalendar(
    orgId: string,
    appleId: string,
    appSpecificPassword: string,
    calendarId: string
  ): Promise<void> {
    // Verify credentials by attempting to fetch calendars
    const isValid = await this.verifyCredentials(appleId, appSpecificPassword);

    if (!isValid) {
      throw new Error('Invalid Apple ID or app-specific password');
    }

    const { error } = await supabase
      .from('booking_pages')
      .update({
        apple_calendar_id: calendarId,
        apple_calendar_username: appleId,
        apple_calendar_password: appSpecificPassword, // TODO: Encrypt this
      })
      .eq('org_id', orgId);

    if (error) throw error;
  }

  /**
   * Verify Apple Calendar credentials
   */
  private async verifyCredentials(
    appleId: string,
    appSpecificPassword: string
  ): Promise<boolean> {
    try {
      const calendars = await this.fetchCalendarList(appleId, appSpecificPassword);
      return calendars.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetch list of user's calendars via CalDAV
   */
  async fetchCalendarList(
    appleId: string,
    appSpecificPassword: string
  ): Promise<Array<{ name: string; url: string; id: string }>> {
    const principalUrl = `${this.caldavServer}/${appleId}/calendars/`;

    try {
      const response = await fetch(principalUrl, {
        method: 'PROPFIND',
        headers: {
          Authorization: this.getBasicAuthHeader(appleId, appSpecificPassword),
          'Content-Type': 'application/xml; charset=utf-8',
          Depth: '1',
        },
        body: `<?xml version="1.0" encoding="utf-8" ?>
          <D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
            <D:prop>
              <D:displayname />
              <D:resourcetype />
              <C:calendar-description />
            </D:prop>
          </D:propfind>`,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch calendars');
      }

      const xmlText = await response.text();
      return this.parseCalendarListXML(xmlText);
    } catch (error) {
      console.error('Error fetching Apple Calendar list:', error);
      throw error;
    }
  }

  /**
   * Parse CalDAV XML response to extract calendar list
   */
  private parseCalendarListXML(xml: string): Array<{ name: string; url: string; id: string }> {
    // Basic XML parsing (in production, use a proper XML parser)
    const calendars: Array<{ name: string; url: string; id: string }> = [];

    const displayNameRegex = /<D:displayname>([^<]+)<\/D:displayname>/g;
    const hrefRegex = /<D:href>([^<]+)<\/D:href>/g;

    const names = [...xml.matchAll(displayNameRegex)].map(m => m[1]);
    const hrefs = [...xml.matchAll(hrefRegex)].map(m => m[1]);

    for (let i = 0; i < Math.min(names.length, hrefs.length); i++) {
      if (hrefs[i].endsWith('/')) {
        const id = hrefs[i].split('/').filter(Boolean).pop() || '';
        calendars.push({
          name: names[i],
          url: hrefs[i],
          id,
        });
      }
    }

    return calendars;
  }

  /**
   * Get busy times from Apple Calendar
   */
  async getAppleCalendarBusyTimes(
    orgId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AppleCalendarBusyTime[]> {
    try {
      const { data: bookingPage } = await supabase
        .from('booking_pages')
        .select('apple_calendar_id, apple_calendar_username, apple_calendar_password')
        .eq('org_id', orgId)
        .single();

      if (!bookingPage?.apple_calendar_id || !bookingPage.apple_calendar_username) {
        return [];
      }

      const events = await this.fetchEvents(
        bookingPage.apple_calendar_username,
        bookingPage.apple_calendar_password,
        bookingPage.apple_calendar_id,
        startDate,
        endDate
      );

      return events.map(event => ({
        start: event.startTime,
        end: event.endTime,
      }));
    } catch (error) {
      console.error('Error fetching Apple Calendar busy times:', error);
      return [];
    }
  }

  /**
   * Fetch events from Apple Calendar via CalDAV
   */
  private async fetchEvents(
    appleId: string,
    appSpecificPassword: string,
    calendarId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalDAVEvent[]> {
    const calendarUrl = `${this.caldavServer}/${appleId}/calendars/${calendarId}/`;

    const response = await fetch(calendarUrl, {
      method: 'REPORT',
      headers: {
        Authorization: this.getBasicAuthHeader(appleId, appSpecificPassword),
        'Content-Type': 'application/xml; charset=utf-8',
        Depth: '1',
      },
      body: `<?xml version="1.0" encoding="utf-8" ?>
        <C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:">
          <D:prop>
            <D:getetag />
            <C:calendar-data />
          </D:prop>
          <C:filter>
            <C:comp-filter name="VCALENDAR">
              <C:comp-filter name="VEVENT">
                <C:time-range start="${this.formatCalDAVDate(startDate)}" end="${this.formatCalDAVDate(endDate)}"/>
              </C:comp-filter>
            </C:comp-filter>
          </C:filter>
        </C:calendar-query>`,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch events');
    }

    const xmlText = await response.text();
    return this.parseEventsXML(xmlText);
  }

  /**
   * Parse CalDAV VEVENT XML to extract event details
   */
  private parseEventsXML(xml: string): CalDAVEvent[] {
    const events: CalDAVEvent[] = [];

    // Extract iCalendar data from XML
    const calendarDataRegex = /<C:calendar-data><!\[CDATA\[([\s\S]*?)\]\]><\/C:calendar-data>/g;
    const matches = [...xml.matchAll(calendarDataRegex)];

    for (const match of matches) {
      const icalData = match[1];
      const event = this.parseICalEvent(icalData);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  /**
   * Parse iCalendar (VEVENT) format to extract event details
   */
  private parseICalEvent(icalData: string): CalDAVEvent | null {
    try {
      const uidMatch = icalData.match(/UID:([^\r\n]+)/);
      const summaryMatch = icalData.match(/SUMMARY:([^\r\n]+)/);
      const descriptionMatch = icalData.match(/DESCRIPTION:([^\r\n]+)/);
      const dtStartMatch = icalData.match(/DTSTART[^:]*:([^\r\n]+)/);
      const dtEndMatch = icalData.match(/DTEND[^:]*:([^\r\n]+)/);
      const locationMatch = icalData.match(/LOCATION:([^\r\n]+)/);

      if (!uidMatch || !dtStartMatch || !dtEndMatch) {
        return null;
      }

      return {
        uid: uidMatch[1],
        summary: summaryMatch?.[1] || 'Untitled Event',
        description: descriptionMatch?.[1],
        startTime: this.parseICalDate(dtStartMatch[1]),
        endTime: this.parseICalDate(dtEndMatch[1]),
        location: locationMatch?.[1],
      };
    } catch (error) {
      console.error('Error parsing iCal event:', error);
      return null;
    }
  }

  /**
   * Create event in Apple Calendar via CalDAV
   */
  async createAppleCalendarEvent(
    orgId: string,
    eventDetails: {
      summary: string;
      description?: string;
      startTime: string; // ISO datetime
      endTime: string; // ISO datetime
      location?: string;
    }
  ): Promise<string | null> {
    try {
      const { data: bookingPage } = await supabase
        .from('booking_pages')
        .select('apple_calendar_id, apple_calendar_username, apple_calendar_password')
        .eq('org_id', orgId)
        .single();

      if (!bookingPage?.apple_calendar_id || !bookingPage.apple_calendar_username) {
        throw new Error('No Apple Calendar configured');
      }

      const uid = this.generateUID();
      const icalEvent = this.createICalEvent({
        uid,
        ...eventDetails,
      });

      const eventUrl = `${this.caldavServer}/${bookingPage.apple_calendar_username}/calendars/${bookingPage.apple_calendar_id}/${uid}.ics`;

      const response = await fetch(eventUrl, {
        method: 'PUT',
        headers: {
          Authorization: this.getBasicAuthHeader(
            bookingPage.apple_calendar_username,
            bookingPage.apple_calendar_password
          ),
          'Content-Type': 'text/calendar; charset=utf-8',
        },
        body: icalEvent,
      });

      if (!response.ok) {
        throw new Error('Failed to create Apple Calendar event');
      }

      return uid;
    } catch (error) {
      console.error('Error creating Apple Calendar event:', error);
      return null;
    }
  }

  /**
   * Delete Apple Calendar event
   */
  async deleteAppleCalendarEvent(orgId: string, eventUid: string): Promise<boolean> {
    try {
      const { data: bookingPage } = await supabase
        .from('booking_pages')
        .select('apple_calendar_id, apple_calendar_username, apple_calendar_password')
        .eq('org_id', orgId)
        .single();

      if (!bookingPage?.apple_calendar_id || !bookingPage.apple_calendar_username) {
        throw new Error('No Apple Calendar configured');
      }

      const eventUrl = `${this.caldavServer}/${bookingPage.apple_calendar_username}/calendars/${bookingPage.apple_calendar_id}/${eventUid}.ics`;

      const response = await fetch(eventUrl, {
        method: 'DELETE',
        headers: {
          Authorization: this.getBasicAuthHeader(
            bookingPage.apple_calendar_username,
            bookingPage.apple_calendar_password
          ),
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Error deleting Apple Calendar event:', error);
      return false;
    }
  }

  /**
   * Disconnect Apple Calendar
   */
  async disconnectAppleCalendar(orgId: string): Promise<void> {
    const { error } = await supabase
      .from('booking_pages')
      .update({
        apple_calendar_id: null,
        apple_calendar_username: null,
        apple_calendar_password: null,
      })
      .eq('org_id', orgId);

    if (error) throw error;
  }

  // Helper methods

  private getBasicAuthHeader(username: string, password: string): string {
    const credentials = `${username}:${password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
  }

  private formatCalDAVDate(date: Date): string {
    // Format: 20231225T120000Z
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  private parseICalDate(icalDate: string): string {
    // Parse format: 20231225T120000Z -> ISO 8601
    const year = icalDate.substring(0, 4);
    const month = icalDate.substring(4, 6);
    const day = icalDate.substring(6, 8);
    const hour = icalDate.substring(9, 11);
    const minute = icalDate.substring(11, 13);
    const second = icalDate.substring(13, 15);

    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }

  private generateUID(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}@flynnai.app`;
  }

  private createICalEvent(event: CalDAVEvent): string {
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Flynn AI//Booking System//EN
BEGIN:VEVENT
UID:${event.uid}
DTSTAMP:${now}
DTSTART:${this.formatCalDAVDate(new Date(event.startTime))}
DTEND:${this.formatCalDAVDate(new Date(event.endTime))}
SUMMARY:${event.summary}
${event.description ? `DESCRIPTION:${event.description}` : ''}
${event.location ? `LOCATION:${event.location}` : ''}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
  }
}

export default new AppleCalendarService();
