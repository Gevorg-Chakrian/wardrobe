// screens/RegisterScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import axios from 'axios';
import { AUTH_BASE_URL } from '../api/config';

const MIN_PASS_LEN = 6;
const hasLetter = (s) => /[A-Za-z]/.test(s);
const hasNumber = (s) => /[0-9]/.test(s);
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);

  const validate = () => {
    const u = username.trim();
    const e = email.trim();
    const p = password;

    if (!u || !e || !p || !confirm) {
      Alert.alert('Missing info', 'Please fill in all fields.');
      return false;
    }
    if (!isEmail(e)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return false;
    }
    if (p.length < MIN_PASS_LEN) {
      Alert.alert('Weak password', `Use at least ${MIN_PASS_LEN} characters.`);
      return false;
    }
    if (!(hasLetter(p) && hasNumber(p))) {
      Alert.alert('Weak password', 'Include at least one letter and one number.');
      return false;
    }
    if (p !== confirm) {
      Alert.alert('Mismatch', 'Password and confirmation do not match.');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      const res = await axios.post(`${AUTH_BASE_URL}/register`, {
        username: username.trim(),
        email: email.trim(),
        password,
      });
      console.log('Registered:', res.data.user);
      Alert.alert('Registration Successful');
      navigation.navigate('Login');
    } catch (err) {
      console.error(err);
      Alert.alert('Registration Failed', err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 6, letter & number)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="none"
      />

      <Button title={loading ? 'Registering…' : 'Register'} onPress={handleRegister} disabled={loading} />

      <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
        Already have an account? Login
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  link: { color: '#1976D2', marginTop: 12, textAlign: 'center' },
});
