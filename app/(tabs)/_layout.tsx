import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

const PRIMARY = '#1B5E20';
const MUTED = '#9E9E9E';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: MUTED,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>⌂</Text>,
        }}
      />
      <Tabs.Screen name="history" options={{ title: 'Riwayat', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 21 }}>◷</Text> }} />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => <Text style={styles.scanIcon}>⌕</Text>,
          tabBarButton: ({ children, onPress, accessibilityLabel, accessibilityState, testID }) => (
            <Pressable
              accessibilityLabel={accessibilityLabel}
              accessibilityState={accessibilityState}
              onPress={onPress}
              testID={testID}
              style={styles.scanButton}
            >
              {children}
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Peta PRO',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🔒</Text>,
          tabBarButton: ({ children, accessibilityLabel, accessibilityState, testID }) => (
            <Pressable
              accessibilityLabel={accessibilityLabel}
              accessibilityState={accessibilityState}
              disabled
              testID={testID}
              style={{ opacity: 0.55 }}
            >
              {children}
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 21 }}>●</Text> }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { height: 68, paddingBottom: 8, paddingTop: 6 },
  label: { fontSize: 11, fontWeight: '600' },
  scanButton: { alignItems: 'center', justifyContent: 'center', marginTop: -14, height: 58, width: 58, borderRadius: 29, backgroundColor: PRIMARY },
  scanIcon: { color: '#FFFFFF', fontSize: 30, fontWeight: '700' },
});
