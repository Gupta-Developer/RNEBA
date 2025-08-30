import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme, ScrollView, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { getProfile } from '@/lib/profile';
import { addSlide, deleteSlide, getSlides, subscribeSlides, updateSlide, type Slide } from '@/lib/content';
import { getOffers, subscribeOffers, addOffer, updateOffer, deleteOffer, type OfferItem } from '@/lib/content';
import { subscribeAllTransactions, updateTransactionStatus, type Transaction } from '@/lib/transactions';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/lib/profile';
import * as ImagePicker from 'expo-image-picker';

export default function AdminScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [slides, setSlides] = useState<Slide[]>(getSlides());
  const [offers, setOffers] = useState<OfferItem[]>(getOffers());
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [txFilter, setTxFilter] = useState<'all' | 'pending' | 'paid' | 'rejected'>('pending');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});

  // carousel add form fields
  const [image, setImage] = useState('');
  const [link, setLink] = useState('');
  const canAdd = useMemo(() => image.trim().length > 0, [image]);

  // offer form (with description and icon picker)
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [active, setActive] = useState(true);
  const [steps, setSteps] = useState<string[]>([]);
  const [newStep, setNewStep] = useState('');
  const canAddOffer = useMemo(() => title.trim().length > 0 && !!Number(amount), [title, amount]);

  // edit states
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [editSlideImage, setEditSlideImage] = useState('');
  const [editSlideLink, setEditSlideLink] = useState('');

  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStoreUrl, setEditStoreUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (!user) { setIsAdmin(false); return; }
        const p = await getProfile(user.id);
        if (!cancelled) setIsAdmin(!!p?.is_admin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const unsub = subscribeSlides(setSlides);
    const unsubOffers = subscribeOffers(setOffers);
    const unsubTx = subscribeAllTransactions(setTxs);
    return () => { unsub(); unsubOffers(); unsubTx(); };
  }, []);

  // Load profiles for all user_ids present in transactions
  useEffect(() => {
    (async () => {
      const ids = Array.from(new Set(txs.map(t => t.user_id))).filter(Boolean);
      if (ids.length === 0) { setProfilesMap({}); return; }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, upi_id, is_admin, updated_at')
        .in('id', ids);
      if (error) { console.warn('[admin] load profiles error', error.message); return; }
      const map: Record<string, UserProfile> = {};
      (data as UserProfile[]).forEach(p => { map[p.id] = p; });
      setProfilesMap(map);
    })();
  }, [txs]);

  const onAdd = () => {
    try {
      if (!canAdd) return;
      addSlide({ image: image.trim(), link: link.trim() || undefined });
      setImage('');
      setLink('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add slide');
    }
  };

  const onDelete = (id: string) => {
    deleteSlide(id);
  };

  // slide edit helpers
  const beginEditSlide = (s: Slide) => {
    setEditingSlideId(s.id);
    setEditSlideImage(s.image);
    setEditSlideLink(s.link ?? '');
  };
  const cancelEditSlide = () => {
    setEditingSlideId(null);
    setEditSlideImage('');
    setEditSlideLink('');
  };
  const saveEditSlide = () => {
    if (!editingSlideId) return;
    updateSlide(editingSlideId, { image: editSlideImage.trim(), link: editSlideLink.trim() || undefined });
    cancelEditSlide();
  };

  const onAddOffer = () => {
    try {
      if (!canAddOffer) return;
      addOffer({
        title: title.trim(),
        amount: Number(amount),
        icon: icon.trim() || undefined,
        description: description.trim() || undefined,
        storeUrl: storeUrl.trim() || undefined,
        active,
        steps: steps.length ? steps : undefined,
      });
      setTitle('');
      setAmount('');
      setIcon('');
      setDescription('');
      setStoreUrl('');
      setActive(true);
      setSteps([]);
      setNewStep('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add offer');
    }
  };

  const onDeleteOffer = (id: string) => {
    deleteOffer(id);
  };

  // Helpers: pick images and manage steps
  const pickSlideImage = async (forEdit?: boolean) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to pick an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.9,
      });
      if (!result.canceled) {
        const uri = result.assets?.[0]?.uri ?? '';
        if (!uri) return;
        if (forEdit) setEditSlideImage(uri); else setImage(uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to pick image');
    }
  };
  const pickIconImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to pick an icon.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled) {
        const uri = result.assets?.[0]?.uri ?? '';
        if (uri) setIcon(uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to pick icon');
    }
  };
  const pickEditIconImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1,1], quality: 0.8 });
      if (!result.canceled) {
        const uri = result.assets?.[0]?.uri ?? '';
        if (uri) setEditIcon(uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to pick icon');
    }
  };

  const addStep = () => {
    const s = newStep.trim();
    if (!s) return;
    setSteps((prev: string[]) => [...prev, s]);
    setNewStep('');
  };
  const removeStep = (index: number) => {
    setSteps((prev: string[]) => prev.filter((_, i) => i !== index));
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: '#0B0F14' }]}>
        <View style={[styles.container, isDark && { backgroundColor: '#0B0F14' }]}> 
          <Text style={[styles.title, isDark && { color: '#E5E7EB' }]}>Admin</Text>
          <Text style={[styles.note, isDark && { color: '#9CA3AF' }]}>Please sign in to access admin.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: '#0B0F14' }]}>
        <View style={[styles.container, isDark && { backgroundColor: '#0B0F14' }]}> 
          <Text style={[styles.title, isDark && { color: '#E5E7EB' }]}>Admin</Text>
          <Text style={[styles.note, isDark && { color: '#9CA3AF' }]}>You do not have admin access.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: '#0B0F14' }]}> 
      <ScrollView contentContainerStyle={[styles.container, isDark && { backgroundColor: '#0B0F14' }]}> 
        <Text style={[styles.title, isDark && { color: '#E5E7EB' }]}>Carousel Manager</Text>

        {/* Add form */}
        <View style={{ gap: 10, marginTop: 12 }}>
          <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Pick Image</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => pickSlideImage(false)} style={[styles.btn, { backgroundColor: '#4F46E5', paddingHorizontal: 12, paddingVertical: 10 }]}>
              <Text style={styles.btnText}>Pick</Text>
            </TouchableOpacity>
            {!!image && <Image source={{ uri: image }} style={{ width: 80, height: 45, borderRadius: 8 }} />}
          </View>

          <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Optional Link</Text>
          <TextInput
            value={link}
            onChangeText={setLink}
            placeholder="https://... or /offer/xyz"
            autoCapitalize="none"
            style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
          />

          <TouchableOpacity
            disabled={!canAdd}
            onPress={onAdd}
            style={[styles.btn, { backgroundColor: canAdd ? '#2563EB' : '#9CA3AF' }]}
          >
            <Text style={styles.btnText}>Add Slide</Text>
          </TouchableOpacity>
        </View>

        {/* List slides */}
        <View style={{ marginTop: 20, gap: 10 }}>
          <Text style={[styles.subTitle, isDark && { color: '#E5E7EB' }]}>Existing Slides</Text>
          {slides.map((s) => (
            <View key={s.id} style={[styles.slideRow, isDark ? styles.rowDark : styles.rowLight]}>
              {editingSlideId === s.id ? (
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {!!editSlideImage && <Image source={{ uri: editSlideImage }} style={{ width: 80, height: 45, borderRadius: 8 }} />}
                    <TouchableOpacity onPress={() => pickSlideImage(true)} style={[styles.btn, { backgroundColor: '#4F46E5', paddingHorizontal: 10, paddingVertical: 8 }]}>
                      <Text style={styles.btnText}>Replace Image</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={editSlideLink}
                    onChangeText={setEditSlideLink}
                    placeholder="https://... or /offer/xyz"
                    autoCapitalize="none"
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                    placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
                  />
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.slideText, isDark && { color: '#E5E7EB' }]}>{s.image}</Text>
                  {!!s.link && (
                    <Text numberOfLines={1} style={[styles.slideLink, isDark && { color: '#9CA3AF' }]}>{s.link}</Text>
                  )}
                </View>
              )}
              <View style={{ gap: 8 }}>
                {editingSlideId === s.id ? (
                  <>
                    <TouchableOpacity onPress={saveEditSlide} style={[styles.btn, { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 8 }]}>
                      <Text style={styles.btnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={cancelEditSlide} style={[styles.btn, { backgroundColor: '#6B7280', paddingHorizontal: 12, paddingVertical: 8 }]}>
                      <Text style={styles.btnText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => beginEditSlide(s)} style={[styles.btn, { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8 }]}>
                      <Text style={styles.btnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(s.id)} style={[styles.deleteBtn]}> 
                      <Text style={{ color: '#fff', fontWeight: '800' }}>Delete</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Offers Manager */}
        <View style={{ height: 24 }} />
        <Text style={[styles.title, isDark && { color: '#E5E7EB' }]}>Offers Manager</Text>

        {/* Add Offer form */}
        <View style={{ gap: 10, marginTop: 12 }}>
          <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Offer title"
            autoCapitalize="sentences"
            style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
          />

          <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Amount (₹)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g., 5"
            keyboardType="numeric"
            style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
          />
          {/* Pick an icon from gallery */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Offer Icon</Text>
            <TouchableOpacity onPress={pickIconImage} style={[styles.btn, { backgroundColor: '#4F46E5', paddingHorizontal: 12, paddingVertical: 8 }]}>
              <Text style={styles.btnText}>Pick</Text>
            </TouchableOpacity>
          </View>
          {!!icon && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image source={{ uri: icon }} style={{ width: 48, height: 48, borderRadius: 8 }} />
              <Text numberOfLines={1} style={[styles.slideLink, isDark && { color: '#9CA3AF' }]}>{icon}</Text>
            </View>
          )}

          <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Description (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Short description"
            multiline
            style={[styles.input, { minHeight: 72 }, isDark ? styles.inputDark : styles.inputLight]}
            placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
          />

          <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Store Link (optional)</Text>
          <TextInput
            value={storeUrl}
            onChangeText={setStoreUrl}
            placeholder="https://play.google.com/store/..."
            autoCapitalize="none"
            style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
          />

          {/* Steps editor */}
          <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Steps to Complete</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              value={newStep}
              onChangeText={setNewStep}
              placeholder="Add a step, e.g., Install the app"
              style={[styles.input, { flex: 1 }, isDark ? styles.inputDark : styles.inputLight]}
              placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
            />
            <TouchableOpacity onPress={addStep} style={[styles.btn, { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 12 }]}>
              <Text style={styles.btnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {steps.map((s, idx) => (
            <View key={`${s}-${idx}`} style={[styles.slideRow, isDark ? styles.rowDark : styles.rowLight]}> 
              <Text style={[styles.slideText, { flex: 1 }, isDark && { color: '#E5E7EB' }]} numberOfLines={2}>{idx + 1}. {s}</Text>
              <TouchableOpacity onPress={() => removeStep(idx)} style={[styles.deleteBtn]}> 
                <Text style={{ color: '#fff', fontWeight: '800' }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Active</Text>
            <Switch value={active} onValueChange={setActive} />
          </View>

          <TouchableOpacity
            disabled={!canAddOffer}
            onPress={onAddOffer}
            style={[styles.btn, { backgroundColor: canAddOffer ? '#2563EB' : '#9CA3AF' }]}
          >
            <Text style={styles.btnText}>Add Offer</Text>
          </TouchableOpacity>
        </View>

        {/* List offers */}
        <View style={{ marginTop: 20, gap: 10 }}>
          <Text style={[styles.subTitle, isDark && { color: '#E5E7EB' }]}>Existing Offers</Text>
          {offers.map((o) => (
            <View key={o.id} style={[styles.slideRow, isDark ? styles.rowDark : styles.rowLight]}>
              {editingOfferId === o.id ? (
                <View style={{ flex: 1, gap: 8 }}>
                  <TextInput value={editTitle} onChangeText={setEditTitle} placeholder="Title" style={[styles.input, isDark ? styles.inputDark : styles.inputLight]} placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'} />
                  <TextInput value={editAmount} onChangeText={setEditAmount} keyboardType="numeric" placeholder="Amount" style={[styles.input, isDark ? styles.inputDark : styles.inputLight]} placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Icon</Text>
                    <TouchableOpacity onPress={pickEditIconImage} style={[styles.btn, { backgroundColor: '#4F46E5', paddingHorizontal: 12, paddingVertical: 8 }]}>
                      <Text style={styles.btnText}>Pick</Text>
                    </TouchableOpacity>
                  </View>
                  {!!editIcon && <Image source={{ uri: editIcon }} style={{ width: 40, height: 40, borderRadius: 8 }} />}
                  <TextInput value={editDescription} onChangeText={setEditDescription} placeholder="Description" multiline style={[styles.input, { minHeight: 72 }, isDark ? styles.inputDark : styles.inputLight]} placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'} />
                  <TextInput value={editStoreUrl} onChangeText={setEditStoreUrl} placeholder="Store URL" autoCapitalize="none" style={[styles.input, isDark ? styles.inputDark : styles.inputLight]} placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'} />
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.slideText, isDark && { color: '#E5E7EB' }]}>{o.title}</Text>
                  <Text style={[styles.slideLink, isDark && { color: '#9CA3AF' }]}>₹{o.amount} • {o.active !== false ? 'Active' : 'Inactive'}</Text>
                </View>
              )}
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Active</Text>
                  <Switch value={(editingOfferId === o.id ? undefined : o.active) !== false} onValueChange={(v) => updateOffer(o.id, { active: v })} />
                </View>
                {editingOfferId === o.id ? (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        updateOffer(o.id, {
                          title: editTitle.trim() || o.title,
                          amount: Number(editAmount) || o.amount,
                          icon: editIcon || o.icon,
                          description: editDescription.trim() || o.description,
                          storeUrl: editStoreUrl.trim() || o.storeUrl,
                        });
                        setEditingOfferId(null);
                        setEditTitle(''); setEditAmount(''); setEditIcon(''); setEditDescription(''); setEditStoreUrl('');
                      }}
                      style={[styles.btn, { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 8 }]}
                    >
                      <Text style={styles.btnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingOfferId(null); setEditTitle(''); setEditAmount(''); setEditIcon(''); setEditDescription(''); setEditStoreUrl(''); }} style={[styles.btn, { backgroundColor: '#6B7280', paddingHorizontal: 12, paddingVertical: 8 }]}>
                      <Text style={styles.btnText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => { setEditingOfferId(o.id); setEditTitle(o.title); setEditAmount(String(o.amount)); setEditIcon(o.icon || ''); setEditDescription(o.description || ''); setEditStoreUrl(o.storeUrl || ''); }} style={[styles.btn, { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8 }]}>
                      <Text style={styles.btnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDeleteOffer(o.id)} style={[styles.deleteBtn]}> 
                      <Text style={{ color: '#fff', fontWeight: '800' }}>Delete</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Transactions Manager */}
        <View style={{ height: 24 }} />
        <Text style={[styles.title, isDark && { color: '#E5E7EB' }]}>Transactions Manager</Text>
        <View style={{ marginTop: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Filter</Text>
            {(['all','pending','paid','rejected'] as const).map((f) => (
              <TouchableOpacity key={f} onPress={() => setTxFilter(f)} style={[styles.chip, txFilter === f ? styles.chipActive : (isDark ? styles.chipDark : styles.chipLight)]}>
                <Text style={[styles.chipText, txFilter === f && { color: '#fff' }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Group by user */}
          {Object.entries(
            txs.reduce<Record<string, Transaction[]>>((acc, t) => {
              if (txFilter !== 'all' && t.status !== txFilter) return acc;
              (acc[t.user_id] ||= []).push(t);
              return acc;
            }, {})
          ).map(([uid, list]) => {
            const prof = profilesMap[uid];
            const header = `${prof?.full_name || 'Unknown User'}${prof?.phone ? ' • ' + prof.phone : ''}${prof?.upi_id ? ' • ' + prof.upi_id : ''}`;
            const sorted = [...list].sort((a,b) => (a.created_at < b.created_at ? 1 : -1));
            return (
              <View key={uid} style={{ gap: 8 }}>
                <View style={[styles.userHeader, isDark ? styles.rowDark : styles.rowLight]}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[styles.userTitle, isDark && { color: '#E5E7EB' }]}>{header}</Text>
                    <Text style={[styles.slideLink, isDark && { color: '#9CA3AF' }]}>{uid}</Text>
                  </View>
                </View>
                {sorted.map((t) => (
                  <View key={t.id} style={[styles.slideRow, isDark ? styles.rowDark : styles.rowLight]}> 
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[styles.slideText, isDark && { color: '#E5E7EB' }]}>
                        {t.offer_title ?? 'Task'} • ₹{t.amount ?? 0} • {t.status}
                      </Text>
                      <Text style={[styles.slideLink, isDark && { color: '#9CA3AF' }]}>
                        {new Date(t.created_at).toLocaleString()}
                      </Text>
                      <TextInput
                        value={noteDrafts[t.id] ?? t.notes ?? ''}
                        onChangeText={(v) => setNoteDrafts((d) => ({ ...d, [t.id]: v }))}
                        placeholder="Admin notes"
                        style={[styles.input, { marginTop: 8 }, isDark ? styles.inputDark : styles.inputLight]}
                        placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
                      />
                    </View>
                    <View style={{ gap: 6, alignItems: 'flex-end' }}>
                      <TouchableOpacity onPress={() => updateTransactionStatus(t.id, 'pending', { notes: noteDrafts[t.id] ?? t.notes ?? null, reviewed_by: user?.id ?? null })} style={[styles.btn, { backgroundColor: '#6B7280', paddingHorizontal: 10, paddingVertical: 8 }]}>
                        <Text style={styles.btnText}>Pending</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateTransactionStatus(t.id, 'rejected', { notes: noteDrafts[t.id] ?? t.notes ?? null, reviewed_by: user?.id ?? null })} style={[styles.btn, { backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 8 }]}>
                        <Text style={styles.btnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateTransactionStatus(t.id, 'paid', { notes: noteDrafts[t.id] ?? t.notes ?? null, reviewed_by: user?.id ?? null })} style={[styles.btn, { backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 8 }]}>
                        <Text style={styles.btnText}>Mark Paid</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  label: { fontWeight: '800', color: '#374151' },
  note: { marginTop: 12, textAlign: 'center', color: '#6B7280' },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
  },
  inputLight: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  inputDark: { backgroundColor: '#111827', borderColor: '#374151', color: '#E5E7EB' },
  btn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#FFFFFF', fontWeight: '900' },
  slideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  rowLight: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' },
  rowDark: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#374151' },
  slideText: { fontWeight: '700', color: '#111827' },
  slideLink: { color: '#6B7280', marginTop: 2 },
  deleteBtn: { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipLight: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  chipDark: { backgroundColor: '#111827', borderColor: '#374151' },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#1E40AF' },
  chipText: { color: '#374151', fontWeight: '800' },
});
