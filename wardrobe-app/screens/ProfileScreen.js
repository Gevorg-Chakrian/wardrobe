// screens/ProfileScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, Image, FlatList, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from '../components/BottomNav';
import { useLanguage } from '../i18n/LanguageProvider';
import { CoachMark, useTutorial } from '../tutorial/TutorialProvider';
import { useFocusEffect } from '@react-navigation/native';

const api = axios.create({ baseURL: API_BASE_URL });
const { width: SCREEN_W } = Dimensions.get('window');
const SIDE = 16;
const GAP = 12;
const COL_W = Math.floor((SCREEN_W - SIDE * 2 - GAP) / 2);

/** ---- helpers ---- */
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
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
/** ------------------------------------------------------------- */

export default function ProfileScreen({ navigation }) {
  const tutorial = useTutorial();
  const profileStepShown = useRef(false); // show “Create Look” once
  useFocusEffect(
    useCallback(() => {
      tutorial?.onScreen?.('Profile');
      tutorial?.startIfEnabled?.('Profile');
      if (!profileStepShown.current && tutorial?.isEnabled?.()) {
        profileStepShown.current = true;
        // Nudge: point to the Create Look button
        setTimeout(() => {
          tutorial.setNext?.({
            anchorId: 'profile:createLook',
            textKey: 'tutorial.createLook',
            screen: 'Profile',
            prefer: 'below',
          });
        }, 150);
      }
    }, [tutorial])
  );

  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [username, setUsername] = useState('Profile');
  const [looks, setLooks] = useState([]);
  const [ratios, setRatios] = useState({}); // id -> aspectRatio (w/h)
  const [deletingIds, setDeletingIds] = useState({}); // id -> true while deleting

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
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: () => doDelete(lookId),
        },
      ]
    );
  };

  const doDelete = async (lookId) => {
    if (!lookId || deletingIds[lookId]) return;
    try {
      setDeletingIds(prev => ({ ...prev, [lookId]: true }));
      // optimistic UI: drop locally
      setLooks(prev => prev.filter(l => l.id !== lookId));
      const token = await getToken();
      await api.delete(`/looks/${lookId}`, { headers: { Authorization: `Bearer ${token}` } });
      // refresh to be safe (in case newest changed, etc.)
      fetchLooks();
    } catch (e) {
      // revert by refetch if failed
      await fetchLooks();
      Alert.alert(t('common.error', 'Error'), t('profile.deleteLookFailed', 'Failed to delete. Please try again.'));
    } finally {
      setDeletingIds(prev => {
        const next = { ...prev };
        delete next[lookId];
        return next;
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 10 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIDE, marginBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', flex: 1 }} numberOfLines={1}>{username}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} activeOpacity={0.8}>
          <Ionicons name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Create look (tutorial anchor) */}
      <View style={{ paddingHorizontal: SIDE, marginBottom: 12 }}>
        <CoachMark id="profile:createLook">
          <TouchableOpacity
            onPress={() => navigation.navigate('CreateLook')}
            style={{ height: 44, borderRadius: 10, backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.9}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t('profile.createLook')}</Text>
          </TouchableOpacity>
        </CoachMark>
      </View>

      <FlatList
        data={[{ kind: 'latest' }, { kind: 'grid' }]}
        keyExtractor={(it, i) => it.kind + i}
        renderItem={({ item }) => {
          if (item.kind === 'latest') {
            if (!latest) return null;
            const ratio = ratios[latest.id] || 1;
            const uri = latest.image_url || latest.imageUrl || latest.url;
            const isDeleting = !!deletingIds[latest.id];
            return (
              <View style={{ paddingHorizontal: SIDE, marginBottom: 16 }}>
                <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>{t('profile.latestLook')}</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('LookDetails', { lookId: latest.id })}
                  onLongPress={() => confirmDelete(latest.id)}
                  delayLongPress={400}
                  activeOpacity={0.85}
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: '#eee',
                    opacity: isDeleting ? 0.6 : 1,
                  }}
                >
                  <Image source={{ uri }} style={{ width: '100%', aspectRatio: ratio }} resizeMode="cover" />
                </TouchableOpacity>
              </View>
            );
          }

          // grid
          return (
            <View style={{ paddingHorizontal: SIDE, flexDirection: 'row', gap: GAP, paddingBottom: insets.bottom + 80 }}>
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
                        marginBottom: GAP,
                        borderRadius: 12,
                        overflow: 'hidden',
                        backgroundColor: '#eee',
                        opacity: isDeleting ? 0.6 : 1,
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
                        marginBottom: GAP,
                        borderRadius: 12,
                        overflow: 'hidden',
                        backgroundColor: '#eee',
                        opacity: isDeleting ? 0.6 : 1,
                      }}
                    >
                      <Image source={{ uri }} style={{ width: '100%', aspectRatio: ratios[lk.id] || 1 }} resizeMode="cover" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        }}
      />

      {/* Bottom nav */}
      <BottomNav navigation={navigation} active="profile" />
    </SafeAreaView>
  );
}
