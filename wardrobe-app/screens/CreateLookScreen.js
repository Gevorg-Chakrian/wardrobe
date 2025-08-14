// screens/CreateLookScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SafeAreaView, View, Text, ScrollView, Image,
  TouchableOpacity, Alert, Platform, InteractionManager
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageProvider';
import { CoachMark, useTutorial } from '../tutorial/TutorialProvider';

const api = axios.create({ baseURL: API_BASE_URL });

export default function CreateLookScreen({ navigation }) {
  const tutorial = useTutorial();

  // guards/flags for tutorial timing
  const step5ShownRef = useRef(false);          // show "Add my photo" once
  const uploadJustHappenedRef = useRef(false);  // set right after upload
  const lastUploadedBaseUrlRef = useRef(null);  // to auto-select the newly uploaded base

  useFocusEffect(
    useCallback(() => {
      tutorial.onScreen('CreateLook');
      tutorial.startIfEnabled('CreateLook');
    }, [tutorial])
  );

  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const typeLabel = (key) => {
    const k = String(key).toLowerCase();
    const loc = t(`types.${k}`);
    return loc && loc !== `types.${k}` ? loc : k.charAt(0).toUpperCase() + k.slice(1);
  };

  const [basePhotos, setBasePhotos] = useState([]);
  const [clothesByType, setClothesByType] = useState({});
  const [selectedBase, setSelectedBase] = useState(null);
  const [pickedByType, setPickedByType] = useState({});
  const [expandedType, setExpandedType] = useState(null);
  const [loading, setLoading] = useState(false);

  const getToken = async () => SecureStore.getItemAsync('token');

  const fetchWardrobe = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await api.get('/wardrobe', { headers: { Authorization: `Bearer ${token}` } });
      const all = res.data?.items || res.data || [];

      const bases = all.filter(it => (it.item_type || it.itemType) === 'profile');
      const clothes = all.filter(it => (it.item_type || it.itemType) !== 'profile');

      setBasePhotos(bases);

      // Prefer auto-selecting the just-added base; otherwise keep current; otherwise first
      if (bases.length > 0) {
        if (lastUploadedBaseUrlRef.current) {
          const m = bases.find(b => (b.image_url || b.imageUrl || b.url) === lastUploadedBaseUrlRef.current);
          if (m) setSelectedBase({ id: m.id, url: m.image_url || m.imageUrl || m.url });
          lastUploadedBaseUrlRef.current = null;
        } else {
          setSelectedBase(prev => {
            if (prev && bases.some(b => b.id === prev.id)) return prev;
            const b0 = bases[0];
            return { id: b0.id, url: b0.image_url || b0.imageUrl || b0.url };
          });
        }
      }

      const grouped = {};
      for (const it of clothes) {
        const tpe = (it.item_type || it.itemType || 'unknown').toLowerCase();
        (grouped[tpe] ||= []).push(it);
      }
      setClothesByType(grouped);
    } catch {
      Alert.alert(t('common.error'), t('createLook.loadWardrobeError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { fetchWardrobe(); }, [fetchWardrobe]));

  /** STEP 5: show “Add my photo” bubble if there are no base photos yet */
  useEffect(() => {
    if (!tutorial?.isEnabled?.()) return;
    if (step5ShownRef.current) return;
    if (basePhotos.length > 0) return;

    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        tutorial.onScreen('CreateLook');
        tutorial.setNext?.({
          anchorId: 'create:addPhoto',
          textKey: 'tutorial.addMyPhoto',
          screen: 'CreateLook',
          prefer: 'below', // bubble under button, arrow up to it
        });
        step5ShownRef.current = true;
      }, 120);
    });
  }, [basePhotos.length, tutorial]);

  /**
   * After uploading a base photo and reloading data:
   *  - expand the first clothes type (so create:item anchor exists)
   *  - wait for layout to complete (interactions + 2×RAF)
   *  - queue steps 6–8 in order via queueFront
   */
  useEffect(() => {
    if (!uploadJustHappenedRef.current) return;
    if (basePhotos.length === 0) return;

    // Expand the first clothes section so the 'create:item' CoachMark exists/measures
    const typeKeys = Object.keys(clothesByType).sort();
    if (typeKeys.length > 0) setExpandedType(typeKeys[0]);

    const queueTrio = () => {
      tutorial.queueFront?.([
        { screen: 'CreateLook', anchorId: 'create:base',     textKey: 'tutorial.chooseBase', prefer: 'above' },
        { screen: 'CreateLook', anchorId: 'create:item',     textKey: 'tutorial.pickItem',   prefer: 'below' },
        { screen: 'CreateLook', anchorId: 'create:continue', textKey: 'tutorial.continue',   prefer: 'above' },
      ]);
      uploadJustHappenedRef.current = false;
    };

    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(queueTrio);
      });
    });
  }, [basePhotos.length, clothesByType, tutorial]);

  const addProfilePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert(t('createLook.permissionTitle'), t('createLook.permissionBody'));

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (picked.canceled) return;

      const asset = picked.assets[0];
      const uri  = Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', '');
      const name = asset.fileName || `photo_${Date.now()}.jpg`;
      const type = asset.mimeType || 'image/jpeg';

      const form = new FormData();
      form.append('image', { uri, name, type });
      form.append('item_type', 'profile');

      const token = await getToken();
      const uploadRes = await api.post('/upload', form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });

      const { image_url, url } = uploadRes.data || {};
      const imageUrl = image_url || url;

      await api.post('/wardrobe', { image_url: imageUrl, item_type: 'profile' },
        { headers: { Authorization: `Bearer ${token}` } });

      // mark that we just uploaded, remember URL for auto-select, then reload
      lastUploadedBaseUrlRef.current = imageUrl;
      uploadJustHappenedRef.current = true;
      await fetchWardrobe();
    } catch (e) {
      Alert.alert(t('common.uploadFailed'), e?.response?.data?.message || e.message || t('common.tryAgain'));
    }
  };

  const deleteBasePhoto = async (photoId) => {
    try {
      const token = await getToken();
      await api.delete(`/wardrobe/${photoId}`, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedBase(curr => (curr?.id === photoId ? null : curr));
      await fetchWardrobe();
    } catch (e) {
      Alert.alert(t('common.deleteFailed'), e?.response?.data?.message || e.message || t('common.tryAgain'));
    }
  };

  const handlePick = (type, id) => {
    setPickedByType(prev => ({ ...prev, [type]: id }));
    setExpandedType(null);
  };

  const isPicked = (type, id) => pickedByType[type] === id;

  const Section = ({ type, items }) => {
    const expanded = expandedType === type;
    const pickedId = pickedByType[type];
    const pickedItem = pickedId ? items.find(it => it.id === pickedId) : null;
    const title = typeLabel(type);

    return (
      <View style={{ marginBottom: 12 }}>
        <TouchableOpacity
          onPress={() => setExpandedType(expanded ? null : type)}
          style={{
            padding: 10,
            backgroundColor: expanded ? '#1976D2' : '#eee',
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center'
          }}
          activeOpacity={0.85}
        >
          <Text
            style={{
              color: expanded ? '#fff' : '#000',
              fontWeight: '600',
              fontSize: 16,
              textTransform: 'capitalize',
              flex: 1
            }}
          >
            {title} ({items.length})
          </Text>
          {pickedItem && !expanded && (
            <Image
              source={{ uri: pickedItem.image_url || pickedItem.imageUrl || pickedItem.url }}
              style={{ width: 40, height: 40, borderRadius: 6 }}
            />
          )}
        </TouchableOpacity>

        {expanded && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 }}>
            {items.map((item, idx) => {
              const uri = item.image_url || item.imageUrl || item.url;
              const picked = isPicked(type, item.id);

              const Tile = (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handlePick(type, item.id)}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 10,
                    overflow: 'hidden',
                    borderWidth: picked ? 3 : 0,
                    borderColor: '#1976D2',
                    backgroundColor: '#eee'
                  }}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                </TouchableOpacity>
              );

              // Wrap the first tile so the 'create:item' anchor is guaranteed
              return idx === 0 ? (
                <CoachMark id="create:item" key={item.id}>
                  {Tile}
                </CoachMark>
              ) : Tile;
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 20 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* Header + Add my photo (Step 5 anchor) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', flex: 1 }}>{t('createLook.chooseBase')}</Text>
          <CoachMark id="create:addPhoto">
            <TouchableOpacity
              onPress={addProfilePhoto}
              activeOpacity={0.9}
              style={{
                paddingHorizontal: 14,
                paddingVertical: Platform.OS === 'ios' ? 10 : 8,
                borderRadius: 8,
                backgroundColor: '#1976D2'
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {t('createLook.addMyPhoto')}
              </Text>
            </TouchableOpacity>
          </CoachMark>
        </View>

        {/* Base scroller (Step 6 anchor) */}
        <CoachMark id="create:base">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {basePhotos.length === 0 ? (
              <Text style={{ color: '#666' }}>{t('createLook.noPhotos')}</Text>
            ) : (
              basePhotos.map((p) => {
                const uri = p.image_url || p.imageUrl || p.url;
                const isSelected = selectedBase?.id === p.id;
                const confirmDelete = () => {
                  Alert.alert(
                    t('createLook.deleteBaseTitle'),
                    t('createLook.deleteBaseBody'),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('common.delete'), style: 'destructive', onPress: () => deleteBasePhoto(p.id) },
                    ]
                  );
                };
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedBase({ id: p.id, url: uri })}
                    onLongPress={confirmDelete}
                    delayLongPress={400}
                    style={{ marginRight: 10 }}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri }}
                      style={{
                        width: 110,
                        height: 110,
                        borderRadius: 10,
                        borderWidth: isSelected ? 3 : 1,
                        borderColor: isSelected ? '#1976D2' : '#ddd'
                      }}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </CoachMark>

        {/* Clothes header (kept for context; tutorial points to first item instead) */}
        <CoachMark id="create:type">
          <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 10 }}>{t('createLook.pickClothes')}</Text>
        </CoachMark>

        {Object.keys(clothesByType).sort().map(type => (
          <Section key={type} type={type} items={clothesByType[type]} />
        ))}

        {/* Continue (Step 8 anchor) */}
        <CoachMark id="create:continue">
          <View style={{ marginTop: 20 }}>
            <TouchableOpacity
              onPress={() => {
                if (!selectedBase) return Alert.alert(t('createLook.pickBaseFirst'));
                const pickedIds = Object.values(pickedByType).filter(Boolean);
                if (pickedIds.length === 0) return Alert.alert(t('createLook.pickAtLeastOne'));
                navigation.navigate('AddLookDetails', {
                  baseUrl: selectedBase.url,
                  itemIds: pickedIds,
                });
              }}
              activeOpacity={0.9}
              style={{
                height: 44,
                borderRadius: 10,
                backgroundColor: '#1976D2',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              disabled={loading}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                {t('common.continue')}
              </Text>
            </TouchableOpacity>
          </View>
        </CoachMark>
      </ScrollView>
    </SafeAreaView>
  );
}
