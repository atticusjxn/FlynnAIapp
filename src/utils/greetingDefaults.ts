import { User } from '@supabase/supabase-js';

const EVENT_FOCUSED_FALLBACK = "Hey, thanks for reaching out — how can we help you today?";

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

const extractBusinessType = (metadata: Record<string, unknown>): string => {
  return (
    pickString(metadata.business_type) ||
    pickString(metadata.businessType) ||
    ''
  );
};

// Business-type-specific greeting templates
const getBusinessTypeContext = (businessType: string): string => {
  const type = businessType.toLowerCase();

  if (type.includes('home') || type.includes('property')) {
    return "What can we help you with around the home?";
  }
  if (type.includes('trade') || type.includes('plumb') || type.includes('electric') || type.includes('hvac')) {
    return "What service do you need today?";
  }
  if (type.includes('beauty') || type.includes('salon') || type.includes('spa')) {
    return "What service are you interested in booking?";
  }
  if (type.includes('event') || type.includes('photo') || type.includes('video')) {
    return "What event can we help you with?";
  }
  if (type.includes('fitness') || type.includes('coach') || type.includes('personal train')) {
    return "What are your fitness goals?";
  }
  if (type.includes('clean')) {
    return "What cleaning service do you need?";
  }
  if (type.includes('repair') || type.includes('mainten')) {
    return "What needs fixing today?";
  }

  return "How can we help you today?";
};

export const buildDefaultGreeting = (
  user: User | null,
  fallback: string = EVENT_FOCUSED_FALLBACK,
): string => {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const businessName = extractBusinessName(metadata);
  const firstName = extractFirstName(metadata);
  const businessType = extractBusinessType(metadata);

  // Get business-type-specific context
  const contextQuestion = businessType
    ? getBusinessTypeContext(businessType)
    : "How can we help you today?";

  if (businessName) {
    return `Hey, thanks for reaching ${businessName}. ${contextQuestion}`;
  }

  if (firstName) {
    return `Hey, thanks for reaching ${firstName}. ${contextQuestion}`;
  }

  return fallback;
};

export const EVENT_GREETING_FALLBACK = EVENT_FOCUSED_FALLBACK;

