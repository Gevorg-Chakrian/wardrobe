// LoginScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { AUTH_BASE_URL } from '../api/config';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${AUTH_BASE_URL}/login`, { email, password });

      // backend should return { token, user }
      const { token, user } = res.data || {};
      if (!token) {
        throw new Error('No token returned from server');
      }

      // Save token for later API calls (Wardrobe screen reads it)
      await SecureStore.setItemAsync('token', token);

      console.log('Logged in:', user);

      // Reset stack so user can’t go “back” to Login
      navigation.reset({
        index: 0,
        routes: [{ name: 'Wardrobe' }],
      });
    } catch (err) {
      console.error(err?.response?.data || err.message);
      Alert.alert('Login Failed', err?.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title="Login" onPress={handleLogin} />
      <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
        Don't have an account? Register
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: { borderBottomWidth: 1, marginBottom: 15, padding: 10 },
  link: { color: 'blue', marginTop: 10, textAlign: 'center' },
});

export default LoginScreen;
