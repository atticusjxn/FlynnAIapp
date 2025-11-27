export type BillingPlanId = 'trial' | 'concierge_basic' | 'concierge_growth';

export const paidPlanIds: BillingPlanId[] = ['concierge_basic', 'concierge_growth'];

export const isPaidPlanId = (planId?: BillingPlanId | null): boolean =>
  Boolean(planId && paidPlanIds.includes(planId));
