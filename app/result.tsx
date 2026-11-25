import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

export default function ResultScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Menunggu model AI</Text>
      <Text style={styles.body}>Dataset/model AI belum tersedia. Belum ada diagnosis, nama penyakit, atau tingkat keyakinan.</Text>
      <Pressable style={styles.button} onPress={() => router.replace('/(tabs)/scan')}>
        <Text style={styles.buttonText}>Kembali ke Scan</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F5', padding: 20, paddingTop: 28 },
  title: { color: '#212121', fontSize: 24, fontWeight: '800' },
  body: { color: '#424242', fontSize: 15, lineHeight: 23, marginTop: 18 },
  button: { alignItems: 'center', backgroundColor: '#1B5E20', borderRadius: 12, justifyContent: 'center', marginTop: 24, minHeight: 52 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
