import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

/**
 * Global auth/session state (client state only — profile data beyond this
 * snapshot belongs in React Query via /user/me).
 *
 * The token + user snapshot persist in the iOS Keychain / Android Keystore via
 * expo-secure-store; on web (react-native-web dev preview) they fall back to
 * localStorage. Call `hydrate()` once at app start before gating routes.
 */

const TOKEN_KEY = 'payhankey.token';
const USER_KEY = 'payhankey.user';

const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  email: string;
};

type AuthStatus = 'hydrating' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  token: string | null;
  user: SessionUser | null;
  /** Load the persisted session (once, at startup). */
  hydrate: () => Promise<void>;
  /** Persist and activate a session (after login or OTP verification). */
  setSession: (token: string, user: SessionUser) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'hydrating',
  token: null,
  user: null,

  hydrate: async () => {
    try {
      const [token, rawUser] = await Promise.all([
        storage.get(TOKEN_KEY),
        storage.get(USER_KEY),
      ]);
      if (token && rawUser) {
        set({ token, user: JSON.parse(rawUser), status: 'signedIn' });
        return;
      }
    } catch {
      // Corrupt/unreadable persisted session — treat as signed out.
    }
    set({ token: null, user: null, status: 'signedOut' });
  },

  setSession: async (token, user) => {
    set({ token, user, status: 'signedIn' });
    await Promise.all([
      storage.set(TOKEN_KEY, token),
      storage.set(USER_KEY, JSON.stringify(user)),
    ]);
  },

  signOut: async () => {
    set({ token: null, user: null, status: 'signedOut' });
    await Promise.all([storage.remove(TOKEN_KEY), storage.remove(USER_KEY)]);
  },
}));
