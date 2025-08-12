// screens/MyPhotosScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, FlatList, Image, Button, Alert,
  TouchableOpacity, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';

const api = axios.create({ baseURL: API_BASE_URL });

export default function MyPhotosScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const getToken = async () => SecureStore.getItemAsync('token');

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await api.get('/wardrobe', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const all = res.data?.items || res.data || [];
      setItems(all.filter(it => (it.item_type || it.itemType) === 'profile'));
    } catch (e) {
      console.log('fetchProfiles error:', e?.response?.data || e.message);
      Alert.alert('Error', 'Failed to load your photos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

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
      const uri = Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', '');
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

      Alert.alert('Added!', 'Photo saved.');
      fetchProfiles();
    } catch (e) {
      console.log('addProfilePhoto error:', e?.response?.data || e.message);
      Alert.alert('Upload failed', e?.response?.data?.message || e.message || 'Please try again.');
    }
  };

  const renderItem = ({ item }) => {
    const img = item.image_url || item.imageUrl || item.url;
    return (
      <View style={{ width: '48%', marginBottom: 10 }}>
        <Image source={{ uri: img }} style={{ width: '100%', height: 160, borderRadius: 10, backgroundColor: '#eee' }} />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', padding: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>My Photos</Text>
        <Button title="Add my photo" onPress={addProfilePhoto} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id || it.image_url || it.imageUrl)}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 24 }}>No photos yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}
