import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../utils/theme';

const CFG = {
  active:    { label: 'IN PROGRESS', color: COLORS.accent,  bg: COLORS.accentDim },
  resolved:  { label: 'RESOLVED',    color: COLORS.online,  bg: '#22C55E18' },
  escalated: { label: 'ESCALATED',   color: COLORS.error,   bg: '#EF444418' },
};

export default function StatusBadge({ status = 'active' }) {
  const c = CFG[status] || CFG.active;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.color + '44' }]}>
      <View style={[styles.dot, { backgroundColor: c.color }]} />
      <Text style={[styles.label, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1, gap: 4 },
  dot:   { width: 5, height: 5, borderRadius: 3 },
  label: { fontSize: 9, fontWeight: FONTS.weights.bold, letterSpacing: 0.8 },
});
