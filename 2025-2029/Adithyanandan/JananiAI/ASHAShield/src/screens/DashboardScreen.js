/**
 * screens/DashboardScreen.js
 *
 * WHY THIS SCREEN EXISTS:
 * First thing the ASHA worker sees when she opens the app.
 * It shows:
 *  - A greeting with her name
 *  - Summary stats: total patients, HIGH-risk count, today's visits
 *  - Quick action buttons: Register New Patient, View All Patients
 *  - A "Today's Alerts" list of HIGH-risk patients needing action TODAY
 *
 * This is the control centre — she should never need to dig deep into menus.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import { getAllPatients, getLatestVisit } from '../db/database';
import { COLORS, SPACING, RADIUS, FONTS } from '../utils/theme';

export default function DashboardScreen({ navigation }) {
  const [patients, setPatients]     = useState([]);
  const [highRisk, setHighRisk]     = useState([]);
  const [todayCount, setTodayCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // useFocusEffect re-runs loadData every time this tab becomes active.
  // This ensures stats refresh after a new visit is logged elsewhere.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setRefreshing(true);
    const all = await getAllPatients();
    setPatients(all);

    // Filter patients whose latest risk is HIGH → show as today's alerts
    const highRiskList = all.filter(p => p.latest_risk === 'HIGH');
    setHighRisk(highRiskList);

    // Count patients who had a visit today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    let count = 0;
    for (const p of all) {
      const visit = await getLatestVisit(p.id);
      if (visit && visit.visit_date && visit.visit_date.startsWith(today)) count++;
    }
    setTodayCount(count);
    setRefreshing(false);
  };

  // ── STAT CARD COMPONENT ──────────────────────────────────────────────────
  // Renders a single stat box (e.g. "12 / Total Patients")
  const StatCard = ({ icon, value, label, color }) => (
    <Animatable.View animation="fadeInUp" duration={600} style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        {/* The '20' suffix makes the icon bg a 12.5% opacity version of the colour */}
        <Icon name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animatable.View>
  );

  return (
    <View style={styles.container}>
      {/* Make status bar content white to show on the dark gradient header */}
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* ── HEADER GRADIENT ───────────────────────────────────────────────── */}
      <LinearGradient
        colors={[COLORS.primary, '#0D7A8A']}  // teal gradient
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Namaste, Sunita 👋</Text>
            <Text style={styles.subtitle}>ASHA Worker · Barmer, Rajasthan</Text>
          </View>
          {/* Shield logo icon in the header */}
          <View style={styles.shieldBadge}>
            <Icon name="shield-plus" size={36} color={COLORS.accent} />
          </View>
        </View>

        {/* ── STAT CARDS ROW ──────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard icon="account-group"  value={patients.length}  label="Total Patients"  color={COLORS.accent} />
          <StatCard icon="alert-circle"   value={highRisk.length}  label="High Risk"        color={COLORS.HIGH}   />
          <StatCard icon="calendar-check" value={todayCount}        label="Visits Today"     color={COLORS.LOW}    />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        refreshControl={
          // Pull-to-refresh gesture reloads dashboard data
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={COLORS.primary} />
        }
      >
        {/* ── QUICK ACTIONS ─────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {/* Register new patient — navigates to PatientRegistrationScreen */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => navigation.navigate('PatientRegistration')}
            activeOpacity={0.85}
          >
            <Icon name="account-plus" size={28} color="#fff" />
            <Text style={styles.actionLabel}>Register{'\n'}Patient</Text>
          </TouchableOpacity>

          {/* View all patients — navigates to PatientListScreen tab */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.accent }]}
            onPress={() => navigation.navigate('Patients')}
            activeOpacity={0.85}
          >
            <Icon name="clipboard-list" size={28} color="#fff" />
            <Text style={styles.actionLabel}>View All{'\n'}Patients</Text>
          </TouchableOpacity>

          {/* Supervisor sync button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#6A5ACD' }]}
            onPress={() => navigation.navigate('Supervisor')}
            activeOpacity={0.85}
          >
            <Icon name="sync" size={28} color="#fff" />
            <Text style={styles.actionLabel}>Sync &{'\n'}Report</Text>
          </TouchableOpacity>
        </View>

        {/* ── TODAY'S ALERTS ─────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>
          🚨 Today's High-Risk Alerts ({highRisk.length})
        </Text>

        {highRisk.length === 0 ? (
          // Empty state — no high-risk patients
          <Animatable.View animation="fadeIn" style={styles.emptyAlert}>
            <Icon name="check-circle" size={40} color={COLORS.LOW} />
            <Text style={styles.emptyText}>No high-risk patients. Good work!</Text>
          </Animatable.View>
        ) : (
          // Map each high-risk patient to an alert card
          highRisk.map((patient, idx) => (
            <Animatable.View
              key={patient.id}
              animation="slideInLeft"
              delay={idx * 100}   // stagger each card by 100ms for visual effect
            >
              <TouchableOpacity
                style={styles.alertCard}
                // Tapping an alert goes directly to that patient's risk card
                onPress={() => navigation.navigate('RiskCard', { patientId: patient.id })}
                activeOpacity={0.9}
              >
                <View style={[styles.riskDot, { backgroundColor: COLORS.HIGH }]} />
                <View style={styles.alertInfo}>
                  <Text style={styles.alertName}>{patient.name}</Text>
                  <Text style={styles.alertMeta}>
                    {patient.village} · Age {patient.age}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </Animatable.View>
          ))
        )}

        {/* Bottom padding so last card isn't cut off */}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  header:       { paddingTop: 52, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  headerContent:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting:     { ...FONTS.heading, color: '#fff', fontSize: 20 },
  subtitle:     { ...FONTS.body,    color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  shieldBadge:  { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  statsRow:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.md },
  statCard:     { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: RADIUS.md, padding: SPACING.sm, marginHorizontal: 4, alignItems: 'center' },
  statIcon:     { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statValue:    { fontSize: 22, fontWeight: '700', color: '#fff' },
  statLabel:    { fontSize: 10, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 2 },
  body:         { flex: 1, paddingHorizontal: SPACING.md },
  sectionTitle: { ...FONTS.subhead, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  actionsRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn:    { flex: 1, marginHorizontal: 5, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', elevation: 3 },
  actionLabel:  { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  alertCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, elevation: 2, borderLeftWidth: 4, borderLeftColor: COLORS.HIGH },
  riskDot:      { width: 12, height: 12, borderRadius: 6, marginRight: SPACING.sm },
  alertInfo:    { flex: 1 },
  alertName:    { ...FONTS.subhead, fontSize: 15 },
  alertMeta:    { ...FONTS.body, fontSize: 12, marginTop: 2 },
  emptyAlert:   { alignItems: 'center', paddingVertical: SPACING.xl, backgroundColor: COLORS.card, borderRadius: RADIUS.md },
  emptyText:    { ...FONTS.body, marginTop: SPACING.sm, color: COLORS.LOW },
});
