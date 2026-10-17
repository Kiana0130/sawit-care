import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

const PRIMARY = '#1B5E20';

export default function ScanScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => setLoading(false);
  }, []);

  const pilihFoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Izin diperlukan', 'Izinkan akses galeri untuk memilih foto daun.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const ambilFoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Izin diperlukan', 'Izinkan akses kamera untuk mengambil foto daun.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const analisisDaun = () => {
    if (!imageUri) {
      Alert.alert('Foto belum dipilih', 'Pilih foto daun terlebih dahulu.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push({
        pathname: '/result' as never,
        params: {
          disease: 'Bercak Cercospora',
          confidence: '87.5',
          imageUri,
        },
      });
    }, 2000);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Scan Daun</Text>
      <Text style={styles.description}>Pilih foto daun kelapa sawit untuk mendapatkan hasil analisis awal.</Text>

      <Pressable style={styles.preview} onPress={pilihFoto}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
        ) : (
          <>
            <Text style={styles.previewIcon}>⌕</Text>
            <Text style={styles.previewText}>Ketuk untuk memilih foto</Text>
            <Text style={styles.previewHint}>Format JPG atau PNG</Text>
          </>
        )}
      </Pressable>

      <View style={styles.actionRow}>
        <Pressable style={({ pressed }) => [styles.secondaryButton, styles.halfButton, pressed && styles.pressed]} onPress={ambilFoto}>
          <Text style={styles.secondaryButtonText}>Ambil Foto</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryButton, styles.halfButton, pressed && styles.pressed]} onPress={pilihFoto}>
          <Text style={styles.secondaryButtonText}>{imageUri ? 'Ganti Foto' : 'Pilih Galeri'}</Text>
        </Pressable>
      </View>

      <Pressable
        disabled={loading}
        style={({ pressed }) => [styles.primaryButton, (pressed || loading) && styles.pressed]}
        onPress={analisisDaun}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Analisis Daun</Text>}
      </Pressable>
      {loading && <Text style={styles.loadingText}>Menganalisis daun Anda...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F5', padding: 20, paddingTop: 32 },
  title: { color: '#212121', fontSize: 28, fontWeight: '800' },
  description: { color: '#757575', fontSize: 14, lineHeight: 21, marginTop: 8 },
  preview: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#BDBDBD', borderRadius: 18, borderStyle: 'dashed', borderWidth: 1.5, height: 260, justifyContent: 'center', marginTop: 28, overflow: 'hidden' },
  previewImage: { height: '100%', width: '100%' },
  previewIcon: { color: PRIMARY, fontSize: 55, fontWeight: '700' },
  previewText: { color: '#424242', fontSize: 16, fontWeight: '700', marginTop: 8 },
  previewHint: { color: '#9E9E9E', fontSize: 12, marginTop: 6 },
  secondaryButton: { alignItems: 'center', borderColor: PRIMARY, borderRadius: 12, borderWidth: 1, marginTop: 16, minHeight: 52, justifyContent: 'center' },
  actionRow: { flexDirection: 'row', gap: 10 },
  halfButton: { flex: 1 },
  secondaryButtonText: { color: PRIMARY, fontSize: 15, fontWeight: '700' },
  primaryButton: { alignItems: 'center', backgroundColor: PRIMARY, borderRadius: 12, justifyContent: 'center', marginTop: 12, minHeight: 52 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  loadingText: { color: PRIMARY, fontSize: 13, marginTop: 12, textAlign: 'center' },
});
