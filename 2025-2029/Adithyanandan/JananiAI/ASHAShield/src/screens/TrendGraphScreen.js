/**
 * screens/TrendGraphScreen.js
 *
 * WHY THIS SCREEN EXISTS:
 * A single visit's vitals can look normal. But a patient whose systolic BP has
 * gone 110 → 118 → 128 → 140 over 4 visits is silently deteriorating.
 * This screen shows longitudinal trends so the ASHA worker (or PHC doctor) can
 * see the TRAJECTORY, not just the snapshot.
 *
 * Charts displayed:
 *  1. Blood Pressure (systolic + diastolic lines on same chart)
 *  2. Haemoglobin level over visits
 *
 * Built with react-native-chart-kit (LineChart) + react-native-svg.
 * All data comes from SQLite — no internet needed.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, StatusBar,
  Dimensions, TouchableOpacity,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getVisitsForPatient, getPatientById } from '../db/database';
import { COLORS, SPACING, RADIUS, FONTS } from '../utils/theme';

// Screen width is needed to make the chart fill the card
const SCREEN_W = Dimensions.get('window').width;

export default function TrendGraphScreen({ route, navigation }) {
  const { patientId } = route.params || {};
  const [patient, setPatient] = useState(null);
  const [visits,  setVisits]  = useState([]);

  useEffect(() => {
    loadData();
  }, [patientId]);

  const loadData = async () => {
    const p = await getPatientById(patientId);
    setPatient(p);
    const v = await getVisitsForPatient(patientId);
    setVisits(v);
  };

  // ── CHART DATA PREPARATION ────────────────────────────────────────────────
  // react-native-chart-kit expects { labels, datasets } where datasets is an
  // array of { data } arrays. Each index corresponds to one visit.

  // X-axis labels: "V1", "V2", "V3"… (visit number, keeping them short)
  const labels = visits.map((_, i) => `V${i + 1}`);

  // Systolic BP values — use 0 for missing data points so chart doesn't crash
  const systolicData  = visits.map(v => v.systolic_bp  || 0);
  const diastolicData = visits.map(v => v.diastolic_bp || 0);
  const hbData        = visits.map(v => v.hb_gdl       || 0);

  // Chart config shared across both charts
  const chartConfig = {
    backgroundColor:     COLORS.card,
    backgroundGradientFrom: COLORS.card,
    backgroundGradientTo:   COLORS.card,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(11, 94, 107, ${opacity})`, // COLORS.primary
    labelColor: () => COLORS.textSecondary,
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: COLORS.primary,
    },
    propsForBackgroundLines: {
      stroke: COLORS.border,
    },
  };

  // We need at least 2 visits to draw a line
  const hasEnoughData = visits.length >= 2;

  // ── RISK HISTORY TABLE ────────────────────────────────────────────────────
  // Shows each visit's date, BP, Hb, and risk badge in a table below the charts
  const RiskPill = ({ level }) => (
    <View style={[styles.pill, { backgroundColor: COLORS[level] || COLORS.LOW }]}>
      <Text style={styles.pillText}>{level || 'LOW'}</Text>
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
          <Text style={styles.topTitle}>Trend Graph</Text>
          <Text style={styles.topSub}>{patient?.name} · {visits.length} visits</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {!hasEnoughData ? (
          // Shown when fewer than 2 visits exist — can't draw a line with 1 point
          <View style={styles.noData}>
            <Icon name="chart-timeline-variant" size={52} color={COLORS.textSecondary} />
            <Text style={styles.noDataText}>
              At least 2 visits are needed to show trends.{'\n'}
              Log more visits to see the trend graph.
            </Text>
          </View>
        ) : (
          <>
            {/* ── BP CHART ─────────────────────────────────────────────────── */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>🩺 Blood Pressure (mmHg)</Text>
              <Text style={styles.chartLegend}>
                <Text style={{ color: COLORS.primary }}>— Systolic  </Text>
                <Text style={{ color: COLORS.HIGH }}>— Diastolic</Text>
              </Text>

              {/* LineChart renders using react-native-svg under the hood */}
              <LineChart
                data={{
                  labels,
                  datasets: [
                    { data: systolicData,  color: () => COLORS.primary, strokeWidth: 2 },
                    { data: diastolicData, color: () => COLORS.HIGH,    strokeWidth: 2 },
                  ],
                }}
                width={SCREEN_W - SPACING.md * 2 - 24} // account for card padding
                height={200}
                chartConfig={chartConfig}
                bezier           // smooth curved lines instead of sharp angles
                style={styles.chart}
                withDots
                withShadow={false}
              />

              {/* Danger zone reference line label */}
              <Text style={styles.refLine}>
                ⚠ Pre-eclampsia threshold: 140/90 mmHg
              </Text>
            </View>

            {/* ── HB CHART ─────────────────────────────────────────────────── */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>🩸 Haemoglobin (g/dL)</Text>
              <LineChart
                data={{
                  labels,
                  datasets: [
                    { data: hbData, color: () => '#C0392B', strokeWidth: 2 },
                  ],
                }}
                width={SCREEN_W - SPACING.md * 2 - 24}
                height={180}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(192, 57, 43, ${opacity})`,
                }}
                bezier
                style={styles.chart}
                withShadow={false}
              />
              <Text style={styles.refLine}>
                ⚠ Severe anaemia threshold: 7 g/dL  |  Moderate: 7–10 g/dL
              </Text>
            </View>

            {/* ── VISIT HISTORY TABLE ──────────────────────────────────────── */}
            <Text style={styles.sectionTitle}>Visit History</Text>
            <View style={styles.table}>
              {/* Table header row */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.headerCell]}>#</Text>
                <Text style={[styles.tableCell, styles.headerCell]}>Date</Text>
                <Text style={[styles.tableCell, styles.headerCell]}>BP</Text>
                <Text style={[styles.tableCell, styles.headerCell]}>Hb</Text>
                <Text style={[styles.tableCell, styles.headerCell]}>Risk</Text>
              </View>
              {/* One row per visit */}
              {visits.map((v, i) => (
                <View key={v.id} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={styles.tableCell}>{i + 1}</Text>
                  <Text style={styles.tableCell}>{v.visit_date?.slice(5)}</Text>
                  {/* .slice(5) trims YYYY- prefix so it shows MM-DD */}
                  <Text style={styles.tableCell}>
                    {v.systolic_bp || '--'}/{v.diastolic_bp || '--'}
                  </Text>
                  <Text style={styles.tableCell}>{v.hb_gdl || '--'}</Text>
                  <View style={styles.tableCell}>
                    <RiskPill level={v.risk_level} />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  topBar:      { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', paddingTop: 48, paddingBottom: 14, paddingHorizontal: SPACING.md },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topTitle:    { color: '#fff', fontSize: 17, fontWeight: '700' },
  topSub:      { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  content:     { padding: SPACING.md },
  noData:      { alignItems: 'center', paddingVertical: 60 },
  noDataText:  { ...FONTS.body, textAlign: 'center', marginTop: SPACING.sm },
  chartCard:   { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, elevation: 2 },
  chartTitle:  { ...FONTS.subhead, marginBottom: 4 },
  chartLegend: { fontSize: 12, marginBottom: SPACING.sm },
  chart:       { borderRadius: RADIUS.sm, marginVertical: 4 },
  refLine:     { fontSize: 11, color: COLORS.textSecondary, marginTop: 6 },
  sectionTitle:{ ...FONTS.subhead, marginVertical: SPACING.sm },
  table:       { backgroundColor: COLORS.card, borderRadius: RADIUS.md, overflow: 'hidden', elevation: 2 },
  tableRow:    { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: SPACING.sm, alignItems: 'center' },
  tableRowAlt: { backgroundColor: COLORS.background },
  tableHeader: { backgroundColor: COLORS.primary },
  tableCell:   { flex: 1, fontSize: 12, color: COLORS.textPrimary, textAlign: 'center' },
  headerCell:  { color: '#fff', fontWeight: '700' },
  pill:        { borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'center' },
  pillText:    { color: '#fff', fontSize: 9, fontWeight: '800' },
});
