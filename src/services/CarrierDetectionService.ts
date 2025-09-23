import { callForwardingGuides } from '../data/callForwardingGuides';

export type CarrierDetectionConfidence = 'high' | 'medium' | 'low';

export interface CarrierDetectionResult {
  carrierId: string;
  confidence: CarrierDetectionConfidence;
  source: 'lookup' | 'heuristic';
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

const getGuideById = (carrierId: string) =>
  callForwardingGuides.find((guide) => guide.id === carrierId) || null;

const stripToDigits = (value: string) => value.replace(/[^\d+]/g, '');

export const detectCarrierFromNumber = async (
  inputNumber: string
): Promise<CarrierDetectionResult | null> => {
  const clean = stripToDigits(inputNumber);

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
      };
    }
  }

  return null;
};
