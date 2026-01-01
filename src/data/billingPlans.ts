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
    name: 'Starter',
    headline: 'Perfect for small businesses',
    price: 29,
    priceText: '$29/mo',
    callAllowanceLabel: '50 AI calls included',
    highlights: [
      '50 AI receptionist calls/month',
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
        description: 'Per call over 50 included calls',
      },
    ],
  },
  {
    id: 'growth',
    name: 'Professional',
    headline: 'For busy service providers',
    price: 79,
    priceText: '$79/mo',
    callAllowanceLabel: '150 AI calls included',
    highlights: [
      '150 AI receptionist calls/month',
      'All Starter features',
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
        description: 'Per call over 150 included calls',
      },
    ],
  },
  {
    id: 'enterprise',
    name: 'Business',
    headline: 'For high-volume operations',
    price: 149,
    priceText: '$149/mo',
    callAllowanceLabel: '350 AI calls included',
    highlights: [
      '350 AI receptionist calls/month',
      'All Professional features',
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
        description: 'Per call over 350 included calls',
      },
    ],
  },
];

export const getPlanById = (planId?: BillingPlanId | null) =>
  billingPlans.find((plan) => plan.id === planId);

export const isPaidPlan = (planId?: BillingPlanId | null): boolean => isPaidPlanId(planId);
