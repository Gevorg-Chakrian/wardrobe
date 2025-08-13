// screens/SettingsScreen.js
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../api/config';

const api = axios.create({ baseURL: API_BASE_URL });
const LANGS = ['en', 'ru', 'de', 'fr', 'es'];

const CHIP_HEIGHT = 36;

const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={{
      height: CHIP_HEIGHT,
      paddingHorizontal: 14,
      borderRadius: 18,
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: active ? '#1976D2' : '#e9e9ea',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Text style={{ color: active ? '#fff' : '#333', fontSize: 15 }}>{label}</Text>
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  const [language, setLanguage] = useState('en');
  const [tutorialOn, setTutorialOn] = useState(true);

  // change password
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  const getToken = async () => SecureStore.getItemAsync('token');

  const loadSettings = async () => {
    try {
      const token = await getToken();
      const res = await api.get('/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const s = res.data?.settings || res.data || {};
      if (s.language) setLanguage(s.language);
      if (typeof s.tutorial_enabled === 'boolean') setTutorialOn(s.tutorial_enabled);
    } catch (e) {
      console.log('loadSettings error', e?.response?.data || e.message);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const persistLanguage = async (lang) => {
    try {
      const token = await getToken();
      await api.put(
        '/settings/language',
        { language: lang },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      console.log('saveLanguage error', e?.response?.data || e.message);
      Alert.alert('Failed', e?.response?.data?.message || e.message || 'Please try again.');
      // revert UI if server failed
      await loadSettings();
    }
  };

  const onPickLanguage = (lang) => {
    const label = String(lang).toUpperCase();
    Alert.alert(
      'Change language',
      `Do you want to change the language to ${label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          style: 'destructive',
          onPress: () => { setLanguage(lang); persistLanguage(lang); },
        },
      ]
    );
  };

  const toggleTutorial = async (next) => {
    setTutorialOn(next); // optimistic
    try {
      const token = await getToken();
      await api.put(
        '/settings/tutorial',
        { enabled: next },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      setTutorialOn(!next); // revert
      console.log('toggleTutorial error', e?.response?.data || e.message);
      Alert.alert('Failed', e?.response?.data?.message || e.message || 'Please try again.');
    }
  };

  const changePassword = async () => {
    if (!newPass || !confirm) return Alert.alert('Missing', 'Enter new password and confirm it.');
    if (newPass.length < 6) return Alert.alert('Weak password', 'Use at least 6 characters.');
    if (newPass !== confirm) return Alert.alert('Mismatch', 'Passwords do not match.');
    try {
      setSavingPass(true);
      const token = await getToken();
      await api.put(
        '/settings/password',
        { newPassword: newPass },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewPass('');
      setConfirm('');
      Alert.alert('Updated', 'Password changed.');
    } catch (e) {
      console.log('changePassword error', e?.response?.data || e.message);
      Alert.alert('Failed', e?.response?.data?.message || e.message || 'Please try again.');
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 10 }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 12 }}>Settings</Text>

        {/* Language */}
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Language</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
          {LANGS.map(l => (
            <Chip
              key={l}
              label={l.toUpperCase()}
              active={language === l}
              onPress={() => onPickLanguage(l)}
            />
          ))}
        </View>

        {/* Tutorial */}
        <View style={{ height: 16 }} />
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Tutorial</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ marginRight: 10 }}>{tutorialOn ? 'On' : 'Off'}</Text>
          <Switch value={tutorialOn} onValueChange={toggleTutorial} />
        </View>

        {/* Change Password */}
        <View style={{ height: 20 }} />
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Change password</Text>
        <View style={{ marginBottom: 8 }}>
          <TextInput
            placeholder="New password"
            secureTextEntry
            value={newPass}
            onChangeText={setNewPass}
            style={{ height: 44, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12 }}
          />
        </View>
        <View style={{ marginBottom: 12 }}>
          <TextInput
            placeholder="Confirm password"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            style={{ height: 44, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12 }}
          />
        </View>
        <TouchableOpacity
          onPress={changePassword}
          disabled={savingPass}
          activeOpacity={0.85}
          style={{
            height: 44,
            borderRadius: 10,
            backgroundColor: savingPass ? '#9bbbe5' : '#1976D2',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {savingPass ? 'Saving…' : 'Update password'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
