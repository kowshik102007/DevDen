import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatScreen from '../screens/ChatScreen';
import DiagnosticReportScreen from '../screens/DiagnosticReportScreen';
import { COLORS } from '../utils/theme';

const Stack = createNativeStackNavigator();
export default function ChatStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg0 }, animation: 'slide_from_right' }}>
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="DiagnosticReport" component={DiagnosticReportScreen} />
    </Stack.Navigator>
  );
}
