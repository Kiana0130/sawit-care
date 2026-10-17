import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

const PRIMARY = '#1B5E20';

export default function ResultScreen() {
  const params = useLocalSearchParams<{ disease?: string; confidence?: string; imageUri?: string }>();
  const disease = typeof params.disease === 'string' ? params.disease : 'Bercak Cercospora';
  const confidence = typeof params.confidence === 'string' ? params.confidence : '87.5';
  const imageUri = typeof params.imageUri === 'string' ? params.imageUri : null;
  const sehat = disease.toLowerCase() === 'sehat';

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Hasil Deteksi</Text>
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" /> : <View style={styles.imagePlaceholder}><Text style={styles.placeholderText}>Foto tidak tersedia</Text></View>}

      <View style={[styles.statusBadge, { backgroundColor: sehat ? '#E8F5E9' : '#FFEBEE' }]}>
        <Text style={[styles.statusText, { color: sehat ? PRIMARY : '#C62828' }]}>{sehat ? 'SEHAT' : 'TERDETEKSI SAKIT'}</Text>
      </View>
      <Text style={styles.disease}>{disease}</Text>
      <Text style={styles.confidence}>Tingkat Keyakinan: <Text style={styles.confidenceValue}>{confidence}%</Text></Text>

      <View style={styles.disclaimer}><Text style={styles.disclaimerText}>ℹ️ Hasil AI bersifat referensi awal. Konsultasikan dengan ahli pertanian.</Text></View>

      <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => Alert.alert('Saran Penanganan', 'Fitur saran penanganan akan segera hadir pada prototype berikutnya.')}>
        <Text style={styles.primaryButtonText}>Lihat Saran Penanganan</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.lockedButton, pressed && styles.pressed]} onPress={() => Alert.alert('Fitur PRO', 'Fitur ini khusus untuk pengguna PRO. Silakan upgrade!')}>
        <Text style={styles.lockedButtonText}>🔒 Tandai Lokasi GPS (PRO)</Text>
      </Pressable>
      <Pressable style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>Kembali ke Scan</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F5', padding: 20, paddingTop: 28 },
  title: { color: '#212121', fontSize: 28, fontWeight: '800', marginBottom: 18 },
  image: { backgroundColor: '#E0E0E0', borderRadius: 16, height: 220, width: '100%' },
  imagePlaceholder: { alignItems: 'center', backgroundColor: '#E0E0E0', borderRadius: 16, height: 220, justifyContent: 'center' },
  placeholderText: { color: '#757575' },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 16, marginTop: 18, paddingHorizontal: 12, paddingVertical: 8 },
  statusText: { fontSize: 12, fontWeight: '800' },
  disease: { color: '#212121', fontSize: 25, fontWeight: '800', marginTop: 12 },
  confidence: { color: '#616161', fontSize: 15, marginTop: 6 },
  confidenceValue: { color: PRIMARY, fontWeight: '800' },
  disclaimer: { backgroundColor: '#FFF8E1', borderRadius: 12, marginTop: 18, padding: 13 },
  disclaimerText: { color: '#6D5B16', fontSize: 12, lineHeight: 18 },
  primaryButton: { alignItems: 'center', backgroundColor: PRIMARY, borderRadius: 12, justifyContent: 'center', marginTop: 22, minHeight: 52 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  lockedButton: { alignItems: 'center', backgroundColor: '#E0E0E0', borderRadius: 12, justifyContent: 'center', marginTop: 12, minHeight: 52 },
  lockedButtonText: { color: '#757575', fontSize: 14, fontWeight: '700' },
  backButton: { alignItems: 'center', marginTop: 14, minHeight: 48, justifyContent: 'center' },
  backText: { color: PRIMARY, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
