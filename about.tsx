import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/constants/theme';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'grid-outline',
    title: 'One flat grid',
    body: 'Every photo and video on your phone, newest first. No folders to dig through, no filenames.',
  },
  {
    icon: 'heart-outline',
    title: 'Favourites',
    body: 'Heart an item into a named folder. It leaves the main grid and lives in Favourites.',
  },
  {
    icon: 'lock-closed-outline',
    title: 'Hidden vault',
    body: 'Pull down from the top of the gallery. Protect it with a PIN and your fingerprint.',
  },
  {
    icon: 'contract-outline',
    title: 'Compress & Resize',
    body: 'Shrink any photo or video to the exact width, height and file size you choose — up to 8K.',
  },
  {
    icon: 'color-palette-outline',
    title: 'Adjust',
    body: 'Crop, colour, HDR, smoothing, schemes, doodles and text, then save a copy or replace.',
  },
  {
    icon: 'options-outline',
    title: 'Yours to style',
    body: 'Theme, accent colour, grid columns, tile shape, corner radius and text size — all in Settings.',
  },
];

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, fs } = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + 40,
        gap: spacing.lg,
      }}>
      <View style={styles.head}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logo}
          contentFit="cover"
        />
        <Text style={[styles.name, { color: colors.text, fontSize: fs(26) }]}>NOOK</Text>
        <Text style={{ color: colors.muted, fontSize: fs(12) }}>
          Version {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </View>

      <Text style={[styles.blurb, { color: colors.text, fontSize: fs(14) }]}>
        A quiet, fast gallery for your phone. Everything stays on the device — NOOK has no account,
        no server and no upload.
      </Text>

      <View style={{ gap: spacing.md }}>
        {FEATURES.map((feature) => (
          <View key={feature.title} style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name={feature.icon} size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: fs(13), fontWeight: '700' }}>
                {feature.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: fs(12), lineHeight: 17, marginTop: 1 }}>
                {feature.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.note, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: fs(12), fontWeight: '700', marginBottom: 4 }}>
          Your privacy
        </Text>
        <Text style={{ color: colors.muted, fontSize: fs(12), lineHeight: 18 }}>
          NOOK reads your media library only when you open it, and keeps its own list of favourites,
          vault items and trash on this phone. Nothing is sent anywhere. Deleting from the trash is
          the only action that can remove a file from your device, and NOOK asks first.
        </Text>
      </View>

      <Text
        onPress={() => router.back()}
        style={{ color: colors.primary, fontSize: fs(13), fontWeight: '700', textAlign: 'center' }}>
        Back
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: spacing.xs },
  logo: { width: 84, height: 84, borderRadius: 20, marginBottom: spacing.xs },
  name: { fontWeight: '800', letterSpacing: 1 },
  blurb: { lineHeight: 21 },
  row: { flexDirection: 'row', gap: spacing.md },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { padding: spacing.md, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
});
