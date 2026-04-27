import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Subscription,
  type SubscriptionPurchase,
  type PurchaseError,
} from 'react-native-iap';
import { supabase } from './supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://flynnai-telephony.fly.dev';

// Mirrors iOS Swift StoreKit product IDs (kept identical so analytics + plans
// table joins are simple). Play Console subscription products must be created
// with these exact IDs.
export const PLAY_PRODUCT_IDS = [
  'com.flynnai.starter.monthly',
  'com.flynnai.growth.monthly',
  'com.flynnai.pro.monthly',
] as const;

export type PlayProductId = typeof PLAY_PRODUCT_IDS[number];

let connectionInitialized = false;
let purchaseSub: { remove: () => void } | null = null;
let errorSub: { remove: () => void } | null = null;

async function ensureConnection(): Promise<void> {
  if (connectionInitialized) return;
  await initConnection();
  connectionInitialized = true;
}

export async function bootstrap(): Promise<Subscription[]> {
  if (Platform.OS !== 'android') return [];
  await ensureConnection();
  return getSubscriptions({ skus: [...PLAY_PRODUCT_IDS] });
}

/**
 * Start a subscription purchase. The actual receipt forwarding happens in
 * the purchaseUpdatedListener registered via attachListeners(). Returns once
 * the Play Billing UI has been opened — caller should await the listener.
 */
export async function purchase(productId: PlayProductId): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('PlayBillingService is Android-only');
  }
  await ensureConnection();
  // Play Billing v6 requires the offer token from the subscription's pricing
  // phases. For a single base-plan + 14-day trial, the first offer is correct.
  const subs = await getSubscriptions({ skus: [productId] });
  const sub = subs.find((s) => s.productId === productId);
  const offerToken = sub?.subscriptionOfferDetails?.[0]?.offerToken;
  if (!offerToken) {
    throw new Error(`No offer token for ${productId} — check Play Console base plan setup`);
  }
  await requestSubscription({
    sku: productId,
    subscriptionOffers: [{ sku: productId, offerToken }],
  });
}

export interface PlayBillingListeners {
  onSuccess: (productId: string) => void;
  onError: (err: Error) => void;
}

/**
 * Register the global purchase listeners. Call once on screen mount; remove
 * via the returned cleanup. The verify call goes server-side — we do NOT
 * trust client-side purchase state.
 */
export function attachListeners({ onSuccess, onError }: PlayBillingListeners): () => void {
  purchaseSub = purchaseUpdatedListener(async (purchase: SubscriptionPurchase) => {
    try {
      const purchaseToken = purchase.purchaseToken;
      const productId = purchase.productId;
      if (!purchaseToken || !productId) {
        throw new Error('Play purchase missing token or productId');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(`${API_BASE_URL}/webhooks/playbilling/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ purchaseToken, productId }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Server verify failed (${res.status}): ${errBody}`);
      }

      // Only acknowledge after server confirms — prevents lost subscriptions
      // if the network drops between Play and our server.
      await finishTransaction({ purchase, isConsumable: false });
      onSuccess(productId);
    } catch (err) {
      console.error('[PlayBilling] Purchase verify failed:', err);
      onError(err as Error);
    }
  });

  errorSub = purchaseErrorListener((err: PurchaseError) => {
    // User-cancelled is code 'E_USER_CANCELLED' — treat as soft.
    if (err.code === 'E_USER_CANCELLED') return;
    console.error('[PlayBilling] Purchase error:', err);
    onError(new Error(err.message || err.code || 'Play Billing error'));
  });

  return () => {
    purchaseSub?.remove();
    errorSub?.remove();
    purchaseSub = null;
    errorSub = null;
  };
}

export async function shutdown(): Promise<void> {
  if (!connectionInitialized) return;
  await endConnection();
  connectionInitialized = false;
}
