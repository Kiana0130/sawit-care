import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ScanApiError, getScanDetail, getScanPhoto, releaseScanPhoto, type ScanPhotoSource } from '@/lib/scan-api';

const PRIMARY = '#1B5E20';

export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [item, setItem] = useState<Awaited<ReturnType<typeof getScanDetail>> | null>(null);
  const [photo, setPhoto] = useState<ScanPhotoSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!id) {
      setError('ID riwayat tidak ditemukan.');
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    getScanDetail(id)
      .then(async (value) => {
        const image = await getScanPhoto(id);
        if (active) { setItem(value); setPhoto(image); setError(null); }
        else releaseScanPhoto(image);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof ScanApiError ? cause.message : 'Detail scan tidak dapat dimuat.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]));

  useEffect(() => () => {
    if (photo) releaseScanPhoto(photo);
  }, [photo]);

  if (loading) return <View style={styles.state}><ActivityIndicator size="large" color={PRIMARY} /><Text style={styles.text}>Memuat detail scan...</Text></View>;
  if (error || !item) return <View style={styles.state}><Text style={styles.title}>Detail tidak tersedia</Text><Text style={styles.text}>{error ?? 'Scan tidak ditemukan.'}</Text></View>;

  const date = new Date(item.scanned_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Makassar' });
  return (
    <View style={styles.screen}>
      {photo ? <Image source={photo} style={styles.photo} resizeMode="cover" /> : <View style={styles.photoPlaceholder}><SymbolView name={{ ios: 'leaf', android: 'eco', web: 'eco' }} tintColor="#9E9E9E" size={50} /><Text style={styles.text}>Foto tidak tersedia</Text></View>}
      <View style={styles.pending}><SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} tintColor="#8D6E00" size={24} /><Text style={styles.pendingTitle}>Menunggu model AI</Text></View>
      <Text style={styles.body}>Foto dan waktu scan sudah tersimpan. Dataset/model AI belum tersedia, jadi belum ada diagnosis, nama penyakit, atau tingkat keyakinan.</Text>
      <Text style={styles.meta}>Disimpan {date} WITA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F5', padding: 20, paddingTop: 32 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  photo: { height: 230, width: '100%', borderRadius: 16, backgroundColor: '#E8F5E9' },
  photoPlaceholder: { height: 230, borderRadius: 16, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', gap: 10 },
  pending: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF8E1', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, marginTop: 24 },
  pendingTitle: { color: '#8D6E00', fontSize: 14, fontWeight: '800' }, title: { color: '#212121', fontSize: 20, fontWeight: '800' },
  body: { color: '#424242', fontSize: 15, lineHeight: 23, marginTop: 18 }, meta: { color: '#757575', fontSize: 13, marginTop: 16 }, text: { color: '#757575', textAlign: 'center' },
});
