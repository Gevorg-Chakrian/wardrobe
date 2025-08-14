// screens/CreateLookScreen.js
import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Button,
  Alert,
  Platform
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
    const localized = t(`types.${k}`);
    if (localized && localized !== `types.${k}`) return localized;
    return k.charAt(0).toUpperCase() + k.slice(1);
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
      setBasePhotos(all.filter(it => (it.item_type || it.itemType) === 'profile'));
      const clothes = all.filter(it => (it.item_type || it.itemType) !== 'profile');
      const grouped = {};
      for (const item of clothes) {
        const tpe = (item.item_type || item.itemType || 'unknown').toLowerCase();
        (grouped[tpe] ||= []).push(item);
      }
      setClothesByType(grouped);
    } catch (e) {
      Alert.alert(t('common.error'), t('createLook.loadWardrobeError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { fetchWardrobe(); }, [fetchWardrobe]));

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

      await fetchWardrobe();
      setSelectedBase({ id: `temp-${Date.now()}`, url: imageUrl });

      if (typeof tutorial?.next === 'function') {
        tutorial.next('create:addPhoto');
      }
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
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', flex: 1 }}>{t('createLook.chooseBase')}</Text>
          <CoachMark id="create:addPhoto">
            <Button title={t('createLook.addMyPhoto')} onPress={addProfilePhoto} />
          </CoachMark>
        </View>

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

        <CoachMark id="create:type">
          <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 10 }}>{t('createLook.pickClothes')}</Text>
        </CoachMark>

        {Object.keys(clothesByType).sort().map(type => (
          <Section key={type} type={type} items={clothesByType[type]} />
        ))}

        <CoachMark id="create:continue">
          <View style={{ marginTop: 20 }}>
            <Button
              title={t('common.continue')}
              onPress={() => {
                if (!selectedBase) return Alert.alert(t('createLook.pickBaseFirst'));
                const pickedIds = Object.values(pickedByType).filter(Boolean);
                if (pickedIds.length === 0) return Alert.alert(t('createLook.pickAtLeastOne'));
                navigation.navigate('AddLookDetails', {
                  baseUrl: selectedBase.url,
                  itemIds: pickedIds,
                });
              }}
              disabled={loading}
            />
          </View>
        </CoachMark>
      </ScrollView>
    </SafeAreaView>
  );
}
