// i18n/LanguageProvider.js
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';

// --- Translations (add keys as you go) ---
const dict = {
  en: {
    common: {
      ok: 'OK', cancel: 'Cancel', save: 'Save',
      yes: 'Yes', no: 'No',
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      tutorial: 'Tutorial',
      changeLangConfirm: (lang) => `Change app language to ${lang.toUpperCase()}?`,
      passwordTitle: 'Change password',
      newPassword: 'New password',
      confirmPassword: 'Confirm password',
      updatePassword: 'Update password',
    },
    buttons: {
      addItem: 'Add Item',
      createLook: 'CREATE LOOK',
      saveItem: 'Save item',
      saveChanges: 'Save changes',
    },
    wardrobe: { all: 'All' },
    profile: { latestLook: 'Latest look' },
    errors: {
      fail: 'Something went wrong',
    },
  },
  ru: {
    common: { ok: 'ОК', cancel: 'Отмена', save: 'Сохранить', yes: 'Да', no: 'Нет' },
    settings: {
      title: 'Настройки',
      language: 'Язык',
      tutorial: 'Обучение',
      changeLangConfirm: (lang) => `Поменять язык приложения на ${lang.toUpperCase()}?`,
      passwordTitle: 'Смена пароля',
      newPassword: 'Новый пароль',
      confirmPassword: 'Подтвердите пароль',
      updatePassword: 'Обновить пароль',
    },
    buttons: { addItem: 'Добавить', createLook: 'СОЗДАТЬ ОБРАЗ', saveItem: 'Сохранить', saveChanges: 'Сохранить изменения' },
    wardrobe: { all: 'Все' },
    profile: { latestLook: 'Последний образ' },
    errors: { fail: 'Что-то пошло не так' },
  },
  de: {
    common: { ok: 'OK', cancel: 'Abbrechen', save: 'Speichern', yes: 'Ja', no: 'Nein' },
    settings: {
      title: 'Einstellungen',
      language: 'Sprache',
      tutorial: 'Tutorial',
      changeLangConfirm: (lang) => `Sprache auf ${lang.toUpperCase()} ändern?`,
      passwordTitle: 'Passwort ändern',
      newPassword: 'Neues Passwort',
      confirmPassword: 'Passwort bestätigen',
      updatePassword: 'Passwort aktualisieren',
    },
    buttons: { addItem: 'Hinzufügen', createLook: 'LOOK ERSTELLEN', saveItem: 'Speichern', saveChanges: 'Änderungen speichern' },
    wardrobe: { all: 'Alle' },
    profile: { latestLook: 'Neuester Look' },
    errors: { fail: 'Etwas ist schief gelaufen' },
  },
  fr: {
    common: { ok: 'OK', cancel: 'Annuler', save: 'Enregistrer', yes: 'Oui', no: 'Non' },
    settings: {
      title: 'Paramètres',
      language: 'Langue',
      tutorial: 'Tutoriel',
      changeLangConfirm: (lang) => `Changer la langue en ${lang.toUpperCase()} ?`,
      passwordTitle: 'Changer le mot de passe',
      newPassword: 'Nouveau mot de passe',
      confirmPassword: 'Confirmer le mot de passe',
      updatePassword: 'Mettre à jour le mot de passe',
    },
    buttons: { addItem: 'Ajouter', createLook: 'CRÉER UN LOOK', saveItem: 'Enregistrer', saveChanges: 'Enregistrer les modifications' },
    wardrobe: { all: 'Tous' },
    profile: { latestLook: 'Dernier look' },
    errors: { fail: 'Une erreur est survenue' },
  },
  es: {
    common: { ok: 'OK', cancel: 'Cancelar', save: 'Guardar', yes: 'Sí', no: 'No' },
    settings: {
      title: 'Ajustes',
      language: 'Idioma',
      tutorial: 'Tutorial',
      changeLangConfirm: (lang) => `¿Cambiar idioma a ${lang.toUpperCase()}?`,
      passwordTitle: 'Cambiar contraseña',
      newPassword: 'Nueva contraseña',
      confirmPassword: 'Confirmar contraseña',
      updatePassword: 'Actualizar contraseña',
    },
    buttons: { addItem: 'Añadir', createLook: 'CREAR LOOK', saveItem: 'Guardar', saveChanges: 'Guardar cambios' },
    wardrobe: { all: 'Todo' },
    profile: { latestLook: 'Último look' },
    errors: { fail: 'Algo salió mal' },
  },
};

const DEFAULT_LANG = 'en';
const KEY = 'lang';

const LanguageContext = createContext({
  lang: DEFAULT_LANG,
  t: (path, ...args) => path,    // noop
  setLanguage: async (_lang, _opts) => {},
});

export const useLanguage = () => useContext(LanguageContext);

function resolve(dictObj, path) {
  const parts = path.split('.');
  let node = dictObj;
  for (const p of parts) node = node?.[p];
  return node;
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(DEFAULT_LANG);

  // send Accept-Language on every request
  useEffect(() => {
    axios.defaults.baseURL = API_BASE_URL;
    axios.defaults.headers.common['Accept-Language'] = lang;
  }, [lang]);

  // boot: SecureStore → backend (/settings) → default
  useEffect(() => {
    (async () => {
      const local = await SecureStore.getItemAsync(KEY);
      if (local && dict[local]) return setLang(local);

      // try backend
      try {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          const res = await axios.get('/settings', { headers: { Authorization: `Bearer ${token}` } });
          const serverLang = res.data?.settings?.language;
          if (serverLang && dict[serverLang]) {
            await SecureStore.setItemAsync(KEY, serverLang);
            return setLang(serverLang);
          }
        }
      } catch {}
      setLang(DEFAULT_LANG);
    })();
  }, []);

  const t = useMemo(() => {
    return (path, ...args) => {
      const entry = resolve(dict[lang] || dict[DEFAULT_LANG], path);
      if (typeof entry === 'function') return entry(...args);
      if (entry == null) return path;
      return entry;
    };
  }, [lang]);

  const setLanguage = async (nextLang, { persistRemote = false } = {}) => {
    if (!dict[nextLang]) return;
    setLang(nextLang);
    await SecureStore.setItemAsync(KEY, nextLang);

    if (persistRemote) {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          await axios.put('/settings/language', { language: nextLang }, { headers: { Authorization: `Bearer ${token}` } });
        }
      } catch { /* non-fatal */ }
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, t, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
