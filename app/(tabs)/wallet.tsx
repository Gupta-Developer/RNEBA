import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, SafeAreaView, Platform, StatusBar, useColorScheme } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack } from 'expo-router';
import { subscribeTransactionsForUser, type Transaction } from '../../lib/transactions';
import { addTransactionListener } from '@/lib/txEvents';
import { useAuth } from '@/hooks/useAuth';

export default function WalletScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const [txs, setTxs] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!user) { setTxs([]); return; }
    const unsub = subscribeTransactionsForUser(user.id, setTxs);
    // Also merge local events for instant UI
    const removeEvt = addTransactionListener<Transaction>((tx) => {
      if (!tx || tx.user_id !== user.id) return;
      setTxs((prev) => {
        const without = prev.filter((p) => p.id !== tx.id);
        return [tx, ...without];
      });
    });
    return () => { unsub(); removeEvt(); };
  }, [user?.id]);

  const completed = useMemo(() => txs.filter((t) => t.status === 'paid').length, [txs]);

  // Display rule: for each offer_id, only keep the most recent non-paid tx (pending/rejected),
  // but include all paid transactions.
  const displayTxs = useMemo(() => {
    const latestNonPaidByOffer = new Map<string, Transaction>();
    const paid: Transaction[] = [];
    for (const t of txs) {
      if (t.status === 'paid') {
        paid.push(t);
      } else if (t.offer_id) {
        const key = String(t.offer_id);
        const prev = latestNonPaidByOffer.get(key);
        if (!prev || new Date(t.created_at).getTime() > new Date(prev.created_at).getTime()) {
          latestNonPaidByOffer.set(key, t);
        }
      } else {
        // no offer_id, keep as-is (treat each unique id)
        latestNonPaidByOffer.set(t.id, t);
      }
    }
    const dedupNonPaid = Array.from(latestNonPaidByOffer.values());
    // Keep original order (already sorted desc by subscribe), so merge by id presence order
    const keep = new Set(dedupNonPaid.map((t) => t.id).concat(paid.map((t) => t.id)));
    return txs.filter((t) => keep.has(t.id));
  }, [txs]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'History',
          headerTitleAlign: 'center',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#2563EB', fontWeight: '900', marginRight: 4 }}>EarnByApps</Text>
              <MaterialIcons name="north-east" size={16} color="#FF7A00" />
            </View>
          ),
        }}
      />
      <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: '#0B0F14' }]}>
        <ScrollView contentContainerStyle={[styles.container, isDark && { backgroundColor: '#0B0F14' }]}>
          {/* Summary */}
          <View style={[
            styles.summaryCard,
            isDark ? { backgroundColor: '#1E3A8A' } : { backgroundColor: '#DBEAFE' }
          ]}>
            <Text style={[styles.summaryTitle, isDark && { color: '#E5E7EB' }]}>Total Tasks Completed</Text>
            <Text style={[styles.summaryNumber, isDark && { color: '#F3F4F6' }]}>{completed}</Text>
          </View>

          {/* History header */}
          <Text style={[styles.sectionTitle, isDark && { color: '#E5E7EB' }]}>Transaction History</Text>

          {/* Transactions */}
          <View style={{ gap: 10 }}>
            {displayTxs.map((t) => (
              <View key={t.id} style={[
                styles.txCard,
                isDark ? { backgroundColor: '#1E293B' } : { backgroundColor: '#fff' }
              ]}>
                {/* Left: icon */}
                <View style={styles.iconBox}>
                  {t.offer_icon_url ? (
                    <Image source={{ uri: t.offer_icon_url }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                  ) : (
                    <MaterialIcons name="apps" size={24} color="#fff" />
                  )}
                </View>
                {/* Middle */}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.txTitle, isDark && { color: '#E5E7EB' }]}>{t.offer_title ?? 'Task'}</Text>
                  <Text style={[styles.txTime, isDark && { color: '#9CA3AF' }]}>{formatTs(t.created_at)}</Text>
                </View>
                {/* Right: status */}
                <View style={[styles.statusBadge, statusStyle(t.status).bg]}>
                  <Text style={[styles.statusText, statusStyle(t.status).text]}>{t.status}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Footer Note */}
          <Text style={[styles.footerText, isDark && { color: '#9CA3AF' }] }>
            Didn't receive money?{"\n"}
            *Check Bank Statement - NOT PAYTM/GPAY BALANCE*{"\n"}
            You will get paid in 24 hours.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function formatTs(ts: string | number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} at ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function statusStyle(status: Transaction['status']) {
  switch (status) {
    case 'paid':
      return { text: { color: '#0F9D58' }, bg: { backgroundColor: '#E7F6EE' } };
    case 'pending':
      return { text: { color: '#F4B400' }, bg: { backgroundColor: '#FFF7E1' } };
    case 'rejected':
    default:
      return { text: { color: '#DB4437' }, bg: { backgroundColor: '#FDECEC' } };
  }
}

const styles = StyleSheet.create({
  safeArea: {
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
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#F7F8FA',
    gap: 12,
  },
  summaryCard: {
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  summaryNumber: {
    marginTop: 6,
    fontSize: 36,
    fontWeight: '900',
    color: '#111827',
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  txCard: {
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#6C8CFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: { fontWeight: '900', color: '#1F2937' },
  txTime: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusText: {
    fontWeight: '900',
    textTransform: 'lowercase',
  },
  footerText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 12,
  },
});
