// tutorial/TutorialProvider.js
import React, {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState
} from 'react';
import { View, Text, Modal, Pressable } from 'react-native';

const TutorialContext = createContext(null);
export const useTutorial = () => useContext(TutorialContext);

const DEFAULT_ENABLED = true;

export function TutorialProvider({ children }) {
  const [enabled, setEnabled] = useState(DEFAULT_ENABLED);

  // engine state
  const [running, setRunning] = useState(false);
  const [currentScreen, setCurrentScreen] = useState(null);
  const [currentStep, setCurrentStep] = useState(null); // { id, screen, anchorId, textKey, prefer? }

  const queueRef = useRef([]);           // steps queue
  const startedRef = useRef(false);      // idempotency guard

  // anchors registry
  const anchorsRef = useRef(new Map());  // id -> { x,y,width,height }
  const [anchorVersion, setAnchorVersion] = useState(0);

  // overlay UI (derived from currentStep + anchor)
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [overlayTarget, setOverlayTarget] = useState(null);
  const [overlayPrefer, setOverlayPrefer] = useState(null); // 'above' | 'below' | null

  /** Screens call this on focus */
  const onScreen = useCallback((screenName) => {
    setCurrentScreen(prev => (prev === screenName ? prev : screenName));
  }, []);

  /** Start tutorial once, if enabled */
  const startIfEnabled = useCallback(() => {
    if (!enabled || startedRef.current) return;

    const steps = [
      // Wardrobe
      { id: 'wardrobe:add',    screen: 'Wardrobe',       anchorId: 'wardrobe:addItem',  textKey: 'tutorial.choosePhoto' },

      // AddItemDetails – show bubble ABOVE colors row
      { id: 'additem:colors',  screen: 'AddItemDetails', anchorId: 'additem:colors',    textKey: 'tutorial.chooseTags', prefer: 'above' },

      // Profile -> Create look
      { id: 'profile:go',      screen: 'Profile',        anchorId: 'profile:create',    textKey: 'tutorial.gotoProfile' },

      // CreateLook flow
      { id: 'create:addPhoto', screen: 'CreateLook',     anchorId: 'create:addPhoto',   textKey: 'tutorial.addMyPhoto' },
      { id: 'create:base',     screen: 'CreateLook',     anchorId: 'create:base',       textKey: 'tutorial.chooseBase' },
      { id: 'create:type',     screen: 'CreateLook',     anchorId: 'create:type',       textKey: 'tutorial.pickType' },
      { id: 'create:continue', screen: 'CreateLook',     anchorId: 'create:continue',   textKey: 'tutorial.continue' },

      // If you wrap AddLookDetails "Save" button later:
      // { id: 'addlook:save', screen: 'AddLook', anchorId: 'addlook:save', textKey: 'tutorial.whenWhere' },
    ];

    queueRef.current = steps;
    startedRef.current = true;
    setRunning(true);

    // prime the first step
    const [head, ...rest] = steps;
    queueRef.current = rest;
    setCurrentStep(head);
  }, [enabled]);

  /** Jump to an ad‑hoc step (optional) */
  const setNext = useCallback(({ anchorId, textKey, screen, prefer }) => {
    setCurrentStep({
      id: `custom:${Date.now()}`,
      anchorId,
      textKey,
      screen: screen || currentScreen,
      prefer: prefer || null,
    });
  }, [currentScreen]);

  /** Anchors register their layout */
  const registerAnchor = useCallback((id, layout) => {
    const prev = anchorsRef.current.get(id);
    if (
      !prev ||
      prev.x !== layout.x || prev.y !== layout.y ||
      prev.width !== layout.width || prev.height !== layout.height
    ) {
      anchorsRef.current.set(id, layout);
      setAnchorVersion(v => v + 1);
    }
  }, []);

  /** Advance the queue */
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

  /** Finish and reset */
  const complete = useCallback(() => {
    queueRef.current = [];
    setCurrentStep(null);
    setOverlayVisible(false);
    setRunning(false);
    startedRef.current = false;
  }, []);

  /** Decide when to show the overlay */
  useEffect(() => {
    if (!running || !currentStep) { setOverlayVisible(false); return; }
    if (currentScreen !== currentStep.screen) { setOverlayVisible(false); return; }
    const anchor = anchorsRef.current.get(currentStep.anchorId);
    if (!anchor) { setOverlayVisible(false); return; }

    setOverlayTarget(anchor);
    setOverlayText(currentStep.textKey || '');
    setOverlayPrefer(currentStep.prefer || null); // respect per‑step placement hint
    setOverlayVisible(true);
  }, [running, currentStep, currentScreen, anchorVersion]);

  const value = useMemo(() => ({
    onScreen,
    startIfEnabled,
    setNext,
    next,
    complete,
    enabled,
    setEnabled,
    registerAnchor,
    isEnabled: () => enabled,
    isRunning: () => running,
  }), [onScreen, startIfEnabled, setNext, next, complete, enabled, registerAnchor, running]);

  return (
    <TutorialContext.Provider value={value}>
      {children}
      <CoachOverlay
        visible={overlayVisible}
        textKey={overlayText}
        target={overlayTarget}
        prefer={overlayPrefer}   // NEW: pass placement preference
        onNext={next}
        onClose={complete}
      />
    </TutorialContext.Provider>
  );
}

/** Overlay bubble with arrow; honors prefer='above' | 'below' */
function CoachOverlay({ visible, textKey, target, prefer, onNext, onClose }) {
  const { useLanguage } = require('../i18n/LanguageProvider');
  const { t } = useLanguage?.() || { t: (k, d) => d || k };
  if (!visible || !target) return null;

  const { width: W, height: H } = require('react-native').Dimensions.get('window');
  const BUBBLE_MAX_W = 280;
  const MARGIN = 10;
  const ARROW = 10;
  const guessH = 88; // conservative bubble height guess

  // Decide placement: respect prefer first, fallback to auto (below if space)
  const canPlaceBelow = target.y + target.height + MARGIN + guessH + MARGIN < H;
  const placeBelow =
    prefer === 'below' ? true  :
    prefer === 'above' ? false :
    canPlaceBelow;

  const bubbleTop = placeBelow
    ? target.y + target.height + MARGIN + ARROW
    : Math.max(MARGIN, target.y - guessH - MARGIN - ARROW);

  const bubbleLeft = Math.min(
    Math.max(MARGIN, target.x),
    W - BUBBLE_MAX_W - MARGIN
  );

  const arrowStyle = placeBelow
    ? {
        position: 'absolute',
        left: Math.min(
          Math.max(bubbleLeft + 16, target.x + target.width / 2 - ARROW),
          bubbleLeft + BUBBLE_MAX_W - 16
        ),
        top: target.y + target.height + MARGIN,
        width: 0, height: 0,
        borderLeftWidth: ARROW, borderRightWidth: ARROW, borderBottomWidth: ARROW,
        borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#111',
      }
    : {
        position: 'absolute',
        left: Math.min(
          Math.max(bubbleLeft + 16, target.x + target.width / 2 - ARROW),
          bubbleLeft + BUBBLE_MAX_W - 16
        ),
        top: bubbleTop + guessH + ARROW,
        width: 0, height: 0,
        borderLeftWidth: ARROW, borderRightWidth: ARROW, borderTopWidth: ARROW,
        borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#111',
      };

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

/** Wrap any clickable/visible target so we can measure it in window coords */
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
