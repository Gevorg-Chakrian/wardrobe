// screens/WardrobeScreen.js
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  SafeAreaView, StatusBar, View, Text, FlatList, Image, Alert, ActivityIndicator,
  Pressable, Platform, Modal, TouchableOpacity, TextInput,
  InteractionManager, Dimensions, PanResponder, ScrollView
} from 'react-native';
import { Animated } from 'react-native';
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
import { ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const api = axios.create({ baseURL: API_BASE_URL });

export const MASTER_TYPES = [
  'hat','scarf','tie',
  'polo','tshirt','shirt','blouse','top','longsleeve',
  'hoodie','sweater','cardigan',
  'jacket','coat','blazer','raincoat',
  'jeans','trousers','shorts','skirt',
  'dress',
  'sneakers','shoes','heels','sandals','boots',
  'bag'
];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SIDE_PADDING = 16;
const COLS = 2;
const COL_GAP = 14;
const ROW_GAP = 10;
const TILE_W = Math.round((SCREEN_W - SIDE_PADDING * 2 - COL_GAP) / COLS);
const SWIPE_DX = 40;
const SWIPE_VX = 0.35;

// Carousel layout constants (columns of chips)
const ROWS = 3;             // 3 rows per column
const COL_W = 128;          // fixed column width so columns align perfectly
const COL_SPACING = 10;     // horizontal gap between columns
const CHIP_VGAP = 6;        // vertical gap between chips inside a column

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

  const ACCENT = '#2DD4BF';
  const ACCENT_TEXT = '#FFFFFF';

  const typeLabel = (key) => {
    const k = String(key).toLowerCase();
    const val = t(`types.${k}`);
    return val && val !== `types.${k}` ? val : k.charAt(0).toUpperCase() + k.slice(1);
  };

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const afterInteractions = () => new Promise(r => InteractionManager.runAfterInteractions(r));
  const askTypeThenUpload = () => { setTypeSearch(''); setTypeModalOpen(true); };

  const doPickAndUpload = useCallback(async (chosenType) => {
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
  }, [getToken, isPicking, isUploading, navigation, t]);

  // iOS: run upload after modal dismiss
  const handleModalDismiss = useCallback(async () => {
    if (!pendingType) return;
    await afterInteractions();
    await new Promise(r => setTimeout(r, 250));
    try { await doPickAndUpload(pendingType); } finally { setPendingType(null); }
  }, [pendingType, doPickAndUpload]);

  /** Grid tile */
  const GridItem = ({ uri, onPress, onLongPress }) => (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.9}
      style={{
        width: TILE_W, height: TILE_W, borderRadius: 16, overflow: 'hidden',
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline,
        shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 }, elevation: 3, marginBottom: ROW_GAP,
      }}
    >
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
    </TouchableOpacity>
  );

  /** ───────────────────── CAROUSEL: columns with 3 stacked chips ───────────────────── */

  // Build columns (column-major): each column has up to 3 entries (top/middle/bottom)
  const columns = useMemo(() => {
    const perCol = Math.ceil(pages.length / ROWS);
    const cols = Array.from({ length: perCol }, (_, c) => {
      const col = [];
      for (let r = 0; r < ROWS; r++) {
        const idx = r * perCol + c;
        const tpe = pages[idx];
        col.push(tpe ? { tpe, index: idx } : null);
      }
      return col;
    });
    return cols;
  }, [pages]);

  // Map: type index -> column index
  const indexToColumn = useMemo(() => {
    const map = {};
    columns.forEach((col, c) => col.forEach(cell => { if (cell) map[cell.index] = c; }));
    return map;
  }, [columns]);

  // Zig-zag order for page swipes: for each column, top→middle→bottom
  const zigzagOrder = useMemo(() => {
    const arr = [];
    for (let c = 0; c < columns.length; c++) {
      for (let r = 0; r < ROWS; r++) {
        const cell = columns[c][r];
        if (cell) arr.push(cell.index);
      }
    }
    return arr;
  }, [columns]);

  // Carousel scroll + centering
  const carouselRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const lastCarouselXRef = useRef(0);           // <- remember last offset
  const contentWidthRef = useRef(0);

  // Keep last X in a ref
  useEffect(() => {
    const sub = scrollX.addListener(({ value }) => { lastCarouselXRef.current = value; });
    return () => scrollX.removeListener(sub);
  }, [scrollX]);

  // Helper: clamp
  const clamp = (v, a, b) => Math.max(a, Math.min(v, b));

  // Center selected column smoothly from current position (even after remount)
  const centerSelectedColumn = useCallback((idx, { animated = true } = {}) => {
    const c = indexToColumn[idx] ?? 0;
    const unit = COL_W + COL_SPACING;
    const colCenter = c * unit + COL_W / 2;
    const maxX = Math.max(0, contentWidthRef.current - SCREEN_W);
    const targetX = clamp(colCenter - SCREEN_W / 2, 0, maxX);

    // If ScrollView was remounted (offset reset to 0), first snap back to last known X, then animate a short delta
    const currentX = lastCarouselXRef.current;
    if (carouselRef.current) {
      // restore current position without animation (no visual jump)
      carouselRef.current.scrollTo({ x: currentX, animated: false });

      if (animated) {
        // small, natural movement to the target
        if (Math.abs(targetX - currentX) < 2) return; // nothing to do
        requestAnimationFrame(() => {
          carouselRef.current?.scrollTo({ x: targetX, animated: true });
        });
      } else {
        carouselRef.current.scrollTo({ x: targetX, animated: false });
      }
    }
  }, [indexToColumn]);

  // Re-center whenever active index changes
  useEffect(() => { centerSelectedColumn(activeIndex); }, [activeIndex, centerSelectedColumn]);

  // Also re-center as soon as we know the content width (important on first mount)
  const handleContentSizeChange = useCallback((w) => {
    contentWidthRef.current = w;
    // re-center to the currently active chip (no animation to avoid jumps)
    centerSelectedColumn(activeIndexRef.current, { animated: false });
  }, [centerSelectedColumn]);

  const Chip = ({ tpe, index, active }) => {
    const label = tpe === 'all' ? t('wardrobe.all') : typeLabel(tpe);
    return (
      <TouchableOpacity
        onPress={() => goToIndex(index)}
        activeOpacity={0.9}
        style={{
          width: '100%',
          marginBottom: CHIP_VGAP,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: active ? ACCENT : colors.chipBg,
          borderWidth: 1,
          borderColor: active ? ACCENT : colors.hairline,
        }}
      >
        <TypeIcon type={tpe} color={active ? ACCENT_TEXT : colors.textMuted} />
        <Text
          style={{
            marginLeft: 8,
            fontSize: 14,
            fontWeight: active ? '800' : '600',
            color: active ? ACCENT_TEXT : colors.text,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  /** Screen-level swipe to move between types in zig-zag order */
  const panEnabledRef = useRef(true);
  const pan = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => panEnabledRef.current && false,
    onMoveShouldSetPanResponder: (_e, g) => {
      if (!panEnabledRef.current) return false;
      const ax = Math.abs(g.dx), ay = Math.abs(g.dy);
      return ax > 12 && ax > ay * 1.2;
    },
    onPanResponderRelease: (_e, g) => {
      const curr = activeIndexRef.current;
      const pos = zigzagOrder.indexOf(curr);
      if (pos === -1) return;
      if (g.dx <= -SWIPE_DX || g.vx <= -SWIPE_VX) {
        const nextPos = Math.min(zigzagOrder.length - 1, pos + 1);
        goToIndex(zigzagOrder[nextPos]);
      } else if (g.dx >= SWIPE_DX || g.vx >= SWIPE_VX) {
        const prevPos = Math.max(0, pos - 1);
        goToIndex(zigzagOrder[prevPos]);
      }
    },
  }), [zigzagOrder, goToIndex]);

  // Android: modal may not call onDismiss reliably
  useEffect(() => {
    if (Platform.OS === 'android' && !typeModalOpen && pendingType) {
      (async () => {
        await afterInteractions();
        await new Promise(r => setTimeout(r, 150));
        try { await doPickAndUpload(pendingType); } finally { setPendingType(null); }
      })();
    }
  }, [typeModalOpen, pendingType, doPickAndUpload]);

  const topInset = (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 18;
  const activeKey = pages[activeIndex] || 'all';
  const dataForActive = activeKey === 'all' ? items : (grouped[activeKey] || []);

  /** ─────────────── Fancy Add Button component ─────────────── */
  const FancyAddButton = ({ label, onPress }) => {
    const WIDTH = Math.min(SCREEN_W - SIDE_PADDING * 2, 320);
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <LinearGradient
          colors={[ACCENT, '#34d399', '#06b6d4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: WIDTH,
            borderRadius: 28,
            padding: 5, // outline thickness
            shadowColor: colors.shadow,
            shadowOpacity: 0.28,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          }}
        >
          <View
            style={{
              borderRadius: 26,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              paddingHorizontal: 22,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: 0.3 }}>
              {label}
            </Text>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 2,
                left: 12,
                right: 12,
                height: 10,
                borderTopLeftRadius: 26,
                borderTopRightRadius: 26,
                backgroundColor: 'rgba(255,255,255,0.35)',
                opacity: 0.65,
              }}
            />
          </View>
        </LinearGradient>
      </Pressable>
    );
  };

  /** Header (Add button + carousel) */
  const HeaderBlock = React.memo(function HeaderBlockComponent() {
    return (
      <View style={{ paddingTop: topInset }}>
        {/* Add button */}
        <View style={{ paddingHorizontal: SIDE_PADDING, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <CoachMark id="wardrobe:addItem">
            <FancyAddButton label={t('wardrobe.addItem')} onPress={askTypeThenUpload} />
          </CoachMark>
          <View style={{ flex: 1 }} />
        </View>

        {/* Carousel */}
        <View
          style={{ paddingHorizontal: SIDE_PADDING, paddingBottom: 8 }}
          onTouchStart={() => { panEnabledRef.current = false; }}
          onTouchEnd={() => { panEnabledRef.current = true; }}
          onTouchCancel={() => { panEnabledRef.current = true; }}
        >
          <Animated.ScrollView
            ref={carouselRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingRight: 6 }}
            onContentSizeChange={handleContentSizeChange}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              {columns.map((col, cIdx) => (
                <View
                  key={`col-${cIdx}`}
                  style={{ width: COL_W, marginRight: COL_SPACING, alignItems: 'stretch' }}
                >
                  {col.map((cell, rIdx) =>
                    cell ? (
                      <Chip
                        key={`${cell.tpe}-${cell.index}`}
                        tpe={cell.tpe}
                        index={cell.index}
                        active={cell.index === activeIndex}
                      />
                    ) : (
                      <View key={`empty-${cIdx}-${rIdx}`} style={{ height: 0, marginBottom: CHIP_VGAP }} />
                    )
                  )}
                </View>
              ))}
            </View>
          </Animated.ScrollView>
        </View>

        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, paddingHorizontal: SIDE_PADDING, marginBottom: 10 }}>
          {pages[activeIndex] === 'all' ? t('wardrobe.all') : typeLabel(pages[activeIndex])}
        </Text>
      </View>
    );
  });

  /** Background pattern + main list */
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentH, setContentH] = useState(SCREEN_H);
  const bgTranslateY = Animated.multiply(scrollY, -1);
  const BG_BUFFER = 600;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
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

      <View style={{ flex: 1 }} {...pan.panHandlers}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
        ) : (
          <Animated.FlatList
            data={dataForActive}
            keyExtractor={(it) => String(it.id || it.image_url || it.imageUrl)}
            numColumns={COLS}
            ListHeaderComponent={<HeaderBlock />}
            ListFooterComponent={<View style={{ height: BOTTOM_NAV_HEIGHT + insets.bottom + 12 }} />}
            showsVerticalScrollIndicator={false}
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
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
            onContentSizeChange={(_w, h) => setContentH(prev => Math.max(prev, h))}
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
              tutorial.setNext?.({ anchorId: 'wardrobe:typePicker', textKey: 'tutorial.pickType', screen: 'Wardrobe', prefer: 'above' });
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
                  height: 40, borderWidth: 1, borderColor: colors.hairline,
                  backgroundColor: colors.surfaceAlt, color: colors.text,
                  borderRadius: 10, paddingHorizontal: 12, marginBottom: 10,
                }}
              />

              <View style={{ flex: 1 }}>
                <CoachMark id="wardrobe:typePicker">
                  <FlatList
                    data={useMemo(() => {
                      const q = typeSearch.trim().toLowerCase();
                      if (!q) return MASTER_TYPES;
                      return MASTER_TYPES.filter(tp => tp.includes(q));
                    }, [typeSearch])}
                    numColumns={2}
                    keyExtractor={(tp) => tp}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    columnWrapperStyle={{ justifyContent: 'center', paddingHorizontal: 0, columnGap: 5 }}
                    contentContainerStyle={{ paddingBottom: 12, rowGap: 5 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => { setPendingType(item); setTypeModalOpen(false); }}
                        activeOpacity={0.9}
                        style={{
                          width: SCREEN_W/2.35,
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: 16,
                          paddingHorizontal: 10,
                          borderRadius: 14,
                          backgroundColor: colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: colors.hairline,
                          shadowColor: colors.shadow,
                          shadowOpacity: 0.08,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 4 },
                          elevation: 2,
                        }}
                      >
                        <TypeIcon type={item} color={colors.text} size={34} />
                        <Text style={{ marginTop: 8, fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={2}>
                          {typeLabel(item)}
                        </Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={{ padding: 24, alignItems: 'center', opacity: 0.7 }}>
                        <Text style={{ color: colors.textMuted }}>
                          {t('common.noResults') || 'No matching types'}
                        </Text>
                      </View>
                    }
                  />
                </CoachMark>
              </View>

              <TouchableOpacity
                onPress={() => setTypeModalOpen(false)}
                activeOpacity={0.9}
                style={{
                  height: 46, borderRadius: 12, backgroundColor: ACCENT,
                  alignItems: 'center', justifyContent: 'center', marginTop: 8,
                  shadowColor: colors.shadow, shadowOpacity: 0.18, shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 }, elevation: 4,
                }}
              >
                <Text style={{ color: ACCENT_TEXT, fontSize: 16, fontWeight: '700' }}>
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
