import { supabase } from '@/lib/supabase';

export type UserProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  upi_id: string | null;
  is_admin?: boolean | null;
  updated_at?: string | null;
};

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, upi_id, is_admin, updated_at')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') { // PGRST116: No rows
    throw error;
  }
  return (data as UserProfile) ?? null;
}

export async function upsertProfile(profile: UserProfile): Promise<void> {
  const payload = {
    id: profile.id,
    full_name: profile.full_name ?? null,
    phone: profile.phone ?? null,
    upi_id: profile.upi_id ?? null,
  };
  const { error } = await supabase.from('profiles').upsert(payload, {
    onConflict: 'id',
    ignoreDuplicates: false,
  });
  if (error) throw error;
}
