// screens/LookDetailsScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { SafeAreaView, View, Text, Image, ScrollView, TouchableOpacity, Button, Alert, Dimensions } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const api = axios.create({ baseURL: API_BASE_URL });

const TAGS = {
  season:   ['spring','summer','autumn','winter','all-season'],
  occasion: ['casual','work','formal','sport','streetwear','beach','loungewear'],
};

const TITLES = {
  season:   'Season',
  occasion: 'Occasion',
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
  const lookId = route.params?.lookId;

  const [loading, setLoading] = useState(false);
  const [look, setLook] = useState(null);           // { id, image_url, season[], occasion[], components: [ {id, image_url, item_type} ] }
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
      // normalize to arrays
      const season    = Array.isArray(data.season) ? data.season : (data.tags?.season || []);
      const occasion  = Array.isArray(data.occasion) ? data.occasion : (data.tags?.occasion || []);
      setSelected({
        season: Array.isArray(season) ? season : (season ? [season] : []),
        occasion: Array.isArray(occasion) ? occasion : (occasion ? [occasion] : []),
      });
    } catch (e) {
      console.log('fetchLook error', e?.response?.data || e.message);
      Alert.alert('Error', 'Failed to load look');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [lookId, navigation]);

  useEffect(() => { fetchLook(); }, [fetchLook]);

  const toggle = (cat, value, max = Infinity) => {
    setSelected(prev => {
      const curr = prev[cat] || [];
      const exists = curr.includes(value);
      let next = exists ? curr.filter(v => v !== value) : [...curr, value];
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
      Alert.alert('Saved', 'Look tags updated.');
      navigation.goBack();
    } catch (e) {
      console.log('update look error', e?.response?.data || e.message);
      Alert.alert('Failed', e?.response?.data?.message || e.message || 'Please try again');
    }
  };

  if (!look) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 10 }}>
        <View style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const comps = Array.isArray(look.components) ? look.components : (look.items || []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 10 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* Look image */}
        <View style={{
          height: HERO_HEIGHT,
          backgroundColor: '#f1f1f1',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 14,
        }}>
          <Image source={{ uri: look.image_url || look.imageUrl || look.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>

        {/* Components (readonly) */}
        <Section title="Components">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {comps && comps.length > 0 ? comps.map((it) => {
              const uri = it.image_url || it.imageUrl || it.url;
              return (
                <View key={it.id} style={{
                  width: 96, height: 96, borderRadius: 10, overflow: 'hidden', backgroundColor: '#eee',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                </View>
              );
            }) : (
              <Text style={{ color: '#666' }}>No components attached.</Text>
            )}
          </View>
        </Section>

        {/* Editable tags */}
        {(['season','occasion']).map((cat) => (
          <Section key={cat} title={TITLES[cat]}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {TAGS[cat].map((v) => (
                <Chip
                  key={v}
                  label={v}
                  active={(selected[cat] || []).includes(v)}
                  onPress={() => toggle(cat, v)}
                />
              ))}
            </View>
          </Section>
        ))}

        <View style={{ height: 18 }} />
        <Button title="Save" onPress={onSave} />
      </ScrollView>
    </SafeAreaView>
  );
}
