// i18n/LanguageProvider.js
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import DICT from './dictionary'; // <-- use the external dictionary

const DEFAULT_LANG = 'en';
const KEY = 'lang';

const LanguageContext = createContext({
  lang: DEFAULT_LANG,
  t: (path, fallback) => fallback ?? path,
  setLanguage: async (_lang, _opts) => {},
});

export const useLanguage = () => useContext(LanguageContext);

// Safe getter "a.b.c" from nested object
function resolve(dictObj, path) {
  const parts = String(path).split('.');
  let node = dictObj;
  for (const p of parts) node = node?.[p];
  return node;
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(DEFAULT_LANG);

  // attach Accept-Language to axios
  useEffect(() => {
    axios.defaults.baseURL = API_BASE_URL;
    axios.defaults.headers.common['Accept-Language'] = lang;
  }, [lang]);

  // load initial language: SecureStore → backend → default
  useEffect(() => {
    (async () => {
      const local = await SecureStore.getItemAsync(KEY);
      if (local && DICT[local]) {
        setLang(local);
        return;
      }

      try {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          const res = await axios.get('/settings', { headers: { Authorization: `Bearer ${token}` } });
          const serverLang = res.data?.settings?.language;
          if (serverLang && DICT[serverLang]) {
            await SecureStore.setItemAsync(KEY, serverLang);
            setLang(serverLang);
            return;
          }
        }
      } catch {
        // non-fatal
      }
      setLang(DEFAULT_LANG);
    })();
  }, []);

  // translator
  const t = useMemo(() => {
    return (path, fallback) => {
      const entry = resolve(DICT[lang] || DICT[DEFAULT_LANG], path);
      if (typeof entry === 'function') {
        // call functions with no args by default (or pass additional args if you add them)
        try { return entry(); } catch { return fallback ?? path; }
      }
      if (entry == null) return fallback ?? path;
      return entry;
    };
  }, [lang]);

  // setter with optional backend persist
  const setLanguage = async (nextLang, { persistRemote = false } = {}) => {
    if (!DICT[nextLang]) return;
    setLang(nextLang);
    await SecureStore.setItemAsync(KEY, nextLang);
    if (persistRemote) {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          await axios.put('/settings/language', { language: nextLang }, { headers: { Authorization: `Bearer ${token}` } });
        }
      } catch { /* ignore */ }
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, t, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
