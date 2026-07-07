/**
 * screens/VisitLoggingScreen.js
 *
 * WHY THIS SCREEN EXISTS:
 * This is the most-used screen in the app. Every time an ASHA worker visits a
 * pregnant woman's home, she opens this screen and enters the vitals she just
 * measured. After entering them, she taps "Compute Risk" and the ML model
 * (computeRisk from riskModel.js) instantly shows a risk score. If she is
 * happy with it, she taps "Save & View Risk Card" to store the visit.
 *
 * Vitals collected (match the ML model's input features):
 *  - Blood pressure (systolic / diastolic)
 *  - Weight, fundal height
 *  - Foetal heart rate
 *  - Haemoglobin
 *  - Urine protein (dipstick)
 *  - MUAC
 *  - Gestational age (auto-computed or manually overridden)
 *
 * Flow:
 *   Enter vitals → computeRisk() → preview risk → insertVisit() → RiskCardScreen
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import { getPatientById, insertVisit } from '../db/database';
import { computeRisk, getRiskColor, getRiskLabel } from '../ml/riskModel';
import { COLORS, SPACING, RADIUS, FONTS } from '../utils/theme';

// Urine protein dipstick options
const PROTEIN_OPTIONS = ['nil', 'trace', '1+', '2+', '3+'];

export default function VisitLoggingScreen({ route, navigation }) {
  // patientId and patientName come from the navigation params set by PatientListScreen
  const { patientId, patientName } = route.params || {};

  const [patient, setPatient] = useState(null);

  // ── VITALS FORM STATE ──────────────────────────────────────────────────────
  const [systolicBp,   setSystolicBp]   = useState('');
  const [diastolicBp,  setDiastolicBp]  = useState('');
  const [weight,       setWeight]       = useState('');
  const [fundalHt,     setFundalHt]     = useState('');
  const [fetalHr,      setFetalHr]      = useState('');
  const [hb,           setHb]           = useState('');
  const [urineProtein, setUrineProtein] = useState('nil');
  const [muac,         setMuac]         = useState('');
  const [notes,        setNotes]        = useState('');
  const [visitDate,    setVisitDate]    = useState(
    new Date().toISOString().split('T')[0] // default to today
  );

  // Computed/preview risk result (set after tapping "Compute Risk")
  const [riskResult, setRiskResult] = useState(null);
  const [saving,     setSaving]     = useState(false);

  // Load the patient's record on mount so we can show her name + EDD
  useEffect(() => {
    if (patientId) getPatientById(patientId).then(setPatient);
  }, [patientId]);

  // Compute gestational age in weeks from patient's LMP and today's date
  const getGestationalAge = () => {
    if (!patient?.lmp) return null;
    const lmp   = new Date(patient.lmp);
    const today = new Date();
    const days  = Math.floor((today - lmp) / (1000 * 60 * 60 * 24));
    return Math.floor(days / 7); // convert days → weeks
  };

  // ── COMPUTE RISK ───────────────────────────────────────────────────────────
  // Called when ASHA taps the "Compute Risk" button.
  // Reads all form values, passes to the ML model, shows a preview card.
  const handleComputeRisk = () => {
    const ga = getGestationalAge();

    // Build the features object that the ML model expects
    const features = {
      systolic_bp:    systolicBp   ? parseInt(systolicBp)   : null,
      diastolic_bp:   diastolicBp  ? parseInt(diastolicBp)  : null,
      hb_gdl:         hb           ? parseFloat(hb)         : null,
      urine_protein:  urineProtein,
      fetal_hr:       fetalHr      ? parseInt(fetalHr)      : null,
      gestational_age:ga,
      weight_kg:      weight       ? parseFloat(weight)     : null,
      muac_cm:        muac         ? parseFloat(muac)       : null,
      age:            patient?.age,
      gravida:        patient?.gravida,
      prev_csection:  patient?.prev_csection === 1,
      prev_pph:       patient?.prev_pph === 1,
      prev_stillbirth:patient?.prev_stillbirth === 1,
      inter_preg_gap: patient?.inter_preg_gap,
    };

    const result = computeRisk(features); // pure JS — runs instantly offline
    setRiskResult(result);
  };

  // ── SAVE VISIT ─────────────────────────────────────────────────────────────
  // Called after the ASHA reviews the risk preview and taps "Save & View Risk Card"
  const handleSave = async () => {
    if (!riskResult) {
      Alert.alert('Compute Risk First', 'Please tap "Compute Risk" before saving.');
      return;
    }

    setSaving(true);
    try {
      // Build the reason string from top-3 reasons (English)
      const reasonStr = riskResult.reasons.map(r => r.en).join(' | ');

      const visitId = await insertVisit({
        patient_id:     patientId,
        visit_date:     visitDate,
        gestational_age:getGestationalAge(),
        systolic_bp:    systolicBp   ? parseInt(systolicBp)   : null,
        diastolic_bp:   diastolicBp  ? parseInt(diastolicBp)  : null,
        weight_kg:      weight       ? parseFloat(weight)     : null,
        fundal_height:  fundalHt     ? parseFloat(fundalHt)   : null,
        fetal_hr:       fetalHr      ? parseInt(fetalHr)      : null,
        hb_gdl:         hb           ? parseFloat(hb)         : null,
        urine_protein:  urineProtein,
        muac_cm:        muac         ? parseFloat(muac)       : null,
        notes:          notes,
        risk_level:     riskResult.riskLevel,
        risk_reason:    reasonStr,
      });

      // Navigate to the risk card, passing all the info we just computed
      navigation.replace('RiskCard', {
        patientId,
        visitId,
        riskResult,
        patientName: patient?.name,
        district:    patient?.district,
      });
    } catch (e) {
      Alert.alert('Error', 'Could not save visit. Please try again.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── URINE PROTEIN SELECTOR ─────────────────────────────────────────────────
  // A row of tappable pills instead of a text input — faster, fewer errors
  const ProteinSelector = () => (
    <View style={styles.proteinRow}>
      {PROTEIN_OPTIONS.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[
            styles.proteinPill,
            urineProtein === opt && styles.proteinPillActive, // highlight selected
          ]}
          onPress={() => setUrineProtein(opt)}
        >
          <Text style={[
            styles.proteinPillText,
            urineProtein === opt && styles.proteinPillTextActive,
          ]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* ── TOP BAR ──────────────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>Log Visit</Text>
          <Text style={styles.topSub}>{patientName || 'Patient'}</Text>
        </View>
        {/* Show gestational age if computable */}
        {getGestationalAge() != null && (
          <View style={styles.gaBadge}>
            <Text style={styles.gaText}>GA {getGestationalAge()}w</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">

        {/* ── VISIT DATE ───────────────────────────────────────────────────── */}
        <View style={styles.field}>
          <Text style={styles.label}>Visit Date</Text>
          <TextInput
            style={styles.input}
            value={visitDate}
            onChangeText={setVisitDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>

        {/* ── BLOOD PRESSURE ───────────────────────────────────────────────── */}
        <Text style={styles.groupLabel}>🩺 Blood Pressure (mmHg)</Text>
        <View style={styles.row2}>
          <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Systolic</Text>
            <TextInput
              style={styles.input}
              value={systolicBp}
              onChangeText={setSystolicBp}
              placeholder="e.g. 120"
              keyboardType="numeric"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Diastolic</Text>
            <TextInput
              style={styles.input}
              value={diastolicBp}
              onChangeText={setDiastolicBp}
              placeholder="e.g. 80"
              keyboardType="numeric"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
        </View>

        {/* ── HAEMOGLOBIN ──────────────────────────────────────────────────── */}
        <Text style={styles.groupLabel}>🩸 Haemoglobin & Nutrition</Text>
        <View style={styles.row2}>
          <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Hb (g/dL)</Text>
            <TextInput
              style={styles.input}
              value={hb}
              onChangeText={setHb}
              placeholder="e.g. 10.5"
              keyboardType="decimal-pad"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>MUAC (cm)</Text>
            <TextInput
              style={styles.input}
              value={muac}
              onChangeText={setMuac}
              placeholder="e.g. 24"
              keyboardType="decimal-pad"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
        </View>

        {/* ── FOETAL ───────────────────────────────────────────────────────── */}
        <Text style={styles.groupLabel}>👶 Foetal & Growth</Text>
        <View style={styles.row2}>
          <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Foetal HR (bpm)</Text>
            <TextInput
              style={styles.input}
              value={fetalHr}
              onChangeText={setFetalHr}
              placeholder="e.g. 140"
              keyboardType="numeric"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Fundal Ht (cm)</Text>
            <TextInput
              style={styles.input}
              value={fundalHt}
              onChangeText={setFundalHt}
              placeholder="e.g. 28"
              keyboardType="decimal-pad"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
        </View>

        <View style={[styles.field, { marginRight: 8 }]}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="e.g. 52.5"
            keyboardType="decimal-pad"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>

        {/* ── URINE PROTEIN ─────────────────────────────────────────────────── */}
        <Text style={styles.groupLabel}>💧 Urine Protein (Dipstick)</Text>
        <ProteinSelector />

        {/* ── NOTES ─────────────────────────────────────────────────────────── */}
        <Text style={styles.groupLabel}>📝 Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any observations…"
          placeholderTextColor={COLORS.textSecondary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* ── COMPUTE RISK BUTTON ──────────────────────────────────────────── */}
        <TouchableOpacity style={styles.computeBtn} onPress={handleComputeRisk} activeOpacity={0.85}>
          <Icon name="brain" size={22} color="#fff" />
          <Text style={styles.computeText}>Compute Risk</Text>
        </TouchableOpacity>

        {/* ── RISK PREVIEW CARD ────────────────────────────────────────────── */}
        {riskResult && (
          <Animatable.View animation="bounceIn" duration={600}>
            <View style={[styles.riskPreview, { backgroundColor: getRiskColor(riskResult.riskLevel) }]}>
              <Text style={styles.riskPreviewLabel}>{getRiskLabel(riskResult.riskLevel)}</Text>
              <Text style={styles.riskPreviewScore}>Risk Score: {riskResult.score}</Text>
              {riskResult.reasons.slice(0, 2).map((r, i) => (
                <Text key={i} style={styles.riskPreviewReason}>
                  ⚠ {r.en}
                </Text>
              ))}
            </View>

            {/* Save button — only shown after computing risk */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Icon name="content-save" size={22} color="#fff" />
              <Text style={styles.saveText}>
                {saving ? 'Saving…' : 'Save & View Risk Card'}
              </Text>
            </TouchableOpacity>
          </Animatable.View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  topBar:       { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', paddingTop: 48, paddingBottom: 14, paddingHorizontal: SPACING.md },
  backBtn:      { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topTitle:     { color: '#fff', fontSize: 17, fontWeight: '700' },
  topSub:       { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  gaBadge:      { backgroundColor: COLORS.accent, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  gaText:       { color: '#fff', fontSize: 12, fontWeight: '700' },
  form:         { padding: SPACING.md },
  groupLabel:   { ...FONTS.subhead, marginTop: SPACING.md, marginBottom: SPACING.xs, fontSize: 14 },
  field:        { marginBottom: SPACING.sm },
  label:        { ...FONTS.label, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
  input:        { backgroundColor: COLORS.card, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, height: 46, color: COLORS.textPrimary, fontSize: 14 },
  notesInput:   { height: 80 },
  row2:         { flexDirection: 'row' },
  proteinRow:   { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.md },
  proteinPill:  { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, marginBottom: 8, backgroundColor: COLORS.card },
  proteinPillActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  proteinPillText:       { fontSize: 13, color: COLORS.textSecondary },
  proteinPillTextActive: { color: '#fff', fontWeight: '700' },
  computeBtn:   { backgroundColor: COLORS.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.md, paddingVertical: 14, marginTop: SPACING.md, elevation: 3 },
  computeText:  { color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 },
  riskPreview:  { borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.md },
  riskPreviewLabel: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  riskPreviewScore: { color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 8 },
  riskPreviewReason:{ color: '#fff', fontSize: 12, marginTop: 4 },
  saveBtn:      { backgroundColor: COLORS.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.md, paddingVertical: 14, marginTop: SPACING.sm, elevation: 3 },
  saveText:     { color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 },
});
