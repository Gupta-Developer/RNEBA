import { supabase } from '@/lib/supabase';
import { emitTransaction } from '@/lib/txEvents';

export type TransactionStatus = 'pending' | 'rejected' | 'paid';

export type Transaction = {
  id: string; // uuid
  user_id: string; // uuid
  offer_id: string | null; // text FK to offers.id
  offer_title: string | null;
  offer_icon_url: string | null;
  amount: number | null;
  status: TransactionStatus;
  proof_url: string | null;
  notes: string | null;
  reviewed_by: string | null; // uuid
  reviewed_at: string | null; // ISO
  created_at: string; // ISO
  updated_at: string; // ISO
};

function mapRow(r: any): Transaction {
  return {
    id: r.id,
    user_id: r.user_id,
    offer_id: r.offer_id,
    offer_title: r.offer_title,
    offer_icon_url: r.offer_icon_url,
    amount: r.amount,
    status: r.status,
    proof_url: r.proof_url,
    notes: r.notes,
    reviewed_by: r.reviewed_by,
    reviewed_at: r.reviewed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  } as Transaction;
}

/**
 * Ensure only one active (non-paid) transaction exists per (user, offer).
 * If a pending/rejected transaction exists, reuse it by setting status back to 'pending'
 * and refreshing updated_at; otherwise insert a new pending row.
 */
export async function createOrReuseActiveTransaction(input: {
  userId: string;
  offerId: string;
  offerTitle?: string;
  offerIconUrl?: string;
  amount?: number;
}): Promise<Transaction> {
  // 1) Find latest non-paid tx for this user/offer
  const { data: existingRows, error: findErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', input.userId)
    .eq('offer_id', input.offerId)
    .neq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1);
  if (findErr) throw findErr;
  const existing = (existingRows as any[] | null)?.[0];

  // 2) If exists and not paid, make sure it's pending and refresh updated_at
  if (existing) {
    const id = (existing as any).id as string;
    const patch: any = {
      status: 'pending' as TransactionStatus,
      offer_title: input.offerTitle ?? (existing as any).offer_title ?? null,
      offer_icon_url: input.offerIconUrl ?? (existing as any).offer_icon_url ?? null,
      amount: input.amount ?? (existing as any).amount ?? null,
      // Let DB trigger update updated_at; or set reviewed_at to null when going back to pending
      reviewed_at: null,
      reviewed_by: null,
    };
    const { data, error } = await supabase
      .from('transactions')
      .update(patch)
      .eq('id', id)
      .select('*')
      .limit(1);
    if (error) throw error;
    const row = (data as any[] | null)?.[0];
    // If RLS prevents returning the updated row, fall back to existing with patched fields
    if (!row) {
      const tx = mapRow({ ...existing, ...patch, id });
      emitTransaction(tx);
      return tx;
    }
    const tx = mapRow(row);
    emitTransaction(tx);
    return tx;
  }

  // 3) Otherwise insert a brand new pending row
  return await createPendingTransaction({
    userId: input.userId,
    offerId: input.offerId,
    offerTitle: input.offerTitle,
    offerIconUrl: input.offerIconUrl,
    amount: input.amount,
  });
}

export async function createPendingTransaction(input: {
  userId: string;
  offerId?: string;
  offerTitle?: string;
  offerIconUrl?: string;
  amount?: number;
  proofUrl?: string;
}) {
  const payload = {
    user_id: input.userId,
    offer_id: input.offerId ?? null,
    offer_title: input.offerTitle ?? null,
    offer_icon_url: input.offerIconUrl ?? null,
    amount: input.amount ?? null,
    status: 'pending' as TransactionStatus,
    proof_url: input.proofUrl ?? null,
  };
  const { data, error } = await supabase.from('transactions').insert(payload).select('*').limit(1);
  if (error) throw error;
  const row = (data as any[] | null)?.[0];
  // If the DB didn't return the row (RLS), synthesize a minimal object
  if (!row) {
    const tx = mapRow({
      id: 'unknown',
      user_id: payload.user_id,
      offer_id: payload.offer_id,
      offer_title: payload.offer_title,
      offer_icon_url: payload.offer_icon_url,
      amount: payload.amount,
      status: payload.status,
      proof_url: payload.proof_url,
      notes: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    emitTransaction(tx);
    return tx;
  }
  const tx = mapRow(row);
  emitTransaction(tx);
  return tx;
}

export async function updateTransactionStatus(
  id: string,
  status: TransactionStatus,
  options?: { notes?: string | null; reviewed_by?: string | null; reviewed_at?: string | null }
) {
  const patch: any = { status };
  if (options) {
    if (options.notes !== undefined) patch.notes = options.notes;
    if (options.reviewed_by !== undefined) patch.reviewed_by = options.reviewed_by;
    // default reviewed_at to now if not provided when setting non-pending status
    if (options.reviewed_at !== undefined) patch.reviewed_at = options.reviewed_at;
    else if (status !== 'pending') patch.reviewed_at = new Date().toISOString();
  }
  const { data, error } = await supabase.from('transactions').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  const tx = mapRow(data);
  emitTransaction(tx);
  return tx;
}

export function subscribeTransactionsForUser(userId: string, cb: (items: Transaction[]) => void) {
  let cancelled = false;
  (async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!cancelled) cb((data as any[] | null)?.map(mapRow) ?? []);
    if (error) console.warn('[transactions] load error', error.message);
  })();

  const channel = supabase
    .channel(`transactions-user-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!cancelled) cb((data as any[] | null)?.map(mapRow) ?? []);
    })
    .subscribe();

  return () => { cancelled = true; supabase.removeChannel(channel); };
}

export function subscribeAllTransactions(cb: (items: Transaction[]) => void) {
  let cancelled = false;
  (async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!cancelled) cb((data as any[] | null)?.map(mapRow) ?? []);
    if (error) console.warn('[transactions] load all error', error.message);
  })();

  const channel = supabase
    .channel('transactions-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (!cancelled) cb((data as any[] | null)?.map(mapRow) ?? []);
    })
    .subscribe();

  return () => { cancelled = true; supabase.removeChannel(channel); };
}
