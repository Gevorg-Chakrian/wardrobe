// screens/AddItemDetailsScreen.js  (aka AddItemScreen)
import React, { useMemo, useState } from 'react';
import {
  SafeAreaView, View, Text, ScrollView, Image, TouchableOpacity, Button,
  Alert, Platform, Dimensions
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';

const api = axios.create({ baseURL: API_BASE_URL });

const TAGS = {
  color: ['black','white','gray','beige','brown','navy','blue','green','yellow','orange','red','pink','purple','gold','silver'],
  season: ['spring','summer','autumn','winter','all-season'],
  fit: ['oversized','slim','regular','cropped','longline','boxy','tailored'],
  occasion: ['casual','work','formal','sport','streetwear','beach','loungewear'],
  material: ['cotton','wool','linen','denim','leather','synthetic','silk','knit'],
  pattern: ['solid','striped','checked','floral','geometric','polka-dot','animal','camouflage'],
  feature: ['hooded','padded','embellished','sheer','sleeveless','backless'],
};

const TITLES = {
  color: 'Color (pick up to 2)',
  season: 'Season',
  fit: 'Fit & Style',
  occasion: 'Occasion',
  material: 'Material',
  pattern: 'Pattern',
  feature: 'Special Features',
};

const SCREEN_W = Dimensions.get('window').width;
const HERO_HEIGHT = Math.min(420, Math.round(SCREEN_W * 1.2));

const Section = ({ title, children }) => (
  <View style={{ marginTop: 18 }}>
    <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>{title}</Text>
    {children}
  </View>
);

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
  >
    <Text style={{ color: active ? '#fff' : '#333', fontSize: 16 }}>{label}</Text>
  </TouchableOpacity>
);

const emptySel = { color: [], season: [], fit: [], occasion: [], material: [], pattern: [], feature: [] };
const toArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);

export default function AddItemScreen({ navigation, route }) {
  const imageUrl    = route.params?.imageUrl;
  const initialType = (route.params?.initialType || 'tshirt').toLowerCase();
  const itemId      = route.params?.itemId || null;
  const existing    = route.params?.existingTags || {};

  const initialSelected = {
    color:     toArray(existing.color),
    season:    toArray(existing.season),
    fit:       toArray(existing.fit),
    occasion:  toArray(existing.occasion),
    material:  toArray(existing.material),
    pattern:   toArray(existing.pattern),
    feature:   toArray(existing.feature),
  };

  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(itemId ? initialSelected : emptySel);
  const [heroUrl, setHeroUrl] = useState(imageUrl);
  const [extracting, setExtracting] = useState(false);

  const toggle = (cat, value, max = Infinity) => {
    setSelected((prev) => {
      const curr = prev[cat] || [];
      const exists = curr.includes(value);
      let next;
      if (exists) next = curr.filter((v) => v !== value);
      else {
        if (curr.length >= max) return prev;
        next = [...curr, value];
      }
      return { ...prev, [cat]: next };
    });
  };

  const REQUIRED_CATS = Object.keys(TAGS).filter(k => k !== 'feature');
  const isValid = useMemo(() => {
    return REQUIRED_CATS.every((k) => (selected[k] || []).length > 0)
           && (selected.color || []).length > 0
           && (selected.color || []).length <= 2;
  }, [selected]);

  const retryExtraction = async () => {
    try {
      setExtracting(true);
      const token = await SecureStore.getItemAsync('token');
      const res = await api.post(
        '/extract',
        { imageUrl: heroUrl, itemType: initialType },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newUrl = res.data?.imageUrl;
      if (!newUrl) throw new Error('No imageUrl returned from extractor');
      setHeroUrl(newUrl);
      Alert.alert('Extraction updated', 'Preview replaced with the new extraction.');
    } catch (e) {
      console.log('retryExtraction error:', e?.response?.data || e.message);
      Alert.alert('Extraction failed', e?.response?.data?.message || e.message || 'Please try again.');
    } finally {
      setExtracting(false);
    }
  };

  const onSave = async () => {
    if (!isValid) {
      Alert.alert('Missing info', 'Please pick at least one tag in each section (features are optional).');
      return;
    }
    try {
      setSaving(true);
      const token = await SecureStore.getItemAsync('token');

      if (itemId) {
        await api.put(
          `/wardrobe/${itemId}`,
          { item_type: initialType, tags: selected, image_url: heroUrl },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await api.post(
          '/wardrobe',
          { image_url: heroUrl, item_type: initialType, tags: selected },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      Alert.alert('Saved!', itemId ? 'Changes updated.' : 'Item added to your wardrobe.');
      navigation.goBack();
    } catch (e) {
      console.log('save item error:', e?.response?.data || e.message);
      Alert.alert('Failed to save', e?.response?.data?.message || e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* hero image */}
        <View style={{ marginTop: 16, marginBottom: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f8f8f8', height: HERO_HEIGHT }}>
          <Image source={{ uri: heroUrl }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
        </View>

        {/* retry extraction */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity
            disabled={extracting}
            onPress={retryExtraction}
            activeOpacity={0.85}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: extracting ? '#9bbbe5' : '#1976D2'
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              {extracting ? 'Extracting…' : 'Try extraction again'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* color swatches */}
        <Section title={TITLES.color}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {TAGS.color.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => toggle('color', c, 2)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  marginRight: 10,
                  marginBottom: 10,
                  backgroundColor: c,
                  borderWidth: selected.color.includes(c) ? 3 : 1,
                  borderColor: selected.color.includes(c) ? '#1976D2' : '#ccc',
                }}
              />
            ))}
          </View>
        </Section>

        {(['season','fit','occasion','material','pattern','feature']).map((cat) => (
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

        <View style={{ height: 16 }} />
        <Button
          title={saving ? 'Saving…' : (itemId ? 'Save changes' : 'Save item')}
          onPress={onSave}
          disabled={saving}
        />

        {itemId && (
          <>
            <View style={{ height: 16 }} />
            <Button
              title="Delete item"
              color="red"
              onPress={() => {
                Alert.alert(
                  "Delete Item",
                  "Are you sure you want to delete this item?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          const token = await SecureStore.getItemAsync('token');
                          await api.delete(`/wardrobe/${itemId}`, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          Alert.alert("Deleted", "Item removed from your wardrobe.");
                          navigation.goBack();
                        } catch (e) {
                          console.log('delete item error:', e?.response?.data || e.message);
                          Alert.alert('Failed to delete', e?.response?.data?.message || e.message || 'Please try again.');
                        }
                      }
                    }
                  ]
                );
              }}
            />
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
