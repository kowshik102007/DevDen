/**
 * utils/theme.js
 *
 * WHY THIS FILE EXISTS:
 * Single source of truth for colours, fonts, and spacing used across all screens.
 * Changing a colour here updates the entire app — no need to hunt through 10 files.
 *
 * DESIGN RATIONALE:
 * The palette uses warm saffron + deep teal — evoking the Indian flag and health
 * sector colours while remaining accessible on low-brightness budget-phone screens.
 * High-contrast risk colours (RED / AMBER / GREEN) follow WHO health card standards.
 */

export const COLORS = {
  primary:    '#0B5E6B',   // deep teal — nav bars, headers
  accent:     '#F5A623',   // saffron / warm amber — CTAs, icons
  background: '#F4F6F9',   // off-white — screen background
  card:       '#FFFFFF',   // white card background
  border:     '#E0E6ED',   // subtle border

  // Risk colours — WHO standard
  HIGH:       '#FF3B30',   // red
  MODERATE:   '#FF9500',   // orange
  LOW:        '#34C759',   // green

  // Text
  textPrimary:   '#1A2B3C',
  textSecondary: '#5A7184',
  textLight:     '#FFFFFF',

  // Misc
  shadow:     'rgba(0,0,0,0.08)',
};

export const FONTS = {
  heading:   { fontFamily: 'Poppins-Bold',     fontSize: 22, color: COLORS.textPrimary },
  subhead:   { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: COLORS.textPrimary },
  body:      { fontFamily: 'Poppins-Regular',  fontSize: 14, color: COLORS.textSecondary },
  label:     { fontFamily: 'Poppins-Medium',   fontSize: 12, color: COLORS.textSecondary },
  riskBig:   { fontFamily: 'Poppins-Bold',     fontSize: 28, color: COLORS.textLight },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 22,
  full: 999,
};
