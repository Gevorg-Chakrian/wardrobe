// screens/WardrobeScreen.js
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  SafeAreaView, StatusBar, View, Text, FlatList, Image, Button, Alert, ActivityIndicator, Pressable,
  Platform, Modal, TouchableOpacity, TextInput, ScrollView, InteractionManager, Dimensions, PanResponder
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import BottomNav, { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useLanguage } from '../i18n/LanguageProvider';
import { CoachMark, useTutorial } from '../tutorial/TutorialProvider';

const api = axios.create({ baseURL: API_BASE_URL });

const MASTER_TYPES = [
  'tshirt','shirt','blouse','top','hoodie','sweater',
  'jeans','trousers','shorts','skirt','dress','jacket',
  'coat','blazer','cardigan','sneakers','shoes','boots',
  'bag','hat','scarf','accessory'
];

const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_SIDE_PADDING = 12;
const COLS = 2;
const ROW_GAP = 12;
const TILE_W = Math.floor((SCREEN_W - PAGE_SIDE_PADDING * 2 - ROW_GAP) / COLS);

// swipe thresholds
const SWIPE_DX = 40;
const SWIPE_VX = 0.35;

export default function WardrobeScreen({ navigation }) {
  const tutorial = useTutorial();
  useFocusEffect(useCallback(() => {
    tutorial.onScreen('Wardrobe');
    tutorial.startIfEnabled();
  }, [])); // eslint-disable-line

  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const typeLabel = (key) => {
    const k = String(key).toLowerCase();
    const val = t(`types.${k}`);
    return val && val !== `types.${k}`
      ? val
      : k.charAt(0).toUpperCase() + k.slice(1);
  };

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  const [pendingType, setPendingType] = useState(null);

  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [activeIndex, _setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const setActiveIndex = (updater) => {
    _setActiveIndex((curr) => {
      const next = typeof updater === 'function' ? updater(curr) : updater;
      activeIndexRef.current = next;
      return next;
    });
  };

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
      Alert.alert(t('common.error'), t('wardrobe.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { fetchWardrobe(); }, [fetchWardrobe]));

  const grouped = useMemo(() => {
    const map = {};
    for (const it of items) {
      const tpe = (it.item_type || it.itemType || 'unknown').toLowerCase();
      (map[tpe] ||= []).push(it);
    }
    return map;
  }, [items]);

  const typeList = useMemo(() => Object.keys(grouped).sort(), [grouped]);
  const pages = useMemo(() => ['all', ...typeList], [typeList]);

  // Clamp activeIndex if pages length changes
  useEffect(() => {
    setActiveIndex((curr) => Math.max(0, Math.min(curr, Math.max(0, pages.length - 1))));
  }, [pages.length]);

  const goToIndex = useCallback((nextIndex) => {
    setActiveIndex((curr) => {
      const max = Math.max(0, pages.length - 1);
      const clamped = Math.max(0, Math.min(nextIndex, max));
      if (clamped === curr) return curr;
      return clamped;
    });
  }, [pages.length]);

  const goToType = (type) => {
    const idx = pages.findIndex((tpe) => tpe.toLowerCase() === String(type).toLowerCase());
    if (idx >= 0) goToIndex(idx);
  };

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const exact = pages.find((tpe) => tpe.toLowerCase() === q);
    const partial = pages.find((tpe) => tpe.toLowerCase().includes(q));
    goToType(exact || partial || 'all');
  }, [searchQuery, pages, goToType]);

  const afterInteractions = () =>
    new Promise(r => InteractionManager.runAfterInteractions(r));

  const askTypeThenUpload = () => {
    setTypeSearch('');
    setTypeModalOpen(true);
  };

  const doPickAndUpload = async (chosenType) => {
    if (!chosenType || isPicking || isUploading) return;
    setIsPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('common.permissionRequired'), t('common.needGalleryAccess')); return; }

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
      Alert.alert(t('common.uploadFailed'), e?.response?.data?.message || e.message || t('common.tryAgain'));
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

  // PanResponder that always reads the latest index and goToIndex
  const pan = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_e, g) => {
      const ax = Math.abs(g.dx), ay = Math.abs(g.dy);
      return ax > 12 && ax > ay * 1.2;
    },
    onMoveShouldSetPanResponderCapture: (_e, g) => {
      const ax = Math.abs(g.dx), ay = Math.abs(g.dy);
      return ax > 12 && ax > ay * 1.2;
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_e, g) => {
      const idx = activeIndexRef.current;
      if (g.dx <= -SWIPE_DX || g.vx <= -SWIPE_VX) {
        goToIndex(idx + 1);
      } else if (g.dx >= SWIPE_DX || g.vx >= SWIPE_VX) {
        goToIndex(idx - 1);
      }
    },
  }), [goToIndex]);

  const topInset = (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 18;

  // derive data once from activeIndex
  const activeKey = pages[activeIndex] || 'all';
  const dataForActive = activeKey === 'all' ? items : (grouped[activeKey] || []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Top controls */}
      <View style={{ paddingTop: topInset, paddingHorizontal: PAGE_SIDE_PADDING }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <CoachMark id="wardrobe:addItem">
            <TouchableOpacity
              onPress={askTypeThenUpload}
              style={{ backgroundColor: '#1976D2', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 }}
              activeOpacity={0.9}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>{t('wardrobe.addItem')}</Text>
            </TouchableOpacity>
          </CoachMark>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => setSearchModalOpen(true)}
            style={{ width: 42, height: 42, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.8}
            accessibilityLabel={t('common.search')}
          >
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 6 }}
        >
          {pages.map((tpe, i) => {
            const active = i === activeIndex;
            return (
              <TouchableOpacity key={tpe} onPress={() => goToIndex(i)} style={{ marginRight: 18, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: active ? '700' : '600', color: active ? '#000' : '#666' }}>
                  {tpe === 'all' ? t('wardrobe.all') : typeLabel(tpe)}
                </Text>
                <View style={{ height: 3, marginTop: 6, width: active ? 22 : 0, backgroundColor: '#1976D2', borderRadius: 3 }} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content (single list that changes with activeIndex) + swipe layer */}
      <View style={{ flex: 1 }} {...pan.panHandlers}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: PAGE_SIDE_PADDING }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>
              {activeKey === 'all' ? t('wardrobe.all') : typeLabel(activeKey)}
            </Text>
            <FlatList
              data={dataForActive}
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
                      t('wardrobe.deleteTitle'),
                      t('wardrobe.deleteConfirm'),
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                          text: t('common.delete'),
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              const token = await SecureStore.getItemAsync('token');
                              await api.delete(`/wardrobe/${item.id}`, {
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              fetchWardrobe();
                            } catch (e) {
                              Alert.alert(t('wardrobe.deleteFailed'), e?.response?.data?.message || e.message || t('common.tryAgain'));
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
        )}
      </View>

      {/* Bottom Menu */}
      <BottomNav navigation={navigation} active="wardrobe" />

      {/* Upload type picker */}
      <Modal
        visible={typeModalOpen}
        animationType="slide"
        transparent
        onDismiss={handleModalDismiss}
        onRequestClose={() => setTypeModalOpen(false)}
        onShow={() => {
          setTimeout(() => {
            tutorial.setNext?.({
              anchorId: 'wardrobe:typePicker',
              textKey: 'tutorial.pickType',
              screen: 'Wardrobe',
              prefer: 'above',
            });
          }, 200);
          setTimeout(() => {
            tutorial.setNext?.({
              anchorId: 'wardrobe:typePicker',
              textKey: 'tutorial.pickType',
              screen: 'Wardrobe',
              prefer: 'above',
            });
          }, 700);
        }}
      >
        {/* Backdrop that closes the sheet */}
        <Pressable
          onPress={() => setTypeModalOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
        >
          {/* Stop propagation for taps inside the sheet */}
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <View
              style={{
                backgroundColor: '#fff',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                height: Math.round(Dimensions.get('window').height * 0.80),
                paddingTop: 8,
                paddingHorizontal: 16,
                paddingBottom: insets?.bottom ?? 8,
              }}
            >
              {/* Grabber */}
              <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd' }} />
              </View>

              {/* Title + X */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', flex: 1 }}>
                  {t('wardrobe.pickType')}
                </Text>
                <TouchableOpacity
                  onPress={() => setTypeModalOpen(false)}
                  hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
                  accessibilityLabel={t('common.close')}
                >
                  <Text style={{ fontSize: 22 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Search */}
              <TextInput
                placeholder={t('wardrobe.searchTypesPlaceholder')}
                value={typeSearch}
                onChangeText={setTypeSearch}
                style={{
                  height: 36,
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  marginBottom: 10,
                }}
              />

              {/* List fills available space */}
              <View style={{ flex: 1 }}>
                <CoachMark id="wardrobe:typePicker">
                  <FlatList
                    data={MASTER_TYPES.filter(tp =>
                      tp.includes(typeSearch.trim().toLowerCase())
                    )}
                    keyExtractor={(tp) => tp}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => { setPendingType(item); setTypeModalOpen(false); }}
                        style={{ paddingVertical: 12 }}
                      >
                        <Text style={{ fontSize: 16 }}>{typeLabel(item)}</Text>
                      </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
                    contentContainerStyle={{ paddingBottom: 8 }}
                  />
                </CoachMark>
              </View>

              {/* Button is part of the SAME white sheet */}
              <TouchableOpacity
                onPress={() => setTypeModalOpen(false)}
                activeOpacity={0.85}
                style={{
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: '#1976D2',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 8,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Search modal */}
      <Modal visible={searchModalOpen} transparent animationType="fade" onRequestClose={() => setSearchModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>{t('wardrobe.searchByType')}</Text>
            <TextInput
              placeholder={t('wardrobe.searchExample')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              style={{ height: 42, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, marginBottom: 12 }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchModalOpen(false); }}>
                <Text style={{ paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSearchModalOpen(false)}>
                <Text style={{ paddingVertical: 8, paddingHorizontal: 12, color: '#1976D2', fontWeight: '600' }}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
