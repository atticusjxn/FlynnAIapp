/**
 * Flynn AI Field Service & Calendar Integrations
 *
 * Supported platforms:
 * - Field Service: Jobber, Fergus, ServiceTitan
 * - Calendar: Google Calendar, Apple Calendar, Calendly
 */

export type IntegrationProvider =
  | 'jobber'
  | 'fergus'
  | 'servicetitan'
  | 'google_calendar'
  | 'apple_calendar'
  | 'calendly';

export type IntegrationStatus =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'pending'
  | 'expired';

export type IntegrationType = 'field_service' | 'calendar' | 'accounting';

export interface IntegrationConnection {
  id: string;
  org_id: string;
  provider: IntegrationProvider;
  type: IntegrationType;
  status: IntegrationStatus;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  account_id?: string;
  account_name?: string;
  metadata?: Record<string, unknown>;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IntegrationSyncLog {
  id: string;
  connection_id: string;
  sync_type: 'push' | 'pull' | 'bidirectional';
  entity_type: 'job' | 'client' | 'event' | 'invoice';
  entity_id?: string;
  status: 'success' | 'failure' | 'partial';
  records_synced: number;
  error_message?: string;
  sync_duration_ms?: number;
  created_at: string;
}

export interface SyncConflict {
  id: string;
  connection_id: string;
  entity_type: 'job' | 'client';
  flynn_entity_id: string;
  external_entity_id: string;
  conflict_type: 'update_conflict' | 'delete_conflict' | 'duplicate';
  flynn_data: Record<string, unknown>;
  external_data: Record<string, unknown>;
  resolution_strategy?: 'flynn_wins' | 'external_wins' | 'manual' | 'merge';
  resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

// Jobber-specific types
export interface JobberJob {
  id: string;
  title: string;
  client: {
    id: string;
    first_name: string;
    last_name: string;
    company_name?: string;
  };
  property: {
    address: {
      street_1?: string;
      street_2?: string;
      city?: string;
      province?: string;
      postal_code?: string;
    };
  };
  visits: Array<{
    id: string;
    start_at: string;
    end_at: string;
    assigned_to?: Array<{ id: string; name: string }>;
  }>;
  line_items: Array<{
    id: string;
    name: string;
    description?: string;
    quantity: number;
    unit_cost: number;
    total: number;
  }>;
  total_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface JobberClient {
  id: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  email?: string;
  phone?: {
    number: string;
    description?: string;
  }[];
  properties: Array<{
    id: string;
    address: {
      street_1?: string;
      street_2?: string;
      city?: string;
      province?: string;
      postal_code?: string;
    };
  }>;
  created_at: string;
  updated_at: string;
}

// Fergus-specific types
export interface FergusJob {
  ID: number;
  Title: string;
  Status: string;
  Description?: string;
  ContactID: number;
  SiteAddressID?: number;
  TotalPrice: number;
  CreatedDate: string;
  ModifiedDate: string;
}

export interface FergusContact {
  ID: number;
  FirstName: string;
  LastName: string;
  CompanyName?: string;
  Email?: string;
  Phone?: string;
  Mobile?: string;
  CreatedDate: string;
  ModifiedDate: string;
}

// ServiceTitan-specific types
export interface ServiceTitanJob {
  id: number;
  jobNumber: string;
  customerId: number;
  locationId: number;
  summary: string;
  type: string;
  status: string;
  businessUnitId: number;
  priority: string;
  campaignId?: number;
  jobTypeId: number;
  createdOn: string;
  modifiedOn: string;
}

export interface ServiceTitanCustomer {
  id: number;
  name: string;
  type: string;
  address: {
    street: string;
    unit?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  email?: string;
  phoneSettings: Array<{
    phoneNumber: string;
    type: string;
  }>;
  createdOn: string;
  modifiedOn: string;
}

// Calendar event types
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
  created: string;
  updated: string;
}

// Integration service response types
export interface IntegrationJobCreateResponse {
  success: boolean;
  external_id: string;
  external_url?: string;
  error?: string;
}

export interface IntegrationJobUpdateResponse {
  success: boolean;
  updated: boolean;
  error?: string;
}

export interface IntegrationSyncResponse {
  success: boolean;
  synced_count: number;
  failed_count: number;
  conflicts: SyncConflict[];
  error?: string;
}
