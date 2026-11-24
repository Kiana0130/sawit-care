import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { showMessage } from '@/lib/feedback';
import { ScanApiError, submitScan } from '@/lib/scan-api';

const PRIMARY = '#1B5E20';

export default function ScanScreen() {
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showMessage('Izin ditolak', 'Aplikasi memerlukan izin kamera untuk memfoto daun.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (!result.canceled) setImage(result.assets[0]);
    } catch {
      showMessage('Kamera tidak tersedia', 'Tidak dapat membuka kamera. Silakan coba lagi.');
    }
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showMessage('Izin ditolak', 'Aplikasi memerlukan izin untuk mengakses galeri foto.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (!result.canceled) setImage(result.assets[0]);
    } catch {
      showMessage('Galeri tidak tersedia', 'Tidak dapat membuka galeri. Silakan coba lagi.');
    }
  };

  const submit = async () => {
    if (!image) {
      showMessage('Pilih foto', 'Ambil foto atau pilih gambar daun sebelum menyimpan.');
      return;
    }
    setLoading(true);
    try {
      const quota = await import('@/lib/scan-api').then((module) => module.getScanQuota());
      if (quota.remaining === 0) {
        showMessage('Kuota habis', 'Kuota scan harian Anda sudah digunakan. Coba lagi besok pukul 00.00 WITA.');
        return;
      }
      const saved = await submitScan(image.uri);
      router.push({ pathname: '/scan-detail', params: { id: saved.id } });
    } catch (cause) {
      const message = cause instanceof ScanApiError ? cause.message : 'Foto gagal dikirim. Periksa koneksi, lalu coba lagi.';
      showMessage('Scan belum tersimpan', message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={PRIMARY} /><Text style={styles.loadingText}>Menyimpan foto...</Text><Text style={styles.loadingSubtext}>Belum ada model AI; foto akan disimpan sebagai menunggu hasil.</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Pindai Daun Sawit</Text>
      <View style={styles.imageContainer}>
        {image ? <Image source={{ uri: image.uri }} style={styles.image} /> : <View style={styles.placeholder}><SymbolView name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }} tintColor="#9E9E9E" size={48} /><Text style={styles.placeholderText}>Belum ada foto dipilih</Text></View>}
      </View>
      <View style={styles.hint}><SymbolView name={{ ios: 'lightbulb', android: 'lightbulb', web: 'lightbulb' }} tintColor="#616161" size={16} /><Text style={styles.hintText}>Tips: Pastikan pencahayaan cukup dan fokus pada daun.</Text></View>
      <View style={styles.buttonRow}>
        <Pressable style={[styles.buttonSecondary, styles.buttonHalf]} onPress={takePhoto}><SymbolView name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }} tintColor={PRIMARY} size={19} /><Text style={styles.buttonSecondaryText}>Ambil Foto</Text></Pressable>
        <Pressable style={[styles.buttonSecondary, styles.buttonHalf]} onPress={pickImage}><SymbolView name={{ ios: 'photo', android: 'photo_library', web: 'photo_library' }} tintColor={PRIMARY} size={19} /><Text style={styles.buttonSecondaryText}>Galeri</Text></Pressable>
      </View>
      <Pressable style={({ pressed }) => [styles.buttonPrimary, pressed && styles.pressed]} onPress={submit}><SymbolView name={{ ios: 'square.and.arrow.up', android: 'upload', web: 'upload' }} tintColor="#FFFFFF" size={19} /><Text style={styles.buttonPrimaryText}>Simpan Foto Scan</Text></Pressable>
      <Text style={styles.prototypeNote}>Foto tersimpan sebagai menunggu model AI. Ini bukan hasil diagnosis.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#212121', marginBottom: 20, textAlign: 'center' },
  imageContainer: { backgroundColor: '#FFF', borderRadius: 16, height: 300, justifyContent: 'center', alignItems: 'center', marginBottom: 16, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: '#E0E0E0' }, image: { width: '100%', height: '100%' }, placeholder: { alignItems: 'center', gap: 8 }, placeholderText: { color: '#9E9E9E', fontSize: 16 },
  hint: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 24 }, hintText: { color: '#616161', flex: 1, fontSize: 13, textAlign: 'center' }, buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 12 }, buttonHalf: { flex: 1 },
  buttonPrimary: { alignItems: 'center', backgroundColor: PRIMARY, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 8, paddingVertical: 16, borderRadius: 12 }, buttonSecondary: { alignItems: 'center', backgroundColor: '#FFF', flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0' }, buttonPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '800' }, buttonSecondaryText: { color: PRIMARY, fontSize: 15, fontWeight: '700' }, pressed: { opacity: 0.8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 24 }, loadingText: { fontSize: 18, fontWeight: '700', color: PRIMARY, marginTop: 16 }, loadingSubtext: { fontSize: 14, color: '#757575', marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }, prototypeNote: { color: '#757575', fontSize: 12, marginTop: 14, textAlign: 'center' },
});
