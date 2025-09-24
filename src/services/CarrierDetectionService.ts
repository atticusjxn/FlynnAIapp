import { callForwardingGuides } from '../data/callForwardingGuides';

const TWILIO_ACCOUNT_SID = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
const ENABLE_HEURISTIC =
  process.env.EXPO_PUBLIC_ENABLE_CARRIER_HEURISTIC === 'true';

export type CarrierDetectionConfidence = 'high' | 'medium' | 'low';

export interface CarrierDetectionResult {
  carrierId: string;
  confidence: CarrierDetectionConfidence;
  source: 'lookup' | 'heuristic';
  rawCarrierName?: string | null;
  e164Number?: string;
}

const AUS_CARRIER_HEURISTICS: Array<{
  regex: RegExp;
  carrierId: string;
  confidence: CarrierDetectionConfidence;
}> = [
  {
    regex: /^(?:\+?61|0)4[0-3]\d{7}$/,
    carrierId: 'au-telstra',
    confidence: 'low',
  },
  {
    regex: /^(?:\+?61|0)49\d{7}$/,
    carrierId: 'au-telstra',
    confidence: 'low',
  },
  {
    regex: /^(?:\+?61|0)4[56]\d{7}$/,
    carrierId: 'au-optus',
    confidence: 'low',
  },
  {
    regex: /^(?:\+?61|0)4[789]\d{7}$/,
    carrierId: 'au-vodafone',
    confidence: 'low',
  },
];

const MVNO_TO_CARRIER: Record<string, string> = {
  mate: 'au-telstra',
  boost: 'au-telstra',
  belong: 'au-telstra',
  aldi: 'au-telstra',
  amaysim: 'au-optus',
  vaya: 'au-optus',
  tpg: 'au-vodafone',
  felix: 'au-vodafone',
  lebara: 'au-vodafone',
  kogan: 'au-vodafone',
};

const STRONG_NAME_MATCHES: Array<{ matcher: RegExp; carrierId: string }> = [
  { matcher: /telstra/i, carrierId: 'au-telstra' },
  { matcher: /optus/i, carrierId: 'au-optus' },
  { matcher: /vodafone|tpg|one\.com\.au/i, carrierId: 'au-vodafone' },
];

const stripToDigits = (value: string) => value.replace(/[^\d+]/g, '');

export const isCarrierLookupEnabled = () =>
  Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);

const formatToE164 = (input: string): string | null => {
  const digits = stripToDigits(input);
  if (!digits) return null;

  if (digits.startsWith('+')) {
    return digits;
  }

  if (digits.startsWith('61')) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `+61${digits.substring(1)}`;
  }

  if (digits.startsWith('4') && digits.length === 9) {
    return `+614${digits.substring(1)}`;
  }

  return null;
};

const mapCarrierIdFromName = (rawName?: string | null): string | null => {
  if (!rawName) {
    return null;
  }

  const normalized = rawName.trim().toLowerCase();

  const mvnoMatch = Object.entries(MVNO_TO_CARRIER).find(([mvno]) =>
    normalized.includes(mvno)
  );
  if (mvnoMatch) {
    return mvnoMatch[1];
  }

  const strongMatch = STRONG_NAME_MATCHES.find(({ matcher }) =>
    matcher.test(rawName)
  );
  if (strongMatch) {
    return strongMatch.carrierId;
  }

  return null;
};

const getGuideById = (carrierId: string) =>
  callForwardingGuides.find((guide) => guide.id === carrierId) || null;

const attemptLookup = async (e164Number: string) => {
  if (!isCarrierLookupEnabled()) {
    return null;
  }

  try {
    const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(
      e164Number
    )}?Fields=carrier`;

    const auth = Buffer.from(
      `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
    ).toString('base64');

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Twilio lookup failed: ${response.status}`);
    }

    const payload = await response.json();
    const rawCarrierName: string | undefined = payload?.carrier?.name;

    const mappedCarrierId = mapCarrierIdFromName(rawCarrierName);

    if (!mappedCarrierId) {
      return null;
    }

    const guide = getGuideById(mappedCarrierId);
    if (!guide) {
      return null;
    }

    return {
      carrierId: guide.id,
      confidence: 'high' as CarrierDetectionConfidence,
      source: 'lookup' as const,
      rawCarrierName: rawCarrierName || null,
      e164Number,
    };
  } catch (error) {
    console.warn('[CarrierDetectionService] lookup failed', error);
    return null;
  }
};

const attemptHeuristic = (
  input: string
): CarrierDetectionResult | null => {
  if (!ENABLE_HEURISTIC) {
    return null;
  }

  const clean = stripToDigits(input);
  if (!clean) {
    return null;
  }

  for (const heuristic of AUS_CARRIER_HEURISTICS) {
    if (heuristic.regex.test(clean)) {
      const guide = getGuideById(heuristic.carrierId);
      if (!guide) {
        continue;
      }

      return {
        carrierId: guide.id,
        confidence: heuristic.confidence,
        source: 'heuristic',
        rawCarrierName: null,
      };
    }
  }

  return null;
};

export const detectCarrierFromNumber = async (
  inputNumber: string
): Promise<CarrierDetectionResult | null> => {
  const lookupEnabled = isCarrierLookupEnabled();
  const e164 = formatToE164(inputNumber);

  if (lookupEnabled && e164) {
    const lookupResult = await attemptLookup(e164);
    if (lookupResult) {
      return lookupResult;
    }
  }

  const heuristic = attemptHeuristic(inputNumber);
  if (heuristic) {
    return heuristic;
  }

  if (!lookupEnabled) {
    throw new Error('LOOKUP_DISABLED');
  }

  return null;
};
