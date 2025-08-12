// screens/WardrobeScreen.js
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  SafeAreaView, StatusBar, View, Text, FlatList, Image, Button, Alert, ActivityIndicator,
  Platform, Modal, TouchableOpacity, TextInput, ScrollView, InteractionManager, Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import BottomNav, { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';

const api = axios.create({ baseURL: API_BASE_URL });

const MASTER_TYPES = [
  'tshirt','shirt','blouse','top','hoodie','sweater',
  'jeans','trousers','shorts','skirt','dress','jacket',
  'coat','blazer','cardigan','sneakers','shoes','boots',
  'bag','hat','scarf','accessory'
];

const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_SIDE_PADDING = 12;
const PAGE_W = SCREEN_W;
const COLS = 2;
const ROW_GAP = 12;

const TILE_W = Math.floor((SCREEN_W - PAGE_SIDE_PADDING * 2 - ROW_GAP) / COLS);

export default function WardrobeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  const [pendingType, setPendingType] = useState(null);

  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const pagesRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const getToken = async () => SecureStore.getItemAsync('token');

  const fetchWardrobe = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await api.get('/wardrobe', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const all = res.data?.items || res.data || [];
      setItems(all.filter(it => (it.item_type || it.itemType) !== 'profile'));
    } catch (e) {
      console.log('fetchWardrobe error:', e?.response?.data || e.message);
      Alert.alert('Error', 'Failed to load wardrobe');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchWardrobe(); }, [fetchWardrobe]));

  const grouped = useMemo(() => {
    const map = {};
    for (const it of items) {
      const t = (it.item_type || it.itemType || 'unknown').toLowerCase();
      (map[t] ||= []).push(it);
    }
    return map;
  }, [items]);

  const typeList = useMemo(() => Object.keys(grouped).sort(), [grouped]);
  const pages = useMemo(() => ['all', ...typeList], [typeList]);

  const scrollToIndex = (index) => {
    if (!pagesRef.current) return;
    setActiveIndex(index);
    pagesRef.current.scrollToIndex({ index, animated: true });
  };

  const goToType = (type) => {
    const idx = pages.findIndex((t) => t.toLowerCase() === type.toLowerCase());
    if (idx >= 0) scrollToIndex(idx);
  };

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const exact = pages.find((t) => t.toLowerCase() === q);
    const partial = pages.find((t) => t.toLowerCase().includes(q));
    goToType(exact || partial || 'all');
  }, [searchQuery, pages]);

  const afterInteractions = () =>
    new Promise(r => InteractionManager.runAfterInteractions(r));

  const askTypeThenUpload = () => { setTypeSearch(''); setTypeModalOpen(true); };

  const doPickAndUpload = async (chosenType) => {
    if (!chosenType || isPicking || isUploading) return;
    setIsPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission required', 'We need access to your gallery.'); return; }

      const mediaType = ImagePicker.MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images;
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType, quality: 0.9,
        presentationStyle: Platform.OS === 'ios' ? 'fullScreen' : undefined,
        allowsMultipleSelection: false,
      });
      if (picked.canceled) return;

      const asset = picked.assets[0];
      const uri  = Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', '');
      const name = asset.fileName || `photo_${Date.now()}.jpg`;
      const type = asset.mimeType || 'image/jpeg';

      const form = new FormData();
      form.append('image', { uri, name, type });
      form.append('item_type', chosenType);

      const token = await getToken();

      setIsUploading(true);
      const uploadRes = await api.post('/upload', form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });

      const { image_url, item_type, url, type: detected } = uploadRes.data || {};
      const imageUrl = image_url || url;
      const finalType = (item_type || detected || chosenType);

      navigation.navigate('AddItemDetails', { imageUrl, initialType: finalType });
    } catch (e) {
      console.log('upload failed:', e.response ? e.response.data : e.message);
      Alert.alert('Upload failed', e?.response?.data?.message || e.message || 'Please try again.');
    } finally {
      setIsPicking(false);
      setIsUploading(false);
      setPendingType(null);
    }
  };

  const handleModalDismiss = async () => {
    if (!pendingType) return;
    await afterInteractions();
    await new Promise(r => setTimeout(r, 350));
    try { await doPickAndUpload(pendingType); }
    finally { setPendingType(null); }
  };

  useEffect(() => {
    if (Platform.OS === 'android' && !typeModalOpen && pendingType) {
      (async () => {
        await afterInteractions();
        await new Promise(r => setTimeout(r, 150));
        await doPickAndUpload(pendingType);
        setPendingType(null);
      })();
    }
  }, [typeModalOpen, pendingType]);

  const GridItem = ({ uri, onPress, onLongPress }) => (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={{
        width: TILE_W,
        height: TILE_W,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#eee',
        marginBottom: ROW_GAP,
      }}
      activeOpacity={0.85}
    >
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
    </TouchableOpacity>
  );

  const getPageLayout = (_, index) => ({
    length: PAGE_W,
    offset: PAGE_W * index,
    index,
  });

  const topInset = (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 18;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Top controls */}
      <View style={{ paddingTop: topInset, paddingHorizontal: PAGE_SIDE_PADDING }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <TouchableOpacity
            onPress={askTypeThenUpload}
            style={{ backgroundColor: '#1976D2', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 }}
            activeOpacity={0.9}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Add Item</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => setSearchModalOpen(true)}
            style={{ width: 42, height: 42, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
          {(['all', ...typeList]).map((t, i) => {
            const active = i === activeIndex;
            return (
              <TouchableOpacity key={t} onPress={() => scrollToIndex(i)} style={{ marginRight: 18, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: active ? '700' : '600', textTransform: 'capitalize', color: active ? '#000' : '#666' }}>
                  {t}
                </Text>
                <View style={{ height: 3, marginTop: 6, width: active ? 22 : 0, backgroundColor: '#1976D2', borderRadius: 3 }} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Carousel pages */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
        ) : (
          <FlatList
            ref={pagesRef}
            data={['all', ...typeList]}
            keyExtractor={(t) => t}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            getItemLayout={getPageLayout}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
              setActiveIndex(index);
            }}
            renderItem={({ item: pageKey }) => {
              const title = pageKey === 'all' ? 'All' : pageKey.charAt(0).toUpperCase() + pageKey.slice(1);
              const data = pageKey === 'all' ? items : (grouped[pageKey] || []);
              return (
                <View style={{ width: PAGE_W, paddingHorizontal: PAGE_SIDE_PADDING }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>{title}</Text>
                  <FlatList
                    data={data}
                    keyExtractor={(it) => String(it.id || it.image_url || it.imageUrl)}
                    numColumns={COLS}
                    columnWrapperStyle={{ justifyContent: 'space-between' }}
                    renderItem={({ item }) => (
                      <GridItem
                        uri={item.image_url || item.imageUrl || item.url}
                        onPress={() =>
                          navigation.navigate('AddItemDetails', {
                            itemId: item.id,
                            imageUrl: item.image_url || item.imageUrl || item.url,
                            initialType: (item.item_type || item.itemType || 'tshirt').toLowerCase(),
                            existingTags: item.tags || {},
                          })
                        }
                        onLongPress={() => {
                          Alert.alert(
                            'Delete Item',
                            'Are you sure you want to delete this item?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: async () => {
                                  try {
                                    const token = await SecureStore.getItemAsync('token');
                                    await api.delete(`/wardrobe/${item.id}`, {
                                      headers: { Authorization: `Bearer ${token}` },
                                    });
                                    fetchWardrobe();
                                  } catch (e) {
                                    Alert.alert('Failed to delete', e?.response?.data?.message || e.message || 'Please try again.');
                                  }
                                },
                              },
                            ]
                          );
                        }}
                      />
                    )}
                    contentContainerStyle={{ paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + 12 }}
                  />
                </View>
              );
            }}
          />
        )}
      </View>

      {/* Bottom Menu */}
      <BottomNav navigation={navigation} active="wardrobe" />

      {/* Upload type picker */}
      <Modal visible={typeModalOpen} animationType="slide" transparent onDismiss={handleModalDismiss}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', padding: 16, paddingBottom: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '75%' }}>
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Pick a type</Text>
            <TextInput
              placeholder="Search types to upload…"
              value={typeSearch}
              onChangeText={setTypeSearch}
              style={{ height: 36, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, marginBottom: 10 }}
            />
            <FlatList
              data={MASTER_TYPES.filter(t => t.includes(typeSearch.trim().toLowerCase()))}
              keyExtractor={(t) => t}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => { setPendingType(item); setTypeModalOpen(false); }} style={{ paddingVertical: 10 }}>
                  <Text style={{ fontSize: 16 }}>{item}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
            />
            <View style={{ height: 8 }} />
            <Button title="Close" onPress={() => setTypeModalOpen(false)} />
          </View>
        </View>
      </Modal>

      {/* Search modal */}
      <Modal visible={searchModalOpen} transparent animationType="fade" onRequestClose={() => setSearchModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Search by type</Text>
            <TextInput
              placeholder="e.g. all, tshirt, jeans…"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              style={{ height: 42, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, marginBottom: 12 }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchModalOpen(false); }}>
                <Text style={{ paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSearchModalOpen(false)}>
                <Text style={{ paddingVertical: 8, paddingHorizontal: 12, color: '#1976D2', fontWeight: '600' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
