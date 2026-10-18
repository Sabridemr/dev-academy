import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useI18n } from '@/i18n';
import { queryClient } from '@/lib/queryClient';
import { kv, KV_KEYS } from '@/lib/storage';
import { configureNotificationHandler } from '@/notifications/push';
import { useNotificationNavigation } from '@/notifications/useNotificationNavigation';
import { useSession } from '@/stores/session';
import { ThemeProvider, useTheme } from '@/theme';
import { LoadingView } from '@/components/ui';

configureNotificationHandler();

/**
 * Kök yerleşim: sağlayıcılar + kimlik doğrulama yönlendirmesi.
 * - Oturum yoksa (auth) grubuna
 * - Oturum varsa ve onboarding tamamlanmadıysa /onboarding'e
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  useAppBootstrap();
  useNotificationNavigation();
  const { colors, scheme } = useTheme();
  const { t } = useI18n();
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const segments = useSegments();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    if (status === 'anonymous' && !inAuth) {
      router.replace('/login');
    } else if (status === 'authenticated') {
      const onboarded = kv.getBoolean(KV_KEYS.onboarded) || Boolean(user?.selectedPathId);
      if (inAuth) router.replace(onboarded ? '/' : '/onboarding');
      else if (!onboarded && !inOnboarding) router.replace('/onboarding');
    }
  }, [status, segments, user?.selectedPathId]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LoadingView />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.fg,
          headerTitleStyle: { color: colors.fg },
          contentStyle: { backgroundColor: colors.bg },
          headerBackTitle: t('common.back'),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="lesson/[id]" options={{ title: '' }} />
        <Stack.Screen name="module/[id]" options={{ title: '' }} />
        <Stack.Screen name="search" options={{ title: t('nav.search'), presentation: 'modal' }} />
        <Stack.Screen name="+not-found" options={{ title: t('common.notFound') }} />
      </Stack>
    </>
  );
}
