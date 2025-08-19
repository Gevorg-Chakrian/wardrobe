//  LandingScreen.js
import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { markLandingSeen } from '../tutorial/sessionFlags';

// Minimal name resolver (same logic as ProfileScreen)
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function base64UrlToBase64(s) { const n = s.replace(/-/g, '+').replace(/_/g, '/'); const pad = n.length % 4 ? 4 - (n.length % 4) : 0; return n + '='.repeat(pad); }
function safeAtob(b64) {
  if (typeof globalThis.atob === 'function') return globalThis.atob(b64);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = String(b64).replace(/[^A-Za-z0-9+/=]/g, ''), out = '';
  for (let bc = 0, bs, buffer, idx = 0; (buffer = str.charAt(idx++)); ) {
    buffer = chars.indexOf(buffer);
    if (~buffer) { bs = bc % 4 ? bs * 64 + buffer : buffer; if (bc++ % 4) out += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))); }
  }
  return out;
}
async function resolveDisplayName() {
  const stored = await SecureStore.getItemAsync('username');
  if (stored) return stored;
  const token = await SecureStore.getItemAsync('token');
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(safeAtob(base64UrlToBase64(parts[1])));
        const email = payload?.email;
        if (email) {
          const beforeAt = String(email).split('@')[0];
          const pretty = beforeAt.split(/[._-]+/).filter(Boolean).map(capitalize).join(' ');
          return pretty || 'Welcome';
        }
      }
    } catch {}
  }
  return 'Welcome';
}

export default function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');

  useEffect(() => { (async () => setName(await resolveDisplayName()))(); }, []);

  const close = () => {
    markLandingSeen();            // open the one-time tutorial start window
    navigation.replace('Wardrobe');   // go to your main stack/tab (see navigator below)
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '800', marginBottom: 12 }}>
          {name ? `Welcome, ${name}!` : 'Welcome'}
        </Text>
        <Text style={{ fontSize: 16, color: '#444', lineHeight: 22, marginBottom: 24 }}>
          Thanks for installing the app. You’ll see this page once per launch.
          We’ll use it for update notes in the future. Tap continue to start.
        </Text>

        <TouchableOpacity
          onPress={close}
          activeOpacity={0.9}
          style={{ height: 48, borderRadius: 12, backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Continue</Text>
        </TouchableOpacity>

        {!name && <ActivityIndicator style={{ marginTop: 16 }} />}
      </View>
    </SafeAreaView>
  );
}
