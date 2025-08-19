// screens/AddItemDetailsScreen.js
import React, { useMemo, useState, useRef } from 'react';
import {
  SafeAreaView, View, Text, ScrollView, Image, TouchableOpacity, Button,
  Alert, Platform, Dimensions
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { extractSync } from '../api/ai';
import { useLanguage } from '../i18n/LanguageProvider';
import { useFocusEffect } from '@react-navigation/native';
import { CoachMark, useTutorial } from '../tutorial/TutorialProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    activeOpacity={0.85}
  >
    <Text style={{ color: active ? '#fff' : '#333', fontSize: 16 }}>{label}</Text>
  </TouchableOpacity>
);

const emptySel = { color: [], season: [], fit: [], occasion: [], material: [], pattern: [], feature: [] };
const toArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);

export default function AddItemScreen({ navigation, route }) {
  const { t } = useLanguage();
  const tutorial = useTutorial();
  const insets = useSafeAreaInsets();

  const requestedRef = useRef(false);
  const retriedRef = useRef(false);

  const imageUrl    = route.params?.imageUrl;
  const initialType = (route.params?.initialType || 'tshirt').toLowerCase();
  const itemId      = route.params?.itemId || null;
  const existing    = route.params?.existingTags || {};
  const isEditing   = !!itemId;

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
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState(isEditing ? initialSelected : emptySel);
  const [heroUrl, setHeroUrl] = useState(imageUrl);
  const [extracting, setExtracting] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      tutorial?.onScreen?.('AddItemDetails');
      tutorial?.startIfEnabled?.();
    }, [tutorial])
  );

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
      const { imageUrl: newUrl } = await extractSync({
        imageUrl: heroUrl,
        itemType: initialType,
      });
      if (!newUrl) throw new Error('No imageUrl returned from extractor');
      setHeroUrl(newUrl);
      Alert.alert(t('addItem.extractUpdatedTitle'), t('addItem.extractUpdatedBody'));
    } catch (e) {
      Alert.alert(t('addItem.extractFailedTitle'), e?.response?.data?.message || e.message || t('common.tryAgain'));
    } finally {
      setExtracting(false);
    }
  };

  const onSave = async () => {
    if (!isValid) {
      Alert.alert(t('addItem.missingTitle'), t('addItem.missingBody'));
      return;
    }
    try {
      setSaving(true);
      const token = await SecureStore.getItemAsync('token');

      if (isEditing) {
        await api.put(`/wardrobe/${itemId}`, { item_type: initialType, tags: selected, image_url: heroUrl }, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await api.post('/wardrobe', { image_url: heroUrl, item_type: initialType, tags: selected }, { headers: { Authorization: `Bearer ${token}` } });
      }

      Alert.alert(
        t('addItem.savedTitle'),
        isEditing ? t('addItem.savedEdit') : t('addItem.savedAdd'),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

      // Queue Step 4: point at the Profile tab once we're back on Wardrobe
      try {
        if (tutorial?.isRunning?.()) {
          tutorial.queueFront?.([
            {
              screen: 'Wardrobe',
              anchorId: 'nav:profile',
              textKey: 'tutorial.gotoProfile', // add this i18n key if missing
              prefer: 'above',
            },
          ]);
        }
      } catch {}
    } catch (e) {
      Alert.alert(t('common.saveFailed'), e?.response?.data?.message || e.message || t('common.tryAgain'));
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
              const token = await SecureStore.getItemAsync('token');
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
    color:    t('tags.color.title'),
    season:   t('tags.season.title'),
    fit:      t('tags.fit.title'),
    occasion: t('tags.occasion.title'),
    material: t('tags.material.title'),
    pattern:  t('tags.pattern.title'),
    feature:  t('tags.feature.title'),
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header with back arrow (no alert) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingTop: insets.top,
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

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* hero image */}
        <View style={{ marginTop: 16, marginBottom: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f8f8f8', height: HERO_HEIGHT }}>
          <Image source={{ uri: heroUrl }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
        </View>

        {/* retry extraction — ONLY when adding (not editing) */}
        {!isEditing && (
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
                {extracting ? t('common.extracting') : t('addItem.tryExtract')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* COLOR section */}
        <CoachMark id="additem:colors">
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
                  accessibilityLabel={t(`tags.color.${c}`, c)}
                />
              ))}
            </View>
          </Section>
        </CoachMark>

        {['season','fit','occasion','material','pattern','feature'].map((cat) => (
          <Section key={cat} title={TITLES[cat]}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {TAGS[cat].map((v) => (
                <Chip
                  key={v}
                  label={t(`tags.${cat}.${v}`, v)}
                  active={(selected[cat] || []).includes(v)}
                  onPress={() => toggle(cat, v)}
                />
              ))}
            </View>
          </Section>
        ))}

        <View style={{ height: 16 }} />
        <CoachMark id="additem:save">
          <Button
            title={saving ? t('common.saving') : (isEditing ? t('addItem.saveChanges') : t('addItem.saveItem'))}
            onPress={onSave}
            disabled={saving || deleting}
          />
        </CoachMark>

        {/* Delete item — only when editing */}
        {isEditing && (
          <>
            <View style={{ height: 10 }} />
            <TouchableOpacity
              onPress={onDeleteItem}
              disabled={deleting}
              activeOpacity={0.85}
              style={{
                height: 44,
                borderRadius: 10,
                backgroundColor: '#E53935',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: deleting ? 0.7 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                {deleting ? t('common.deleting', 'Deleting…') : t('addItem.deleteItem', 'Delete item')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
