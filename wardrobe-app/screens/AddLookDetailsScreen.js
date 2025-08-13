// screens/AddLookDetailsScreen.js
import React, { useMemo, useState } from 'react';
import { SafeAreaView, View, Text, ScrollView, Image, TouchableOpacity, Button, Alert, Dimensions, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useLanguage } from '../i18n/LanguageProvider';

const api = axios.create({ baseURL: API_BASE_URL });

const SCREEN_W = Dimensions.get('window').width;
const HERO_H = Math.min(460, Math.round(SCREEN_W * 1.25));

const Chip = ({ active, label, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 8 : 6,
      borderRadius: 18,
      marginRight: 8,
      marginBottom: 10,
      backgroundColor: active ? '#1976D2' : '#e9e9ea',
    }}
    activeOpacity={0.85}
  >
    <Text style={{ color: active ? '#fff' : '#333', fontSize: 16 }}>{label}</Text>
  </TouchableOpacity>
);

export default function AddLookDetailsScreen({ navigation, route }) {
  const { t } = useLanguage();

  const baseUrl = route.params?.baseUrl;      // base photo we’ll save for this look
  const itemIds = route.params?.itemIds || [];

  // i18n-driven tag sets (fallback to English keys if not provided)
  const SEASONS   = ['spring','summer','autumn','winter','all-season'];
  const OCCASIONS = ['casual','work','formal','sport','streetwear','beach','loungewear'];

  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState({ season: [], occasion: [] });

  const toggle = (cat, value) => {
    setSelected((prev) => {
      const curr = prev[cat] || [];
      const exists = curr.includes(value);
      const next = exists ? curr.filter(v => v !== value) : [...curr, value];
      return { ...prev, [cat]: next };
    });
  };

  const isValid = useMemo(
    () => (selected.season || []).length > 0 && (selected.occasion || []).length > 0,
    [selected]
  );

  const onSave = async () => {
    if (!isValid) {
      return Alert.alert(
        t('addLook.missingTitle', 'Missing info'),
        t('addLook.missingBody', 'Pick at least one Season and Occasion.')
      );
    }
    try {
      setSaving(true);
      const token = await SecureStore.getItemAsync('token');
      await api.post(
        '/looks',
        { image_url: baseUrl, items_used: itemIds, tags: selected },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert(t('addLook.saved', 'Look saved!'));
      navigation.navigate('Profile');
    } catch (e) {
      Alert.alert(
        t('common.saveFailed', 'Failed to save'),
        e?.response?.data?.message || e.message || t('common.tryAgain', 'Please try again.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* Preview of the look (base photo for now) */}
        <View
          style={{
            marginTop: 16,
            marginBottom: 16,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#f8f8f8',
            height: HERO_H,
          }}
        >
          <Image source={{ uri: baseUrl }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
        </View>

        {/* Season */}
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>
            {t('tags.season.title', 'Season')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {SEASONS.map(v => (
              <Chip
                key={v}
                label={t(`tags.season.${v}`, v)}
                active={(selected.season || []).includes(v)}
                onPress={() => toggle('season', v)}
              />
            ))}
          </View>
        </View>

        {/* Occasion */}
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>
            {t('tags.occasion.title', 'Occasion')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {OCCASIONS.map(v => (
              <Chip
                key={v}
                label={t(`tags.occasion.${v}`, v)}
                active={(selected.occasion || []).includes(v)}
                onPress={() => toggle('occasion', v)}
              />
            ))}
          </View>
        </View>

        <View style={{ height: 16 }} />
        <Button
          title={saving ? t('common.saving', 'Saving…') : t('addLook.save', 'Save look')}
          onPress={onSave}
          disabled={saving}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
