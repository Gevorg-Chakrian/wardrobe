import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, Button, Alert, ActivityIndicator, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';

const api = axios.create({ baseURL: API_BASE_URL });

export default function WardrobeScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const getToken = async () => SecureStore.getItemAsync('token');

  const fetchWardrobe = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await api.get('/wardrobe', { headers: { Authorization: `Bearer ${token}` } });
      setItems(res.data?.items || res.data || []);
    } catch (e) {
      console.log('fetchWardrobe error:', e?.response?.data || e.message);
      Alert.alert('Error', 'Failed to load wardrobe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWardrobe(); }, [fetchWardrobe]);

  const pickAndUpload = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'We need access to your gallery.');
        return;
      }

      const mediaType = ImagePicker.MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images;
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: mediaType, quality: 0.9 });
      if (picked.canceled) return;

      const asset = picked.assets[0];
      const uri = Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', '');
      const name = asset.fileName || `photo_${Date.now()}.jpg`;
      const type = asset.mimeType || 'image/jpeg';

      const form = new FormData();
      form.append('image', { uri, name, type });
      form.append('item_type', 'tshirt');

      const token = await SecureStore.getItemAsync('token');

      const uploadRes = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        console.log('upload error:', uploadRes.status, data);
        throw new Error(data?.message || `Upload failed (${uploadRes.status})`);
      }

      const { image_url, item_type, url, type: detected } = data || {};
      const imageUrl = image_url || url;
      const finalType = item_type || detected || 'tshirt';

      // Save to wardrobe
      const saveToken = token || (await SecureStore.getItemAsync('token'));
      await api.post(
        '/wardrobe',
        { image_url: imageUrl, item_type: finalType },
        { headers: { Authorization: `Bearer ${saveToken}` } }
      );

      Alert.alert('Added!', 'Item was added to your wardrobe.');
      fetchWardrobe();
    } catch (e) {
      console.log('pickAndUpload error:', e?.response?.data || e.message);
      Alert.alert('Upload failed', e?.response?.data?.message || e.message || 'Please try again.');
    }
  };


  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Button title="Add item from gallery" onPress={pickAndUpload} />
      <FlatList
        style={{ marginTop: 16 }}
        data={items}
        keyExtractor={(it) => String(it.id || it.image_url)}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Image
              source={{ uri: item.image_url || item.url }}
              style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: '#eee', marginRight: 12 }}
            />
            <Text>{item.item_type || 'unknown'}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 24 }}>No items yet.</Text>}
      />
    </View>
  );
}
