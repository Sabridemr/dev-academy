import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProgressSummary } from '@/hooks/content';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName, focusedName: IconName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} size={size} color={color} />
  );
}

/** Alt sekmeler: Ana sayfa, Modüller, Tekrar, Kütüphane, Profil */
export default function TabsLayout() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const summary = useProgressSummary();
  const due = summary.data?.dueReviews ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: tabIcon('home-outline', 'home'),
          tabBarButtonTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="modules"
        options={{
          title: t('nav.modules'),
          tabBarIcon: tabIcon('layers-outline', 'layers'),
          tabBarButtonTestID: 'tab-modules',
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: t('nav.review'),
          tabBarIcon: tabIcon('repeat-outline', 'repeat'),
          tabBarBadge: due > 0 ? due : undefined,
          tabBarButtonTestID: 'tab-review',
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('nav.library'),
          tabBarIcon: tabIcon('bookmarks-outline', 'bookmarks'),
          tabBarButtonTestID: 'tab-library',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: tabIcon('person-circle-outline', 'person-circle'),
          tabBarButtonTestID: 'tab-profile',
        }}
      />
    </Tabs>
  );
}
