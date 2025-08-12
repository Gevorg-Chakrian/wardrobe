// screens/CreateLookScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView, View, Text, FlatList, Image, TouchableOpacity, Button, Alert, Dimensions
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';

const api = axios.create({ baseURL: API_BASE_URL });
const { width } = Dimensions.get('window');
const COLS = 3;
const GAP = 10;
const TILE = Math.floor((width - 24 - GAP * (COLS - 1)) / COLS);

export default function CreateLookScreen() {
  const [profiles, setProfiles] = useState([]); // base images (item_type: 'profile')
  const [clothes, setClothes] = useState([]);   // all other wardrobe items
  const [base, setBase] = useState(null);       // selected base
  const [picked, setPicked] = useState([]);     // selected clothing IDs

  const getToken = async () => SecureStore.getItemAsync('token');

  const fetchAll = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await api.get('/wardrobe', { headers: { Authorization: `Bearer ${token}` } });
      const all = res.data?.items || res.data || [];
      const p = [];
      const c = [];
      all.forEach(it => {
        const t = (it.item_type || it.itemType || '').toLowerCase();
        if (t === 'profile') p.push(it);
        else c.push(it);
      });
      setProfiles(p);
      setClothes(c);
      if (!base && p.length) setBase(p[0]);
    } catch (e) {
      console.log('create-look fetch error:', e?.response?.data || e.message);
      Alert.alert('Error', 'Failed to load wardrobe.');
    }
  }, [base]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleCloth = (item) => {
    setPicked((prev) => {
      const id = item.id;
      return prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    });
  };

  const selectedClothes = useMemo(
    () => clothes.filter(it => picked.includes(it.id)),
    [clothes, picked]
  );

  const generate = () => {
    if (!base) return Alert.alert('Pick a base photo', 'Select one of your photos at the top.');
    if (selectedClothes.length === 0) return Alert.alert('Pick some clothes', 'Select at least one clothing item.');

    // For now we just display the base photo as the "result".
    Alert.alert('Look created (mock)', `Base chosen + ${selectedClothes.length} item(s). For now we show your base photo as result.`);
  };

  const ProfileThumb = ({ item }) => {
    const img = item.image_url || item.imageUrl || item.url;
    const active = base?.id === item.id;
    return (
      <TouchableOpacity
        onPress={() => setBase(item)}
        style={{
          width: 90, height: 120, marginRight: 10, borderRadius: 10, overflow: 'hidden',
          borderWidth: active ? 3 : 1, borderColor: active ? '#1976D2' : '#ccc', backgroundColor: '#eee'
        }}
      >
        <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} />
      </TouchableOpacity>
    );
  };

  const ClothTile = ({ item }) => {
    const img = item.image_url || item.imageUrl || item.url;
    const active = picked.includes(item.id);
    return (
      <TouchableOpacity
        onPress={() => toggleCloth(item)}
        style={{
          width: TILE, height: TILE, borderRadius: 10, overflow: 'hidden',
          backgroundColor: '#eee', borderWidth: active ? 3 : 0, borderColor: active ? '#1976D2' : 'transparent'
        }}
      >
        <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', padding: 12 }}>
      {/* base profile carousel */}
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Choose your base photo</Text>
      <FlatList
        data={profiles}
        keyExtractor={(it) => String(it.id || it.image_url || it.imageUrl)}
        renderItem={({ item }) => <ProfileThumb item={item} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 6 }}
        ListEmptyComponent={<Text style={{ color: '#666' }}>No photos yet. Add some in “My Photos”.</Text>}
      />

      {/* clothes grid */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>Pick clothes</Text>
        <Button title="Generate look" onPress={generate} />
      </View>

      <FlatList
        data={clothes}
        keyExtractor={(it) => String(it.id || it.image_url || it.imageUrl)}
        renderItem={({ item }) => <ClothTile item={item} />}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 24 }}>No clothes yet.</Text>}
      />
    </SafeAreaView>
  );
}
