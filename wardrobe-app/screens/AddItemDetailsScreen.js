// screens/AddItemDetailsScreen.js
import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, Alert,
  Platform, Dimensions, Animated, Image, Pressable
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useLanguage } from '../i18n/LanguageProvider';
import { useFocusEffect } from '@react-navigation/native';
import { CoachMark, useTutorial } from '../tutorial/TutorialProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const api = axios.create({ baseURL: API_BASE_URL });

/** ---- Compact, AI-useful facets ---- */
const TAGS = {
  color:     ['black','white','gray','beige','brown','navy','blue','green','yellow','orange','red','pink','purple','gold','silver'],
  season:    ['spring','summer','autumn','winter','all-season'],
  weather:   ['hot','mild','cold','rain','wind','snow'],
  occasion:  ['casual','work','formal','sport','streetwear','beach','loungewear'],
  formality: ['casual','smart-casual','semi-formal','formal'],
  fit:       ['oversized','slim','regular','cropped','longline','boxy','tailored'],
  layer:     ['base','midlayer','outer'],
  material:  ['cotton','wool','linen','denim','leather','synthetic','silk','knit'],
  pattern:   ['solid','striped','checked','floral','geometric','polka-dot','animal','camouflage'],
  versatility: ['low','medium','high'],
};

/** ---- Per-type visible facets (from previous step) ---- */
const PER_TYPE = (() => {
  const HEAD_NECK = {
    hat:     ['color','season','weather','occasion','formality','material','pattern','versatility'],
    scarf:   ['color','season','weather','occasion','formality','material','pattern','versatility'],
    tie:     ['color','occasion','formality','material','pattern','versatility'],
  };
  const LIGHT_TOPS = ['polo','tshirt','shirt','blouse','top','longsleeve']
    .reduce((m,t)=> (m[t]=['color','season','weather','occasion','formality','fit','material','pattern','layer','versatility'], m), {});
  const KNITS = ['hoodie','sweater','cardigan']
    .reduce((m,t)=> (m[t]=['color','season','weather','occasion','formality','fit','material','pattern','layer','versatility'], m), {});
  const OUTER = ['jacket','coat','blazer','raincoat']
    .reduce((m,t)=> (m[t]=['color','season','weather','occasion','formality','fit','material','pattern','layer','versatility'], m), {});
  const BOTTOMS = ['jeans','trousers','shorts','skirt']
    .reduce((m,t)=> (m[t]=['color','season','weather','occasion','formality','fit','material','pattern','versatility'], m), {});
  const ONEPIECE = { dress: ['color','season','weather','occasion','formality','fit','material','pattern','versatility'] };
  const FOOTWEAR = ['sneakers','shoes','heels','sandals','boots']
    .reduce((m,t)=> (m[t]=['color','season','weather','occasion','pattern','versatility'], m), {}); // minimal per your request
  const BAG = { bag: ['color','occasion','formality','material','pattern','versatility'] };
  return { ...HEAD_NECK, ...LIGHT_TOPS, ...KNITS, ...OUTER, ...BOTTOMS, ...ONEPIECE, ...FOOTWEAR, ...BAG };
})();

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HERO_HEIGHT = Math.min(420, Math.round(SCREEN_W * 1.2));
const SIDE = 16;
const ACCENT = '#2DD4BF';

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
      borderWidth: active ? 0 : 1,
      borderColor: '#d8d8db',
      backgroundColor: active ? ACCENT : '#f0f0f2',
    }}
    activeOpacity={0.85}
  >
    <Text style={{ color: active ? '#fff' : '#333', fontSize: 15, fontWeight: active ? '700' : '500' }}>{label}</Text>
  </TouchableOpacity>
);

const toArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);
const labelize = (t, path, fallback) => {
  const key = `tags.${path}`;
  const val = t(key);
  return val && val !== key ? val : fallback;
};

/** Fancy primary button (gradient outline + inner card) */
const FancyPrimaryButton = ({ label, onPress, disabled }) => {
  const WIDTH = Math.min(SCREEN_W - SIDE * 2, 360);
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={({ pressed }) => ({ transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] })}>
      <LinearGradient
        colors={[ACCENT, '#34d399', '#06b6d4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: WIDTH,
          borderRadius: 28,
          padding: 5,
          opacity: disabled ? 0.65 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
          alignSelf: 'center',
        }}
      >
        <View
          style={{
            borderRadius: 24,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            paddingHorizontal: 22,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#111', letterSpacing: 0.3 }}>
            {label}
          </Text>
          {/* subtle gloss */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 2,
              left: 12,
              right: 12,
              height: 10,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: 'rgba(255,255,255,0.35)',
              opacity: 0.65,
            }}
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
};

export default function AddItemDetailsScreen({ navigation, route }) {
  const { t } = useLanguage();
  const tutorial = useTutorial();
  const insets = useSafeAreaInsets();

  const imageUrl    = route.params?.imageUrl;
  const initialType = (route.params?.initialType || 'tshirt').toLowerCase();
  const itemId      = route.params?.itemId || null;
  const existing    = route.params?.existingTags || {};
  const isEditing   = !!itemId;

  const visibleFacets = useMemo(
    () => PER_TYPE[initialType] || ['color','season','weather','occasion','formality','fit','material','pattern','versatility'],
    [initialType]
  );

  const initialSelected = {
    color:       toArray(existing.color),
    season:      toArray(existing.season),
    weather:     toArray(existing.weather),
    occasion:    toArray(existing.occasion),
    formality:   toArray(existing.formality),
    fit:         toArray(existing.fit),
    layer:       toArray(existing.layer),
    material:    toArray(existing.material),
    pattern:     toArray(existing.pattern),
    versatility: toArray(existing.versatility),
  };

  const [heroUrl, setHeroUrl] = useState(imageUrl);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState(initialSelected);

  useFocusEffect(
    React.useCallback(() => {
      tutorial?.onScreen?.('AddItemDetails');
      tutorial?.startIfEnabled?.();
    }, [tutorial])
  );

  const toggle = useCallback((cat, value, max = Infinity) => {
    setSelected(prev => {
      const curr = toArray(prev[cat]);
      const exists = curr.includes(value);
      if (exists) return { ...prev, [cat]: curr.filter(v => v !== value) };
      if (curr.length >= max) return prev;
      return { ...prev, [cat]: [...curr, value] };
    });
  }, []);

  // Validation: color (≤2) + at least one other visible facet
  const isValid = useMemo(() => {
    const hasColor = (selected.color || []).length > 0 && (selected.color || []).length <= 2;
    const others = visibleFacets.filter(f => f !== 'color');
    const anyOther = others.some(f => (selected[f] || []).length > 0);
    return hasColor && anyOther;
  }, [selected, visibleFacets]);

  // Optional: refine/extract endpoint
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
      Alert.alert(t('addItem.extractUpdatedTitle', 'Updated'), t('addItem.extractUpdatedBody', 'Image was refined.'));
    } catch (e) {
      Alert.alert(t('addItem.extractFailedTitle', 'Couldn’t refine'), e?.response?.data?.message || e.message);
    } finally {
      setExtracting(false);
    }
  };

  const getToken = async () => SecureStore.getItemAsync('token');

  const onSave = async () => {
    if (!isValid) {
      const otherList = visibleFacets.filter(f => f !== 'color').join(', ');
      Alert.alert(
        t('addItem.missingTitle', 'Add more details'),
        t('addItem.missingBody', `Please choose color (up to 2) and at least one of: ${otherList}.`)
      );
      return;
    }
    try {
      setSaving(true);
      const token = await getToken();
      const payload = { image_url: heroUrl, item_type: initialType, tags: selected };

      if (isEditing) {
        await api.put(`/wardrobe/${itemId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await api.post('/wardrobe', payload, { headers: { Authorization: `Bearer ${token}` } });
      }

    } catch (e) {
      Alert.alert(t('common.saveFailed', 'Save failed'), e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const onDeleteItem = () => {
    if (!isEditing || !itemId) return;
    Alert.alert(
      t('wardrobe.deleteTitle', 'Delete item?'),
      t('wardrobe.deleteConfirm', 'Are you sure you want to delete this item?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              const token = await getToken();
              await api.delete(`/wardrobe/${itemId}`, { headers: { Authorization: `Bearer ${token}` } });
              navigation.goBack();
            } catch (e) {
              Alert.alert(t('common.error', 'Error'), t('common.deleteFailed', 'Failed to delete. Please try again.'));
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  const TITLES = {
    color:       labelize(t, 'color.title', 'Color'),
    season:      labelize(t, 'season.title', 'Season'),
    weather:     labelize(t, 'weather.title', 'Weather'),
    occasion:    labelize(t, 'occasion.title', 'Occasion'),
    formality:   labelize(t, 'formality.title', 'Formality'),
    fit:         labelize(t, 'fit.title', 'Fit'),
    layer:       labelize(t, 'layer.title', 'Layer role'),
    material:    labelize(t, 'material.title', 'Material'),
    pattern:     labelize(t, 'pattern.title', 'Pattern'),
    versatility: labelize(t, 'versatility.title', 'Versatility'),
  };

  // Background (same paper pattern w/ parallax)
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentH, setContentH] = useState(SCREEN_H);
  const bgTranslateY = Animated.multiply(scrollY, -1);
  const BG_BUFFER = 600;

  const renderFacet = (cat) => (
    <Section key={cat} title={TITLES[cat]}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {TAGS[cat].map((v) => (
          <Chip
            key={v}
            label={labelize(t, `${cat}.${v}`, v)}
            active={(selected[cat] || []).includes(v)}
            onPress={() => toggle(cat, v)}
          />
        ))}
      </View>
    </Section>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Background layer */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          transform: [{ translateY: bgTranslateY }],
          height: Math.max(contentH + BG_BUFFER, SCREEN_H + BG_BUFFER),
        }}
      >
        <ImageBackground
          source={require('../assets/patterns/light-paper.png')}
          resizeMode="repeat"
          style={{ flex: 1, width: '100%' }}
        />
      </Animated.View>

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingTop: useSafeAreaInsets().top,
          paddingBottom: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
          accessibilityLabel={t('common.back', 'Back')}
          style={{ padding: 6, marginRight: 6 }}
        >
          <Text style={{ fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>
          {isEditing ? t('addItem.editTitle', 'Edit item') : t('addItem.addTitle', 'Add item')}
        </Text>
      </View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingHorizontal: SIDE, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_w, h) => setContentH(prev => Math.max(prev, h))}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* hero image */}
        <View style={{ marginTop: 16, marginBottom: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f8f8f8', height: HERO_HEIGHT }}>
          <Image source={{ uri: heroUrl }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
        </View>

        {/* refine (only when adding) */}
        {!isEditing && (
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity
              disabled={extracting}
              onPress={retryExtraction}
              activeOpacity={0.85}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: extracting ? '#9bbbe5' : ACCENT,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>
                {extracting ? t('common.extracting', 'Extracting…') : t('addItem.tryExtract', 'Refine image')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Always show COLOR */}
        <CoachMark id="additem:colors">
          <Section title={TITLES.color}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {TAGS.color.map((c) => {
                const active = (selected.color || []).includes(c);
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => toggle('color', c, 2)}
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      marginRight: 10, marginBottom: 10,
                      backgroundColor: c,
                      borderWidth: active ? 3 : 1,
                      borderColor: active ? ACCENT : '#ccc',
                    }}
                    accessibilityLabel={labelize(t, `color.${c}`, c)}
                  />
                );
              })}
            </View>
          </Section>
        </CoachMark>

        {/* Only the facets that matter for this type */}
        {visibleFacets.filter(f => f !== 'color').map(renderFacet)}

        {/* Fancy Save */}
        <View style={{ height: 18 }} />
        <CoachMark id="additem:save">
          <FancyPrimaryButton
            label={saving ? t('common.saving', 'Saving…') : (isEditing ? t('addItem.saveChanges', 'Save changes') : t('addItem.saveItem', 'Save item'))}
            onPress={onSave}
            disabled={saving || deleting}
          />
        </CoachMark>

        {/* Delete when editing */}
        {isEditing && (
          <>
            <View style={{ height: 12 }} />
            <TouchableOpacity
              onPress={onDeleteItem}
              disabled={deleting}
              activeOpacity={0.9}
              style={{
                alignSelf: 'center',
                width: Math.min(SCREEN_W - SIDE * 2, 360),
                height: 46,
                borderRadius: 14,
                backgroundColor: '#E53935',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: deleting ? 0.7 : 1,
                shadowColor: '#000',
                shadowOpacity: 0.16,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                {deleting ? t('common.deleting', 'Deleting…') : t('addItem.deleteItem', 'Delete item')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
