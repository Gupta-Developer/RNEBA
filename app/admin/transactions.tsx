import React, { useCallback, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, useColorScheme, ActivityIndicator, Platform } from 'react-native';
import { fetchTransactions, type Transaction, type TransactionStatus } from '@/lib/transactions';

const statuses: Array<TransactionStatus | 'all'> = ['all', 'pending', 'paid', 'rejected'];

type Item = Transaction;

export default function TransactionsExplore() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Filters
  const [status, setStatus] = useState<TransactionStatus | 'all'>('pending');
  const [userId, setUserId] = useState<string>('');
  const [fromIso, setFromIso] = useState<string>('');
  const [toIso, setToIso] = useState<string>('');

  // Data
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 50;

  const canSearch = useMemo(() => !loading && !loadingMore, [loading, loadingMore]);

  const loadFirst = useCallback(async () => {
    if (!canSearch) return;
    setLoading(true);
    try {
      const { items: rows, nextCursor } = await fetchTransactions({
        status,
        userId: userId.trim() || undefined,
        from: fromIso.trim() || undefined,
        to: toIso.trim() || undefined,
        pageSize,
      });
      setItems(rows);
      setCursor(nextCursor);
    } catch (e: any) {
      console.warn('[txn-explore] load error', e?.message || e);
      setItems([]);
      setCursor(undefined);
    } finally {
      setLoading(false);
    }
  }, [status, userId, fromIso, toIso, canSearch]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      const { items: rows, nextCursor } = await fetchTransactions({
        status,
        userId: userId.trim() || undefined,
        from: fromIso.trim() || undefined,
        to: toIso.trim() || undefined,
        pageSize,
        cursor,
      });
      setItems(prev => [...prev, ...rows]);
      setCursor(nextCursor);
    } catch (e: any) {
      console.warn('[txn-explore] load more error', e?.message || e);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, status, userId, fromIso, toIso, loading, loadingMore]);

  const keyExtractor = useCallback((item: Item) => item.id, []);

  const renderItem = useCallback(({ item }: { item: Item }) => {
    return (
      <View style={[styles.row, isDark ? styles.rowDark : styles.rowLight]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
            {item.offer_title || 'Task'} • ₹{typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0}
          </Text>
          <Text style={[styles.sub, isDark && { color: '#9CA3AF' }]} numberOfLines={1}>
            {new Date(item.created_at).toLocaleString()} • {item.user_id}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.badge, item.status === 'paid' ? styles.badgePaid : item.status === 'rejected' ? styles.badgeRejected : styles.badgePending]}>
            {item.status}
          </Text>
        </View>
      </View>
    );
  }, [isDark]);

  const ListHeader = (
    <View style={{ gap: 10 }}>
      <Text style={[styles.pageTitle, isDark && { color: '#E5E7EB' }]}>Transactions Explore</Text>

      <View style={{ gap: 8 }}>
        <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Status</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {statuses.map(s => (
            <TouchableOpacity key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s ? styles.chipActive : (isDark ? styles.chipDark : styles.chipLight)]}>
              <Text style={[styles.chipText, status === s && { color: '#fff' }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>User ID (optional)</Text>
        <TextInput value={userId} onChangeText={setUserId} autoCapitalize="none" placeholder="uuid..." style={[styles.input, isDark ? styles.inputDark : styles.inputLight]} placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>From (ISO)</Text>
          <TextInput value={fromIso} onChangeText={setFromIso} autoCapitalize="none" placeholder="2024-01-01T00:00:00Z" style={[styles.input, isDark ? styles.inputDark : styles.inputLight]} placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>To (ISO)</Text>
          <TextInput value={toIso} onChangeText={setToIso} autoCapitalize="none" placeholder="2025-12-31T23:59:59Z" style={[styles.input, isDark ? styles.inputDark : styles.inputLight]} placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'} />
        </View>
      </View>

      <TouchableOpacity disabled={!canSearch} onPress={loadFirst} style={[styles.btn, { backgroundColor: canSearch ? '#2563EB' : '#9CA3AF' }]}>
        {loading ? (<ActivityIndicator color="#fff" />) : (<Text style={styles.btnText}>Fetch</Text>)}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: '#0B0F14' }]}> 
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        contentContainerStyle={[styles.container, isDark && { backgroundColor: '#0B0F14' }]}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={(
          <View style={{ marginVertical: 16, alignItems: 'center' }}>
            {loadingMore ? (
              <ActivityIndicator color={isDark ? '#E5E7EB' : '#111827'} />
            ) : cursor ? (
              <TouchableOpacity onPress={loadMore} style={[styles.btn, { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 10 }]}>
                <Text style={styles.btnText}>Load more</Text>
              </TouchableOpacity>
            ) : items.length > 0 ? (
              <Text style={[styles.sub, isDark && { color: '#9CA3AF' }]}>End of results</Text>
            ) : null}
          </View>
        )}
        removeClippedSubviews
        initialNumToRender={10}
        windowSize={11}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 16 },
  pageTitle: { fontSize: 22, fontWeight: '900', color: '#111827', textAlign: 'center' },
  label: { fontWeight: '800', color: '#374151' },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1 },
  inputLight: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  inputDark: { backgroundColor: '#111827', borderColor: '#374151', color: '#E5E7EB' },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '900' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipLight: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  chipDark: { backgroundColor: '#111827', borderColor: '#374151' },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#1E40AF' },
  chipText: { color: '#374151', fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, gap: 10 },
  rowLight: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' },
  rowDark: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#374151' },
  title: { fontWeight: '800', color: '#111827' },
  sub: { color: '#6B7280', marginTop: 2 },
  badge: { fontWeight: '900', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, overflow: 'hidden', color: '#fff' },
  badgePaid: { backgroundColor: '#10B981' },
  badgeRejected: { backgroundColor: '#EF4444' },
  badgePending: { backgroundColor: '#6B7280' },
});
