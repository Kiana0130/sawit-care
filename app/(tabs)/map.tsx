import { StyleSheet, Text, View } from 'react-native';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.lock}>🔒</Text>
      <Text style={styles.title}>Peta Kebun</Text>
      <Text style={styles.description}>Fitur Peta adalah bagian dari Paket PRO.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', padding: 24 },
  lock: { fontSize: 42 },
  title: { color: '#212121', fontSize: 24, fontWeight: '800', marginTop: 12 },
  description: { color: '#757575', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
