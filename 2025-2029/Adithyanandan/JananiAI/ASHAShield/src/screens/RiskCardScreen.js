/**
 * screens/RiskCardScreen.js
 *
 * WHY THIS SCREEN EXISTS:
 * This is the MOST IMPORTANT screen in the entire app.
 * The design brief says: "colour-coded risk cards (Green/Yellow/Red), voice
 * readout in regional language, no English required."
 *
 * What this screen shows:
 *  1. A full-screen colour card: RED / AMBER / GREEN based on risk level
 *  2. Large Hindi label: KHATRA / SAVDHAN / SURAKSHIT
 *  3. Hindi/English reason strings (plain-language SHAP output)
 *  4. A "🔊 Suniye" (Listen) button that reads the risk message aloud via TTS
 *  5. Emergency quick-dial buttons: 108, PHC, ANM Supervisor
 *  6. Buttons to view the trend graph or go back to the patient list
 *
 * This screen is the "answer" the ASHA worker needs after measuring vitals.
 * It must work with zero literacy barrier.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Linking, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import { getLatestVisit, getEmergencyContacts, getPatientById } from '../db/database';
import { getRiskColor, getRiskLabel } from '../ml/riskModel';
import { speak, stopSpeech } from '../utils/tts';
import { COLORS, SPACING, RADIUS, FONTS } from '../utils/theme';

export default function RiskCardScreen({ route, navigation }) {
  // Navigation params — either passed fresh from VisitLoggingScreen, or by
  // tapping an alert card on the Dashboard (only patientId is passed then)
  const { patientId, riskResult: passedResult, patientName, district } = route.params || {};

  const [patient,    setPatient]    = useState(null);
  const [visit,      setVisit]      = useState(null);
  const [riskResult, setRiskResult] = useState(passedResult || null);
  const [contacts,   setContacts]   = useState([]);
  const [speaking,   setSpeaking]   = useState(false);

  useEffect(() => {
    loadData();
    // Stop TTS if user navigates away
    return () => stopSpeech();
  }, [patientId]);

  const loadData = async () => {
    if (!patientId) return;
    const p = await getPatientById(patientId);
    setPatient(p);

    // If riskResult wasn't passed (navigated from alert card), load last visit
    if (!passedResult) {
      const v = await getLatestVisit(patientId);
      setVisit(v);
      if (v) {
        // Reconstruct a minimal riskResult from stored data so the screen renders
        setRiskResult({
          riskLevel: v.risk_level || 'LOW',
          score: 0,
          reasons: v.risk_reason
            ? v.risk_reason.split(' | ').map(en => ({ en, hi: en }))
            : [],
          voiceHindi:   v.risk_reason || '',
          voiceEnglish: v.risk_reason || '',
        });
      }
    }

    // Load emergency contacts for this patient's district
    const dist = p?.district || district || 'Barmer';
    const c = await getEmergencyContacts(dist);
    setContacts(c);
  };

  if (!riskResult) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading risk card…</Text>
      </View>
    );
  }

  const { riskLevel, reasons = [], voiceHindi } = riskResult;
  const bgColor    = getRiskColor(riskLevel);
  const riskLabel  = getRiskLabel(riskLevel);
  const isHighRisk = riskLevel === 'HIGH';

  // ── VOICE READOUT ─────────────────────────────────────────────────────────
  // Read the Hindi risk message aloud via TTS
  const handleSpeak = async () => {
    if (speaking) {
      stopSpeech();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const msg = voiceHindi || reasons.map(r => r.hi).join('. ');
    await speak(msg, 'hi-IN');
    setSpeaking(false);
  };

  // ── EMERGENCY CALL ────────────────────────────────────────────────────────
  // Opens the native phone dialler with the given number
  const handleCall = (phone, label) => {
    Alert.alert(
      `Call ${label}?`,
      `This will dial ${phone}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          style: 'destructive',
          onPress: () => Linking.openURL(`tel:${phone}`),
          // Linking.openURL with tel: opens the system phone app
        },
      ]
    );
  };

  // ── ICON for emergency contact type ──────────────────────────────────────
  const contactIcon = (type) => {
    if (type === 'ambulance') return 'ambulance';
    if (type === 'phc')       return 'hospital-building';
    if (type === 'anm')       return 'account-nurse';
    return 'phone';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={bgColor} />

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── TOP CLOSE BUTTON ─────────────────────────────────────────────── */}
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={() => { stopSpeech(); navigation.goBack(); }}
            style={styles.closeBtn}
          >
            <Icon name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {/* Trend graph shortcut */}
          <TouchableOpacity
            onPress={() => navigation.navigate('TrendGraph', { patientId })}
            style={styles.trendBtn}
          >
            <Icon name="chart-line" size={18} color="#fff" />
            <Text style={styles.trendText}>Trend</Text>
          </TouchableOpacity>
        </View>

        {/* ── BIG RISK CARD ─────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[bgColor, bgColor + 'CC']}  // solid → 80% opacity gradient
          style={styles.riskCard}
        >
          {/* Animated pulse ring for HIGH risk — draws attention */}
          {isHighRisk && (
            <Animatable.View
              animation="pulse"
              easing="ease-in-out"
              iterationCount="infinite"
              style={styles.pulseRing}
            />
          )}

          {/* Risk icon */}
          <Animatable.View animation="bounceIn" duration={800}>
            <Icon
              name={isHighRisk ? 'alert-decagram' : riskLevel === 'MODERATE' ? 'alert' : 'check-circle'}
              size={72}
              color="#fff"
            />
          </Animatable.View>

          {/* Main Hindi risk label */}
          <Animatable.Text animation="fadeInUp" delay={200} style={styles.riskLabel}>
            {riskLabel}
          </Animatable.Text>

          {/* Patient name */}
          <Text style={styles.patientName}>
            {patient?.name || patientName || 'Patient'}
          </Text>

          {/* Date */}
          <Text style={styles.visitDate}>
            Visit: {visit?.visit_date || new Date().toISOString().split('T')[0]}
          </Text>

          {/* ── VOICE BUTTON ──────────────────────────────────────────────── */}
          {/* Large tappable button — even a low-literacy worker can identify the speaker icon */}
          <TouchableOpacity
            style={styles.speakBtn}
            onPress={handleSpeak}
            activeOpacity={0.85}
          >
            <Icon name={speaking ? 'stop-circle' : 'volume-high'} size={26} color={bgColor} />
            <Text style={[styles.speakText, { color: bgColor }]}>
              {speaking ? 'Rokein' : '🔊 Suniye (Listen)'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ── REASONS LIST ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Why this risk level?</Text>
        {reasons.length === 0 ? (
          <View style={styles.reasonCard}>
            <Text style={styles.reasonText}>No specific risk factors detected. Continue routine care.</Text>
          </View>
        ) : (
          reasons.map((r, i) => (
            <Animatable.View
              key={i}
              animation="slideInRight"
              delay={i * 150}
              style={styles.reasonCard}
            >
              {/* Numbered bullet */}
              <View style={[styles.reasonNum, { backgroundColor: bgColor }]}>
                <Text style={styles.reasonNumText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                {/* Hindi reason */}
                <Text style={styles.reasonHindi}>{r.hi}</Text>
                {/* English sub-text */}
                <Text style={styles.reasonEn}>{r.en}</Text>
              </View>
            </Animatable.View>
          ))
        )}

        {/* ── EMERGENCY CONTACTS ──────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>📞 Emergency Contacts</Text>
        <View style={styles.contactsGrid}>
          {contacts.map((c, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.contactCard,
                c.type === 'ambulance' && styles.ambulanceCard, // 108 gets special styling
              ]}
              onPress={() => handleCall(c.phone, c.label)}
              activeOpacity={0.85}
            >
              <Icon
                name={contactIcon(c.type)}
                size={28}
                color={c.type === 'ambulance' ? '#fff' : COLORS.primary}
              />
              <Text style={[
                styles.contactLabel,
                c.type === 'ambulance' && styles.ambulanceLabel,
              ]}>
                {c.label}
              </Text>
              <Text style={[
                styles.contactPhone,
                c.type === 'ambulance' && styles.ambulancePhone,
              ]}>
                {c.phone}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── VITALS SUMMARY ──────────────────────────────────────────────── */}
        {visit && (
          <>
            <Text style={styles.sectionTitle}>📋 Today's Vitals</Text>
            <View style={styles.vitalsCard}>
              <VitalRow label="BP"   value={`${visit.systolic_bp || '--'}/${visit.diastolic_bp || '--'} mmHg`} />
              <VitalRow label="Hb"   value={`${visit.hb_gdl || '--'} g/dL`} />
              <VitalRow label="FHR"  value={`${visit.fetal_hr || '--'} bpm`} />
              <VitalRow label="Protein" value={visit.urine_protein || 'nil'} />
              <VitalRow label="Wt"   value={`${visit.weight_kg || '--'} kg`} />
            </View>
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// Small two-column row inside the vitals summary card
function VitalRow({ label, value }) {
  return (
    <View style={styles.vitalRow}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <Text style={styles.vitalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  loading:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:    { ...FONTS.body },
  scroll:         { paddingBottom: 40 },
  topRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, paddingTop: 48, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  closeBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' },
  trendBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 7 },
  trendText:      { color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 4 },
  riskCard:       { minHeight: 320, justifyContent: 'center', alignItems: 'center', paddingTop: 90, paddingBottom: SPACING.xl, paddingHorizontal: SPACING.md },
  pulseRing:      { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  riskLabel:      { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', marginTop: SPACING.sm, letterSpacing: 0.5 },
  patientName:    { fontSize: 18, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginTop: 8 },
  visitDate:      { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  speakBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: RADIUS.full, paddingHorizontal: 20, paddingVertical: 12, marginTop: SPACING.md, elevation: 2 },
  speakText:      { fontSize: 15, fontWeight: '700', marginLeft: 8 },
  sectionTitle:   { ...FONTS.subhead, marginTop: SPACING.lg, marginHorizontal: SPACING.md, marginBottom: SPACING.sm },
  reasonCard:     { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.card, borderRadius: RADIUS.md, marginHorizontal: SPACING.md, marginBottom: SPACING.sm, padding: SPACING.md, elevation: 2 },
  reasonNum:      { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm, marginTop: 2 },
  reasonNumText:  { color: '#fff', fontWeight: '800', fontSize: 13 },
  reasonHindi:    { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  reasonEn:       { fontSize: 12, color: COLORS.textSecondary },
  contactsGrid:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md },
  contactCard:    { width: '47%', margin: '1.5%', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', elevation: 2 },
  ambulanceCard:  { backgroundColor: COLORS.HIGH },
  contactLabel:   { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center', marginTop: 6 },
  contactPhone:   { fontSize: 16, fontWeight: '900', color: COLORS.primary, marginTop: 2 },
  ambulanceLabel: { color: '#fff' },
  ambulancePhone: { color: '#fff' },
  vitalsCard:     { backgroundColor: COLORS.card, borderRadius: RADIUS.md, marginHorizontal: SPACING.md, padding: SPACING.md, elevation: 2 },
  vitalRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  vitalLabel:     { ...FONTS.label, fontWeight: '700' },
  vitalValue:     { ...FONTS.body, fontWeight: '600', color: COLORS.textPrimary },
});
