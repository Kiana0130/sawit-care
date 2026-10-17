import { useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, Alert } from 'react-native';

const PRIMARY = '#1B5E20';

export default function ScanScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Izin Ditolak', 'Aplikasi memerlukan izin akses kamera untuk memfoto daun.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Izin Ditolak', 'Aplikasi memerlukan izin untuk mengakses galeri foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const analyzeImage = () => {
    if (!image) {
      Alert.alert('Peringatan', 'Silakan ambil foto atau pilih gambar daun terlebih dahulu!');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push({
        pathname: '/result',
        params: {
          disease: 'Bercak Cercospora', // Mock Data
          confidence: '87.5',           // Mock Data
          imageUri: image,
        },
      });
    }, 2000);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Menganalisis daun Anda...</Text>
        <Text style={styles.loadingSubtext}>Mohon tunggu, AI sedang memproses foto</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Pindai Daun Sawit</Text>
      
      {/* Area Preview Foto */}
      <View style={styles.imageContainer}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
            <Text style={styles.placeholderText}>Belum ada foto dipilih</Text>
          </View>
        )}
      </View>

      <Text style={styles.hint}>💡 Tips: Pastikan pencahayaan cukup dan fokus pada bercak daun.</Text>

      {/* Tombol Aksi: Kamera & Galeri */}
      <View style={styles.buttonRow}>
        <Pressable style={[styles.buttonSecondary, { flex: 1, marginRight: 8 }]} onPress={takePhoto}>
          <Text style={styles.buttonSecondaryText}>📷 Ambil Foto</Text>
        </Pressable>
        
        <Pressable style={[styles.buttonSecondary, { flex: 1, marginLeft: 8 }]} onPress={pickImage}>
          <Text style={styles.buttonSecondaryText}>🖼️ Galeri</Text>
        </Pressable>
      </View>

      {/* Tombol Analisis */}
      <Pressable 
        style={({ pressed }) => [styles.buttonPrimary, pressed && styles.pressed]} 
        onPress={analyzeImage}
      >
        <Text style={styles.buttonPrimaryText}>🔍 Analisis Daun</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#212121', marginBottom: 20, textAlign: 'center' },
  imageContainer: { backgroundColor: '#FFF', borderRadius: 16, height: 300, justifyContent: 'center', alignItems: 'center', marginBottom: 16, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: '#E0E0E0' },
  image: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center' },
  placeholderIcon: { fontSize: 48, marginBottom: 8 },
  placeholderText: { color: '#9E9E9E', fontSize: 16 },
  hint: { color: '#616161', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  buttonRow: { flexDirection: 'row', marginBottom: 12 },
  buttonPrimary: { backgroundColor: PRIMARY, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonSecondary: { backgroundColor: '#FFF', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  buttonPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  buttonSecondaryText: { color: PRIMARY, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  loadingText: { fontSize: 18, fontWeight: '700', color: PRIMARY, marginTop: 16 },
  loadingSubtext: { fontSize: 14, color: '#757575', marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
});