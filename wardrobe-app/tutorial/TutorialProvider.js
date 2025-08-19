// tutorial/TutorialProvider.js
import React, {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState
} from 'react';
import { View, Text, Modal, Pressable, Dimensions } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';
import { canAutoStartTutorial, consumeTutorialStartWindow } from '../tutorial/sessionFlags';

const TutorialContext = createContext(null);
export const useTutorial = () => useContext(TutorialContext);

// Default only until we hydrate from server
const DEFAULT_ENABLED = true;

export function TutorialProvider({ children }) {
  const [enabled, setEnabledState] = useState(DEFAULT_ENABLED);
  const [hydrated, setHydrated] = useState(false); // block seeding until true

  // engine state
  const [running, setRunning] = useState(false);
  const [currentScreen, setCurrentScreen] = useState(null);
  const [currentStep, setCurrentStep] = useState(null); // {id,screen,anchorId,textKey,prefer}
  const queueRef = useRef([]);     // remaining steps
  const startedRef = useRef(false);

  // anchors
  const anchorsRef = useRef(new Map()); // id -> {x,y,width,height}
  const [anchorVersion, setAnchorVersion] = useState(0);

  // overlay state
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [overlayTarget, setOverlayTarget] = useState(null);
  const [overlayPrefer, setOverlayPrefer] = useState(null);

  /** ---------- hydrate "enabled" from server once ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) { if (!cancelled) setHydrated(true); return; }
        const api = axios.create({ baseURL: API_BASE_URL });
        const res = await api.get('/settings', { headers: { Authorization: `Bearer ${token}` } });
        const s = res.data?.settings || res.data || {};
        const serverEnabled = typeof s.tutorial_enabled === 'boolean' ? s.tutorial_enabled : DEFAULT_ENABLED;
        if (!cancelled) { setEnabledState(!!serverEnabled); setHydrated(true); }
      } catch {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** ---------- default flow (seeded on first start) ---------- */
  const DEFAULT_FLOW = useRef([
    { id: 'wardrobe:add',    screen: 'Wardrobe',       anchorId: 'wardrobe:addItem',    textKey: 'tutorial.choosePhoto',  prefer: 'below' },
    { id: 'wardrobe:type',   screen: 'Wardrobe',       anchorId: 'wardrobe:typePicker', textKey: 'tutorial.pickType',     prefer: 'above' },
    { id: 'additem:colors',  screen: 'AddItemDetails', anchorId: 'additem:colors',      textKey: 'tutorial.chooseTags',   prefer: 'above' },
    { id: 'wardrobe:profile', screen: 'Wardrobe',    anchorId: 'nav:profile',        textKey: 'tutorial.gotoProfile',  prefer: 'above' },
    { id: 'profile:create',  screen: 'Profile',        anchorId: 'profile:createLook',  textKey: 'tutorial.createLook',   prefer: 'below' },
    { id: 'create:addPhoto', screen: 'CreateLook',     anchorId: 'create:addPhoto',     textKey: 'tutorial.addMyPhoto',   prefer: 'below' },
  ]);

  /** ---------- core helpers ---------- */
  const applyEnabled = useCallback((val) => {
    const on = !!val;
    setEnabledState(on);
    if (!on) {
      // Full stop; do NOT reseed until next Landing‑gated start
      queueRef.current = [];
      setCurrentStep(null);
      setOverlayVisible(false);
      setRunning(false);
      startedRef.current = false;
    }
  }, []);

  const ensureRunning = useCallback(() => {
    if (!enabled) return false;
    if (!running) setRunning(true);
    return true;
  }, [enabled, running]);

  const onScreen = useCallback((screenName) => {
    setCurrentScreen(prev => (prev === screenName ? prev : screenName));
  }, []);

  /** Start once and seed the default flow ONLY after Landing closes this launch */
  const startIfEnabled = useCallback(() => {
    if (!hydrated) return;
    // If we're still inside the one-time window but tutorial is OFF,
    // consume the window so it cannot auto-start later in this launch.
    if (!enabled) {
      if (canAutoStartTutorial()) consumeTutorialStartWindow();
      return;
    }
    if (!canAutoStartTutorial()) return; // not in the allowed window
    consumeTutorialStartWindow();

    if (!startedRef.current) {
      startedRef.current = true;
      const flow = DEFAULT_FLOW.current.slice();
      if (flow.length) {
        const [head, ...rest] = flow;
        queueRef.current = rest;
        setCurrentStep(head);
        setRunning(true);
        return;
      }
    }
    setRunning(true);
  }, [enabled, hydrated]);

  /** Show a specific step immediately (only while running) */
  const setNext = useCallback(({ anchorId, textKey, screen, prefer }) => {
    if (!ensureRunning()) return;
    setCurrentStep({
      id: `custom:${Date.now()}`,
      anchorId,
      textKey,
      screen: screen || currentScreen,
      prefer: prefer || null,
    });
  }, [currentScreen, ensureRunning]);

  /** Queue steps to the front (only while running) */
  const queueFront = useCallback((steps) => {
    if (!steps || steps.length === 0) return;
    if (!ensureRunning()) return;

    const payload = steps.map((s, i) => ({
      id: s.id || `q:${Date.now()}-${i}`,
      screen: s.screen || currentScreen,
      anchorId: s.anchorId,
      textKey: s.textKey,
      prefer: s.prefer || null,
    }));

    if (!currentStep) {
      const [head, ...rest] = payload;
      queueRef.current = rest.concat(queueRef.current);
      setCurrentStep(head);
    } else {
      queueRef.current = payload.concat(queueRef.current);
    }
  }, [currentScreen, ensureRunning, currentStep]);

  /** Anchors register their position */
  const registerAnchor = useCallback((id, layout) => {
    const prev = anchorsRef.current.get(id);
    if (!prev ||
        prev.x !== layout.x || prev.y !== layout.y ||
        prev.width !== layout.width || prev.height !== layout.height) {
      anchorsRef.current.set(id, layout);
      setAnchorVersion(v => v + 1);
    }
  }, []);

  /** Advance to the next queued step (or stop) */
  const next = useCallback(() => {
    setCurrentStep(null);
    const q = queueRef.current;
    if (!q || q.length === 0) {
      setOverlayVisible(false);
      setRunning(false);
      return;
    }
    const [head, ...rest] = q;
    queueRef.current = rest;
    setCurrentStep(head);
  }, []);

  /** Finish everything */
  const complete = useCallback(() => {
    queueRef.current = [];
    setCurrentStep(null);
    setOverlayVisible(false);
    setRunning(false);
  }, []);

  /** Drive overlay only when anchor is measured & screen matches */
  useEffect(() => {
    if (!running || !currentStep) { setOverlayVisible(false); return; }
    if (currentScreen !== currentStep.screen) { setOverlayVisible(false); return; }
    const anchor = anchorsRef.current.get(currentStep.anchorId);
    if (!anchor) { setOverlayVisible(false); return; }

    setOverlayTarget(anchor);
    setOverlayText(currentStep.textKey || '');
    setOverlayPrefer(currentStep.prefer || null);
    setOverlayVisible(true);
  }, [running, currentStep, currentScreen, anchorVersion]);

  const value = useMemo(() => ({
    onScreen,
    startIfEnabled,
    setNext,
    queueFront,
    next,
    complete,
    enabled,
    setEnabled: applyEnabled,
    registerAnchor,
    isEnabled: () => enabled,
    isRunning: () => running,
    isHydrated: () => hydrated,
  }), [onScreen, startIfEnabled, setNext, queueFront, next, complete, enabled, registerAnchor, running, applyEnabled, hydrated]);

  return (
    <TutorialContext.Provider value={value}>
      {children}
      <CoachOverlay
        visible={overlayVisible}
        textKey={overlayText}
        target={overlayTarget}
        prefer={overlayPrefer}
        onNext={next}
        onClose={complete}
      />
    </TutorialContext.Provider>
  );
}

/** ---------- Overlay UI (arrow + smart placement) ---------- */
function CoachOverlay({ visible, textKey, target, prefer, onNext, onClose }) {
  const { useLanguage } = require('../i18n/LanguageProvider');
  const { t } = useLanguage?.() || { t: (k, d) => d || k };
  if (!visible || !target) return null;

  const { width: W, height: H } = Dimensions.get('window');
  const BUBBLE_MAX_W = 280;
  const MARGIN = 10;
  const ARROW = 10;
  const guessH = 72;
  const guessW = 200;

  let bubbleTop, bubbleLeft, arrowStyle;

  if (prefer === 'right' || prefer === 'left') {
    bubbleTop = Math.max(MARGIN, Math.min(target.y, H - guessH - MARGIN));
    if (prefer === 'right') {
      bubbleLeft = Math.min(target.x + target.width + MARGIN + ARROW, W - BUBBLE_MAX_W - MARGIN);
      arrowStyle = {
        position: 'absolute',
        top: Math.max(bubbleTop + 16, Math.min(target.y + target.height / 2 - ARROW, bubbleTop + guessH - 16)),
        left: Math.min(target.x + target.width + MARGIN, W - MARGIN - ARROW * 2),
        width: 0, height: 0,
        borderTopWidth: ARROW, borderBottomWidth: ARROW, borderLeftWidth: ARROW,
        borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#111',
      };
    } else {
      bubbleLeft = Math.max(MARGIN, target.x - (MARGIN + ARROW + guessW));
      arrowStyle = {
        position: 'absolute',
        top: Math.max(bubbleTop + 16, Math.min(target.y + target.height / 2 - ARROW, bubbleTop + guessH - 16)),
        left: Math.max(target.x - MARGIN - ARROW, MARGIN),
        width: 0, height: 0,
        borderTopWidth: ARROW, borderBottomWidth: ARROW, borderRightWidth: ARROW,
        borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: '#111',
      };
    }
  } else {
    const placeBelow =
      prefer === 'below' ? true :
      prefer === 'above' ? false :
      (target.y + target.height + MARGIN + guessH + MARGIN < H);

    bubbleTop = placeBelow
      ? target.y + target.height + MARGIN + ARROW
      : Math.max(MARGIN, target.y - guessH - MARGIN - ARROW);

    bubbleLeft = Math.min(Math.max(MARGIN, target.x), W - BUBBLE_MAX_W - MARGIN);

    arrowStyle = placeBelow
      ? {
          position: 'absolute',
          left: Math.min(Math.max(bubbleLeft + 16, target.x + target.width / 2 - ARROW), bubbleLeft + BUBBLE_MAX_W - 16),
          top: target.y + target.height + MARGIN,
          width: 0, height: 0,
          borderLeftWidth: ARROW, borderRightWidth: ARROW, borderBottomWidth: ARROW,
          borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#111',
        }
      : {
          position: 'absolute',
          left: Math.min(Math.max(bubbleLeft + 16, target.x + target.width / 2 - ARROW), bubbleLeft + BUBBLE_MAX_W - 16),
          top: bubbleTop + guessH + ARROW,
          width: 0, height: 0,
          borderLeftWidth: ARROW, borderRightWidth: ARROW, borderTopWidth: ARROW,
          borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#111',
        };
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onNext} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <View style={arrowStyle} pointerEvents="none" />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: bubbleLeft,
            top: bubbleTop,
            padding: 12,
            backgroundColor: '#111',
            borderRadius: 10,
            maxWidth: BUBBLE_MAX_W,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15 }}>
            {t(textKey, textKey || '')}
          </Text>
          <Text style={{ color: '#bbb', marginTop: 6, fontSize: 13 }}>
            {t('tutorial.tapAnywhere', 'Tap anywhere to continue')}
          </Text>
        </View>
      </Pressable>
    </Modal>
  );
}

export function CoachMark({ id, children }) {
  const { registerAnchor } = useTutorial() || {};
  const ref = React.useRef(null);

  const onLayout = useCallback(() => {
    requestAnimationFrame(() => {
      if (!ref.current || !registerAnchor) return;
      ref.current.measureInWindow((x, y, width, height) => {
        if (width && height) registerAnchor(id, { x, y, width, height });
      });
    });
  }, [id, registerAnchor]);

  return (
    <View ref={ref} onLayout={onLayout}>
      {children}
    </View>
  );
}
