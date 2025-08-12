// screens/ProfileScreen.js
import React from 'react';
import { SafeAreaView, View, Text, Button, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 16 }}>Profile</Text>

        {/* Put anything you want here */}
        <View style={{ marginTop: 8 }}>
          <Button title="Create Look" onPress={() => navigation.navigate('CreateLook')} />
        </View>
      </ScrollView>

      {/* Bottom menu on Profile too */}
      <BottomNav navigation={navigation} active="profile" />
    </SafeAreaView>
  );
}
