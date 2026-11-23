import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { showConfirm } from '@/lib/feedback';
import { useAuth } from '@/providers/auth-provider';

export default function ProfileScreen() {
  const { logout: authLogout, user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = () => {
    showConfirm('Konfirmasi Logout', 'Apakah Anda yakin ingin keluar?', 'Ya, Keluar', () => {
      setLoggingOut(true);
      void authLogout().catch(() => undefined).finally(() => setLoggingOut(false));
    });
  };

  return (
    <View style={styles.container}>
      <SymbolView name={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' }} tintColor="#1B5E20" size={48} />
      <Text style={styles.title}>{user?.name ?? 'Profil Petani'}</Text>
      <Text style={styles.description}>{user?.email ?? 'Kelola profil dan preferensi akun Anda.'}</Text>
      <Pressable disabled={loggingOut} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed, loggingOut && styles.disabled]} onPress={logout}>
        {loggingOut ? <ActivityIndicator color="#C62828" /> : <Text style={styles.logoutText}>Logout</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', padding: 24 },
  pressed: { opacity: 0.72 },
  title: { color: '#212121', fontSize: 24, fontWeight: '800', marginTop: 12 },
  description: { color: '#757575', fontSize: 14, marginTop: 8, textAlign: 'center' },
  logoutButton: { borderColor: '#C62828', borderRadius: 10, borderWidth: 1, justifyContent: 'center', marginTop: 32, minHeight: 52, paddingHorizontal: 48 },
  logoutText: { color: '#C62828', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
