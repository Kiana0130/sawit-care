import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

const PRIMARY = '#1B5E20';

export default function RegisterScreen() {
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [konfirmasiPassword, setKonfirmasiPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();

  const daftar = () => {
    if (!nama.trim() || !email.trim() || !password.trim() || !konfirmasiPassword.trim()) {
      Alert.alert('Data belum lengkap', 'Nama, email, password, dan konfirmasi password wajib diisi.');
      return;
    }

    if (password !== konfirmasiPassword) {
      Alert.alert('Registrasi gagal', 'Password dan konfirmasi password tidak sama.');
      return;
    }

    if (password.length < 12) {
      Alert.alert('Registrasi gagal', 'Password minimal 12 karakter.');
      return;
    }

    setSubmitting(true);
    void register(nama.trim(), email.trim(), password)
      .catch((error: unknown) => {
        const message = getApiErrorMessage(error, 'Tidak dapat terhubung ke server.');
        Alert.alert('Registrasi gagal', message);
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>Sawit Care</Text>
        <Text style={styles.title}>Buat Akun Baru</Text>
        <Text style={styles.subtitle}>Daftarkan diri Anda untuk mulai merawat kebun.</Text>

        <Text style={styles.label}>Nama Lengkap</Text>
        <TextInput onChangeText={setNama} placeholder="Masukkan nama lengkap" placeholderTextColor="#9E9E9E" style={styles.input} value={nama} />
        <Text style={styles.label}>Email</Text>
        <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="Masukkan email" placeholderTextColor="#9E9E9E" style={styles.input} value={email} />
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput autoCapitalize="none" secureTextEntry={!showPassword} onChangeText={setPassword} placeholder="Masukkan password" placeholderTextColor="#9E9E9E" style={styles.passwordInput} value={password} />
          <Pressable accessibilityLabel={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} onPress={() => setShowPassword((visible) => !visible)} style={styles.passwordToggle}>
            <Text style={styles.passwordToggleText}>{showPassword ? 'Sembunyikan' : 'Lihat'}</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Konfirmasi Password</Text>
        <View style={styles.passwordRow}>
          <TextInput autoCapitalize="none" secureTextEntry={!showConfirmation} onChangeText={setKonfirmasiPassword} placeholder="Ulangi password" placeholderTextColor="#9E9E9E" style={styles.passwordInput} value={konfirmasiPassword} />
          <Pressable accessibilityLabel={showConfirmation ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'} onPress={() => setShowConfirmation((visible) => !visible)} style={styles.passwordToggle}>
            <Text style={styles.passwordToggleText}>{showConfirmation ? 'Sembunyikan' : 'Lihat'}</Text>
          </Pressable>
        </View>

        <Pressable disabled={submitting} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, submitting && styles.disabled]} onPress={daftar}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Daftar</Text>}
        </Pressable>
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Sudah punya akun? </Text>
          <Pressable onPress={() => router.replace('/login' as never)}><Text style={styles.link}>Login di sini</Text></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#F5F5F5', flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22 },
  logo: { color: PRIMARY, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  title: { color: '#212121', fontSize: 24, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  subtitle: { color: '#757575', fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  label: { color: '#424242', fontSize: 14, fontWeight: '700', marginBottom: 7, marginTop: 16 },
  input: { borderColor: '#D6D6D6', borderRadius: 10, borderWidth: 1, color: '#212121', fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  passwordRow: { alignItems: 'center', borderColor: '#D6D6D6', borderRadius: 10, borderWidth: 1, flexDirection: 'row' },
  passwordInput: { color: '#212121', flex: 1, fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  passwordToggle: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  passwordToggleText: { color: PRIMARY, fontSize: 13, fontWeight: '700' },
  primaryButton: { alignItems: 'center', backgroundColor: PRIMARY, borderRadius: 10, justifyContent: 'center', marginTop: 24, minHeight: 52 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#757575', fontSize: 14 },
  link: { color: PRIMARY, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.6 },
});
