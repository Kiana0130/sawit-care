import { StyleSheet, Text, View } from 'react-native';

export default function ScanScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⌕</Text>
      <Text style={styles.title}>Scan Daun</Text>
      <Text style={styles.description}>Fitur pemindaian akan tersedia pada langkah berikutnya.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', padding: 24 },
  icon: { color: '#1B5E20', fontSize: 54, fontWeight: '700' },
  title: { color: '#212121', fontSize: 24, fontWeight: '800', marginTop: 12 },
  description: { color: '#757575', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
