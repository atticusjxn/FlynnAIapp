export type BillingPlanId = 'trial' | 'starter' | 'growth' | 'enterprise';

export const paidPlanIds: BillingPlanId[] = ['starter', 'growth', 'enterprise'];

export const isPaidPlanId = (planId?: BillingPlanId | null): boolean =>
  Boolean(planId && paidPlanIds.includes(planId));
