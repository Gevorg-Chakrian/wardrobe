// api/ai.js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

const api = axios.create({ baseURL: API_BASE_URL });

// Bearer helper
async function auth() {
  const token = await SecureStore.getItemAsync('token');
  return { headers: { Authorization: `Bearer ${token}` } };
}

/**
 * extractSync — calls your backend’s extraction endpoint.
 * For now it hits /extract (your existing route).
 * If you later rename to /ai/extractSync, just change it here.
 */
export async function extractSync({ imageUrl, itemType }) {
  const cfg = await auth();
  const res = await api.post('/extract', { imageUrl, itemType }, cfg);
  return res.data; // expect { imageUrl, tags? }
}

/**
 * composeSync — stub for later (we’ll use this in AddLookDetailsScreen)
 * export async function composeSync({ baseUrl, itemIds }) {
 *   const cfg = await auth();
 *   const res = await api.post('/ai/composeSync', { baseUrl, itemIds }, cfg);
 *   return res.data; // { composedUrl }
 * }
 */
