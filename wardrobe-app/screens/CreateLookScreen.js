import React, { useCallback, useState } from 'react';
import {
  SafeAreaView, View, Text, ScrollView, Image,
  TouchableOpacity, Button, Alert, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const api = axios.create({ baseURL: API_BASE_URL });

export default function CreateLookScreen() {
  const insets = useSafeAreaInsets();
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
      const res = await api.get('/wardrobe', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const all = res.data?.items || res.data || [];
      setBasePhotos(all.filter(it => (it.item_type || it.itemType) === 'profile'));
      const clothes = all.filter(it => (it.item_type || it.itemType) !== 'profile');
      const grouped = {};
      for (const item of clothes) {
        const t = (item.item_type || item.itemType || 'unknown').toLowerCase();
        (grouped[t] ||= []).push(item);
      }
      setClothesByType(grouped);
    } catch (e) {
      console.log('fetchWardrobe error:', e?.response?.data || e.message);
      Alert.alert('Error', 'Failed to load wardrobe');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchWardrobe(); }, [fetchWardrobe]));

  const addProfilePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission required', 'We need access to your gallery.');

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
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      const { image_url, url } = uploadRes.data || {};
      const imageUrl = image_url || url;

      await api.post(
        '/wardrobe',
        { image_url: imageUrl, item_type: 'profile' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await fetchWardrobe();
      setSelectedBase({ id: `temp-${Date.now()}`, url: imageUrl });
    } catch (e) {
      console.log('addProfilePhoto error:', e?.response?.data || e.message);
      Alert.alert('Upload failed', e?.response?.data?.message || e.message || 'Please try again.');
    }
  };

  const handlePick = (type, id) => {
    setPickedByType(prev => ({ ...prev, [type]: id }));
    setExpandedType(null); // close after pick
  };

  const isPicked = (type, id) => pickedByType[type] === id;

  const Section = ({ type, items }) => {
    const expanded = expandedType === type;
    const pickedId = pickedByType[type];
    const pickedItem = pickedId ? items.find(it => it.id === pickedId) : null;

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
        >
          <Text style={{
            color: expanded ? '#fff' : '#000',
            fontWeight: '600',
            fontSize: 16,
            textTransform: 'capitalize',
            flex: 1
          }}>
            {type} ({items.length})
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
            {items.map(item => {
              const uri = item.image_url || item.imageUrl || item.url;
              const picked = isPicked(type, item.id);
              return (
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
                >
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 20 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* Base photo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', flex: 1 }}>Choose your base photo</Text>
          <Button title="Add my photo" onPress={addProfilePhoto} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {basePhotos.length === 0 ? (
            <Text style={{ color: '#666' }}>No photos yet. Tap “Add my photo”.</Text>
          ) : (
            basePhotos.map((p) => {
              const uri = p.image_url || p.imageUrl || p.url;
              return (
                <TouchableOpacity key={p.id} onPress={() => setSelectedBase({ id: p.id, url: uri })} style={{ marginRight: 10 }}>
                  <Image
                    source={{ uri }}
                    style={{
                      width: 110,
                      height: 110,
                      borderRadius: 10,
                      borderWidth: selectedBase?.id === p.id ? 3 : 1,
                      borderColor: selectedBase?.id === p.id ? '#1976D2' : '#ddd'
                    }}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 10 }}>Pick clothes</Text>

        {/* Accordion sections */}
        {Object.keys(clothesByType).sort().map(type => (
          <Section key={type} type={type} items={clothesByType[type]} />
        ))}

        <View style={{ marginTop: 20 }}>
          <Button
            title="Generate look"
            onPress={() => {
              if (!selectedBase) return Alert.alert('Pick a base photo first.');
              const pickedIds = Object.values(pickedByType).filter(Boolean);
              if (pickedIds.length === 0) return Alert.alert('Pick at least one clothing item.');
              Alert.alert('Stub', `Selected ${pickedIds.length} item(s) from ${Object.keys(pickedByType).length} types.`);
            }}
            disabled={loading}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
