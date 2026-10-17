import { StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.avatar}>●</Text>
      <Text style={styles.title}>Profil Petani</Text>
      <Text style={styles.description}>Kelola profil dan preferensi akun Anda.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', padding: 24 },
  avatar: { color: '#1B5E20', fontSize: 48 },
  title: { color: '#212121', fontSize: 24, fontWeight: '800', marginTop: 12 },
  description: { color: '#757575', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
