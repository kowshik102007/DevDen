/**
 * navigation/AppNavigator.js
 *
 * WHY THIS FILE EXISTS:
 * React Navigation is the standard routing library for React Native.
 * This file wires all screens together into:
 *
 *  RootStack (full-screen modal-style screens)
 *    └── MainTabs (bottom tab bar — always visible to ASHA worker)
 *          ├── Tab: Patients   → PatientListScreen
 *          ├── Tab: Dashboard  → DashboardScreen
 *          └── Tab: Supervisor → SupervisorScreen
 *
 *  Screens pushed on top of tabs (no tab bar):
 *    - PatientRegistrationScreen  (new patient form)
 *    - VisitLoggingScreen         (log a visit for a patient)
 *    - RiskCardScreen             (coloured risk card + voice readout)
 *    - TrendGraphScreen           (BP / Hb history chart)
 *
 * NavigationContainer is the root — it must wrap the entire navigator tree.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator }  from '@react-navigation/native-stack';
import { createBottomTabNavigator }    from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// ── Screen imports ────────────────────────────────────────────────────────────
import DashboardScreen           from '../screens/DashboardScreen';
import PatientListScreen         from '../screens/PatientListScreen';
import PatientRegistrationScreen from '../screens/PatientRegistrationScreen';
import VisitLoggingScreen        from '../screens/VisitLoggingScreen';
import RiskCardScreen            from '../screens/RiskCardScreen';
import TrendGraphScreen          from '../screens/TrendGraphScreen';
import SupervisorScreen          from '../screens/SupervisorScreen';

import { COLORS } from '../utils/theme';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Bottom tab navigator ──────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // headerShown: false hides the native top header — screens draw their own
        headerShown: false,
        tabBarActiveTintColor:   COLORS.accent,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor:  COLORS.border,
          paddingBottom: 6,
          height: 60,
        },
        // Icon function: returns a MaterialCommunityIcons icon for each tab
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if      (route.name === 'Patients')    iconName = 'account-group';
          else if (route.name === 'Dashboard')   iconName = 'view-dashboard';
          else if (route.name === 'Supervisor')  iconName = 'chart-bar';
          return <Icon name={iconName} size={size} color={color} />;
        },
      })}
    >
      {/* Each Tab.Screen maps a tab label to a screen component */}
      <Tab.Screen name="Dashboard"  component={DashboardScreen}  />
      <Tab.Screen name="Patients"   component={PatientListScreen} />
      <Tab.Screen name="Supervisor" component={SupervisorScreen}  />
    </Tab.Navigator>
  );
}

// ── Root stack navigator ─────────────────────────────────────────────────────
export default function AppNavigator() {
  return (
    // NavigationContainer provides the navigation context to all child screens
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* MainTabs is the "home" of the app */}
        <Stack.Screen name="MainTabs" component={MainTabs} />

        {/* These screens slide over the tabs when pushed */}
        <Stack.Screen
          name="PatientRegistration"
          component={PatientRegistrationScreen}
          options={{ presentation: 'card', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="VisitLogging"
          component={VisitLoggingScreen}
          options={{ presentation: 'card', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="RiskCard"
          component={RiskCardScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="TrendGraph"
          component={TrendGraphScreen}
          options={{ presentation: 'card', animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
