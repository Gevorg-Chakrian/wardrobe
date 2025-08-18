// screens/LookDetailsScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView, View, Text, Image, ScrollView, TouchableOpacity, Button, Alert, Dimensions } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageProvider';

const api = axios.create({ baseURL: API_BASE_URL });

const TAG_KEYS = {
  season:   ['spring','summer','autumn','winter','all-season'],
  occasion: ['casual','work','formal','sport','streetwear','beach','loungewear'],
};

const TITLES_KEYS = {
  season:   'lookDetails.season',
  occasion: 'lookDetails.occasion',
};

const SCREEN_W = Dimensions.get('window').width;
const HERO_HEIGHT = Math.min(500, Math.round(SCREEN_W * 1.25));

const Chip = ({ active, label, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={{
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      marginRight: 8,
      marginBottom: 10,
      backgroundColor: active ? '#1976D2' : '#e9e9ea',
    }}
  >
    <Text style={{ color: active ? '#fff' : '#333', fontSize: 16 }}>{label}</Text>
  </TouchableOpacity>
);

const Section = ({ title, children }) => (
  <View style={{ marginTop: 18 }}>
    <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>{title}</Text>
    {children}
  </View>
);

export default function LookDetailsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const lookId = route.params?.lookId;

  const [loading, setLoading] = useState(false);
  const [look, setLook] = useState(null);
  const [selected, setSelected] = useState({ season: [], occasion: [] });

  const getToken = async () => SecureStore.getItemAsync('token');

  const fetchLook = useCallback(async () => {
    if (!lookId) return;
    try {
      setLoading(true);
      const token = await getToken();
      const res = await api.get(`/looks/${lookId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = res.data?.look || res.data;
      if (!data) throw new Error('Look not found');

      setLook(data);
      const season = Array.isArray(data.season) ? data.season : data.tags?.season || [];
      const occasion = Array.isArray(data.occasion) ? data.occasion : data.tags?.occasion || [];
      setSelected({
        season: Array.isArray(season) ? season : season ? [season] : [],
        occasion: Array.isArray(occasion) ? occasion : occasion ? [occasion] : [],
      });
    } catch (e) {
      console.log('fetchLook error', e?.response?.data || e.message);
      Alert.alert(t('common.error'), t('lookDetails.loadError'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [lookId, navigation, t]);

  useEffect(() => { fetchLook(); }, [fetchLook]);

  const toggle = (cat, value, max = Infinity) => {
    setSelected((prev) => {
      const curr = prev[cat] || [];
      const exists = curr.includes(value);
      let next = exists ? curr.filter((v) => v !== value) : [...curr, value];
      if (next.length > max) next = next.slice(0, max);
      return { ...prev, [cat]: next };
    });
  };

  const onSave = async () => {
    try {
      const token = await getToken();
      await api.put(
        `/looks/${lookId}`,
        { season: selected.season, occasion: selected.occasion },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert(t('lookDetails.savedTitle'), t('lookDetails.savedMsg'));
      navigation.goBack();
    } catch (e) {
      console.log('update look error', e?.response?.data || e.message);
      Alert.alert(t('common.error'), t('lookDetails.saveFailed'));
    }
  };

  if (!look) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 10 }}>
        <View style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const comps = Array.isArray(look.components) ? look.components : look.items || [];
  const heroUri = look.image_url || look.imageUrl || look.url;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header with back arrow */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
          accessibilityLabel={t('common.back', 'Back')}
          style={{ padding: 6, marginRight: 8 }}
        >
          <Text style={{ fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>
          {t('lookDetails.title', 'Look Details')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* Look image */}
        <View
          style={{
            height: HERO_HEIGHT,
            backgroundColor: '#f1f1f1',
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 14,
          }}
        >
          <Image source={{ uri: heroUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>

        {/* Components (readonly) */}
        <Section title={t('lookDetails.components')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {comps && comps.length > 0 ? (
              comps.map((it) => {
                const uri = it.image_url || it.imageUrl || it.url;
                return (
                  <View
                    key={it.id}
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 10,
                      overflow: 'hidden',
                      backgroundColor: '#eee',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                  </View>
                );
              })
            ) : (
              <Text style={{ color: '#666' }}>{t('lookDetails.noComponents')}</Text>
            )}
          </View>
        </Section>

        {/* Editable tags */}
        {['season', 'occasion'].map((cat) => (
          <Section key={cat} title={t(TITLES_KEYS[cat])}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {TAG_KEYS[cat].map((key) => (
                <Chip
                  key={key}
                  label={t(`tags.${cat}.${key}`)}
                  active={(selected[cat] || []).includes(key)}
                  onPress={() => toggle(cat, key)}
                />
              ))}
            </View>
          </Section>
        ))}

        <View style={{ height: 18 }} />
        <Button title={t('lookDetails.save')} onPress={onSave} />
      </ScrollView>
    </SafeAreaView>
  );
}
