import type { BillingPlanId } from '../types/billing';
import { isPaidPlanId } from '../types/billing';

const basicPaymentLink = process.env.EXPO_PUBLIC_STRIPE_BASIC_LINK || '';
const growthPaymentLink = process.env.EXPO_PUBLIC_STRIPE_GROWTH_LINK || '';

export interface BillingPlanDefinition {
  id: BillingPlanId;
  name: string;
  headline: string;
  price: number;
  priceText: string;
  callAllowanceLabel: string;
  highlights: string[];
  recommended?: boolean;
  stripePriceId?: string;
  paymentLink?: string;
  additionalCosts?: {
    label: string;
    cost: number;
    description: string;
  }[];
}

export const billingPlans: BillingPlanDefinition[] = [
  {
    id: 'concierge_basic',
    name: 'Concierge Basic',
    headline: 'Unlock your AI receptionist',
    price: 49,
    priceText: '$49/mo',
    callAllowanceLabel: 'Up to 100 missed calls',
    highlights: [
      'Dedicated Flynn number provisioning',
      'Human-like concierge summaries',
      'Voice customisation + event scripts',
    ],
    recommended: true,
    paymentLink: basicPaymentLink || 'https://flynn.ai/pricing#concierge-basic',
    additionalCosts: [
      {
        label: 'Flynn Phone Number',
        cost: 2,
        description: 'Dedicated number for your business ($2/month recurring)',
      },
    ],
  },
  {
    id: 'concierge_growth',
    name: 'Concierge Growth',
    headline: 'Scale to squad-level volume',
    price: 99,
    priceText: '$99/mo',
    callAllowanceLabel: 'Up to 500 missed calls',
    highlights: [
      'Priority routing + analytics',
      'Multi-event intake scripts',
      'Team notifications + exports',
    ],
    paymentLink: growthPaymentLink || 'https://flynn.ai/pricing#concierge-growth',
    additionalCosts: [
      {
        label: 'Flynn Phone Number',
        cost: 2,
        description: 'Dedicated number for your business ($2/month recurring)',
      },
    ],
  },
];

export const getPlanById = (planId?: BillingPlanId | null) =>
  billingPlans.find((plan) => plan.id === planId);

export const isPaidPlan = (planId?: BillingPlanId | null): boolean => isPaidPlanId(planId);
