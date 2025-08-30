import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user: User | null = session?.user ?? null;

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user, loading, signOut };
}

export async function signInWithEmailOtp(email: string, redirectTo?: string) {
  email = email.trim();
  if (!email) throw new Error('Email is required');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo || 'earnbyapps://auth',
    },
  });
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUpWithPassword(email: string, password: string, redirectTo?: string) {
  email = email.trim();
  if (!email) throw new Error('Email is required');
  if (!password) throw new Error('Password is required');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo || 'earnbyapps://auth',
    },
  });
  if (error) throw error;
  return data.user;
}

export async function signUpWithEmailLink(email: string, redirectTo?: string) {
  email = email.trim();
  if (!email) throw new Error('Email is required');
  // Passwordless sign-up: magic link. This will create the user if not exists.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo || 'earnbyapps://auth',
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

export async function signInWithGoogle(redirectTo?: string) {
  const defaultRedirect = Platform.OS === 'web'
    ? (typeof window !== 'undefined' ? window.location.origin : undefined)
    : 'earnbyapps://auth';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || defaultRedirect,
    },
  });
  if (error) throw error;
  return data;
}
