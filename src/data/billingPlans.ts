import type { BillingPlanId } from '../types/billing';
import { isPaidPlanId } from '../types/billing';
import Constants from 'expo-constants';

const starterPaymentLink = process.env.EXPO_PUBLIC_STRIPE_STARTER_LINK
  || process.env.EXPO_PUBLIC_STRIPE_BASIC_LINK
  || '';
const professionalPaymentLink = process.env.EXPO_PUBLIC_STRIPE_PROFESSIONAL_LINK
  || process.env.EXPO_PUBLIC_STRIPE_GROWTH_LINK
  || '';
const businessPaymentLink = process.env.EXPO_PUBLIC_STRIPE_BUSINESS_LINK || '';

// Get Stripe price IDs from app config (hardcoded for production builds)
const stripeStarterPriceId = Constants.expoConfig?.extra?.stripeStarterPriceId || 'price_1SbiXfRm2tMRBfxY4wxwUbK8';
const stripeProfessionalPriceId = Constants.expoConfig?.extra?.stripeProfessionalPriceId || 'price_1SbiXoRm2tMRBfxYrZE2tD4o';
const stripeBusinessPriceId = Constants.expoConfig?.extra?.stripeBusinessPriceId || 'price_1SbiXwRm2tMRBfxYACw2GkKc';

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
    id: 'starter',
    name: 'Base Plan',
    headline: 'Perfect for small businesses',
    price: 79,
    priceText: '$79/mo',
    callAllowanceLabel: '200 minutes (~100 calls)',
    highlights: [
      '200 minutes of AI calls/month',
      'Approximately 100 calls',
      'Dedicated phone number provisioning',
      'Voice customization',
      'Job card creation',
      '$0.80 per additional call',
    ],
    recommended: true,
    stripePriceId: stripeStarterPriceId,
    paymentLink: starterPaymentLink || 'https://flynn.ai/pricing#starter',
    additionalCosts: [
      {
        label: 'Additional Calls',
        cost: 0.80,
        description: 'Per call over 200 minutes',
      },
    ],
  },
  {
    id: 'growth',
    name: 'Max Plan',
    headline: 'For busy service providers',
    price: 149,
    priceText: '$149/mo',
    callAllowanceLabel: '500 minutes (~250 calls)',
    highlights: [
      '500 minutes of AI calls/month',
      'Approximately 250 calls',
      'All Base Plan features',
      'Priority support',
      'Advanced analytics',
      '$0.70 per additional call',
    ],
    stripePriceId: stripeProfessionalPriceId,
    paymentLink: professionalPaymentLink || 'https://flynn.ai/pricing#professional',
    additionalCosts: [
      {
        label: 'Additional Calls',
        cost: 0.70,
        description: 'Per call over 500 minutes',
      },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    headline: 'For high-volume operations',
    price: 299,
    priceText: '$299/mo',
    callAllowanceLabel: '1000 minutes (~500 calls)',
    highlights: [
      '1000 minutes of AI calls/month',
      'Approximately 500 calls',
      'All Max Plan features',
      'Dedicated support',
      'Custom integrations',
      '$0.60 per additional call',
    ],
    stripePriceId: stripeBusinessPriceId,
    paymentLink: businessPaymentLink || 'https://flynn.ai/pricing#business',
    additionalCosts: [
      {
        label: 'Additional Calls',
        cost: 0.60,
        description: 'Per call over 1000 minutes',
      },
    ],
  },
];

export const getPlanById = (planId?: BillingPlanId | null) =>
  billingPlans.find((plan) => plan.id === planId);

export const isPaidPlan = (planId?: BillingPlanId | null): boolean => isPaidPlanId(planId);
