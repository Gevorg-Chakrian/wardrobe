// screens/ProfileScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, Image, FlatList, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';

const api = axios.create({ baseURL: API_BASE_URL });
const { width: SCREEN_W } = Dimensions.get('window');
const SIDE = 16;
const GAP = 12;
const COL_W = Math.floor((SCREEN_W - SIDE*2 - GAP) / 2);

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('Profile');
  const [looks, setLooks] = useState([]);
  const [ratios, setRatios] = useState({}); // id -> aspectRatio (w/h)

  useEffect(() => {
    (async () => {
      const local = await SecureStore.getItemAsync('username');
      if (local) setUsername(local);
      else setUsername('Profile');
    })();
  }, []);

  const getToken = async () => SecureStore.getItemAsync('token');

  const fetchLooks = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await api.get('/looks', { headers: { Authorization: `Bearer ${token}` } });
      const arr = res.data?.looks || [];
      setLooks(arr);

      // probe image sizes for aspectRatio
      arr.forEach((lk) => {
        const uri = lk.image_url;
        if (!uri || ratios[lk.id]) return;
        Image.getSize(
          uri,
          (w, h) => setRatios(prev => ({ ...prev, [lk.id]: w / h })),
          () => setRatios(prev => ({ ...prev, [lk.id]: 1 }))
        );
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to load looks');
    }
  }, [ratios]);

  useEffect(() => { fetchLooks(); }, [fetchLooks]);

  const latest = looks[0] || null;
  const rest = useMemo(() => (looks.length > 1 ? looks.slice(1) : []), [looks]);

  // Split rest into two columns (simple waterfall)
  const colA = [], colB = [];
  let hA = 0, hB = 0;
  rest.forEach(lk => {
    const r = ratios[lk.id] || 1;
    const estH = COL_W / r;
    if (hA <= hB) { colA.push(lk); hA += estH + GAP; } else { colB.push(lk); hB += estH + GAP; }
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 10 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIDE, marginBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', flex: 1 }}>{username}</Text>
        <TouchableOpacity onPress={() => Alert.alert('Settings', 'Coming soon')} activeOpacity={0.8}>
          <Ionicons name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Create look */}
      <View style={{ paddingHorizontal: SIDE, marginBottom: 12 }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateLook')}
          style={{ height: 44, borderRadius: 10, backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.9}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>CREATE LOOK</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[{ kind:'latest' }, { kind:'grid' }]}
        keyExtractor={(it, i) => it.kind + i}
        renderItem={({ item }) => {
          if (item.kind === 'latest') {
            if (!latest) return null;
            const ratio = ratios[latest.id] || 1;
            return (
              <View style={{ paddingHorizontal: SIDE, marginBottom: 16 }}>
                <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Latest look</Text>
                <View style={{ width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#eee' }}>
                  <Image
                    source={{ uri: latest.image_url }}
                    style={{ width: '100%', aspectRatio: ratio }}
                    resizeMode="cover"
                  />
                </View>
              </View>
            );
          }

          // grid
          return (
            <View style={{ paddingHorizontal: SIDE, flexDirection: 'row', gap: GAP, paddingBottom: insets.bottom + 80 }}>
              <View style={{ width: COL_W }}>
                {colA.map(lk => (
                  <View key={lk.id} style={{ marginBottom: GAP, borderRadius: 12, overflow: 'hidden', backgroundColor: '#eee' }}>
                    <Image source={{ uri: lk.image_url }} style={{ width: '100%', aspectRatio: ratios[lk.id] || 1 }} resizeMode="cover" />
                  </View>
                ))}
              </View>
              <View style={{ width: COL_W }}>
                {colB.map(lk => (
                  <View key={lk.id} style={{ marginBottom: GAP, borderRadius: 12, overflow: 'hidden', backgroundColor: '#eee' }}>
                    <Image source={{ uri: lk.image_url }} style={{ width: '100%', aspectRatio: ratios[lk.id] || 1 }} resizeMode="cover" />
                  </View>
                ))}
              </View>
            </View>
          );
        }}
      />
      {/* Always-visible bottom navigation */}
      <BottomNav navigation={navigation} active="profile" />
    </SafeAreaView>
  );
}
