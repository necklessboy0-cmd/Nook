import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, buildColors } from '@/constants/theme';
import { useAppearance } from '@/lib/store';

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const [appearance, , status] = useAppearance();

  const scheme: 'light' | 'dark' =
    appearance.mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : appearance.mode;

  const colors = useMemo(() => buildColors(scheme, appearance.accent), [scheme, appearance.accent]);

  const value = useMemo(
    () => ({
      colors,
      appearance,
      scheme,
      fs: (size: number) => Math.round(size * appearance.fontScale),
    }),
    [colors, appearance, scheme],
  );

  const navTheme = useMemo(
    () => ({
      ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
      colors: {
        ...(scheme === 'dark' ? DarkTheme : DefaultTheme).colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    }),
    [scheme, colors],
  );

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={value}>
        <NavThemeProvider value={navTheme}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'fade',
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="viewer" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
            <Stack.Screen name="adjust" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="vault" options={{ animation: 'fade' }} />
            <Stack.Screen name="trash" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="folder/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="about" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </NavThemeProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
