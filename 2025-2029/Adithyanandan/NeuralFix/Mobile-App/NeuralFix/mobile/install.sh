#!/bin/bash
# NeuralFix Mobile — One-shot install script
# Run this instead of manually managing package.json versions
# Usage: cd mobile && bash install.sh

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   NeuralFix Mobile — Installing      ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Install expo first
echo "→ Installing Expo SDK..."
npm install expo --legacy-peer-deps

# Let expo install pick exact compatible versions
echo "→ Installing all dependencies via expo install..."
npx expo install \
  react-native \
  react \
  react-native-safe-area-context \
  react-native-screens \
  @expo/vector-icons \
  expo-image-picker \
  expo-status-bar \
  expo-sharing \
  expo-asset \
  @react-navigation/native \
  @react-navigation/native-stack \
  @react-navigation/bottom-tabs \
  babel-preset-expo

echo ""
echo "✅ Done! Now run: npx expo start"
echo ""
