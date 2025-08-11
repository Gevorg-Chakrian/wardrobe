// screens/WardrobeScreen.js
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  View, Text, FlatList, Image, Button, Alert, ActivityIndicator,
  Platform, Modal, TouchableOpacity, TextInput, ScrollView, InteractionManager,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';

const api = axios.create({ baseURL: API_BASE_URL });

const MASTER_TYPES = [
  'tshirt','shirt','blouse','top','hoodie','sweater',
  'jeans','trousers','shorts','skirt','dress','jacket',
  'coat','blazer','cardigan','sneakers','shoes','boots',
  'bag','hat','scarf','accessory'
];

const { width } = Dimensions.get('window');
const COLS = 3;
const GAP = 10;
const TILE = Math.floor((width - 24 /* page paddings */ - GAP * (COLS - 1)) / COLS);

export default function WardrobeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  const [pendingType, setPendingType] = useState(null);

  const [preview, setPreview] = useState({ open: false, url: null, label: '' });

  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const getToken = async () => SecureStore.getItemAsync('token');

  const fetchWardrobe = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await api.get('/wardrobe', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(res.data?.items || res.data || []);
    } catch (e) {
      console.log('fetchWardrobe error:', e?.response?.data || e.message);
      Alert.alert('Error', 'Failed to load wardrobe');
    } finally {
      setLoading(false);
    }
  }, []);

  // refresh when screen gains focus (e.g., after saving details)
  useFocusEffect(useCallback(() => { fetchWardrobe(); }, [fetchWardrobe]));

  const typeCounts = useMemo(() => {
    const counts = {};
    for (const it of items) {
      const t = (it.item_type || it.itemType || 'unknown').toLowerCase();
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [items]);

  const existingTypes = useMemo(() => Object.keys(typeCounts).sort(), [typeCounts]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) { setFilterType('all'); return; }
    const match = existingTypes.find(t => t.includes(q));
    setFilterType(match || 'all');
  }, [searchQuery, existingTypes]);

  const filteredItems = useMemo(() => {
    if (filterType === 'all') return items;
    return items.filter(
      it => (it.item_type || it.itemType || '').toLowerCase() === filterType
    );
  }, [items, filterType]);

  const askTypeThenUpload = () => {
    setTypeSearch('');
    setTypeModalOpen(true);
  };

  const afterInteractions = () =>
    new Promise(r => InteractionManager.runAfterInteractions(r));

  const doPickAndUpload = async (chosenType) => {
    if (!chosenType) return;
    if (isPicking || isUploading) return;

    setIsPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'We need access to your gallery.');
        return;
      }

      const mediaType = ImagePicker.MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images;
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType,
        quality: 0.9,
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
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      const { image_url, item_type, url, type: detected } = uploadRes.data || {};
      const imageUrl = image_url || url;
      const finalType = (item_type || detected || chosenType);

      // 👉 Go to the tagging screen instead of saving directly
      navigation.navigate('AddItemDetails', { imageUrl, itemType: finalType });
    } catch (e) {
      if (e.response) {
        console.log('upload failed: status', e.response.status, e.response.data);
      } else {
        console.log('upload failed:', e.message);
      }
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

  // --- UI helpers ---
  const Chip = ({ active, label, count, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16,
        marginRight: 8, backgroundColor: active ? '#1976D2' : '#eee',
        flexDirection: 'row', alignItems: 'center', height: 32
      }}
    >
      <Text style={{ color: active ? '#fff' : '#333' }}>{label}</Text>
      {typeof count === 'number' && (
        <View style={{
          marginLeft: 6, minWidth: 18, paddingHorizontal: 6, height: 20,
          borderRadius: 10, backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#ddd',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <Text style={{ fontSize: 12, color: active ? '#fff' : '#333' }}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const GridItem = ({ uri, label }) => (
    <TouchableOpacity
      onPress={() => setPreview({ open: true, url: uri, label })}
      style={{ width: TILE, height: TILE, borderRadius: 10, overflow: 'hidden', backgroundColor: '#eee' }}
    >
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
    </TouchableOpacity>
  );

  // group items for the "All" view
  const grouped = useMemo(() => {
    const map = {};
    for (const it of items) {
      const t = (it.item_type || it.itemType || 'unknown').toLowerCase();
      (map[t] ||= []).push(it);
    }
    return map;
  }, [items]);

  // layout tweaks
  const topInset = (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 18;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 12, paddingTop: topInset }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <TextInput
            placeholder="Search by type"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1, height: 42, borderWidth: 1, borderColor: '#ccc',
              borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 8 : 6,
              fontSize: 16, lineHeight: 20, textAlignVertical: 'center', marginRight: 8
            }}
          />
          <Button title="Add item from gallery" onPress={askTypeThenUpload} />
        </View>

        {/* Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 4 }}
          style={{ marginBottom: 6 }}
        >
          <Chip
            label="all"
            active={filterType === 'all'}
            count={items.length}
            onPress={() => { setFilterType('all'); setSearchQuery(''); }}
          />
          {Object.keys(typeCounts).sort().map(t => (
            <Chip
              key={t}
              label={t}
              active={filterType === t}
              count={typeCounts[t]}
              onPress={() => { setFilterType(t); setSearchQuery(''); }}
            />
          ))}
        </ScrollView>

        {/* Content */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
        ) : filterType === 'all' ? (
          // Grouped gallery for "All"
          <ScrollView
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {existingTypes.map((t) => (
              <View key={t} style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, textTransform: 'capitalize' }}>
                  {t}
                </Text>
                <FlatList
                  data={grouped[t] || []}
                  keyExtractor={(it) => String(it.id || it.image_url || it.imageUrl)}
                  renderItem={({ item }) => (
                    <GridItem uri={item.image_url || item.imageUrl || item.url} label={t} />
                  )}
                  numColumns={COLS}
                  columnWrapperStyle={{ gap: GAP }}
                  ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
                  scrollEnabled={false}
                />
              </View>
            ))}
            {existingTypes.length === 0 && (
              <Text style={{ textAlign: 'center', marginTop: 24 }}>No items yet.</Text>
            )}
          </ScrollView>
        ) : (
          // Plain grid when a single type is selected
          <FlatList
            data={filteredItems}
            keyExtractor={(it) => String(it.id || it.image_url || it.imageUrl)}
            renderItem={({ item }) => (
              <GridItem uri={item.image_url || item.imageUrl || item.url} label={filterType} />
            )}
            numColumns={COLS}
            columnWrapperStyle={{ gap: GAP }}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>

      {/* Type select modal */}
      <Modal
        visible={typeModalOpen}
        animationType="slide"
        transparent
        onDismiss={handleModalDismiss}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#fff', padding: 16, paddingBottom: 24,
            borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '75%'
          }}>
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Pick a type</Text>
            <TextInput
              placeholder="Search types to upload…"
              value={typeSearch}
              onChangeText={setTypeSearch}
              style={{
                height: 36, borderWidth: 1, borderColor: '#ccc',
                borderRadius: 8, paddingHorizontal: 10, marginBottom: 10
              }}
            />
            <FlatList
              data={MASTER_TYPES.filter(t => t.includes(typeSearch.trim().toLowerCase()))}
              keyExtractor={(t) => t}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setPendingType(item);
                    setTypeModalOpen(false);
                  }}
                  style={{ paddingVertical: 10 }}
                >
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

      {/* Preview */}
      <Modal
        visible={preview.open}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview({ open: false, url: null, label: '' })}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setPreview({ open: false, url: null, label: '' })}
          activeOpacity={1}
        >
          {!!preview.url && (
            <>
              <Image source={{ uri: preview.url }} style={{ width: '90%', height: '70%', resizeMode: 'contain' }} />
              <Text style={{ color: '#fff', marginTop: 10 }}>{preview.label}</Text>
              <Text style={{ color: '#bbb', marginTop: 6, fontSize: 12 }}>(tap to close)</Text>
            </>
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
