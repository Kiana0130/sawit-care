import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'login',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthGate>
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="result" options={{ title: 'Hasil Deteksi' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Informasi' }} />
        </Stack>
      </AuthGate>
    </ThemeProvider>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = pathname === '/login' || pathname === '/register';

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicRoute) router.replace('/login');
    if (user && isPublicRoute) router.replace('/(tabs)');
  }, [isPublicRoute, loading, pathname, router, user]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#1B5E20" size="large" />
        <Text style={styles.loadingText}>Memuat Sawit Care...</Text>
      </View>
    );
  }

  if (!user && !isPublicRoute) return null;
  return children;
}

const styles = StyleSheet.create({
  loadingScreen: { alignItems: 'center', backgroundColor: '#F5F5F5', flex: 1, justifyContent: 'center' },
  loadingText: { color: '#1B5E20', fontSize: 15, fontWeight: '700', marginTop: 12 },
});
