import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../utils/theme';
import ChatStackNavigator from './ChatStackNavigator';
import HistoryScreen from '../screens/HistoryScreen';
import VisionScreen from '../screens/VisionScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle: styles.tabBar,
      tabBarActiveTintColor: COLORS.accent,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarLabelStyle: styles.tabLabel,
    }}>
      <Tab.Screen name="ChatTab" component={ChatStackNavigator} options={{
        tabBarLabel: 'Fix It',
        tabBarIcon: ({ focused, color }) => (
          <View style={[styles.iconWrap, focused && styles.iconActive]}>
            <Ionicons name={focused ? 'hardware-chip' : 'hardware-chip-outline'} size={22} color={color} />
          </View>
        ),
      }} />
      <Tab.Screen name="VisionTab" component={VisionScreen} options={{
        tabBarLabel: 'Vision',
        tabBarIcon: ({ focused, color }) => (
          <View style={[styles.iconWrap, focused && styles.iconActive]}>
            <Ionicons name={focused ? 'scan' : 'scan-outline'} size={22} color={color} />
          </View>
        ),
      }} />
      <Tab.Screen name="HistoryTab" component={HistoryScreen} options={{
        tabBarLabel: 'History',
        tabBarIcon: ({ focused, color }) => (
          <View style={[styles.iconWrap, focused && styles.iconActive]}>
            <Ionicons name={focused ? 'time' : 'time-outline'} size={22} color={color} />
          </View>
        ),
      }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: COLORS.bg1, borderTopWidth: 1, borderTopColor: COLORS.border, height: 72, paddingBottom: 12, paddingTop: 8 },
  tabLabel: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold, letterSpacing: 0.5, textTransform: 'uppercase' },
  iconWrap: { padding: 4, borderRadius: 8 },
  iconActive: { backgroundColor: COLORS.accentDim },
});

