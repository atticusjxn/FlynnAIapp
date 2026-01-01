/**
 * Billing Service
 *
 * Handles subscription status checks and billing logic for Flynn AI
 */

import type { BillingPlanId } from '../types/billing';
import { supabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://flynnai-telephony.fly.dev';

export interface SubscriptionStatus {
  hasPaidPlan: boolean;
  planId: BillingPlanId | null;
  callsUsed: number;
  callsAllotted: number;
  callsRemaining: number;
  canMakeCalls: boolean;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';
}

const PLAN_CALL_LIMITS: Record<BillingPlanId, number> = {
  trial: 0, // Free tier: no calls to real numbers
  starter: 50,
  growth: 150,
  enterprise: 350,
};

/**
 * Get the current user's subscription status
 */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  try {
    // Fetch user's organization and billing details
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('default_org_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.default_org_id) {
      return {
        hasPaidPlan: false,
        planId: 'trial',
        callsUsed: 0,
        callsAllotted: 0,
        callsRemaining: 0,
        canMakeCalls: false,
      };
    }

    // Fetch organization billing info
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('billing_plan_id, stripe_subscription_id, stripe_customer_id, subscription_status')
      .eq('id', profile.default_org_id)
      .single();

    if (orgError) {
      console.error('[BillingService] Failed to fetch organization:', orgError);
      return {
        hasPaidPlan: false,
        planId: 'trial',
        callsUsed: 0,
        callsAllotted: 0,
        callsRemaining: 0,
        canMakeCalls: false,
      };
    }

    const planId = (org?.billing_plan_id as BillingPlanId) || 'trial';
    const isPaid = planId !== 'trial';
    const callLimit = PLAN_CALL_LIMITS[planId] || 0;

    // Count AI receptionist calls this billing period
    const billingPeriodStart = getBillingPeriodStart();
    const billingPeriodMonth = billingPeriodStart.toISOString().split('T')[0];
    const { count: callsUsed, error: callsError } = await supabase
      .from('ai_call_usage')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', profile.default_org_id)
      .eq('billing_period_month', billingPeriodMonth);

    if (callsError) {
      console.error('[BillingService] Failed to count calls:', callsError);
    }

    const totalCallsUsed = callsUsed || 0;
    const callsRemaining = Math.max(0, callLimit - totalCallsUsed);
    const canMakeCalls = isPaid && (org?.subscription_status === 'active' || org?.subscription_status === 'trialing');

    return {
      hasPaidPlan: isPaid,
      planId,
      callsUsed: totalCallsUsed,
      callsAllotted: callLimit,
      callsRemaining,
      canMakeCalls,
      stripeSubscriptionId: org?.stripe_subscription_id,
      stripeCustomerId: org?.stripe_customer_id,
      subscriptionStatus: org?.subscription_status as any,
    };
  } catch (error) {
    console.error('[BillingService] Error fetching subscription status:', error);
    return {
      hasPaidPlan: false,
      planId: 'trial',
      callsUsed: 0,
      callsAllotted: 0,
      callsRemaining: 0,
      canMakeCalls: false,
    };
  }
}

/**
 * Check if user can setup AI receptionist (requires paid plan)
 */
export async function canSetupReceptionist(userId: string): Promise<boolean> {
  const status = await getSubscriptionStatus(userId);
  return status.hasPaidPlan;
}

/**
 * Check if user can make test calls (free users can only test in-app)
 */
export async function canMakeTestCall(userId: string): Promise<{ allowed: boolean; isInAppOnly: boolean }> {
  const status = await getSubscriptionStatus(userId);

  if (!status.hasPaidPlan) {
    // Free tier: can test in-app only
    return { allowed: true, isInAppOnly: true };
  }

  // Paid tier: can call their real provisioned number
  return { allowed: status.canMakeCalls, isInAppOnly: false };
}

/**
 * Get the start of the current billing period (monthly billing)
 */
function getBillingPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
}

/**
 * Create a Stripe checkout session and open it in browser
 */
export async function createCheckoutSession(priceId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/billing/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ priceId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create checkout session');
    }

    const { url } = await response.json();

    // Open Stripe Checkout in browser
    const result = await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });

    if (result.type === 'cancel') {
      console.log('[BillingService] User canceled checkout');
    }
  } catch (error) {
    console.error('[BillingService] Error creating checkout session:', error);
    Alert.alert('Error', 'Failed to open checkout. Please try again.');
    throw error;
  }
}

/**
 * Open Stripe Customer Portal for managing subscription
 */
export async function openCustomerPortal(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/billing/create-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create portal session');
    }

    const { url } = await response.json();

    // Open Stripe Customer Portal in browser
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  } catch (error) {
    console.error('[BillingService] Error opening customer portal:', error);
    Alert.alert('Error', 'Failed to open billing portal. Please try again.');
    throw error;
  }
}

/**
 * Get subscription status from backend API
 */
export async function getSubscriptionFromAPI(): Promise<{
  plan: BillingPlanId;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasActiveSubscription: boolean;
} | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/api/billing/subscription-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      console.error('[BillingService] Failed to fetch subscription status');
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[BillingService] Error fetching subscription from API:', error);
    return null;
  }
}

export const BillingService = {
  getSubscriptionStatus,
  canSetupReceptionist,
  canMakeTestCall,
  createCheckoutSession,
  openCustomerPortal,
  getSubscriptionFromAPI,
};
