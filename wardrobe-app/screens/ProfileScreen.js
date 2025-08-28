// screens/ProfileScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, Image, Dimensions, Alert,
} from 'react-native';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from '../components/BottomNav';
import { useLanguage } from '../i18n/LanguageProvider';
import { CoachMark, useTutorial } from '../tutorial/TutorialProvider';
import { useFocusEffect } from '@react-navigation/native';
import { ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const api = axios.create({ baseURL: API_BASE_URL });
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SIDE = 16;
const GAP = 12;
const COL_W = Math.floor((SCREEN_W - SIDE * 2 - GAP) / 2);

// Accent to match Wardrobe
const ACCENT = '#2DD4BF';

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function base64UrlToBase64(s) {
  const n = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = n.length % 4 ? 4 - (n.length % 4) : 0;
  return n + '='.repeat(pad);
}
function base64DecodePolyfill(input) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = String(input).replace(/[^A-Za-z0-9+/=]/g, '');
  let output = '';
  for (let bc = 0, bs, buffer, idx = 0; (buffer = str.charAt(idx++)); ) {
    buffer = chars.indexOf(buffer);
    if (~buffer) {
      bs = bc % 4 ? bs * 64 + buffer : buffer;
      if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
  }
  return output;
}
function safeAtob(b64) {
  if (typeof globalThis.atob === 'function') return globalThis.atob(b64);
  return base64DecodePolyfill(b64);
}
async function resolveDisplayName() {
  const stored = await SecureStore.getItemAsync('username');
  if (stored) return stored;

  const token = await SecureStore.getItemAsync('token');
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const jsonStr = safeAtob(base64UrlToBase64(parts[1]));
        const payload = JSON.parse(jsonStr);
        const email = payload?.email;
        if (email) {
          const beforeAt = String(email).split('@')[0];
          const pretty = beforeAt.split(/[._-]+/).filter(Boolean).map(capitalize).join(' ');
          return pretty || 'Profile';
        }
      }
    } catch {}
  }
  return 'Profile';
}

export default function ProfileScreen({ navigation }) {
  const tutorial = useTutorial();
  useFocusEffect(useCallback(() => {
    tutorial?.onScreen?.('Profile');
    tutorial?.startIfEnabled?.();
  }, [tutorial]));

  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [username, setUsername] = useState('Profile');
  const [looks, setLooks] = useState([]);
  const [ratios, setRatios] = useState({}); // id -> aspectRatio
  const [deletingIds, setDeletingIds] = useState({}); // id -> true

  useEffect(() => { (async () => setUsername(await resolveDisplayName()))(); }, []);
  const getToken = async () => SecureStore.getItemAsync('token');

  const fetchLooks = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await api.get('/looks', { headers: { Authorization: `Bearer ${token}` } });
      const arr = res.data?.looks || res.data?.items || [];
      setLooks(arr);

      arr.forEach((lk) => {
        const uri = lk.image_url || lk.imageUrl || lk.url;
        if (!uri || ratios[lk.id]) return;
        Image.getSize(
          uri,
          (w, h) => setRatios(prev => ({ ...prev, [lk.id]: w / h })),
          ()   => setRatios(prev => ({ ...prev, [lk.id]: 1 }))
        );
      });
    } catch {
      Alert.alert(t('common.error'), t('profile.loadLooksError'));
    }
  }, [t, ratios]);

  useEffect(() => { fetchLooks(); }, [fetchLooks]);

  const latest = looks[0] || null;
  const rest = useMemo(() => (looks.length > 1 ? looks.slice(1) : []), [looks]);

  // simple waterfall into two columns
  const colA = [], colB = [];
  let hA = 0, hB = 0;
  rest.forEach(lk => {
    const r = ratios[lk.id] || 1;
    const estH = COL_W / r;
    if (hA <= hB) { colA.push(lk); hA += estH + GAP; } else { colB.push(lk); hB += estH + GAP; }
  });

  /** Delete flow */
  const confirmDelete = (lookId) => {
    Alert.alert(
      t('profile.deleteLookTitle', 'Delete look?'),
      t('profile.deleteLookBody', 'This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('common.delete', 'Delete'), style: 'destructive', onPress: () => doDelete(lookId) },
      ]
    );
  };
  const doDelete = async (lookId) => {
    if (!lookId || deletingIds[lookId]) return;
    try {
      setDeletingIds(prev => ({ ...prev, [lookId]: true }));
      setLooks(prev => prev.filter(l => l.id !== lookId)); // optimistic
      const token = await getToken();
      await api.delete(`/looks/${lookId}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchLooks();
    } catch {
      await fetchLooks();
      Alert.alert(t('common.error', 'Error'), t('profile.deleteLookFailed', 'Failed to delete. Please try again.'));
    } finally {
      setDeletingIds(prev => { const n = { ...prev }; delete n[lookId]; return n; });
    }
  };

  /** Fancy button (same style as Wardrobe) */
  const FancyButton = ({ label, onPress }) => {
    const WIDTH = Math.min(SCREEN_W - SIDE * 2, 320);
    return (
      <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={{ transform: [{ scale: 1 }] }}>
        <LinearGradient
          colors={[ACCENT, '#34d399', '#06b6d4']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{
            width: WIDTH, borderRadius: 28, padding: 5,
            shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 }, elevation: 6,
          }}
        >
          <View style={{
            borderRadius: 26, backgroundColor: '#fff',
            alignItems: 'center', justifyContent: 'center',
            paddingVertical: 14, paddingHorizontal: 22,
          }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#111', letterSpacing: 0.3 }}>
              {label}
            </Text>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', top: 2, left: 12, right: 12, height: 10,
                borderTopLeftRadius: 26, borderTopRightRadius: 26,
                backgroundColor: 'rgba(255,255,255,0.35)', opacity: 0.65,
              }}
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  /** Parallax paper background (same as Wardrobe) */
  const scrollY = useRef(new Animated.Value(0)).current;
  const bgTranslateY = Animated.multiply(scrollY, -1);
  const [contentH, setContentH] = useState(SCREEN_H);
  const BG_BUFFER = 600;

  /** Header (scrolls away with content) */
  const HeaderBlock = React.memo(() => (
    <View style={{ paddingTop: insets.top + 10, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIDE, marginBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', flex: 1 }} numberOfLines={1}>{username}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} activeOpacity={0.8}>
          <Ionicons name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: SIDE, alignItems: 'flex-start' }}>
        <CoachMark id="profile:createLook">
          <FancyButton label={t('profile.createLook')} onPress={() => navigation.navigate('CreateLook')} />
        </CoachMark>
      </View>

      {latest ? (
        <View style={{ paddingHorizontal: SIDE, marginTop: 16 }}>
          <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>{t('profile.latestLook')}</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('LookDetails', { lookId: latest.id })}
            onLongPress={() => confirmDelete(latest.id)}
            delayLongPress={400}
            activeOpacity={0.85}
            style={{
              width: '100%', borderRadius: 12, overflow: 'hidden',
              backgroundColor: '#eee', opacity: deletingIds[latest.id] ? 0.6 : 1,
            }}
          >
            <Image
              source={{ uri: latest.image_url || latest.imageUrl || latest.url }}
              style={{ width: '100%', aspectRatio: ratios[latest.id] || 1 }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  ));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Paper pattern background with subtle parallax */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
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

      {/* Content */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        onContentSizeChange={(_w, h) => setContentH(prev => Math.max(prev, h))}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        <HeaderBlock />

        {/* Grid */}
        <View style={{ paddingHorizontal: SIDE, flexDirection: 'row', gap: GAP }}>
          <View style={{ width: COL_W }}>
            {colA.map(lk => {
              const uri = lk.image_url || lk.imageUrl || lk.url;
              const isDeleting = !!deletingIds[lk.id];
              return (
                <TouchableOpacity
                  key={lk.id}
                  onPress={() => navigation.navigate('LookDetails', { lookId: lk.id })}
                  onLongPress={() => confirmDelete(lk.id)}
                  delayLongPress={400}
                  activeOpacity={0.85}
                  style={{
                    marginBottom: GAP, borderRadius: 12, overflow: 'hidden',
                    backgroundColor: '#eee', opacity: isDeleting ? 0.6 : 1,
                  }}
                >
                  <Image source={{ uri }} style={{ width: '100%', aspectRatio: ratios[lk.id] || 1 }} resizeMode="cover" />
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ width: COL_W }}>
            {colB.map(lk => {
              const uri = lk.image_url || lk.imageUrl || lk.url;
              const isDeleting = !!deletingIds[lk.id];
              return (
                <TouchableOpacity
                  key={lk.id}
                  onPress={() => navigation.navigate('LookDetails', { lookId: lk.id })}
                  onLongPress={() => confirmDelete(lk.id)}
                  delayLongPress={400}
                  activeOpacity={0.85}
                  style={{
                    marginBottom: GAP, borderRadius: 12, overflow: 'hidden',
                    backgroundColor: '#eee', opacity: isDeleting ? 0.6 : 1,
                  }}
                >
                  <Image source={{ uri }} style={{ width: '100%', aspectRatio: ratios[lk.id] || 1 }} resizeMode="cover" />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Animated.ScrollView>

      <BottomNav navigation={navigation} active="profile" />
    </SafeAreaView>
  );
}
