// wardrobe-app/api/auth.js
import * as SecureStore from 'expo-secure-store';
import { AUTH_BASE_URL } from './config';

export async function register(username, email, password) {
  const r = await fetch(`${AUTH_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.message || 'Register failed');
  return data;
}

export async function login(email, password) {
  const r = await fetch(`${AUTH_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.message || 'Login failed');

  await SecureStore.setItemAsync('token', data.token);
  return data; // { token, user }
}
