import { AuthTokenStorage } from './authTokenStorage';
import { APP_BASE_URL } from '@env';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';

declare const __DEV__: boolean | undefined;

// Network retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RETRY_BACKOFF_MULTIPLIER = 2;

const normalizeBaseUrl = (url?: string | null) => {
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const resolveBaseUrl = () => {
  const configBaseUrl = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;
  const runtimeBaseUrl = APP_BASE_URL || configBaseUrl;

  if (!runtimeBaseUrl) {
    console.warn('[API] APP_BASE_URL is not set. Requests will fail until configured.');
    return '';
  }

  return normalizeBaseUrl(runtimeBaseUrl);
};

const baseUrl = resolveBaseUrl();

console.log('[API] baseUrl resolved to', baseUrl);

const isDevEnvironment = () => {
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__;
  }

  return false;
};

export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await AuthTokenStorage.getAccessToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }

  if (isDevEnvironment()) {
    const fallbackUserId = await AuthTokenStorage.getUserId();
    if (fallbackUserId) {
      return { 'x-user-id': fallbackUserId };
    }
  }

  return {};
};

const shouldSerializeAsJson = (body: unknown) => {
  if (!body) return false;
  if (typeof body === 'string') return false;
  if (body instanceof FormData) return false;
  if (body instanceof Blob) return false;
  if (body instanceof ArrayBuffer) return false;
  if (ArrayBuffer.isView(body)) return false;
  return typeof body === 'object';
};

interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: RequestInit['body'] | Record<string, unknown>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  skipRetry?: boolean;
}

class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

const checkNetworkConnection = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true;
  } catch (error) {
    console.warn('[API] Failed to check network status:', error);
    return true; // Assume connected if check fails
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof NetworkError) return true;
  if (error instanceof TypeError && error.message.includes('Network request failed')) return true;
  if (error instanceof Error) {
    const status = (error as Error & { status?: number }).status;
    // Retry on 5xx errors and 429 (rate limit)
    if (status && (status >= 500 || status === 429)) return true;
  }
  return false;
};

const buildUrl = (path: string) => {
  if (!baseUrl) {
    throw new Error('API base URL is not configured. Set APP_BASE_URL in your environment.');
  }

  if (!path.startsWith('/')) {
    return `${baseUrl}/${path}`;
  }

  return `${baseUrl}${path}`;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
};

const extractErrorMessage = async (response: Response) => {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        return payload.error;
      }
      if (payload && typeof payload.message === 'string') {
        return payload.message;
      }
    } else {
      const text = await response.text();
      if (text) return text;
    }
  } catch (error) {
    console.warn('[API] Failed to parse error response:', error);
  }

  return 'Request failed';
};

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { skipAuth, skipRetry, headers: customHeaders = {}, body, method, ...rest } = options;

  // Check network connectivity before attempting request
  const isConnected = await checkNetworkConnection();
  if (!isConnected) {
    throw new NetworkError('No internet connection. Please check your network and try again.');
  }

  const url = buildUrl(path);
  const headers: Record<string, string> = { ...customHeaders };

  if (!skipAuth) {
    const authHeaders = await getAuthHeaders();
    Object.assign(headers, authHeaders);
  }

  let requestBody: RequestInit['body'];

  if (shouldSerializeAsJson(body)) {
    requestBody = JSON.stringify(body);
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  } else {
    requestBody = body as RequestInit['body'];
  }

  // Retry logic with exponential backoff
  let lastError: Error | null = null;
  const maxAttempts = skipRetry ? 1 : MAX_RETRIES;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: requestBody,
        ...rest,
      });

      if (!response.ok) {
        const message = await extractErrorMessage(response);
        const error = new Error(message);
        (error as Error & { status?: number }).status = response.status;

        // Don't retry on 4xx errors (except 429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw error;
        }

        lastError = error;

        // Retry if retryable and not last attempt
        if (isRetryableError(error) && attempt < maxAttempts - 1) {
          const delay = RETRY_DELAY_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, attempt);
          console.log(`[API] Retrying request (attempt ${attempt + 1}/${maxAttempts}) after ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        throw error;
      }

      return parseResponse<T>(response);
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (isRetryableError(error) && attempt < maxAttempts - 1) {
        const delay = RETRY_DELAY_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, attempt);
        console.log(`[API] Network error, retrying (attempt ${attempt + 1}/${maxAttempts}) after ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  // If we get here, all retries failed
  throw lastError || new Error('Request failed after all retry attempts');
};

export const apiClient = {
  get<T>(path: string, options: RequestOptions = {}) {
    return apiRequest<T>(path, { ...options, method: 'GET' });
  },
  post<T>(path: string, body?: RequestOptions['body'], options: RequestOptions = {}) {
    return apiRequest<T>(path, { ...options, method: 'POST', body });
  },
  patch<T>(path: string, body?: RequestOptions['body'], options: RequestOptions = {}) {
    return apiRequest<T>(path, { ...options, method: 'PATCH', body });
  },
  delete<T>(path: string, options: RequestOptions = {}) {
    return apiRequest<T>(path, { ...options, method: 'DELETE' });
  },
};
