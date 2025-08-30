import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Animated,
  Easing,
  BackHandler,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Constants from 'expo-constants';
import { createOrReuseActiveTransaction } from '../../lib/transactions';
import { subscribeOfferById, fetchOfferById } from '../../lib/content';
import { useAuth } from '@/hooks/useAuth';
import { getProfile } from '@/lib/profile';

// Simple pulse animation hook for skeletons
function usePulse() {
  const opacity = React.useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

// Skeleton loader matching the details layout
function SkeletonLoader({ isDark }: { isDark: boolean }) {
  const opacity = usePulse();
  const baseBg = isDark ? '#1E293B' : '#FFFFFF';
  const bone = isDark ? '#334155' : '#E5E7EB';
  const containerBg = isDark ? '#0B0F14' : '#F7F8FA';

  return (
    <View style={{ gap: 12, backgroundColor: containerBg }}>
      {/* Card skeleton */}
      <View style={[styles.card, isDark ? { backgroundColor: baseBg, shadowOpacity: 0 } : null]}>
        <View style={styles.offerRow}>
          {/* Icon */}
          <Animated.View style={[styles.iconBox, { backgroundColor: bone, opacity }]} />
          <View style={{ flex: 1, marginRight: 12 }}>
            {/* Title line */}
            <Animated.View style={{ height: 18, width: '70%', borderRadius: 4, backgroundColor: bone, marginBottom: 8, opacity }} />
            {/* Desc lines */}
            <Animated.View style={{ height: 12, width: '95%', borderRadius: 4, backgroundColor: bone, marginBottom: 6, opacity }} />
            <Animated.View style={{ height: 12, width: '80%', borderRadius: 4, backgroundColor: bone, opacity }} />
          </View>
          {/* Amount badge */}
          <Animated.View style={[styles.coinBadge, { backgroundColor: bone, borderColor: bone, opacity }]} />
        </View>
      </View>

      {/* Steps title */}
      <Animated.View style={{ height: 18, width: 160, borderRadius: 4, backgroundColor: bone, marginTop: 6, marginBottom: 6, opacity }} />
      {/* Steps card */}
      <View style={[styles.stepsCard, isDark ? { backgroundColor: baseBg, shadowOpacity: 0 } : null]}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={styles.stepRow}>
            <Animated.View style={[styles.stepNumber, { backgroundColor: bone, opacity }]} />
            <Animated.View style={{ flex: 1, height: 14, borderRadius: 4, backgroundColor: bone, opacity }} />
            <Animated.View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: bone, marginLeft: 8, opacity }} />
          </View>
        ))}
      </View>

      {/* CTA button */}
      <Animated.View style={[styles.primaryBtn, { backgroundColor: bone, opacity }]} />
    </View>
  );
}

type Offer = {
  id: string;
  title: string;
  amount: number;
  icon?: string;
  description?: string;
  storeUrl?: string;
  steps?: string[];
  requiresProof?: boolean;
};

export default function OfferDetailsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id } = useLocalSearchParams<{ id: string }>();
  const isFocused = useIsFocused();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [seenFirstSnapshot, setSeenFirstSnapshot] = useState(false);
  const [showNotFound, setShowNotFound] = useState(false);
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!id) return () => { mounted = false; };
    (async () => {
      try {
        const first = await fetchOfferById(String(id));
        if (!mounted) return;
        setOffer(first);
      } finally {
        if (mounted) setSeenFirstSnapshot(true);
        if (mounted) setLoading(false);
      }
    })();

    const unsub = subscribeOfferById(String(id), (item) => {
      if (!mounted) return;
      setOffer(item);
    });
    return () => { mounted = false; unsub(); };
  }, [id]);

  // Ensure Android hardware back returns to Home tab
  useEffect(() => {
    if (!isFocused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)');
      return true; // prevent default
    });
    return () => sub.remove();
  }, [isFocused]);

  // After initial snapshot, if still no offer, reveal Not Found after a short delay (prevents flicker)
  useEffect(() => {
    if (!isFocused) { setShowNotFound(false); return; }
    if (!seenFirstSnapshot) return;
    if (offer) { setShowNotFound(false); return; }
    const t = setTimeout(() => setShowNotFound(true), 700);
    return () => clearTimeout(t);
  }, [isFocused, seenFirstSnapshot, offer]);

  // Load admin flag (unused currently, retained for future admin-only controls)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user) { if (!cancelled) setIsAdmin(false); return; }
        const p = await getProfile(user.id);
        if (!cancelled) setIsAdmin(!!p?.is_admin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const steps = useMemo(() => (
    offer?.steps && offer.steps.length ? offer.steps : [
      'Install the app',
      'Open and register with your phone number',
      'Complete one game/tutorial',
    ]
  ), [offer?.steps]);

  const openStore = () => {
    if (!offer) return;

    if (!user) { router.push('/(tabs)/profile'); return; }
    // Create or reuse a single active transaction per (user, offer)
    createOrReuseActiveTransaction({
      userId: user.id,
      offerId: offer.id,
      offerTitle: offer.title,
      offerIconUrl: offer.icon,
      amount: offer.amount,
    }).catch((e: any) => {
      Alert.alert('Could not start task', e?.message || 'Failed to create transaction');
    });
    if (offer.storeUrl) {
      Linking.openURL(offer.storeUrl).catch(() => {});
    }
  };

  // Avoid showing placeholder UI before data resolves to prevent flicker of "App Name"
  if (loading) {
    if (!isFocused) return null; // do not render skeleton when navigating away
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: '#0B0F14' }]} edges={['top']}>
          <ScrollView contentContainerStyle={[styles.container, isDark && { backgroundColor: '#0B0F14' }]}>
            <SkeletonLoader isDark={isDark} />
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // If we've seen data but there's no offer, show not-found with manual back (no auto nav)
  if (isFocused && seenFirstSnapshot && !offer && showNotFound) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: '#0B0F14' }]} edges={['top']}>
          <View style={[styles.container, isDark && { backgroundColor: '#0B0F14' }]}> 
            <Text style={[styles.sectionTitle, isDark && { color: '#E5E7EB' }]}>Offer not found</Text>
            <TouchableOpacity onPress={() => { router.replace('/(tabs)'); }} style={[styles.primaryBtn, { marginTop: 12 }]}> 
              <Text style={styles.primaryBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  // If not focused, render nothing (after hooks are registered)
  if (!isFocused) return null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: '#0B0F14' }]} edges={['top']}> 
        <ScrollView contentContainerStyle={[styles.container, isDark && { backgroundColor: '#0B0F14' }]}>
        {/* Offer card info */}
        <View style={[styles.card, isDark ? { backgroundColor: '#1E293B', shadowOpacity: 0 } : null]}>
          <View style={styles.offerRow}>
            <View style={styles.iconBox}>
              {offer?.icon ? (
                <Image source={{ uri: offer.icon }} style={styles.iconImg} />
              ) : (
                <MaterialIcons name="apps" size={28} color="#fff" />
              )}
            </View>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.appName, isDark && { color: '#E5E7EB' }]}>{offer?.title ?? 'App Name'}</Text>
              <Text style={[styles.appDesc, isDark && { color: '#CBD5E1' }]} numberOfLines={2}>
                {offer?.description ?? 'Complete simple steps to earn rewards.'}
              </Text>
            </View>
            <View style={styles.coinBadge}>
              <Text style={styles.coinText}>{`₹${offer?.amount ?? 0}`}</Text>
            </View>
          </View>
        </View>

        {/* Steps */}
        <Text style={[styles.sectionTitle, isDark && { color: '#E5E7EB' }]}>Steps to Complete</Text>
        <View style={[styles.stepsCard, isDark ? { backgroundColor: '#1E293B', shadowOpacity: 0 } : null]}>
          {steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{i + 1}</Text></View>
              <Text style={[styles.stepText, isDark && { color: '#E5E7EB' }]}>{s}</Text>
              <MaterialIcons name="check-circle-outline" size={20} color={isDark ? '#64748B' : '#C7CCD6'} />
            </View>
          ))}
        </View>

        {/* CTA Button: Login gate */}
        <TouchableOpacity
          onPress={() => { if (!user) { router.push('/(tabs)/profile'); } else { openStore(); } }}
          activeOpacity={0.9}
          style={[styles.primaryBtn, isDark && { backgroundColor: '#4338CA' }]}
        >
          <Text style={styles.primaryBtnText}>{user ? 'Install App' : 'Login to install app'}</Text>
        </TouchableOpacity>

        {/* Screenshot proof temporarily disabled */}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F7F8FA',
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#F7F8FA',
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#6C8CFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconImg: { width: 56, height: 56, borderRadius: 12 },
  appName: { fontSize: 18, fontWeight: '900', color: '#1D1D1D' },
  appDesc: { marginTop: 2, color: '#4A4A4A', fontSize: 13 },
  coinBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFD36A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFE9B6',
  },
  coinText: { fontWeight: '900', color: '#6A4B00' },

  sectionTitle: {
    marginTop: 6,
    marginBottom: 6,
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  stepsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E8EDFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepNumberText: { color: '#2947F7', fontWeight: '900', fontSize: 12 },
  stepText: { flex: 1, color: '#2A2A2A', fontSize: 14, fontWeight: '600' },

  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  proofCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C7CCD6',
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFBFF',
  },
  uploadBoxPicked: {
    borderColor: '#2563EB',
    backgroundColor: '#F0F4FF',
  },
  uploadText: { marginTop: 6, color: '#6B7280', fontWeight: '700' },
  submitBtn: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#A9B4CC',
  },
  submitBtnText: { color: '#fff', fontWeight: '900' },
  submitBtnTextDisabled: { color: '#F0F0F0' },
});
