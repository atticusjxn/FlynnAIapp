import { Session } from '@supabase/supabase-js';
import { SafeAsyncStorage } from '../utils/SafeAsyncStorage';

const ACCESS_TOKEN_KEY = 'flynnai.auth.accessToken';
const REFRESH_TOKEN_KEY = 'flynnai.auth.refreshToken';
const EXPIRES_AT_KEY = 'flynnai.auth.expiresAt';
const USER_ID_KEY = 'flynnai.auth.userId';

const removeKeys = async () => {
  await Promise.all([
    SafeAsyncStorage.removeItem(ACCESS_TOKEN_KEY),
    SafeAsyncStorage.removeItem(REFRESH_TOKEN_KEY),
    SafeAsyncStorage.removeItem(EXPIRES_AT_KEY),
    SafeAsyncStorage.removeItem(USER_ID_KEY),
  ]);
};

export const AuthTokenStorage = {
  async storeSession(session: Session | null) {
    if (!session) {
      await removeKeys();
      return;
    }

    const tasks: Promise<void>[] = [];

    if (session.access_token) {
      tasks.push(SafeAsyncStorage.setItem(ACCESS_TOKEN_KEY, session.access_token));
    } else {
      tasks.push(SafeAsyncStorage.removeItem(ACCESS_TOKEN_KEY));
    }

    if (session.refresh_token) {
      tasks.push(SafeAsyncStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token));
    } else {
      tasks.push(SafeAsyncStorage.removeItem(REFRESH_TOKEN_KEY));
    }

    if (typeof session.expires_at === 'number') {
      tasks.push(SafeAsyncStorage.setItem(EXPIRES_AT_KEY, String(session.expires_at)));
    } else {
      tasks.push(SafeAsyncStorage.removeItem(EXPIRES_AT_KEY));
    }

    if (session.user?.id) {
      tasks.push(SafeAsyncStorage.setItem(USER_ID_KEY, session.user.id));
    } else {
      tasks.push(SafeAsyncStorage.removeItem(USER_ID_KEY));
    }

    await Promise.all(tasks);
  },

  async clear() {
    await removeKeys();
  },

  async getAccessToken() {
    return SafeAsyncStorage.getItem(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken() {
    return SafeAsyncStorage.getItem(REFRESH_TOKEN_KEY);
  },

  async getExpiresAt() {
    return SafeAsyncStorage.getItem(EXPIRES_AT_KEY);
  },

  async getUserId() {
    return SafeAsyncStorage.getItem(USER_ID_KEY);
  },
};
