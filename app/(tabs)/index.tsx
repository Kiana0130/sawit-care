import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const PRIMARY = '#1B5E20';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View><Text style={styles.greeting}>Halo, Petani!</Text><Text style={styles.subtitle}>Rawat kebun sawit lebih mudah.</Text></View>
        <Text style={styles.badge}>Paket Gratis</Text>
      </View>
      <View style={styles.quotaCard}>
        <View style={styles.row}><Text style={styles.cardTitle}>Sisa Kuota Scan Hari Ini</Text><Text style={styles.quota}>3/5</Text></View>
        <View style={styles.progressBackground}><View style={styles.progress} /></View>
        <Text style={styles.helper}>Gunakan kuota untuk memeriksa kesehatan daun.</Text>
      </View>
      <Text style={styles.sectionTitle}>Ringkasan Kebun</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statIcon}>◉</Text><Text style={styles.statValue}>12</Text><Text style={styles.statLabel}>Total Scan</Text></View>
        <View style={styles.statCard}><Text style={styles.statIcon}>⚠</Text><Text style={styles.statValue}>2</Text><Text style={styles.statLabel}>Pohon Sakit</Text></View>
      </View>
      <View style={styles.infoCard}><Text style={styles.infoTitle}>Deteksi dini, panen lebih baik</Text><Text style={styles.infoText}>Scan daun kelapa sawit untuk mendapatkan referensi awal kondisi tanaman.</Text></View>
      <Pressable style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]} onPress={() => router.push('/scan' as never)}><Text style={styles.scanButtonText}>Scan Sekarang</Text><Text style={styles.arrow}>→</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F5' }, content: { padding: 20, paddingTop: 58, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }, greeting: { color: '#1B1B1B', fontSize: 26, fontWeight: '800' }, subtitle: { color: '#757575', fontSize: 14, marginTop: 5 }, badge: { color: PRIMARY, backgroundColor: '#E8F5E9', borderRadius: 16, fontSize: 12, fontWeight: '700', paddingHorizontal: 11, paddingVertical: 8 },
  quotaCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 26, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, cardTitle: { color: '#424242', fontSize: 15, fontWeight: '700' }, quota: { color: PRIMARY, fontSize: 18, fontWeight: '800' }, progressBackground: { height: 9, backgroundColor: '#E0E0E0', borderRadius: 8, marginTop: 14, overflow: 'hidden' }, progress: { width: '60%', height: '100%', backgroundColor: PRIMARY, borderRadius: 8 }, helper: { color: '#9E9E9E', fontSize: 12, marginTop: 10 },
  sectionTitle: { color: '#212121', fontSize: 18, fontWeight: '800', marginBottom: 12 }, statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 }, statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16 }, statIcon: { color: PRIMARY, fontSize: 20 }, statValue: { color: '#212121', fontSize: 28, fontWeight: '800', marginTop: 4 }, statLabel: { color: '#757575', fontSize: 13, marginTop: 2 }, infoCard: { backgroundColor: '#E8F5E9', borderRadius: 14, padding: 17, marginBottom: 24 }, infoTitle: { color: PRIMARY, fontSize: 15, fontWeight: '800', marginBottom: 5 }, infoText: { color: '#4E6B50', fontSize: 13, lineHeight: 19 }, scanButton: { alignItems: 'center', backgroundColor: PRIMARY, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', paddingVertical: 17 }, pressed: { opacity: 0.8 }, scanButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }, arrow: { color: '#FFFFFF', fontSize: 22, marginLeft: 10 },
});
