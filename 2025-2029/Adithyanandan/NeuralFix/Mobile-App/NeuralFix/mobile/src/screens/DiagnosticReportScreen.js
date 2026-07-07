import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../utils/theme';
import { useSession } from '../utils/SessionContext';
import * as api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function DiagnosticReportScreen({ route, navigation }) {
  const { sessionId } = route.params;
  const { getSession, refreshSession } = useSession();
  const session = getSession(sessionId);
  const [report, setReport] = useState(session?.diagnostic_report || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (!report) generateReport(); }, []);

  const generateReport = async () => {
    setIsGenerating(true); setError(null);
    try {
      const r = await api.generateReport(sessionId);
      setReport(r.report);
      await refreshSession(sessionId);
    } catch (e) { setError(e.message); }
    finally { setIsGenerating(false); }
  };

  const handleShare = async () => {
    if (!report) return;
    try {
      await Share.share({ title: `NeuralFix Report — ${session?.title}`, message: `NEURALFIX DIAGNOSTIC REPORT\n${new Date().toLocaleString()}\n\n${report}` });
    } catch { Alert.alert('Error', 'Could not share report.'); }
  };

  const renderReport = () => {
    if (!report) return null;
    return report.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**'))
        return <View key={i} style={styles.sectionHead}><Text style={styles.sectionHeadText}>{line.replace(/\*\*/g, '')}</Text></View>;
      if (/^\d+\./.test(line))
        return <View key={i} style={styles.listRow}><Text style={styles.listNum}>{line.match(/^(\d+\.)/)[1]}</Text><Text style={styles.listText}>{line.replace(/^\d+\.\s*/, '')}</Text></View>;
      if (line.startsWith('- ') || line.startsWith('• '))
        return <View key={i} style={styles.bulletRow}><View style={styles.bullet} /><Text style={styles.bulletText}>{line.replace(/^[-•]\s*/, '')}</Text></View>;
      const lc = line.toLowerCase();
      if (lc.includes('priority') && (lc.includes('high') || lc.includes('critical') || lc.includes('medium') || lc.includes('low'))) {
        const hi = lc.includes('high') || lc.includes('critical');
        return <View key={i} style={[styles.priorityBadge, hi ? styles.priorityHigh : styles.priorityMed]}>
          <Ionicons name={hi ? 'warning' : 'alert-circle'} size={14} color={hi ? COLORS.error : COLORS.warning} />
          <Text style={[styles.priorityText, { color: hi ? COLORS.error : COLORS.warning }]}>{line}</Text>
        </View>;
      }
      if (line.trim() === '') return <View key={i} style={{ height: SPACING.sm }} />;
      return <Text key={i} style={styles.bodyText}>{line}</Text>;
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Diagnostic Report</Text>
          <Text style={styles.headerSub}>{new Date().toLocaleDateString()}</Text>
        </View>
        {report && <TouchableOpacity style={styles.shareBtn} onPress={handleShare}><Ionicons name="share-outline" size={20} color={COLORS.accent} /></TouchableOpacity>}
      </View>

      <View style={styles.sessionStrip}>
        <StatusBadge status="escalated" />
        <Text style={styles.sessionTitle} numberOfLines={1}>{session?.title || 'Tech Issue'}</Text>
        <Text style={styles.msgCount}>{session?.messages?.length || 0} messages</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isGenerating && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingTitle}>Generating Report</Text>
            <Text style={styles.loadingSub}>NeuralFix AI is compiling your diagnostic report...</Text>
          </View>
        )}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={24} color={COLORS.error} />
            <Text style={styles.errorTitle}>Failed to generate</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={generateReport}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
          </View>
        )}
        {report && !isGenerating && (
          <>
            <View style={styles.metaCard}>
              <View style={styles.metaRow}><Ionicons name="flash-outline" size={14} color={COLORS.textMuted} /><Text style={styles.metaText}>Generated by NeuralFix AI (Groq)</Text></View>
              <View style={styles.metaRow}><Ionicons name="time-outline" size={14} color={COLORS.textMuted} /><Text style={styles.metaText}>{new Date().toLocaleString()}</Text></View>
              <View style={styles.metaRow}><Ionicons name="chatbubbles-outline" size={14} color={COLORS.textMuted} /><Text style={styles.metaText}>{session?.messages?.length} messages analyzed</Text></View>
            </View>
            <View style={styles.reportCard}>{renderReport()}</View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={18} color={COLORS.textInverse} />
                <Text style={styles.primaryBtnText}>Share with IT Support</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={generateReport}>
                <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.secondaryBtnText}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg0 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn:      { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  headerSub:    { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  shareBtn:     { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: COLORS.accentMid, alignItems: 'center', justifyContent: 'center' },
  sessionStrip: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.base, paddingVertical: SPACING.xs, backgroundColor: COLORS.bg1, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sessionTitle: { flex: 1, fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  msgCount:     { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  content:      { padding: SPACING.base, gap: SPACING.base, paddingBottom: SPACING.xxl },
  loadingCard:  { backgroundColor: COLORS.bg1, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.xl, alignItems: 'center', gap: SPACING.base },
  loadingTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  loadingSub:   { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center' },
  errorCard:    { backgroundColor: '#1A0808', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.error + '44', padding: SPACING.lg, alignItems: 'center', gap: SPACING.sm },
  errorTitle:   { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.error },
  errorText:    { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center' },
  retryBtn:     { marginTop: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, backgroundColor: COLORS.bg2, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  retryText:    { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, fontWeight: FONTS.weights.semibold },
  metaCard:     { backgroundColor: COLORS.bg1, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  metaText:     { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  reportCard:   { backgroundColor: COLORS.bg1, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.base },
  sectionHead:      { marginTop: SPACING.base, marginBottom: SPACING.xs, borderLeftWidth: 2, borderLeftColor: COLORS.accent, paddingLeft: SPACING.sm },
  sectionHeadText:  { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold, color: COLORS.accent, letterSpacing: 1 },
  listRow:      { flexDirection: 'row', gap: SPACING.sm, marginVertical: 3 },
  listNum:      { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.accent, minWidth: 22 },
  listText:     { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, lineHeight: 20 },
  bulletRow:    { flexDirection: 'row', gap: SPACING.sm, marginVertical: 3, alignItems: 'flex-start' },
  bullet:       { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.textMuted, marginTop: 7, flexShrink: 0 },
  bulletText:   { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, lineHeight: 20 },
  priorityBadge:{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderRadius: RADIUS.sm, marginVertical: SPACING.xs },
  priorityHigh: { backgroundColor: '#EF444422', borderWidth: 1, borderColor: '#EF444444' },
  priorityMed:  { backgroundColor: '#F59E0B22', borderWidth: 1, borderColor: '#F59E0B44' },
  priorityText: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },
  bodyText:     { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20 },
  actions:      { gap: SPACING.sm, marginTop: SPACING.xs },
  primaryBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: SPACING.md },
  primaryBtnText:  { fontSize: FONTS.sizes.base, fontWeight: FONTS.weights.bold, color: COLORS.textInverse },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.bg2, borderRadius: RADIUS.md, paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  secondaryBtnText: { fontSize: FONTS.sizes.base, fontWeight: FONTS.weights.semibold, color: COLORS.textSecondary },
});
