import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Resolve config from Expo extra or env
const extra = Constants.expoConfig?.extra as any | undefined;
const SUPABASE_URL = (extra?.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (extra?.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // This will help catch misconfiguration early during development
  console.warn('[supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY. Add them to app.json extra or as EXPO_PUBLIC_ envs.');
}

const isWeb = Platform.OS === 'web';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Native: use AsyncStorage. Web: let supabase-js default to localStorage.
    storage: isWeb ? undefined : AsyncStorage,
    autoRefreshToken: true,
    // Persist session on all platforms to avoid unexpected logouts while navigating.
    persistSession: true,
    // Handle URL-based session only on web
    detectSessionInUrl: isWeb,
  },
});
