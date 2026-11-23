import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { getApiErrorMessage } from '@/lib/api';
import { showMessage } from '@/lib/feedback';
import { useAuth } from '@/providers/auth-provider';

const PRIMARY = '#1B5E20';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  const masuk = () => {
    if (!email.trim() || !password) {
      showMessage('Data belum lengkap', 'Email dan password wajib diisi.');
      return;
    }
    setSubmitting(true);
    void login(email.trim(), password)
      .then(() => showMessage('Login berhasil', `Selamat datang kembali, ${email.trim()}.`))
      .catch((error: unknown) => showMessage('Login gagal', getApiErrorMessage(error, 'Tidak dapat terhubung ke server.')))
      .finally(() => setSubmitting(false));
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>Sawit Care</Text>
        <Text style={styles.title}>Selamat Datang</Text>
        <Text style={styles.subtitle}>Masuk untuk memantau kesehatan kebun Anda.</Text>
        <Text style={styles.label}>Email</Text>
        <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="Masukkan email" placeholderTextColor="#9E9E9E" style={styles.input} value={email} />
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput autoCapitalize="none" autoComplete="password" onChangeText={setPassword} placeholder="Masukkan password" placeholderTextColor="#9E9E9E" secureTextEntry={!showPassword} style={styles.passwordInput} value={password} />
          <Pressable accessibilityLabel={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} onPress={() => setShowPassword((visible) => !visible)} style={styles.passwordToggle}>
            {showPassword ? <SymbolView name={{ ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }} tintColor={PRIMARY} size={19} /> : <SymbolView name={{ ios: 'eye', android: 'visibility', web: 'visibility' }} tintColor={PRIMARY} size={19} />}
          </Pressable>
        </View>
        <Pressable disabled={submitting} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, submitting && styles.disabled]} onPress={masuk}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Masuk</Text>}
        </Pressable>
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Belum punya akun? </Text>
          <Link href={{ pathname: '/register' }} asChild><Pressable><Text style={styles.link}>Daftar di sini</Text></Pressable></Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#F5F5F5', flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22 },
  logo: { color: PRIMARY, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  title: { color: '#212121', fontSize: 24, fontWeight: '800', marginTop: 22, textAlign: 'center' },
  subtitle: { color: '#757575', fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  label: { color: '#424242', fontSize: 14, fontWeight: '700', marginBottom: 7, marginTop: 22 },
  input: { borderColor: '#D6D6D6', borderRadius: 10, borderWidth: 1, color: '#212121', fontSize: 15, minHeight: 52, paddingHorizontal: 14 },
  passwordRow: { alignItems: 'center', borderColor: '#D6D6D6', borderRadius: 10, borderWidth: 1, flexDirection: 'row' },
  passwordInput: { color: '#212121', flex: 1, fontSize: 15, minHeight: 52, paddingHorizontal: 14 },
  passwordToggle: { alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: PRIMARY, borderRadius: 10, justifyContent: 'center', marginTop: 26, minHeight: 52 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  footerText: { color: '#757575', fontSize: 14 },
  link: { color: PRIMARY, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.6 },
});
