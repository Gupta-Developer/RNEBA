import { supabase } from './supabase';

export type Slide = {
  id: string;
  image: string; // image URL
  link?: string; // optional external or in-app link
};

export type OfferItem = {
  id: string;
  title: string;
  amount: number;
  icon?: string;
  label?: string;
  description?: string;
  steps?: string[];
  storeUrl?: string; // optional redirect link
  active?: boolean; // visibility toggle
  requiresProof?: boolean; // whether users must upload screenshot proof
};
// Mapping helpers for Supabase rows <-> app types
type SlideRow = { id: string; image: string; link: string | null; created_at: string };
type OfferRow = {
  id: string;
  title: string;
  amount: number;
  icon: string | null;
  label: string | null;
  description: string | null;
  steps: string[] | null; // jsonb array of text
  store_url: string | null;
  active: boolean | null;
  requires_proof: boolean | null;
  created_at: string;
};

function fromSlideRow(r: SlideRow): Slide {
  return { id: r.id, image: r.image, link: r.link ?? undefined };
}
function fromOfferRow(r: OfferRow): OfferItem {
  return {
    id: r.id,
    title: r.title,
    amount: r.amount,
    icon: r.icon ?? undefined,
    label: r.label ?? undefined,
    description: r.description ?? undefined,
    steps: r.steps ?? undefined,
    storeUrl: r.store_url ?? undefined,
    active: r.active ?? undefined,
    requiresProof: r.requires_proof ?? undefined,
  };
}

function toOfferInsert(input: Omit<OfferItem, 'id' | 'label'> & { id?: string; label?: string }) {
  return {
    title: input.title,
    amount: input.amount,
    icon: input.icon ?? null,
    label: input.label ?? null,
    description: input.description ?? null,
    steps: input.steps ?? null,
    store_url: input.storeUrl ?? null,
    active: input.active ?? true,
    requires_proof: input.requiresProof ?? false,
  };
}

function toOfferPatch(patch: Partial<OfferItem>) {
  return {
    title: patch.title,
    amount: patch.amount,
    icon: patch.icon ?? undefined,
    label: patch.label ?? undefined,
    description: patch.description ?? undefined,
    steps: patch.steps ?? undefined,
    store_url: patch.storeUrl ?? undefined,
    active: patch.active ?? undefined,
    requires_proof: patch.requiresProof ?? undefined,
  };
}

export function seedContent() {
  // No-op when using Supabase
}

export function getSlides(): Slide[] {
  // This synchronous API is kept for backward-compat. It returns an empty array immediately.
  // Use subscribeSlides to receive realtime data shortly after.
  return [];
}
export function subscribeSlides(cb: (items: Slide[]) => void) {
  let cancelled = false;
  // initial load
  (async () => {
    const { data, error } = await supabase
      .from('slides')
      .select('*')
      .order('created_at', { ascending: false });
    if (!cancelled) cb((data as SlideRow[] | null)?.map(fromSlideRow) ?? []);
    if (error) console.warn('[slides] load error', error.message);
  })();

  const channel = supabase
    .channel('slides-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'slides' }, async () => {
      const { data } = await supabase
        .from('slides')
        .select('*')
        .order('created_at', { ascending: false });
      if (!cancelled) cb((data as SlideRow[] | null)?.map(fromSlideRow) ?? []);
    })
    .subscribe();

  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
}
export function addSlide(input: Omit<Slide, 'id'> & { id?: string }) {
  // Fire and forget; return a local object for immediate UI response
  const id = input.id?.trim() || cryptoRandomId('slide');
  const newSlide: Slide = { id, image: input.image, link: input.link };
  supabase.from('slides').insert({ id, image: input.image, link: input.link ?? null }).then(({ error }: { error: any }) => {
    if (error) console.warn('[slides] insert error', error.message);
  });
  return newSlide;
}
export function deleteSlide(id: string) {
  supabase.from('slides').delete().eq('id', id).then(({ error }: { error: any }) => {
    if (error) console.warn('[slides] delete error', error.message);
  });
}

export function updateSlide(id: string, patch: Partial<Slide>) {
  const update = {
    image: patch.image,
    link: patch.link ?? undefined,
  } as { image?: string; link?: string | null };
  // Map undefined to leave untouched, and explicit nulls for nullable columns
  if (Object.prototype.hasOwnProperty.call(patch, 'link')) {
    update.link = patch.link ?? null;
  }
  supabase.from('slides').update(update).eq('id', id).then(({ error }: { error: any }) => {
    if (error) console.warn('[slides] update error', error.message);
  });
}

export function getOffers(): OfferItem[] {
  // For backward-compat synchronous calls. Use subscribeOffers for data.
  return [];
}
export function getOfferById(id: string): OfferItem | undefined {
  // Synchronous fallback returns undefined; rely on subscribeOffers to populate UI
  return undefined;
}
export async function fetchOfferById(id: string): Promise<OfferItem | null> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .limit(1);
  if (error) throw error;
  const row = (data as any[] | null)?.[0] as OfferRow | undefined;
  return row ? fromOfferRow(row) : null;
}
export function subscribeOfferById(id: string, cb: (item: OfferItem | null) => void) {
  let cancelled = false;
  (async () => {
    try {
      const first = await fetchOfferById(id);
      if (!cancelled) cb(first);
    } catch (e) {
      if (!cancelled) cb(null);
    }
  })();

  const channel = supabase
    .channel(`offer-${id}-changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `id=eq.${id}` }, async () => {
      try {
        const next = await fetchOfferById(id);
        if (!cancelled) cb(next);
      } catch {
        if (!cancelled) cb(null);
      }
    })
    .subscribe();

  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
}
export function subscribeOffers(cb: (items: OfferItem[]) => void) {
  let cancelled = false;
  (async () => {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!cancelled) cb((data as OfferRow[] | null)?.map(fromOfferRow) ?? []);
    if (error) console.warn('[offers] load error', error.message);
  })();

  const channel = supabase
    .channel('offers-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, async () => {
      const { data } = await supabase
        .from('offers')
        .select('*')
        .order('created_at', { ascending: false });
      if (!cancelled) cb((data as OfferRow[] | null)?.map(fromOfferRow) ?? []);
    })
    .subscribe();

  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
}
export function addOffer(input: Omit<OfferItem, 'id' | 'label'> & { id?: string; label?: string }) {
  const id = input.id?.trim() || cryptoRandomId('offer');
  const label = input.label || null; // label is optional now
  const insert = { id, ...toOfferInsert({ ...input, label: label ?? undefined }) } as any;
  supabase.from('offers').insert(insert).then(({ error }: { error: any }) => {
    if (error) console.warn('[offers] insert error', error.message);
  });
  return fromOfferRow({
    id,
    title: input.title,
    amount: input.amount,
    icon: input.icon ?? null,
    label,
    description: input.description ?? null,
    steps: input.steps ?? null,
    store_url: input.storeUrl ?? null,
    active: input.active ?? true,
    requires_proof: input.requiresProof ?? false,
    created_at: new Date().toISOString(),
  });
}
export function updateOffer(id: string, patch: Partial<OfferItem>) {
  const update = toOfferPatch(patch);
  supabase.from('offers').update(update).eq('id', id).then(({ error }: { error: any }) => {
    if (error) console.warn('[offers] update error', error.message);
  });
}
export function deleteOffer(id: string) {
  supabase.from('offers').delete().eq('id', id).then(({ error }: { error: any }) => {
    if (error) console.warn('[offers] delete error', error.message);
  });
}
export function setOfferVisibility(id: string, active: boolean) {
  updateOffer(id, { active });
}

// Simple local ID generator to mimic previous synchronous behavior
function cryptoRandomId(prefix: string) {
  try {
    // @ts-ignore
    const bytes = globalThis.crypto?.getRandomValues(new Uint8Array(8));
    const n = bytes ? Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('') : `${Date.now()}`;
    return `${prefix}-${n}`;
  } catch {
    return `${prefix}-${Date.now()}`;
  }
}
