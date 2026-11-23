import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

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
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={22} />,
        }}
      />
      <Tabs.Screen name="history" options={{ title: 'Riwayat', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }} tintColor={color} size={21} /> }} />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: () => <SymbolView name={{ ios: 'viewfinder', android: 'center_focus_strong', web: 'center_focus_strong' }} tintColor="#FFFFFF" size={30} />,
          tabBarButton: ({ children, onPress, accessibilityLabel, accessibilityState, testID }) => (
            <Pressable
              accessibilityLabel={accessibilityLabel}
              accessibilityRole="button"
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
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} tintColor={color} size={19} />,
          tabBarButton: ({ children, onPress, accessibilityLabel, accessibilityState, testID }) => (
            <Pressable
              accessibilityLabel={accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={accessibilityState}
              onPress={onPress}
              testID={testID}
              style={({ pressed }) => [styles.proButton, pressed && styles.pressed]}
            >
              {children}
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' }} tintColor={color} size={21} /> }} />

    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { height: 68, paddingBottom: 8, paddingTop: 6 },
  label: { fontSize: 11, fontWeight: '600' },
  scanButton: { alignItems: 'center', justifyContent: 'center', marginTop: -14, height: 58, width: 58, borderRadius: 29, backgroundColor: PRIMARY },
  proButton: { opacity: 0.65 },
  pressed: { opacity: 0.45 },
});
