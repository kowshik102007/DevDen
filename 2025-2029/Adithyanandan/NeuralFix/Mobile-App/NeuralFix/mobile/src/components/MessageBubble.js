import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../utils/theme';
import { API_BASE_URL } from '../utils/config';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const imageUri = message.image_path ? `${API_BASE_URL}${message.image_path}` : message.localImageUri || null;

  return (
    <View style={[styles.wrapper, isUser ? styles.userWrapper : styles.aiWrapper]}>
      {!isUser && <View style={styles.avatar}><Ionicons name="hardware-chip-outline" size={14} color={COLORS.accent} /></View>}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {imageUri && <Image source={{ uri: imageUri }} style={styles.img} resizeMode="cover" />}
        <FormattedText text={message.content} isUser={isUser} />
        <Text style={[styles.ts, isUser ? styles.tsUser : styles.tsAi]}>
          {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </Text>
      </View>
      {isUser && <View style={[styles.avatar, styles.userAvatar]}><Ionicons name="person" size={14} color={COLORS.textSecondary} /></View>}
    </View>
  );
}

function FormattedText({ text, isUser }) {
  if (!text) return null;
  const color = isUser ? COLORS.textInverse : COLORS.textPrimary;
  return (
    <View style={{ gap: 2 }}>
      {text.split('\n').map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**'))
          return <Text key={i} style={[styles.boldLine, { color: isUser ? COLORS.textInverse : COLORS.accent }]}>{line.replace(/\*\*/g, '')}</Text>;
        if (/^\d+\./.test(line))
          return (
            <View key={i} style={styles.stepRow}>
              <Text style={[styles.stepNum, { color: isUser ? COLORS.textInverse : COLORS.accent }]}>{line.match(/^(\d+\.)/)[1]}</Text>
              <Text style={[styles.body, { color, flex: 1 }]}>{line.replace(/^\d+\.\s*/, '')}</Text>
            </View>
          );
        if (line.trim() === '') return <View key={i} style={{ height: 4 }} />;
        return <Text key={i} style={[styles.body, { color }]}>{line}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { flexDirection: 'row', alignItems: 'flex-end', marginBottom: SPACING.sm, gap: SPACING.sm },
  userWrapper:{ justifyContent: 'flex-end' },
  aiWrapper:  { justifyContent: 'flex-start' },
  avatar:     { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: COLORS.accentMid, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userAvatar: { backgroundColor: COLORS.bg3, borderColor: COLORS.border },
  bubble:     { maxWidth: '78%', borderRadius: RADIUS.lg, padding: SPACING.md },
  userBubble: { backgroundColor: COLORS.accent, borderBottomRightRadius: RADIUS.sm },
  aiBubble:   { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.border, borderBottomLeftRadius: RADIUS.sm },
  img:        { width: '100%', height: 160, borderRadius: RADIUS.md, marginBottom: SPACING.sm, backgroundColor: COLORS.bg3 },
  boldLine:   { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: SPACING.xs },
  stepRow:    { flexDirection: 'row', gap: SPACING.xs, marginVertical: 2 },
  stepNum:    { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, minWidth: 20 },
  body:       { fontSize: FONTS.sizes.sm, lineHeight: 20 },
  ts:         { fontSize: 10, marginTop: SPACING.xs, alignSelf: 'flex-end' },
  tsUser:     { color: 'rgba(8,11,18,0.5)' },
  tsAi:       { color: COLORS.textMuted },
});
