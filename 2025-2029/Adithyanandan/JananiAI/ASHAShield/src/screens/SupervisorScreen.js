/**
 * screens/SupervisorScreen.js
 *
 * WHY THIS SCREEN EXISTS:
 * This screen serves two roles:
 *  1. LOCAL analytics for the ASHA worker herself: how many patients, how many
 *     high-risk, visit frequency this month.
 *  2. SYNC BUTTON: when WiFi is available, push unsynced visits to the FastAPI
 *     backend so the ANM supervisor's dashboard gets updated.
 *
 * In a full production build, this screen would be a separate login-gated app
 * for ANM supervisors. For the hackathon demo, we combine it so judges can see
 * the supervisor perspective on the same device.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import { getAllPatients, getVisitsForPatient, getDB } from '../db/database';
import { checkBackendHealth, syncVisit } from '../utils/api';
import { COLORS, SPACING, RADIUS, FONTS } from '../utils/theme';

export default function SupervisorScreen() {
  const [stats,    setStats]    = useState(null);
  const [syncing,  setSyncing]  = useState(false);
  const [backendOk,setBackendOk]= useState(false);

  useFocusEffect(
    useCallback(() => {
      loadStats();
      checkBackendHealth().then(setBackendOk);
    }, [])
  );

  // ── LOAD LOCAL STATS ──────────────────────────────────────────────────────
  // Aggregates data from SQLite for the local analytics dashboard
  const loadStats = async () => {
    const patients = await getAllPatients();
    let totalVisits = 0;
    let highRiskCount = 0;
    let unsyncedCount = 0;
    const thisMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    for (const p of patients) {
      const visits = await getVisitsForPatient(p.id);
      totalVisits += visits.length;

      if (p.latest_risk === 'HIGH') highRiskCount++;

      // Count visits this month
      const monthlyVisits = visits.filter(v => v.visit_date?.startsWith(thisMonth));
      unsyncedCount += visits.filter(v => !v.synced).length;
    }

    setStats({
      totalPatients: patients.length,
      totalVisits,
      highRiskCount,
      moderateRiskCount: patients.filter(p => p.latest_risk === 'MODERATE').length,
      unsyncedCount,
    });
  };

  // ── SYNC TO BACKEND ────────────────────────────────────────────────────────
  // Finds all unsynced visits in SQLite and POSTs them to FastAPI one by one
  const handleSync = async () => {
    if (!backendOk) {
      Alert.alert('No Connection', 'Backend server is not reachable. Please connect to WiFi and try again.');
      return;
    }

    setSyncing(true);
    try {
      const database = await getDB();
      // Find all unsynced visit rows
      const [res] = await database.executeSql(
        'SELECT v.*, p.district FROM visits v JOIN patients p ON v.patient_id = p.id WHERE v.synced = 0'
      );

      let successCount = 0;
      for (let i = 0; i < res.rows.length; i++) {
        const visit = res.rows.item(i);
        const ok = await syncVisit(visit);
        if (ok) {
          // Mark as synced in local DB
          await database.executeSql('UPDATE visits SET synced = 1 WHERE id = ?', [visit.id]);
          successCount++;
        }
      }

      Alert.alert(
        '✅ Sync Complete',
        `${successCount} of ${res.rows.length} visits synced to supervisor dashboard.`
      );
      loadStats(); // refresh stats to show updated unsynced count
    } catch (e) {
      Alert.alert('Sync Error', e.message);
    } finally {
      setSyncing(false);
    }
  };

  // ── STAT TILE ─────────────────────────────────────────────────────────────
  const StatTile = ({ icon, value, label, color }) => (
    <Animatable.View animation="fadeInUp" duration={500} style={styles.tile}>
      <Icon name={icon} size={30} color={color} />
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </Animatable.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Supervisor View</Text>
        <Text style={styles.headerSub}>Barmer District · ASHA Sunita</Text>
        {/* Backend status indicator */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: backendOk ? COLORS.LOW : '#999' }]} />
          <Text style={styles.statusText}>
            {backendOk ? 'Backend reachable' : 'Offline mode'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* ── STATS GRID ───────────────────────────────────────────────────── */}
        {stats ? (
          <View style={styles.tilesGrid}>
            <StatTile icon="account-group"  value={stats.totalPatients}      label="Total Patients"  color={COLORS.primary}  />
            <StatTile icon="clipboard-list" value={stats.totalVisits}         label="Total Visits"    color={COLORS.accent}   />
            <StatTile icon="alert-circle"   value={stats.highRiskCount}       label="High Risk"       color={COLORS.HIGH}     />
            <StatTile icon="alert"          value={stats.moderateRiskCount}   label="Moderate Risk"   color={COLORS.MODERATE} />
          </View>
        ) : (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        )}

        {/* ── SYNC SECTION ─────────────────────────────────────────────────── */}
        <View style={styles.syncCard}>
          <View style={styles.syncHeader}>
            <Icon name="cloud-sync" size={26} color={COLORS.primary} />
            <Text style={styles.syncTitle}>Sync to Supervisor</Text>
          </View>
          <Text style={styles.syncDesc}>
            {stats?.unsyncedCount || 0} visit(s) not yet synced to the ANM supervisor dashboard.
            Connect to WiFi, then tap Sync.
          </Text>
          <TouchableOpacity
            style={[styles.syncBtn, (!backendOk || syncing) && styles.syncBtnDisabled]}
            onPress={handleSync}
            disabled={syncing || !backendOk}
            activeOpacity={0.85}
          >
            {syncing ? (
              // Show a spinner while syncing
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="upload-network" size={20} color="#fff" />
            )}
            <Text style={styles.syncBtnText}>
              {syncing ? 'Syncing…' : 'Sync Now'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── WHAT GETS SYNCED ──────────────────────────────────────────────── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What gets synced?</Text>
          {[
            'Visit vitals (BP, Hb, weight, etc.)',
            'Risk scores and reason strings',
            'HIGH/MODERATE risk flag log',
            'Visit timestamps and data completeness',
          ].map((item, i) => (
            <View key={i} style={styles.infoRow}>
              <Icon name="check" size={16} color={COLORS.LOW} />
              <Text style={styles.infoText}>{item}</Text>
            </View>
          ))}
          <Text style={styles.infoNote}>
            ℹ Raw patient names and IDs are anonymised before transmission.
            Privacy by design.
          </Text>
        </View>

        {/* ── ABDM EXPORT NOTE ─────────────────────────────────────────────── */}
        <View style={styles.abdmCard}>
          <Icon name="file-export" size={24} color={COLORS.accent} />
          <View style={{ flex: 1, marginLeft: SPACING.sm }}>
            <Text style={styles.abdmTitle}>ABDM / RCH Export</Text>
            <Text style={styles.abdmDesc}>
              FHIR R4 format export to Ayushman Bharat Digital Mission is available
              via the backend sync. Tap Sync to push records to the RCH portal.
            </Text>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  header:         { backgroundColor: COLORS.primary, paddingTop: 52, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  headerTitle:    { ...FONTS.heading, color: '#fff' },
  headerSub:      { ...FONTS.body, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statusRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusDot:      { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText:     { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  content:        { padding: SPACING.md },
  tilesGrid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile:           { width: '48%', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.sm, elevation: 2 },
  tileValue:      { fontSize: 26, fontWeight: '800', marginTop: 6 },
  tileLabel:      { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
  syncCard:       { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm, elevation: 2 },
  syncHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  syncTitle:      { ...FONTS.subhead, marginLeft: SPACING.sm },
  syncDesc:       { ...FONTS.body, marginBottom: SPACING.md },
  syncBtn:        { backgroundColor: COLORS.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.md, paddingVertical: 13, elevation: 2 },
  syncBtnDisabled:{ opacity: 0.5 },
  syncBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 8 },
  infoCard:       { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm, elevation: 2 },
  infoTitle:      { ...FONTS.subhead, marginBottom: SPACING.sm },
  infoRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  infoText:       { ...FONTS.body, marginLeft: 8 },
  infoNote:       { fontSize: 11, color: COLORS.textSecondary, marginTop: SPACING.sm, fontStyle: 'italic' },
  abdmCard:       { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.accent + '15', borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.accent + '40' },
  abdmTitle:      { ...FONTS.subhead, color: COLORS.accent },
  abdmDesc:       { ...FONTS.body, marginTop: 4, fontSize: 12 },
});
