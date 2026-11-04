import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/auth-provider';

export default function ProfileScreen() {
  const { logout: authLogout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = () => {
    Alert.alert('Konfirmasi Logout', 'Apakah Anda yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya, Keluar', style: 'destructive', onPress: () => {
        setLoggingOut(true);
        void authLogout().catch(() => undefined).finally(() => setLoggingOut(false));
      } },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.avatar}>●</Text>
      <Text style={styles.title}>Profil Petani</Text>
      <Text style={styles.description}>Kelola profil dan preferensi akun Anda.</Text>
      <Pressable disabled={loggingOut} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed, loggingOut && styles.disabled]} onPress={logout}>
        {loggingOut ? <ActivityIndicator color="#C62828" /> : <Text style={styles.logoutText}>Logout</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', padding: 24 },
  avatar: { color: '#1B5E20', fontSize: 48 },
  title: { color: '#212121', fontSize: 24, fontWeight: '800', marginTop: 12 },
  description: { color: '#757575', fontSize: 14, marginTop: 8, textAlign: 'center' },
  logoutButton: { borderColor: '#C62828', borderRadius: 10, borderWidth: 1, justifyContent: 'center', marginTop: 32, minHeight: 52, paddingHorizontal: 48 },
  logoutText: { color: '#C62828', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.6 },
});
