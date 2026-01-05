/**
 * Trial Notification Service
 *
 * Handles push notifications and email alerts for trial expiration
 */

import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { addDays, differenceInDays, isBefore, startOfDay } from 'date-fns';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://flynnai-telephony.fly.dev';

export interface TrialStatus {
  isInTrial: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  hasExpired: boolean;
}

/**
 * Get user's trial status
 */
export async function getTrialStatus(userId: string): Promise<TrialStatus> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('default_org_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.default_org_id) {
      return {
        isInTrial: false,
        trialEndsAt: null,
        daysRemaining: 0,
        hasExpired: false,
      };
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('created_at, subscription_status, billing_plan_id')
      .eq('id', profile.default_org_id)
      .single();

    if (orgError || !org) {
      return {
        isInTrial: false,
        trialEndsAt: null,
        daysRemaining: 0,
        hasExpired: false,
      };
    }

    const isInTrial = org.billing_plan_id === 'trial' || org.subscription_status === 'trialing';

    if (!isInTrial) {
      return {
        isInTrial: false,
        trialEndsAt: null,
        daysRemaining: 0,
        hasExpired: false,
      };
    }

    // Trial lasts 14 days from org creation
    const trialEndsAt = addDays(new Date(org.created_at), 14);
    const now = startOfDay(new Date());
    const daysRemaining = differenceInDays(trialEndsAt, now);
    const hasExpired = isBefore(trialEndsAt, now);

    return {
      isInTrial: true,
      trialEndsAt,
      daysRemaining: Math.max(0, daysRemaining),
      hasExpired,
    };
  } catch (error) {
    console.error('[TrialNotificationService] Error getting trial status:', error);
    return {
      isInTrial: false,
      trialEndsAt: null,
      daysRemaining: 0,
      hasExpired: false,
    };
  }
}

/**
 * Schedule local push notifications for trial expiry
 */
export async function scheduleTrialExpiryNotifications(trialStatus: TrialStatus) {
  if (!trialStatus.isInTrial || !trialStatus.trialEndsAt) {
    return;
  }

  // Cancel existing trial notifications
  const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of existingNotifications) {
    if (notification.content.data?.type === 'trial_expiry') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  const now = new Date();

  // Schedule 5-day warning
  const fiveDaysBefore = addDays(trialStatus.trialEndsAt, -5);
  if (isBefore(now, fiveDaysBefore)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your Flynn AI trial ends in 5 days',
        body: 'Subscribe now to keep using AI receptionist features and never miss a lead!',
        data: { type: 'trial_expiry', daysRemaining: 5 },
      },
      trigger: fiveDaysBefore,
    });
  }

  // Schedule 1-day warning
  const oneDayBefore = addDays(trialStatus.trialEndsAt, -1);
  if (isBefore(now, oneDayBefore)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your Flynn AI trial ends tomorrow!',
        body: 'Subscribe today to avoid losing access to your AI receptionist and call handling.',
        data: { type: 'trial_expiry', daysRemaining: 1 },
      },
      trigger: oneDayBefore,
    });
  }

  // Schedule expiry notification
  if (isBefore(now, trialStatus.trialEndsAt)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your Flynn AI trial has ended',
        body: 'Subscribe now to reactivate your AI receptionist and continue capturing leads.',
        data: { type: 'trial_expired', daysRemaining: 0 },
      },
      trigger: trialStatus.trialEndsAt,
    });
  }
}

/**
 * Send trial expiry email notification
 */
export async function sendTrialExpiryEmail(
  userId: string,
  daysRemaining: number
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      console.error('[TrialNotificationService] No user email found');
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/notifications/trial-expiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        email: user.email,
        daysRemaining,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send trial expiry email: ${response.statusText}`);
    }

    console.log(`[TrialNotificationService] Trial expiry email sent for ${daysRemaining} days remaining`);
  } catch (error) {
    console.error('[TrialNotificationService] Error sending trial expiry email:', error);
    throw error;
  }
}

/**
 * Initialize trial notifications for current user
 */
export async function initializeTrialNotifications(userId: string) {
  try {
    const trialStatus = await getTrialStatus(userId);

    if (trialStatus.isInTrial) {
      await scheduleTrialExpiryNotifications(trialStatus);

      // Send email if approaching expiry
      if (trialStatus.daysRemaining === 5 || trialStatus.daysRemaining === 1) {
        await sendTrialExpiryEmail(userId, trialStatus.daysRemaining);
      }
    }
  } catch (error) {
    console.error('[TrialNotificationService] Error initializing trial notifications:', error);
  }
}
