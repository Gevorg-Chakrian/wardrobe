// components/BottomNav.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BOTTOM_NAV_HEIGHT = 62;

const TABS = ['wardrobe', 'profile']; // logical order (left → right)

export default function BottomNav({ navigation, active = 'wardrobe' }) {
  const insets = useSafeAreaInsets();

  const go = (dest) => {
    if (dest === active) return;

    const fromIdx = TABS.indexOf(active);
    const toIdx   = TABS.indexOf(dest);

    // decide swipe based on relative position
    const animation = toIdx > fromIdx ? 'slide_from_right' : 'slide_from_left';
    const routeName = dest === 'wardrobe' ? 'Wardrobe' : 'Profile';

    navigation.navigate(routeName, { animation });
  };

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: BOTTOM_NAV_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
      }}
    >
      {/* Wardrobe */}
      <TouchableOpacity onPress={() => go('wardrobe')} style={{ alignItems: 'center' }} activeOpacity={0.8}>
        <Ionicons
          name="shirt-outline"
          size={24}
          color={active === 'wardrobe' ? '#1976D2' : '#666'}
        />
        <Text
          style={{
            marginTop: 4,
            fontSize: 12,
            color: active === 'wardrobe' ? '#1976D2' : '#666',
            fontWeight: active === 'wardrobe' ? '600' : '400',
          }}
        >
          Wardrobe
        </Text>
      </TouchableOpacity>

      {/* Plus (visual only) */}
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 40,            // smaller so it doesn’t exceed the bar
            height: 40,
            borderRadius: 20,
            backgroundColor: '#FFD54F',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 3,
            elevation: 2,
          }}
          pointerEvents="none"
        >
          <Ionicons name="add" size={24} color="#333" />
        </View>
        <Text style={{ marginTop: 4, fontSize: 12, color: '#999' }}>Plus</Text>
      </View>

      {/* Profile */}
      <TouchableOpacity onPress={() => go('profile')} style={{ alignItems: 'center' }} activeOpacity={0.8}>
        <Ionicons
          name="person-circle-outline"
          size={24}
          color={active === 'profile' ? '#1976D2' : '#666'}
        />
        <Text
          style={{
            marginTop: 4,
            fontSize: 12,
            color: active === 'profile' ? '#1976D2' : '#666',
            fontWeight: active === 'profile' ? '600' : '400',
          }}
        >
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
}
