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
import { useLanguage } from '../i18n/LanguageProvider';
import { useTutorial } from '../tutorial/TutorialProvider';

const api = axios.create({ baseURL: API_BASE_URL });
const LANGS = ['en', 'ru', 'de', 'fr', 'es'];

const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={{
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 8 : 6,
      borderRadius: 18,
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: active ? '#1976D2' : '#e9e9ea',
    }}
  >
    <Text style={{ color: active ? '#fff' : '#333', fontSize: 15 }}>{label}</Text>
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { lang, t, setLanguage } = useLanguage();

  const tutorial = useTutorial();
  const [loading, setLoading] = useState(false);
  const [tutorialOn, setTutorialOn] = useState(true);

  // password
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  const getToken = async () => SecureStore.getItemAsync('token');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const res = await api.get('/settings', { headers: { Authorization: `Bearer ${token}` } });
        const s = res.data?.settings || res.data || {};
        if (typeof s.tutorial_enabled === 'boolean') setTutorialOn(s.tutorial_enabled);
        // language is controlled by provider (no need to set here)
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onChooseLang = (next) => {
    if (next === lang) return;
    Alert.alert(
      t('settings.language', 'Language'),
      t('settings.changeLangConfirm', `Change app language to ${next.toUpperCase()}?`, next),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.yes', 'Yes'),
          style: 'default',
          onPress: () => setLanguage(next, { persistRemote: true }),
        },
      ]
    );
  };

  const toggleTutorial = async (next) => {
    setTutorialOn(next); // optimistic
    tutorial?.setEnabled?.(next);
    try {
      const token = await getToken();
      await api.put('/settings/tutorial', { enabled: next }, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      setTutorialOn(!next); // revert
      tutorial?.setEnabled?.(!next);
      Alert.alert(t('common.error', 'Error'), t('common.tryAgain', 'Please try again.'));
    }
  };

  const changePassword = async () => {
    if (!newPass || !confirm) {
      return Alert.alert(t('common.error', 'Error'), t('settings.passwordMissing', 'Enter new password and confirm it.'));
    }
    if (newPass.length < 6) {
      return Alert.alert(
        t('settings.weakPassword', 'Weak password'),
        t('settings.weakPasswordBody', 'Use at least 6 characters.')
      );
    }
    if (newPass !== confirm) {
      return Alert.alert(
        t('settings.passwordMismatch', 'Mismatch'),
        t('settings.passwordMismatchBody', 'Passwords do not match.')
      );
    }

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
      Alert.alert(t('settings.updated', 'Updated'), t('settings.passwordChanged', 'Password changed.'));
    } catch {
      Alert.alert(t('common.error', 'Error'), t('common.tryAgain', 'Please try again.'));
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 10 }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 12 }}>
          {t('settings.title', 'Settings')}
        </Text>

        {/* Language */}
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
          {t('settings.language', 'Language')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {LANGS.map(l => (
            <Chip key={l} label={l.toUpperCase()} active={lang === l} onPress={() => onChooseLang(l)} />
          ))}
        </View>

        {/* Tutorial */}
        <View style={{ height: 16 }} />
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
          {t('settings.tutorial', 'Tutorial')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ marginRight: 10 }}>
            {tutorialOn ? t('common.on', 'On') : t('common.off', 'Off')}
          </Text>
          <Switch value={tutorialOn} onValueChange={toggleTutorial} />
        </View>

        {/* Change Password */}
        <View style={{ height: 20 }} />
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
          {t('settings.passwordTitle', 'Change password')}
        </Text>
        <View style={{ marginBottom: 8 }}>
          <TextInput
            placeholder={t('settings.newPassword', 'New password')}
            secureTextEntry
            value={newPass}
            onChangeText={setNewPass}
            style={{ height: 44, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12 }}
          />
        </View>
        <View style={{ marginBottom: 12 }}>
          <TextInput
            placeholder={t('settings.confirmPassword', 'Confirm password')}
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
            {t('settings.updatePassword', 'Update password')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
