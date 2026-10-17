import { View, Text, StyleSheet, FlatList, Image } from 'react-native';

const PRIMARY = '#1B5E20';

// MOCK DATA untuk Riwayat Scan
const MOCK_HISTORY = [
  { id: '1', date: '17 Okt 2026', disease: 'Bercak Cercospora', confidence: '87.5', isHealthy: false, image: 'https://images.unsplash.com/photo-1598516098034-9c41c237f63b?w=100' },
  { id: '2', date: '16 Okt 2026', disease: 'Sehat', confidence: '92.0', isHealthy: true, image: 'https://images.unsplash.com/photo-1598516098034-9c41c237f63b?w=100' },
  { id: '3', date: '15 Okt 2026', disease: 'Defisiensi Hara', confidence: '78.3', isHealthy: false, image: 'https://images.unsplash.com/photo-1598516098034-9c41c237f63b?w=100' },
  { id: '4', date: '14 Okt 2026', disease: 'Sehat', confidence: '95.1', isHealthy: true, image: 'https://images.unsplash.com/photo-1598516098034-9c41c237f63b?w=100' },
];

export default function HistoryScreen() {
  const renderItem = ({ item }: { item: typeof MOCK_HISTORY[0] }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.thumbnail} />
      <View style={styles.info}>
        <Text style={styles.date}>{item.date}</Text>
        <Text style={[styles.disease, { color: item.isHealthy ? PRIMARY : '#C62828' }]}>
          {item.disease}
        </Text>
        <Text style={styles.confidence}>Keyakinan: {item.confidence}%</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: item.isHealthy ? '#E8F5E9' : '#FFEBEE' }]}>
        <Text style={[styles.badgeText, { color: item.isHealthy ? PRIMARY : '#C62828' }]}>
          {item.isHealthy ? 'Sehat' : 'Sakit'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Riwayat Scan</Text>
      
      {/* Filter Chips (Visual Saja untuk Prototype) */}
      <View style={styles.filterContainer}>
        <View style={[styles.chip, styles.chipActive]}><Text style={styles.chipTextActive}>Semua</Text></View>
        <View style={styles.chip}><Text style={styles.chipText}>Sehat</Text></View>
        <View style={styles.chip}><Text style={styles.chipText}>Sakit</Text></View>
      </View>

      <FlatList
        data={MOCK_HISTORY}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', paddingTop: 60, paddingHorizontal: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#212121', marginBottom: 16 },
  filterContainer: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0E0E0' },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { color: '#757575', fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  listContent: { paddingBottom: 20 },
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 12, alignItems: 'center', elevation: 1 },
  thumbnail: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#E0E0E0' },
  info: { flex: 1, marginLeft: 12 },
  date: { fontSize: 12, color: '#9E9E9E', marginBottom: 4 },
  disease: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  confidence: { fontSize: 12, color: '#757575' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});