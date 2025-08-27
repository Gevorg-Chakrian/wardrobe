// screens/WardrobeScreen.js
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  SafeAreaView, StatusBar, View, Text, FlatList, Image, Alert, ActivityIndicator,
  Pressable, Platform, Modal, TouchableOpacity, TextInput, ScrollView,
  InteractionManager, Dimensions, PanResponder, ImageBackground
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
import { useTheme } from '../ui/theme';
import TypeIcon from '../components/TypeIcon';

const api = axios.create({ baseURL: API_BASE_URL });

const MASTER_TYPES = [
  'tshirt','shirt','blouse','top','hoodie','sweater',
  'jeans','trousers','shorts','skirt','dress','jacket',
  'coat','blazer','cardigan','sneakers','shoes','boots',
  'bag','hat','scarf','accessory'
];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** Layout */
const SIDE_PADDING = 16;
const COLS = 2;
const COL_GAP = 14;
const ROW_GAP = 18;
const TILE_W = Math.round((SCREEN_W - SIDE_PADDING * 2 - COL_GAP) / COLS);

const SWIPE_DX = 40;
const SWIPE_VX = 0.35;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function postWithRetry(url, data, config, { retries = 2, timeout = 30000 } = {}) {
  let attempt = 0;
  const baseCfg = {
    ...config,
    timeout,
    maxBodyLength: Infinity,
    headers: { ...(config?.headers || {}), 'Content-Type': 'multipart/form-data' },
    transformRequest: [(d) => d],
  };
  while (true) {
    try { return await api.post(url, data, baseCfg); }
    catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');
      const isNetErr  = err.message === 'Network Error';
      const status    = err?.response?.status;
      if (attempt < retries && (isTimeout || isNetErr || (status >= 500 && status <= 599))) {
        attempt += 1; await sleep(800 * attempt); continue;
      }
      throw err;
    }
  }
}

export default function WardrobeScreen({ navigation }) {
  const tutorial = useTutorial();
  useFocusEffect(useCallback(() => { tutorial.onScreen('Wardrobe'); tutorial.startIfEnabled(); }, []));
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();

  const typeLabel = (key) => {
    const k = String(key).toLowerCase();
    const val = t(`types.${k}`);
    return val && val !== `types.${k}` ? val : k.charAt(0).toUpperCase() + k.slice(1);
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
      activeIndexRef.current = next; return next;
    });
  };

  const getToken = async () => SecureStore.getItemAsync('token');

  const fetchWardrobe = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await api.get('/wardrobe', { headers: { Authorization: `Bearer ${token}` } });
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

  useEffect(() => {
    setActiveIndex((curr) => Math.max(0, Math.min(curr, Math.max(0, pages.length - 1))));
  }, [pages.length]);

  const goToIndex = useCallback((nextIndex) => {
    setActiveIndex((curr) => {
      const max = Math.max(0, pages.length - 1);
      const clamped = Math.max(0, Math.min(nextIndex, max));
      return clamped === curr ? curr : clamped;
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

  const afterInteractions = () => new Promise(r => InteractionManager.runAfterInteractions(r));
  const askTypeThenUpload = () => { setTypeSearch(''); setTypeModalOpen(true); };

  const doPickAndUpload = async (chosenType) => {
    if (!chosenType || isPicking || isUploading) return;
    setIsPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('common.permissionRequired'), t('common.needGalleryAccess')); return; }

      const mediaType = ImagePicker.MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images;
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType, quality: 0.8,
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
      const uploadRes = await postWithRetry('/upload', form, { headers: { Authorization: `Bearer ${token}` } });
      const { image_url, item_type, url, type: detected } = uploadRes.data || {};
      const imageUrl = image_url || url;
      const finalType = (item_type || detected || chosenType);

      navigation.navigate('AddItemDetails', { imageUrl, initialType: finalType });
    } catch (e) {
      console.log('upload failed:', e?.response?.data || e.message);
      const msg = e?.response?.data?.message ||
        (e?.message === 'Network Error'
          ? t('common.networkIssue', 'Network issue. Please check your connection and try again.')
          : e?.message) || t('common.tryAgain');
      Alert.alert(t('common.uploadFailed'), msg);
    } finally {
      setIsPicking(false);
      setIsUploading(false);
      setPendingType(null);
    }
  };

  const handleModalDismiss = async () => {
    if (!pendingType) return;
    await afterInteractions(); await new Promise(r => setTimeout(r, 350));
    try { await doPickAndUpload(pendingType); } finally { setPendingType(null); }
  };

  useEffect(() => {
    if (Platform.OS === 'android' && !typeModalOpen && pendingType) {
      (async () => {
        await afterInteractions(); await new Promise(r => setTimeout(r, 150));
        await doPickAndUpload(pendingType); setPendingType(null);
      })();
    }
  }, [typeModalOpen, pendingType]);

  /** Grid tile */
  const GridItem = ({ uri, onPress, onLongPress }) => (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.9}
      style={{
        width: TILE_W,
        height: TILE_W,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.hairline,
        shadowColor: colors.shadow,
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
    </TouchableOpacity>
  );

  /** Swipe between pages */
  const pan = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_e, g) => {
      const ax = Math.abs(g.dx), ay = Math.abs(g.dy); return ax > 12 && ax > ay * 1.2;
    },
    onMoveShouldSetPanResponderCapture: (_e, g) => {
      const ax = Math.abs(g.dx), ay = Math.abs(g.dy); return ax > 12 && ax > ay * 1.2;
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_e, g) => {
      const idx = activeIndexRef.current;
      if (g.dx <= -SWIPE_DX || g.vx <= -SWIPE_VX) { goToIndex(idx + 1); }
      else if (g.dx >= SWIPE_DX || g.vx >= SWIPE_VX) { goToIndex(idx - 1); }
    },
  }), [goToIndex]);

  const topInset = (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 18;

  const activeKey = pages[activeIndex] || 'all';
  const dataForActive = activeKey === 'all' ? items : (grouped[activeKey] || []);

  /** Tabs state + centering logic */
  const tabsRef = useRef(null);
  const tabLayoutsRef = useRef({});
  const [tabsContentW, setTabsContentW] = useState(0);
  const didMountTabs = useRef(false);
  const lastTabsNode = useRef(null);

  useEffect(() => {
    const layout = tabLayoutsRef.current[activeIndex];
    const node = tabsRef.current;
    if (!layout || !node) return;

    const isNewInstance = node !== lastTabsNode.current;
    if (isNewInstance) {
      lastTabsNode.current = node;
      didMountTabs.current = false;
    }

    const desiredCenterX = layout.x + layout.width / 2;
    const targetX = Math.max(0, Math.min(desiredCenterX - SCREEN_W / 2, Math.max(0, tabsContentW - SCREEN_W)));
    node.scrollTo({ x: targetX, animated: didMountTabs.current });
    if (!didMountTabs.current) didMountTabs.current = true;
  }, [activeIndex, tabsContentW]);

  /** Header block (scrolls away with content) */
  const HeaderBlock = React.memo(function HeaderBlockComponent() {
    return (
      <View style={{ paddingTop: topInset }}>
        {/* Add / Search */}
        <View style={{ paddingHorizontal: SIDE_PADDING, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <CoachMark id="wardrobe:addItem">
            <TouchableOpacity
              onPress={askTypeThenUpload}
              activeOpacity={0.9}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 14,
                shadowColor: colors.shadow,
                shadowOpacity: 0.18,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 4,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t('wardrobe.addItem')}</Text>
            </TouchableOpacity>
          </CoachMark>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => setSearchModalOpen(true)}
            style={{
              width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.hairline,
              alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
            }}
            activeOpacity={0.85}
            accessibilityLabel={t('common.search')}
          >
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <ScrollView
          ref={tabsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SIDE_PADDING, paddingBottom: 8 }}
          onContentSizeChange={(w) => setTabsContentW(w)}
        >
          {pages.map((tpe, i) => {
            const active = i === activeIndex;
            const label = tpe === 'all' ? t('wardrobe.all') : typeLabel(tpe);
            return (
              <TouchableOpacity
                key={tpe}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  tabLayoutsRef.current[i] = { x, width };
                }}
                onPress={() => goToIndex(i)}
                activeOpacity={0.9}
                style={{
                  marginRight: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: active ? colors.chipActiveBg : colors.chipBg,
                  borderWidth: 1,
                  borderColor: active ? 'transparent' : colors.hairline,
                }}
              >
                <TypeIcon type={tpe} color={active ? colors.chipActiveText : colors.textMuted} />
                <Text
                  style={{
                    marginLeft: 8,
                    fontSize: 14,
                    fontWeight: active ? '800' : '600',
                    color: active ? colors.chipActiveText : colors.text,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section title */}
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, paddingHorizontal: SIDE_PADDING, marginBottom: 10 }}>
          {activeKey === 'all' ? t('wardrobe.all') : typeLabel(activeKey)}
        </Text>
      </View>
    );
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Pattern PNG behind everything (tiles with repeat) */}
      <ImageBackground
        source={require('../assets/patterns/light-paper.png')}
        style={{ flex: 1 }}
        resizeMode="repeat"
      >
        <View style={{ flex: 1 }} {...pan.panHandlers}>
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
          ) : (
            <FlatList
              data={dataForActive}
              keyExtractor={(it) => String(it.id || it.image_url || it.imageUrl)}
              numColumns={COLS}
              ListHeaderComponent={<HeaderBlock />}
              ListFooterComponent={<View style={{ height: BOTTOM_NAV_HEIGHT + insets.bottom + 12 }} />}
              showsVerticalScrollIndicator={false}

              // Full-width content with consistent horizontal/vertical gaps
              contentContainerStyle={{ paddingBottom: 0 }}
              columnWrapperStyle={{ paddingHorizontal: SIDE_PADDING, columnGap: COL_GAP }}
              ItemSeparatorComponent={() => <View style={{ height: ROW_GAP }} />}

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
            />
          )}
        </View>

        <BottomNav navigation={navigation} active="wardrobe" />

        {/* Upload type picker */}
        <Modal
          visible={typeModalOpen}
          animationType="slide"
          transparent
          onDismiss={handleModalDismiss}
          onRequestClose={() => setTypeModalOpen(false)}
          onShow={() => {
            if (tutorial?.isRunning?.()) {
              setTimeout(() => {
                tutorial.setNext?.({
                  anchorId: 'wardrobe:typePicker',
                  textKey: 'tutorial.pickType',
                  screen: 'Wardrobe',
                  prefer: 'above',
                });
              }, 250);
            }
          }}
        >
          <Pressable
            onPress={() => setTypeModalOpen(false)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
          >
            <Pressable onPress={() => {}} style={{ width: '100%' }}>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  height: Math.round(SCREEN_H * 0.80),
                  paddingTop: 8,
                  paddingHorizontal: 16,
                  paddingBottom: insets?.bottom ?? 8,
                  borderTopWidth: 1,
                  borderColor: colors.hairline,
                }}
              >
                <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.hairline }} />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', flex: 1, color: colors.text }}>
                    {t('wardrobe.pickType')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setTypeModalOpen(false)}
                    hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
                    accessibilityLabel={t('common.close')}
                  >
                    <Text style={{ fontSize: 22, color: colors.textMuted }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  placeholder={t('wardrobe.searchTypesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={typeSearch}
                  onChangeText={setTypeSearch}
                  style={{
                    height: 40,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    backgroundColor: colors.surfaceAlt,
                    color: colors.text,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    marginBottom: 10,
                  }}
                />

                <View style={{ flex: 1 }}>
                  <CoachMark id="wardrobe:typePicker">
                    <FlatList
                      data={MASTER_TYPES.filter(tp => tp.includes(typeSearch.trim().toLowerCase()))}
                      keyExtractor={(tp) => tp}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          onPress={() => { setPendingType(item); setTypeModalOpen(false); }}
                          style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}
                        >
                          <TypeIcon type={item} color={colors.textMuted} />
                          <Text style={{ fontSize: 16, marginLeft: 10, color: colors.text }}>{typeLabel(item)}</Text>
                        </TouchableOpacity>
                      )}
                      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.hairline }} />}
                      contentContainerStyle={{ paddingBottom: 8 }}
                    />
                  </CoachMark>
                </View>

                <TouchableOpacity
                  onPress={() => setTypeModalOpen(false)}
                  activeOpacity={0.9}
                  style={{
                    height: 46, borderRadius: 12, backgroundColor: colors.primary,
                    alignItems: 'center', justifyContent: 'center', marginTop: 8,
                    shadowColor: colors.shadow, shadowOpacity: 0.18, shadowRadius: 10,
                    shadowOffset: { width: 0, height: 6 }, elevation: 4,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
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
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.hairline }}>
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8, color: colors.text }}>{t('wardrobe.searchByType')}</Text>
              <TextInput
                placeholder={t('wardrobe.searchExample')}
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                style={{
                  height: 42, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceAlt,
                  color: colors.text, borderRadius: 10, paddingHorizontal: 12, marginBottom: 12
                }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchModalOpen(false); }}>
                  <Text style={{ paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, color: colors.textMuted }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSearchModalOpen(false)}>
                  <Text style={{ paddingVertical: 8, paddingHorizontal: 12, color: colors.primary, fontWeight: '700' }}>{t('common.done')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ImageBackground>
    </SafeAreaView>
  );
}
