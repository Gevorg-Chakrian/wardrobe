// screens/AddItemScreen.js
import React, { useMemo, useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Button,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';

const api = axios.create({ baseURL: API_BASE_URL });

const TAGS = {
  color: [
    'black','white','gray','beige','brown','navy','blue','green','yellow','orange',
    'red','pink','purple','gold','silver','multicolor',
  ],
  season: ['spring','summer','autumn','winter','all-season'],
  fit: ['oversized','slim','regular','cropped','longline','boxy','tailored'],
  occasion: ['casual','work','formal','sport','streetwear','beach','loungewear'],
  material: ['cotton','wool','linen','denim','leather','synthetic','silk','knit'],
  pattern: ['solid','striped','checked','floral','geometric','polka-dot','animal','camouflage'],
  feature: ['waterproof','hooded','padded','embellished','sheer','sleeveless','backless'],
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

const { width: SCREEN_W } = Dimensions.get('window');

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

export default function AddItemScreen({ navigation, route }) {
  const imageUrl = route.params?.imageUrl;
  const initialType = (route.params?.initialType || 'tshirt').toLowerCase();

  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState({
    color: [],
    season: [],
    fit: [],
    occasion: [],
    material: [],
    pattern: [],
    feature: [],
  });

  // --- image aspect ratio so it never crops ---
  const [imgAR, setImgAR] = useState(1); // width / height
  useEffect(() => {
    if (!imageUrl) return;
    Image.getSize(
      imageUrl,
      (w, h) => {
        if (w && h) setImgAR(w / h);
      },
      () => setImgAR(1) // fallback square if lookup fails
    );
  }, [imageUrl]);

  // generic toggler; for color we enforce max 2
  const toggle = (cat, value, max = Infinity) => {
    setSelected((prev) => {
      const curr = prev[cat] || [];
      const exists = curr.includes(value);
      let next;
      if (exists) {
        next = curr.filter((v) => v !== value);
      } else {
        if (curr.length >= max) return prev;
        next = [...curr, value];
      }
      return { ...prev, [cat]: next };
    });
  };

  const isValid = useMemo(() => {
    // require at least one tag in every category
    return Object.keys(TAGS).every((k) => (selected[k] || []).length > 0);
  }, [selected]);

  const onSave = async () => {
    if (!isValid) {
      Alert.alert('Missing info', 'Please pick at least one tag in each section.');
      return;
    }
    try {
      setSaving(true);
      const token = await SecureStore.getItemAsync('token');

      await api.post(
        '/wardrobe',
        {
          image_url: imageUrl,
          item_type: initialType,
          tags: selected,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Saved!', 'Item added to your wardrobe.');
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
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Image preview (auto height from real aspect ratio) */}
        <View style={{ marginTop: 12, marginBottom: 16, alignItems: 'center' }}>
          <Image
            source={{ uri: imageUrl }}
            style={{
              width: SCREEN_W - 32,           // page padding 16 + 16
              aspectRatio: imgAR || 1,        // auto height
              borderRadius: 14,
              backgroundColor: '#f8f8f8',
            }}
            resizeMode="contain"
          />
        </View>

        {/* sections */}
        <Section title={TITLES.color}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {TAGS.color.map((c) => (
              <Chip
                key={c}
                label={c}
                active={selected.color.includes(c)}
                onPress={() => toggle('color', c, 2)}
              />
            ))}
          </View>
        </Section>

        {['season', 'fit', 'occasion', 'material', 'pattern', 'feature'].map((cat) => (
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
        <Button title={saving ? 'Saving…' : 'Save item'} onPress={onSave} disabled={saving} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
