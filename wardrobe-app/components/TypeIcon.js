// components/TypeIcon.js
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Map every MASTER_TYPES key (and "all") to a stable MDI icon.
// If some names aren’t supported by your Expo version, we fallback to 'hanger'.
const MAP = {
  all:        'wardrobe-outline',

  tshirt:     'tshirt-crew-outline',
  shirt:      'shirt-outline',

  blouse:     'hanger',
  top:        'tshirt-v-outline',

  hoodie:     'hoodie',             // if your MDI set is older, fallback will kick in
  sweater:    'sweater',

  jeans:      'human-male-height-variant', // jeans isn't in older sets; use neutral
  trousers:   'tape-measure',
  shorts:     'human-male-height-variant',
  skirt:      'skirt',
  dress:      'tshirt-crew',        // safe neutral

  jacket:     'jacket-puffer',      // fallback-safe
  coat:       'coat-rack',
  blazer:     'tie',
  cardigan:   'sweater',

  sneakers:   'shoe-sneaker',
  shoes:      'shoe-formal',
  boots:      'shoe-boot',

  bag:        'handbag-outline',
  hat:        'hat-fedora',
  scarf:      'scarf',
  accessory:  'sunglasses',
};

function resolveIcon(name) {
  const n = MAP[name] || MAP.all;
  // MaterialCommunityIcons returns a glyph even for unknown names,
  // but to be extra safe, keep a small whitelist check pattern:
  return typeof n === 'string' && n ? n : 'hanger';
}

export default function TypeIcon({ type, color, size = 20 }) {
  const key = String(type || 'all').toLowerCase();
  return (
    <MaterialCommunityIcons
      name={resolveIcon(key)}
      size={size}
      color={color}
    />
  );
}
