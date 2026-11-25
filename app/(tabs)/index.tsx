import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ScanApiError, getDashboardSummary, getScanQuota, type ScanQuota } from '@/lib/scan-api';

type Summary = Awaited<ReturnType<typeof getDashboardSummary>>;
const PRIMARY = '#1B5E20';

export default function HomeScreen() {
  const [quota, setQuota] = useState<ScanQuota | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getScanQuota(), getDashboardSummary()])
      .then(([nextQuota, nextSummary]) => {
        if (active) { setQuota(nextQuota); setSummary(nextSummary); setError(null); }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof ScanApiError ? cause.message : 'Ringkasan tidak dapat dimuat. Periksa koneksi.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const remaining = quota?.remaining;
  const limit = quota?.limit;
  const progress = typeof remaining === 'number' && typeof limit === 'number' && limit > 0
    ? `${Math.max(0, Math.min(100, ((limit - remaining) / limit) * 100))}%` as `${number}%`
    : '0%';

  return (
    <View style={styles.screen}>
      <View style={styles.header}><View><Text style={styles.greeting}>Halo, Petani!</Text><Text style={styles.subtitle}>Rawat kebun sawit lebih mudah.</Text></View><Text style={styles.badge}>{quota?.plan === 'pro' ? 'Paket PRO' : 'Paket Gratis'}</Text></View>
      <View style={styles.quotaCard}>
        <View style={styles.row}><Text style={styles.cardTitle}>Sisa Kuota Scan Hari Ini</Text>{loading ? <ActivityIndicator color={PRIMARY} /> : <Text style={styles.quota}>{limit === null ? '∞' : `${remaining ?? '—'}/${limit ?? 5}`}</Text>}</View>
        {limit !== null && <View style={styles.progressBackground}><View style={[styles.progress, { width: progress }]} /></View>}
        <Text style={styles.helper}>{error ?? (limit === null ? 'Kuota scan Anda tidak dibatasi.' : 'Kuota dihitung ulang setiap hari pukul 00.00 WITA.')}</Text>
      </View>
      <Text style={styles.sectionTitle}>Ringkasan Scan</Text>
      {quota && <Text style={styles.summaryPeriod}>{quota.plan === 'pro' ? 'Seluruh riwayat scan' : '7 hari terakhir'}</Text>}
      <View style={styles.statsRow}>
        <View style={styles.statCard}><SymbolView name={{ ios: 'viewfinder', android: 'center_focus_strong', web: 'center_focus_strong' }} tintColor={PRIMARY} size={20} /><Text style={styles.statValue}>{summary?.total_scans ?? '—'}</Text><Text style={styles.statLabel}>Total Scan</Text></View>
        <View style={styles.statCard}><SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} tintColor="#757575" size={20} /><Text style={styles.statValue}>{summary?.pending_scans ?? '—'}</Text><Text style={styles.statLabel}>Menunggu AI</Text></View>
      </View>
      <View style={styles.infoCard}><Text style={styles.infoTitle}>Deteksi dini, panen lebih baik</Text><Text style={styles.infoText}>Foto daun tersimpan dengan status menunggu model AI. Hasil diagnosis belum tersedia.</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F5', padding: 20, paddingTop: 58 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }, greeting: { color: '#1B1B1B', fontSize: 26, fontWeight: '800' }, subtitle: { color: '#757575', fontSize: 14, marginTop: 5 },
  badge: { color: PRIMARY, backgroundColor: '#E8F5E9', borderRadius: 16, fontSize: 12, fontWeight: '700', paddingHorizontal: 11, paddingVertical: 8 },
  quotaCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 26, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, cardTitle: { color: '#424242', fontSize: 15, fontWeight: '700' }, quota: { color: PRIMARY, fontSize: 18, fontWeight: '800' },
  progressBackground: { height: 9, backgroundColor: '#E0E0E0', borderRadius: 8, marginTop: 14, overflow: 'hidden' }, progress: { height: '100%', backgroundColor: PRIMARY, borderRadius: 8 }, helper: { color: '#757575', fontSize: 12, marginTop: 10 },
  sectionTitle: { color: '#212121', fontSize: 18, fontWeight: '800', marginBottom: 4 }, summaryPeriod: { color: '#757575', fontSize: 13, marginBottom: 12 }, statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 }, statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16 }, statValue: { color: '#212121', fontSize: 28, fontWeight: '800', marginTop: 4 }, statLabel: { color: '#757575', fontSize: 13, marginTop: 2 },
  infoCard: { backgroundColor: '#E8F5E9', borderRadius: 14, padding: 17 }, infoTitle: { color: PRIMARY, fontSize: 15, fontWeight: '800', marginBottom: 5 }, infoText: { color: '#4E6B50', fontSize: 13, lineHeight: 19 },
});
