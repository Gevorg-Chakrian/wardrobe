// components/BottomNav.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageProvider';
import { CoachMark } from '../tutorial/TutorialProvider';
import { useTheme } from '../ui/theme';

export const BOTTOM_NAV_HEIGHT = 64;

const TABS = ['wardrobe', 'profile'];

export default function BottomNav({ navigation, active = 'wardrobe' }) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();

  const go = (dest) => {
    if (dest === active) return;
    const fromIdx = TABS.indexOf(active);
    const toIdx = TABS.indexOf(dest);
    const animation = toIdx > fromIdx ? 'slide_from_right' : 'slide_from_left';
    navigation.navigate(dest === 'wardrobe' ? 'Wardrobe' : 'Profile', { animation });
  };

  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12 + insets.bottom / 2,
        height: BOTTOM_NAV_HEIGHT,
        borderRadius: 18,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.hairline,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
      }}
    >
      {/* Wardrobe */}
      <TouchableOpacity onPress={() => go('wardrobe')} style={{ alignItems: 'center', width: 84 }} activeOpacity={0.85}>
        <Ionicons
          name="grid-outline"
          size={24}
          color={active === 'wardrobe' ? colors.primary : colors.textMuted}
        />
        <Text
          style={{
            marginTop: 4,
            fontSize: 12,
            color: active === 'wardrobe' ? colors.primary : colors.textMuted,
            fontWeight: active === 'wardrobe' ? '700' : '500',
          }}
        >
          {t('nav.wardrobe')}
        </Text>
      </TouchableOpacity>

      {/* PRO chip */}
      <View pointerEvents="none" style={{ alignItems: 'center' }}>
        <View
          style={{
            height: 40,
            paddingHorizontal: 20,
            borderRadius: 12,
            backgroundColor: colors.accent, // gold
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.06)',
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '800',
              color: '#333',
              letterSpacing: 0.4,
            }}
          >
            {t('nav.pro')}
          </Text>
        </View>
      </View>

      {/* Profile */}
      <CoachMark id="nav:profile">
        <TouchableOpacity onPress={() => go('profile')} style={{ alignItems: 'center', width: 84 }} activeOpacity={0.85}>
          <Ionicons
            name="person-circle-outline"
            size={24}
            color={active === 'profile' ? colors.primary : colors.textMuted}
          />
          <Text
            style={{
              marginTop: 4,
              fontSize: 12,
              color: active === 'profile' ? colors.primary : colors.textMuted,
              fontWeight: active === 'profile' ? '700' : '500',
            }}
          >
            {t('nav.profile', 'Profile')}
          </Text>
        </TouchableOpacity>
      </CoachMark>
    </View>
  );
}
