import { User } from '@supabase/supabase-js';

const EVENT_FOCUSED_FALLBACK = "Hi, thanks for calling — how can we help you today?";

const pickString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const extractFirstName = (metadata: Record<string, unknown>): string => {
  const rawName =
    pickString(metadata.first_name) ||
    pickString(metadata.firstName) ||
    pickString(metadata.owner_name) ||
    pickString(metadata.full_name) ||
    pickString(metadata.name);

  if (!rawName) {
    return '';
  }

  const [firstWord] = rawName.split(' ');
  return firstWord ?? rawName;
};

const extractBusinessName = (metadata: Record<string, unknown>): string => {
  return (
    pickString(metadata.business_name) ||
    pickString(metadata.businessName) ||
    pickString(metadata.company) ||
    pickString(metadata.brand)
  );
};

export const buildDefaultGreeting = (
  user: User | null,
  fallback: string = EVENT_FOCUSED_FALLBACK,
): string => {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const businessName = extractBusinessName(metadata);
  const firstName = extractFirstName(metadata);

  if (firstName && businessName) {
    return `Hi, you've reached ${firstName} at ${businessName} — how can we help you today?`;
  }

  if (businessName) {
    return `Hi, you've reached ${businessName} — how can we help you today?`;
  }

  if (firstName) {
    return `Hi, you've reached ${firstName} — how can we help you today?`;
  }

  return fallback;
};

export const EVENT_GREETING_FALLBACK = EVENT_FOCUSED_FALLBACK;

