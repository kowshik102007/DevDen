/**
 * screens/PatientListScreen.js
 *
 * WHY THIS SCREEN EXISTS:
 * Shows the ASHA worker a list of ALL her registered patients.
 * Each row displays: name, village, age, and a colour-coded risk badge from
 * their most recent visit. She can tap a patient to log a new visit or view
 * their risk card.
 *
 * Features:
 *  - Search bar to filter by name or village
 *  - Risk badge (RED/AMBER/GREEN) on each row
 *  - Pull-to-refresh
 *  - FAB (Floating Action Button) to add a new patient
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, StatusBar, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import { getAllPatients } from '../db/database';
import { COLORS, SPACING, RADIUS, FONTS } from '../utils/theme';

export default function PatientListScreen({ navigation }) {
  const [patients,  setPatients]  = useState([]);
  const [filtered,  setFiltered]  = useState([]);
  const [query,     setQuery]     = useState('');
  const [refreshing,setRefreshing]= useState(false);

  // Reload list every time this tab is focused
  useFocusEffect(
    useCallback(() => { loadPatients(); }, [])
  );

  const loadPatients = async () => {
    setRefreshing(true);
    const data = await getAllPatients();
    setPatients(data);
    setFiltered(data);    // initially show all
    setRefreshing(false);
  };

  // Filter patients by name or village as the user types in the search box
  const onSearch = (text) => {
    setQuery(text);
    if (!text.trim()) {
      setFiltered(patients);
      return;
    }
    const q = text.toLowerCase();
    setFiltered(
      patients.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.village?.toLowerCase().includes(q)
      )
    );
  };

  // ── RISK BADGE ────────────────────────────────────────────────────────────
  // Small coloured pill showing LOW / MODERATE / HIGH
  const RiskBadge = ({ level }) => {
    const color = COLORS[level] || COLORS.LOW;
    return (
      <View style={[styles.badge, { backgroundColor: color + '22' }]}>
        <View style={[styles.badgeDot, { backgroundColor: color }]} />
        <Text style={[styles.badgeText, { color }]}>{level || 'LOW'}</Text>
      </View>
    );
  };

  // ── PATIENT ROW ───────────────────────────────────────────────────────────
  // Each row is a pressable card. Pressing shows an action sheet to either
  // log a visit or view the last risk card.
  const renderItem = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 40} duration={400}>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.85}
        onPress={() =>
          // Navigate to VisitLogging and pass the patient's ID as a route param
          navigation.navigate('VisitLogging', { patientId: item.id, patientName: item.name })
        }
      >
        {/* Avatar circle using initials */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name ? item.name[0].toUpperCase() : '?'}
          </Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {item.village} · Age {item.age} · G{item.gravida}P{item.parity}
          </Text>
          {/* EDD — shows how many weeks remain */}
          {item.edd ? (
            <Text style={styles.edd}>EDD: {item.edd}</Text>
          ) : null}
        </View>

        <View style={styles.rightCol}>
          <RiskBadge level={item.latest_risk} />
          {/* Tap to view risk card — dedicated button */}
          <TouchableOpacity
            style={styles.riskBtn}
            onPress={() => navigation.navigate('RiskCard', { patientId: item.id })}
          >
            <Icon name="shield-alert" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Patients</Text>
        <Text style={styles.headerSub}>{patients.length} registered</Text>
      </View>

      {/* ── SEARCH BAR ─────────────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or village…"
          placeholderTextColor={COLORS.textSecondary}
          value={query}
          onChangeText={onSearch}
          // returnKeyType "search" changes the keyboard's enter key to a search icon
          returnKeyType="search"
        />
        {/* Clear button — only visible when there is text */}
        {query.length > 0 && (
          <TouchableOpacity onPress={() => onSearch('')}>
            <Icon name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── PATIENT LIST ────────────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadPatients} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          // Shown when there are no patients yet
          <View style={styles.empty}>
            <Icon name="account-off" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {query ? 'No patients found.' : 'No patients registered yet.\nTap + to register.'}
            </Text>
          </View>
        }
      />

      {/* ── FAB (Floating Action Button) ────────────────────────────────────── */}
      {/* Fixed + button in the bottom-right corner to quickly add a patient */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('PatientRegistration')}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  header:          { backgroundColor: COLORS.primary, paddingTop: 52, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  headerTitle:     { ...FONTS.heading, color: '#fff' },
  headerSub:       { ...FONTS.body, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: SPACING.md, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, elevation: 2 },
  searchIcon:      { marginRight: SPACING.sm },
  searchInput:     { flex: 1, height: 44, color: COLORS.textPrimary, fontSize: 14 },
  listContent:     { paddingHorizontal: SPACING.md, paddingBottom: 100 },
  row:             { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, elevation: 2 },
  avatar:          { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary + '22', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
  avatarText:      { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  info:            { flex: 1 },
  name:            { ...FONTS.subhead, fontSize: 15 },
  meta:            { ...FONTS.body,    fontSize: 12, marginTop: 2 },
  edd:             { fontSize: 11, color: COLORS.accent, marginTop: 2 },
  rightCol:        { alignItems: 'flex-end' },
  badge:           { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeDot:        { width: 7, height: 7, borderRadius: 4, marginRight: 4 },
  badgeText:       { fontSize: 10, fontWeight: '700' },
  riskBtn:         { marginTop: 6, padding: 4 },
  empty:           { alignItems: 'center', paddingVertical: 60 },
  emptyText:       { ...FONTS.body, textAlign: 'center', marginTop: SPACING.sm },
  fab:             { position: 'absolute', bottom: 24, right: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', elevation: 6 },
});
