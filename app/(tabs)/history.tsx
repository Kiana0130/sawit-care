import { StyleSheet, Text, View } from 'react-native';

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Riwayat Scan</Text>
      <Text style={styles.description}>Riwayat hasil scan akan ditampilkan pada langkah berikutnya.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', padding: 24 },
  title: { color: '#212121', fontSize: 24, fontWeight: '800' },
  description: { color: '#757575', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
