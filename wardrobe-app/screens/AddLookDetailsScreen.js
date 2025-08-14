// screens/AddLookDetailsScreen.js
import React, { useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Button,
  Dimensions,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useLanguage } from '../i18n/LanguageProvider';
import { useTutorial, CoachMark } from '../tutorial/TutorialProvider';

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
  const tutorial = useTutorial();

  const baseUrl = route.params?.baseUrl;
  const itemIds = route.params?.itemIds || [];

  // i18n-driven tag sets
  const SEASONS   = ['spring','summer','autumn','winter','all-season'];
  const OCCASIONS = ['casual','work','formal','sport','streetwear','beach','loungewear'];

  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState({ season: [], occasion: [] });

  // show the “almost there” bubble once, above the first tag group
  const promptedRef = useRef(false);
  useFocusEffect(
    React.useCallback(() => {
      tutorial?.onScreen?.('AddLookDetails');
      tutorial?.startIfEnabled?.('AddLookDetails');

      if (!promptedRef.current && tutorial?.isEnabled?.()) {
        promptedRef.current = true;
        // Wait a tick so the <CoachMark id="addlook:tags" /> is measured
        setTimeout(() => {
          tutorial.setNext?.({
            anchorId: 'addlook:tags',
            // Use whichever copy you prefer; this key should contain the message body.
            textKey: 'tutorial.lookReadyBody',
            screen: 'AddLookDetails',
            prefer: 'above', // bubble above chips, arrow pointing down at them
          });
        }, 200);
      }
    }, [tutorial])
  );

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
      // keep this validation alert (it’s actionable)
      return alert(
        t('addLook.missingTitle', 'Missing info') + '\n' +
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

      // Finish tutorial & go to Profile
      try {
        tutorial?.complete?.();
        tutorial?.setEnabled?.(false);
        if (token) {
          await api.put(
            '/settings/tutorial',
            { enabled: false },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      } catch {}
      navigation.navigate('Profile');
    } catch (e) {
      alert(t('common.saveFailed', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* Look preview */}
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

        {/* Season (ANCHOR for the bubble) */}
        <CoachMark id="addlook:tags">
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
        </CoachMark>

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
