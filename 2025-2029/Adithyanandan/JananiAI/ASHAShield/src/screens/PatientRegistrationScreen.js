/**
 * screens/PatientRegistrationScreen.js
 *
 * WHY THIS SCREEN EXISTS:
 * Before logging any visit, the ASHA worker must register the pregnant woman.
 * This one-time form captures all the static demographic and obstetric history
 * data that the ML model uses as baseline features.
 *
 * Fields collected:
 *  - Name, age, village, district, phone
 *  - Gravida, parity, LMP, EDD
 *  - Previous complications (C-section, PPH, stillbirth)
 *  - Inter-pregnancy interval, blood group
 *
 * On submit → insertPatient() writes to SQLite → navigates back to Patients tab.
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { insertPatient } from '../db/database';
import { COLORS, SPACING, RADIUS, FONTS } from '../utils/theme';

export default function PatientRegistrationScreen({ navigation }) {
  // ── FORM STATE ─────────────────────────────────────────────────────────────
  // Each field maps to a column in the patients table
  const [name,           setName]           = useState('');
  const [age,            setAge]            = useState('');
  const [village,        setVillage]        = useState('');
  const [district,       setDistrict]       = useState('Barmer');
  const [phone,          setPhone]          = useState('');
  const [gravida,        setGravida]        = useState('1');
  const [parity,         setParity]         = useState('0');
  const [lmp,            setLmp]            = useState('');  // Last Menstrual Period
  const [bloodGroup,     setBloodGroup]     = useState('');
  const [prevCsection,   setPrevCsection]   = useState(false);
  const [prevPph,        setPrevPph]        = useState(false);
  const [prevStillbirth, setPrevStillbirth] = useState(false);
  const [interPregGap,   setInterPregGap]   = useState('');
  const [loading,        setLoading]        = useState(false);

  // Compute EDD from LMP: add 280 days (Naegele's rule)
  const computeEdd = (lmpStr) => {
    if (!lmpStr || lmpStr.length < 10) return '';
    const lmpDate = new Date(lmpStr);
    lmpDate.setDate(lmpDate.getDate() + 280);
    return lmpDate.toISOString().split('T')[0]; // format as YYYY-MM-DD
  };

  // ── SUBMIT HANDLER ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Basic validation — name and age are the minimum required fields
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter the patient name.');
      return;
    }
    if (!age || isNaN(parseInt(age))) {
      Alert.alert('Required', 'Please enter a valid age.');
      return;
    }

    setLoading(true);
    try {
      await insertPatient({
        name:           name.trim(),
        age:            parseInt(age),
        village:        village.trim(),
        district:       district.trim(),
        phone:          phone.trim(),
        gravida:        parseInt(gravida) || 1,
        parity:         parseInt(parity)  || 0,
        lmp:            lmp,
        edd:            computeEdd(lmp),   // auto-calculated from LMP
        prev_csection:  prevCsection,
        prev_pph:       prevPph,
        prev_stillbirth:prevStillbirth,
        inter_preg_gap: interPregGap ? parseInt(interPregGap) : null,
        blood_group:    bloodGroup.trim(),
        asha_id:        'ASHA_001',        // hard-coded for demo; would come from login
      });

      Alert.alert(
        '✅ Registered',
        `${name} has been registered successfully.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Error', 'Could not save patient. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── INPUT COMPONENT ────────────────────────────────────────────────────────
  // Reusable labelled text input to avoid repetitive JSX
  const Field = ({ label, value, onChangeText, placeholder, keyboardType = 'default', hint }) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        keyboardType={keyboardType}
      />
    </View>
  );

  // ── TOGGLE COMPONENT ────────────────────────────────────────────────────────
  // Yes/No toggle for boolean obstetric history fields
  const Toggle = ({ label, value, onValueChange, hint }) => (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {/* Switch is the React Native toggle/checkbox widget */}
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.border, true: COLORS.accent + '80' }}
        thumbColor={value ? COLORS.accent : '#ccc'}
      />
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
        <Text style={styles.topTitle}>Register Patient</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">

        {/* ── SECTION: Personal Info ──────────────────────────────────────── */}
        <SectionHeader icon="account" title="Personal Information" />
        <Field label="Full Name *" value={name} onChangeText={setName} placeholder="e.g. Meena Devi" />
        <Field label="Age *" value={age} onChangeText={setAge} placeholder="e.g. 24" keyboardType="numeric" hint="Age <18 or >35 increases risk" />
        <Field label="Village" value={village} onChangeText={setVillage} placeholder="e.g. Balotra" />
        <Field label="District" value={district} onChangeText={setDistrict} placeholder="e.g. Barmer" />
        <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="10-digit mobile" keyboardType="phone-pad" />
        <Field label="Blood Group" value={bloodGroup} onChangeText={setBloodGroup} placeholder="e.g. B+" />

        {/* ── SECTION: Pregnancy Details ──────────────────────────────────── */}
        <SectionHeader icon="baby" title="Pregnancy Details" />
        <Field
          label="Gravida (total pregnancies)"
          value={gravida}
          onChangeText={setGravida}
          placeholder="1"
          keyboardType="numeric"
          hint="Including current pregnancy"
        />
        <Field
          label="Parity (previous deliveries)"
          value={parity}
          onChangeText={setParity}
          placeholder="0"
          keyboardType="numeric"
        />
        <Field
          label="LMP (Last Menstrual Period)"
          value={lmp}
          onChangeText={setLmp}
          placeholder="YYYY-MM-DD"
          hint="Used to calculate EDD automatically"
        />
        {lmp.length >= 10 && (
          // Show computed EDD immediately so ASHA can verify
          <View style={styles.eddDisplay}>
            <Icon name="calendar" size={16} color={COLORS.accent} />
            <Text style={styles.eddText}>
              Computed EDD: <Text style={{ fontWeight: '700' }}>{computeEdd(lmp)}</Text>
            </Text>
          </View>
        )}
        <Field
          label="Inter-pregnancy gap (months)"
          value={interPregGap}
          onChangeText={setInterPregGap}
          placeholder="e.g. 18"
          keyboardType="numeric"
          hint="Gap since last delivery. <24 months = higher risk"
        />

        {/* ── SECTION: Previous Complications ─────────────────────────────── */}
        <SectionHeader icon="alert-circle" title="Previous Complications" />
        <Toggle label="Previous C-Section?"      value={prevCsection}   onValueChange={setPrevCsection}   hint="Increases surgical risk" />
        <Toggle label="Previous PPH?"            value={prevPph}        onValueChange={setPrevPph}        hint="Postpartum haemorrhage — HIGH risk flag" />
        <Toggle label="Previous Stillbirth?"     value={prevStillbirth} onValueChange={setPrevStillbirth} hint="Requires additional monitoring" />

        {/* ── SUBMIT BUTTON ────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Icon name={loading ? 'loading' : 'check-circle'} size={22} color="#fff" />
          <Text style={styles.submitText}>
            {loading ? 'Saving…' : 'Register Patient'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// Small header component for grouping form sections
function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <Icon name={icon} size={18} color={COLORS.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  topBar:       { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', paddingTop: 48, paddingBottom: 14, paddingHorizontal: SPACING.md },
  backBtn:      { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topTitle:     { flex: 1, textAlign: 'center', color: '#fff', fontSize: 17, fontWeight: '700' },
  form:         { padding: SPACING.md },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 6 },
  sectionTitle: { ...FONTS.subhead, marginLeft: SPACING.sm, color: COLORS.primary },
  field:        { marginBottom: SPACING.sm },
  label:        { ...FONTS.label, marginBottom: 4, fontWeight: '600', color: COLORS.textPrimary },
  hint:         { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  input:        { backgroundColor: COLORS.card, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, height: 46, color: COLORS.textPrimary, fontSize: 14 },
  toggleRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginBottom: SPACING.sm },
  eddDisplay:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent + '18', borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.sm },
  eddText:      { marginLeft: 6, color: COLORS.textPrimary, fontSize: 13 },
  submitBtn:    { backgroundColor: COLORS.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.md, paddingVertical: 16, marginTop: SPACING.lg, elevation: 4 },
  submitDisabled:{ opacity: 0.6 },
  submitText:   { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
});
