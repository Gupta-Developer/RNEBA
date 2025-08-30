import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, SafeAreaView, Platform, StatusBar, useColorScheme, Linking } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { getSlides, subscribeSlides, type Slide, getOffers, subscribeOffers, type OfferItem } from '../../lib/content';
import { subscribeTransactionsForUser, type Transaction } from '@/lib/transactions';
import { getProfile } from '@/lib/profile';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const [activeCarousel, setActiveCarousel] = useState(0);
  const [allOffers, setAllOffers] = useState<OfferItem[]>(getOffers());
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [slides, setSlides] = useState<Slide[]>(getSlides());
  const [isAdmin, setIsAdmin] = useState(false);
  const [paidOfferIds, setPaidOfferIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Subscribe to content store so Admin additions reflect immediately
    const unsubSlides = subscribeSlides(setSlides);
    const unsubOffers = subscribeOffers((items) => {
      // store all; we'll filter by paid in a memo
      setAllOffers(items);
      setLoadingOffers(false);
    });
    // Optionally simulate loading state on first mount
    setLoadingOffers(false);
    return () => {
      unsubSlides();
      unsubOffers();
    };
  }, []);

  // Track user's paid transactions to hide those offers on Home
  useEffect(() => {
    if (!user) { setPaidOfferIds(new Set()); return; }
    const unsub = subscribeTransactionsForUser(user.id, (items: Transaction[]) => {
      const paid = new Set(items.filter((t) => t.status === 'paid' && !!t.offer_id).map((t) => String(t.offer_id)));
      setPaidOfferIds(paid);
    });
    return unsub;
  }, [user?.id]);

  // Load profile to determine admin flag
  useEffect(() => {
    let cancelled = false;
    async function loadAdmin() {
      try {
        if (!user) {
          if (!cancelled) setIsAdmin(false);
          return;
        }
        const p = await getProfile(user.id);
        if (!cancelled) setIsAdmin(!!p?.is_admin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    }
    loadAdmin();
    return () => { cancelled = true; };
  }, [user]);

  // Compute visible offers: active and not already paid by the user
  const visibleOffers = useMemo(() => {
    const active = allOffers.filter((o) => o.active !== false);
    if (!paidOfferIds.size) return active;
    return active.filter((o) => !paidOfferIds.has(String(o.id)));
  }, [allOffers, paidOfferIds]);

  const MIN_VISIBLE = 8;
  const dummyCount = useMemo(() => Math.max(0, MIN_VISIBLE - visibleOffers.length), [visibleOffers.length]);

  return (
    <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: '#0B0F14' }] }>
      <ScrollView contentContainerStyle={[styles.container, isDark && { backgroundColor: '#0B0F14' }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>EarnByApps</Text>
        <MaterialIcons name="north-east" size={18} color="#FF7A00" style={styles.arrowIcon} />
        {isAdmin && (
          <TouchableOpacity
            onPress={() => router.push('/admin')}
            style={[styles.authBtn, { right: 16, backgroundColor: isDark ? '#4F46E5' : '#2563EB' }]}
          >
            <Text style={styles.authBtnText}>Admin</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tagline */}
      <Text style={[styles.tagline, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>India's Largest Earning App</Text>

      {/* (Tabs removed as requested) */}

      {/* Carousel (image-based) */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActiveCarousel(index);
        }}
        style={styles.carousel}
      >
        {slides.map((slide) => {
          const onPress = async () => {
            if (!slide.link) return;
            try {
              if (slide.link.startsWith('/')) {
                router.push(slide.link as any);
              } else {
                await Linking.openURL(slide.link);
              }
            } catch {}
          };
          return (
            <TouchableOpacity
              key={slide.id}
              activeOpacity={0.9}
              onPress={onPress}
              style={{ width: SCREEN_WIDTH }}
            >
              <View style={{ marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' }}>
                <Image
                  source={{ uri: slide.image }}
                  style={{ width: '100%', height: 160, backgroundColor: '#e5e7eb' }}
                  resizeMode="cover"
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dotsRow}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeCarousel && styles.dotActive]} />
        ))}
      </View>

      {/* Section Title */}
      <Text style={[styles.sectionTitle, isDark && { color: '#E5E7EB' }]}>All Offers</Text>

      {/* Real Offers */}
      <View style={styles.offerList}>
        {visibleOffers.map((offer, idx) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            index={idx}
            onPress={() => router.push(`/offer/${offer.id}` as Href)}
          />
        ))}

        {/* Dummy Offers */}
        {Array.from({ length: dummyCount }).map((_, i) => (
          <OfferCard key={`dummy-${i}`} dummy index={visibleOffers.length + i} />
        ))}

        {loadingOffers && <Text style={[styles.loadingText, isDark && { color: '#9CA3AF' }]}>Loading offers...</Text>}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Types
type Offer = OfferItem;

// Components
function OfferCard({ offer, dummy, index, onPress }: { offer?: Offer; dummy?: boolean; index: number; onPress?: () => void }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const label = offer?.label ?? `Offer ${index + 1}`;
  const amount = offer?.amount ?? (index % 2 === 0 ? 5 : 7);
  const description = offer ? (offer.description || 'Complete simple steps to earn rewards.') : '────────────── ──────────────';
  const [ctaPressed, setCtaPressed] = useState(false);
  return (
    <View style={styles.offerCardWrapper}> 
      <View style={styles.offerLabelPill}>
        <Text style={styles.offerLabelText}>{label}</Text>
      </View>
      <View
        style={[
          styles.offerCard,
          isDark ? styles.offerCardDark : styles.offerCardLight,
          dummy && (isDark ? styles.offerCardMutedDark : styles.offerCardMuted),
        ]}
      >
        {/* Top Row: Icon + Name + Reward Pill */}
        <View style={styles.cardTopRow}>
          <View style={[styles.iconPlaceholder, dummy ? styles.iconMuted : styles.iconVibrant]}>
            {offer?.icon ? (
              <Image source={{ uri: offer.icon }} style={{ width: 48, height: 48, borderRadius: 10 }} />
            ) : (
              <MaterialIcons name="apps" size={26} color={dummy ? '#9AA0A6' : '#ffffff'} />
            )}
          </View>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text
              numberOfLines={1}
              style={[
                styles.offerTitle,
                { fontSize: 16 },
                isDark && { color: '#E5E7EB' },
                dummy && styles.offerTitleMuted,
              ]}
            >
              {offer?.title ?? '──────────────'}
            </Text>
          </View>
          <View
            style={[
              styles.rewardPill,
              isDark ? styles.rewardPillDark : styles.rewardPillLight,
              dummy && styles.rewardPillDisabled,
            ]}
          >
            <Text
              style={[
                styles.rewardText,
                isDark ? styles.rewardTextDark : styles.rewardTextLight,
                dummy && styles.rewardTextDisabled,
              ]}
            >
              {`₹${amount}`}
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text
          numberOfLines={2}
          style={[
            styles.offerDesc,
            { color: isDark ? '#D1D5DB' : '#4B5563' },
            dummy && styles.offerTitleMuted,
          ]}
        >
          {description}
        </Text>

        {/* Divider */}
        <View style={[styles.cardDivider, { backgroundColor: isDark ? '#334155' : '#E5E7EB' }]} />

        {/* Footer: Solid View Details button */}
        <TouchableOpacity
          disabled={dummy}
          activeOpacity={0.9}
          onPress={onPress}
          onPressIn={() => setCtaPressed(true)}
          onPressOut={() => setCtaPressed(false)}
          style={[
            styles.viewDetailsBtn,
            {
              backgroundColor: isDark
                ? (ctaPressed ? '#4338CA' : '#4F46E5')
                : (ctaPressed ? '#1D4ED8' : '#2563EB'),
            },
          ]}
        >
          <Text style={styles.viewDetailsBtnText}>View Details →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    // Ensure content starts below status bar / notch across platforms
    paddingTop: Platform.select({
      ios: 0,
      android: StatusBar.currentHeight ?? 0,
      web: 'env(safe-area-inset-top)' as any,
      default: 0,
    }) as any,
    backgroundColor: '#FFF',
    flex: 1,
  },
  container: {
    paddingTop: 12,
    paddingBottom: 96, // space for bottom tabs
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    position: 'relative',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2563EB', // brand blue
  },
  arrowIcon: {
    marginTop: 2,
  },
  authBtn: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  authBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  tagline: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  // tabs styles removed
  carousel: {
    marginTop: 12,
  },
  // removed old text-based card styles
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C4C4C4',
  },
  dotActive: {
    backgroundColor: '#000',
  },
  sectionTitle: {
    marginTop: 16,
    marginHorizontal: 16,
    fontSize: 22,
    fontWeight: '900',
    color: '#111',
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 8,
  },
  offerList: {
    marginTop: 8,
    paddingHorizontal: 12,
    gap: 12,
  },
  offerCardWrapper: {
    position: 'relative',
  },
  offerLabelPill: {
    position: 'absolute',
    top: -8,
    left: 12,
    backgroundColor: '#2947F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    zIndex: 2,
  },
  offerLabelText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  offerCard: {
    borderRadius: 16,
    padding: 14,
    paddingTop: 18,
    gap: 8,
    minHeight: 120,
    // soft shadow
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  offerCardLight: {
    backgroundColor: '#FFFFFF',
  },
  offerCardMuted: {
    backgroundColor: '#F2F2F2',
  },
  offerCardDark: {
    backgroundColor: '#1E293B',
  },
  offerCardMutedDark: {
    backgroundColor: '#111827',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconVibrant: {
    backgroundColor: '#6C8CFF',
  },
  iconMuted: {
    backgroundColor: '#E0E0E0',
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E2E2E',
    flexShrink: 1,
  },
  offerTitleMuted: {
    color: '#9AA0A6',
    fontWeight: '600',
  },
  rewardPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardPillLight: { backgroundColor: '#FDE68A' },
  rewardPillDark: { backgroundColor: '#F59E0B' },
  rewardPillDisabled: { opacity: 0.6 },
  rewardText: { fontWeight: '900' },
  rewardTextLight: { color: '#1F2937' },
  rewardTextDark: { color: '#FFFFFF' },
  rewardTextDisabled: { opacity: 0.6 },

  offerDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginTop: 6,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  viewDetailsBtn: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  viewDetailsBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  // removed external details button styles
});
