import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { deleteScan, ScanApiError, getScanHistory } from '@/lib/scan-api';
import { showConfirm } from '@/lib/feedback';

type Filter = 'all' | 'healthy' | 'sick' | 'pending';
type ScanItem = Awaited<ReturnType<typeof getScanHistory>>['items'][number];

const PRIMARY = '#1B5E20';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Semua' }, { key: 'healthy', label: 'Sehat' },
  { key: 'sick', label: 'Sakit' }, { key: 'pending', label: 'Menunggu' },
];

export default function HistoryScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getScanHistory(1, filter)
      .then((result) => { setItems(result.items); setError(null); })
      .catch((cause: unknown) => { setError(cause instanceof ScanApiError ? cause.message : 'Riwayat tidak dapat dimuat. Periksa koneksi.'); })
      .finally(() => { setLoading(false); });
    return () => undefined;
  }, [filter]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await deleteScan(id);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (cause) {
      setError(cause instanceof ScanApiError ? cause.message : 'Scan gagal dihapus.');
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: ScanItem }) => {
    const date = new Date(item.scanned_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Makassar' });
    const pending = item.status === 'pending';
    const healthy = item.status === 'healthy';
    return (
      <View style={styles.card}>
        <Pressable style={styles.itemButton} onPress={() => router.push({ pathname: '/scan-detail', params: { id: item.id } })}>
          <View style={[styles.iconWrap, { backgroundColor: pending ? '#FFF8E1' : healthy ? '#E8F5E9' : '#FFEBEE' }]}>
            <SymbolView name={{ ios: pending ? 'clock' : healthy ? 'checkmark' : 'exclamationmark.triangle', android: pending ? 'schedule' : healthy ? 'check' : 'warning', web: pending ? 'schedule' : healthy ? 'check' : 'warning' }} tintColor={pending ? '#8D6E00' : healthy ? PRIMARY : '#C62828'} size={22} />
          </View>
          <View style={styles.info}>
            <Text style={styles.date}>{date} WITA</Text>
            <Text style={styles.disease}>{pending ? 'Menunggu model AI' : healthy ? 'Sehat' : 'Terdeteksi sakit'}</Text>
            <Text style={styles.confidence}>{pending ? 'Foto tersimpan; hasil belum tersedia.' : 'Hasil diagnosis tersedia'}</Text>
          </View>
        </Pressable>
        <Pressable disabled={busyId === item.id} accessibilityRole="button" accessibilityLabel="Hapus riwayat" onPress={() => showConfirm('Hapus riwayat scan?', `Hapus riwayat scan pada ${date} WITA? Tindakan ini tidak dapat dibatalkan.`, 'Hapus', () => { void remove(item.id); })} style={styles.deleteButton}>
          {busyId === item.id ? <ActivityIndicator size="small" color="#C62828" /> : <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} tintColor="#C62828" size={19} />}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Riwayat Scan</Text>
      <FlatList
        ListHeaderComponent={<View style={styles.filterContainer}>{FILTERS.map((item) => <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.chip, filter === item.key && styles.chipActive]}><Text style={filter === item.key ? styles.chipTextActive : styles.chipText}>{item.label}</Text></Pressable>)}</View>}
        data={!loading && !error ? items : []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={loading ? <View style={styles.state}><ActivityIndicator size="large" color={PRIMARY} /><Text style={styles.stateText}>Memuat riwayat...</Text></View> : error ? <View style={styles.state}><Text style={styles.stateText}>{error}</Text><Pressable onPress={() => { void load(); }}><Text style={styles.retry}>Coba lagi</Text></Pressable></View> : <View style={styles.state}><SymbolView name={{ ios: 'doc.text.magnifyingglass', android: 'history', web: 'history' }} tintColor="#9E9E9E" size={44} /><Text style={styles.emptyTitle}>Belum ada riwayat scan</Text><Text style={styles.stateText}>Foto yang kamu simpan akan tampil di sini.</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', paddingTop: 60, paddingHorizontal: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#212121', marginBottom: 16 },
  filterContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0E0E0' },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY }, chipText: { color: '#757575', fontSize: 13, fontWeight: '600' }, chipTextActive: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  listContent: { paddingBottom: 20 }, card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 12, alignItems: 'center', elevation: 1 },
  itemButton: { flex: 1, flexDirection: 'row', alignItems: 'center' }, iconWrap: { width: 52, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, info: { flex: 1, marginHorizontal: 12 }, date: { fontSize: 11, color: '#9E9E9E', marginBottom: 4 }, disease: { fontSize: 15, fontWeight: '700', color: '#212121', marginBottom: 4 }, confidence: { fontSize: 12, color: '#757575' }, deleteButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }, stateText: { color: '#757575', textAlign: 'center', fontSize: 14 }, emptyTitle: { color: '#212121', fontSize: 17, fontWeight: '700' }, retry: { color: PRIMARY, fontWeight: '700', padding: 10 },
});
