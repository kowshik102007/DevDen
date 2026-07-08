/**
 * App.js
 *
 * WHY THIS FILE EXISTS:
 * This is the ROOT component of the React Native app — the very first thing
 * that runs when the Android OS launches the app.
 *
 * It does three things:
 *  1. Initialises the SQLite database on first launch (creates tables)
 *  2. Renders a full-screen loading state while DB initialises
 *  3. Renders the AppNavigator (which contains all screens) once ready
 *
 * React Native's entry point (index.js) registers this component with the
 * Android runtime via AppRegistry.registerComponent.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// GestureHandlerRootView is required by react-navigation — wraps the whole app

import AppNavigator from './src/navigation/AppNavigator';
import { getDB } from './src/db/database';
import { COLORS } from './src/utils/theme';

export default function App() {
  const [dbReady, setDbReady] = useState(false); // tracks DB init status
  const [error,   setError]   = useState(null);

  useEffect(() => {
    // Initialise the SQLite database when the app first opens.
    // getDB() opens the file and runs initSchema() which creates tables.
    getDB()
      .then(() => setDbReady(true))
      .catch(e => {
        console.error('DB init failed:', e);
        setError(e.message);
      });
  }, []);

  // ── LOADING SCREEN ────────────────────────────────────────────────────────
  if (!dbReady) {
    return (
      <View style={styles.splash}>
        {error ? (
          // Show error if DB can't open (storage permission issue etc.)
          <Text style={styles.errorText}>DB Error: {error}</Text>
        ) : (
          <>
            <Text style={styles.splashTitle}>🛡 ASHA Shield</Text>
            <Text style={styles.splashSub}>Maternal Risk Intelligence</Text>
            <ActivityIndicator
              size="large"
              color={COLORS.accent}
              style={{ marginTop: 24 }}
            />
            <Text style={styles.splashLoading}>Initialising offline database…</Text>
          </>
        )}
      </View>
    );
  }

  // ── MAIN APP ──────────────────────────────────────────────────────────────
  return (
    // GestureHandlerRootView must be the outermost wrapper for swipe gestures
    // and bottom sheet navigation to work correctly
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppNavigator />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
  splashSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  splashLoading: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 12,
  },
  errorText: {
    color: '#ff6b6b',
    padding: 20,
    textAlign: 'center',
  },
});
