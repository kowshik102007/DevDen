import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
  Image, Alert, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SPACING, RADIUS } from '../utils/theme';
import { useSession } from '../utils/SessionContext';
import * as api from '../services/api';
import MessageBubble from '../components/MessageBubble';
import StatusBadge from '../components/StatusBadge';
import ServerBanner from '../components/ServerBanner';

const CATEGORIES = [
  { id: 'networking', label: 'WiFi / Internet', icon: 'wifi', color: '#00C2FF' },
  { id: 'computer', label: 'Computer / Laptop', icon: 'laptop-outline', color: '#818CF8' },
  { id: 'printer', label: 'Printer / Scanner', icon: 'print-outline', color: '#F59E0B' },
  { id: 'mobile', label: 'Phone / Tablet', icon: 'phone-portrait-outline', color: '#22C55E' },
  { id: 'software', label: 'Software / Apps', icon: 'apps-outline', color: '#EC4899' },
  { id: 'display', label: 'TV / Projector', icon: 'tv-outline', color: '#F97316' },
  { id: 'account', label: 'Password / Account', icon: 'key-outline', color: '#A78BFA' },
  { id: 'iot', label: 'Smart Devices', icon: 'home-outline', color: '#34D399' },
];

const QUICK_PROMPTS = {
  networking: ['No internet connection', 'WiFi very slow', 'Router lights are red', "Can't connect to WiFi"],
  computer: ['Computer is frozen', 'Very slow startup', 'Blue screen error', 'Won\'t turn on'],
  printer: ['Printer not detected', 'Paper jam', 'Printing blank pages', 'Printer offline'],
  mobile: ['Phone won\'t charge', 'App keeps crashing', 'Storage full', 'Screen not responding'],
  software: ['App won\'t open', 'Error message on screen', 'Update keeps failing', 'Program crashed'],
  display: ['No signal on screen', 'HDMI not working', 'Wrong resolution', 'Projector won\'t connect'],
  account: ['Forgot my password', 'Account locked out', 'Can\'t log in', 'Two-factor not working'],
  iot: ['Smart light not responding', 'Alexa / Google not working', 'Device offline', 'Won\'t connect to app'],
};

export default function ChatScreen({ navigation }) {
  const { createSession, refreshSession, getSession, activeSessionId, setActiveSessionId, serverOnline, checkServer } = useSession();

  const [sessionId, setSessionId] = useState(activeSessionId);
  const [messages, setMessages] = useState([]);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [showCategories, setShowCategories] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])).start();
    } else { pulseAnim.setValue(1); }
  }, [isLoading]);

  useEffect(() => {
    (async () => {
      const online = await checkServer();
      if (online) {
        let sid = activeSessionId;
        if (!sid) { sid = await createSession(); setSessionId(sid); }
        else {
          setSessionId(sid);
          const s = await refreshSession(sid);
          if (s) { setMessages(s.messages || []); setSessionMeta(s); setSelectedCategory(s.category || 'general'); }
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const s = getSession(sessionId);
    if (s) { setMessages(s.messages || []); setSessionMeta(s); }
  }, [sessionId, getSession]);

  const startNewSession = useCallback(async (category = 'general') => {
    const catLabel = CATEGORIES.find(c => c.id === category)?.label || 'Tech Issue';
    const sid = await createSession(catLabel, category);
    setSessionId(sid); setActiveSessionId(sid);
    setMessages([]); setSessionMeta(null);
    setPendingImage(null); setSelectedCategory(category);
    setShowCategories(false);
  }, [createSession, setActiveSessionId]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7 });
    if (!r.canceled) setPendingImage(r.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow camera access.'); return; }
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
    if (!r.canceled) setPendingImage(r.assets[0].uri);
  };

  const showImageOptions = () => Alert.alert('Add Device Photo', 'Helps AI identify the issue', [
    { text: 'Take Photo', onPress: takePhoto },
    { text: 'Choose from Library', onPress: pickImage },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text && !pendingImage) return;
    if (isLoading) return;
    const userText = text || 'I have attached an image of the device.';
    setInputText(''); setIsLoading(true);
    const optimistic = { id: `tmp-${Date.now()}`, role: 'user', content: userText, localImageUri: pendingImage, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    const imageToUpload = pendingImage;
    setPendingImage(null);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    try {
      if (imageToUpload && sessionId) await api.uploadImage(sessionId, imageToUpload, `device_${Date.now()}.jpg`);
      await api.sendChatMessage(sessionId, userText);
      const updated = await refreshSession(sessionId);
      if (updated) { setMessages(updated.messages || []); setSessionMeta(updated); }
    } catch (err) {
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: `⚠️ Error: ${err.message}\n\nMake sure the server is running and you're on the same WiFi.`, timestamp: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const currentCat = CATEGORIES.find(c => c.id === selectedCategory);
  const quickPrompts = QUICK_PROMPTS[selectedCategory] || [];

  const renderEmpty = () => (
    <View style={styles.empty}>
      {showCategories ? (
        <>
          <Text style={styles.emptyTitle}>What needs fixing?</Text>
          <Text style={styles.emptySub}>Pick a category to get started</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity key={cat.id} style={[styles.catCard, { borderColor: cat.color + '55' }]} onPress={() => startNewSession(cat.id)}>
                <View style={[styles.catIcon, { backgroundColor: cat.color + '22' }]}>
                  <Ionicons name={cat.icon} size={22} color={cat.color} />
                </View>
                <Text style={styles.catLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={styles.emptyLogo}>
            <Ionicons name="hardware-chip-outline" size={36} color={COLORS.accent} />
          </View>
          <Text style={styles.emptyTitle}>NeuralFix</Text>
          <Text style={styles.emptySub}>AI tech support for everyone.{'\n'}Describe your problem or pick a category.</Text>
          <TouchableOpacity style={styles.catPickerBtn} onPress={() => setShowCategories(true)}>
            <Ionicons name="grid-outline" size={16} color={COLORS.accent} />
            <Text style={styles.catPickerBtnText}>Browse Categories</Text>
          </TouchableOpacity>
          {quickPrompts.length > 0 && (
            <>
              <Text style={styles.quickLabel}>QUICK START</Text>
              <View style={styles.quickList}>
                {quickPrompts.map(p => (
                  <TouchableOpacity key={p} style={styles.quickChip} onPress={() => setInputText(p)}>
                    <Text style={styles.quickChipText}>{p}</Text>
                    <Ionicons name="arrow-forward" size={12} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Ionicons name="hardware-chip-outline" size={18} color={COLORS.accent} />
          </View>
          <View>
            <Text style={styles.headerTitle}>NeuralFix</Text>
            {currentCat && selectedCategory !== 'general'
              ? <Text style={[styles.headerSub, { color: currentCat.color }]}>{currentCat.label}</Text>
              : <Text style={styles.headerSub}>AI Tech Support</Text>
            }
          </View>
        </View>
        <View style={styles.headerRight}>
          {messages.length >= 2 && (
            <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('DiagnosticReport', { sessionId })}>
              <Ionicons name="document-text-outline" size={15} color={COLORS.accent} />
              <Text style={styles.reportBtnText}>Report</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.gridBtn} onPress={() => { setShowCategories(!showCategories); }}>
            <Ionicons name="grid-outline" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.newBtn} onPress={() => startNewSession(selectedCategory)}>
            <Ionicons name="add" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ServerBanner status={serverOnline} onRetry={checkServer} />

      {sessionMeta && messages.length > 0 && (() => {
        const lastMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.expert_used);
        const expert = lastMsg ? lastMsg.expert_used : sessionMeta.latest_expert || null;

        let expertLabel = null;
        let expertIcon = null;
        let expertColor = null;

        if (expert === 'vision') {
          expertLabel = 'Vision Expert';
          expertIcon = 'eye';
          expertColor = COLORS.warning;
        } else if (expert === 'rag') {
          expertLabel = 'Docs Expert';
          expertIcon = 'library';
          expertColor = COLORS.success;
        } else if (expert === 'general') {
          expertLabel = 'General Expert';
          expertIcon = 'hardware-chip-outline';
          expertColor = COLORS.accent;
        }

        return (
          <View style={styles.sessionStrip}>
            <StatusBadge status={sessionMeta.status} />
            <Text style={styles.sessionTitle} numberOfLines={1}>{sessionMeta.title}</Text>
            {expertLabel && (
              <View style={[styles.expertBadge, { borderColor: expertColor }]}>
                <Ionicons name={expertIcon} size={10} color={expertColor} />
                <Text style={[styles.expertBadgeText, { color: expertColor }]}>{expertLabel}</Text>
              </View>
            )}
            {sessionMeta.image_paths?.length > 0 && (
              <View style={styles.imgCount}>
                <Ionicons name="image-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.imgCountText}>{sessionMeta.image_paths.length}</Text>
              </View>
            )}
          </View>
        );
      })()}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => <MessageBubble message={item} />}
          keyExtractor={(item, i) => item.id || String(i)}
          contentContainerStyle={[styles.msgList, messages.length === 0 && { flex: 1 }]}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {isLoading && (
          <View style={styles.typing}>
            {[0, 1, 2].map(i => <Animated.View key={i} style={[styles.dot, { opacity: pulseAnim }]} />)}
            <Text style={styles.typingText}>NeuralFix is thinking...</Text>
          </View>
        )}

        {pendingImage && (
          <View style={styles.imgPreview}>
            <Image source={{ uri: pendingImage }} style={styles.previewImg} />
            <TouchableOpacity style={styles.removeImg} onPress={() => setPendingImage(null)}>
              <Ionicons name="close-circle" size={20} color={COLORS.error} />
            </TouchableOpacity>
            <Text style={styles.imgPreviewLabel}>Device photo ready to send</Text>
          </View>
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.mediaBtn} onPress={showImageOptions}>
            <Ionicons name="camera-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Describe your tech problem..."
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() && !pendingImage) && styles.sendBtnOff]}
            onPress={handleSend}
            disabled={!inputText.trim() && !pendingImage}
          >
            <Ionicons name="arrow-up" size={18} color={COLORS.textInverse} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  logo: { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: COLORS.accentMid, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, letterSpacing: 0.5 },
  headerSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.accentMid, backgroundColor: COLORS.accentDim },
  reportBtnText: { fontSize: FONTS.sizes.xs, color: COLORS.accent, fontWeight: FONTS.weights.semibold },
  gridBtn: { width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  newBtn: { width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  sessionStrip: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.base, paddingVertical: SPACING.xs, backgroundColor: COLORS.bg1, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sessionTitle: { flex: 1, fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  expertBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm, borderWidth: 1, backgroundColor: COLORS.bg2 },
  expertBadgeText: { fontSize: 10, fontWeight: FONTS.weights.bold, textTransform: 'uppercase' },
  imgCount: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  imgCountText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  msgList: { paddingHorizontal: SPACING.base, paddingVertical: SPACING.base, gap: SPACING.md },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xl },
  emptyLogo: { width: 72, height: 72, borderRadius: RADIUS.xl, backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: COLORS.accentMid, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.base },
  emptyTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptySub: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.lg },
  catPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.accentMid, backgroundColor: COLORS.accentDim, marginBottom: SPACING.lg },
  catPickerBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.accent, fontWeight: FONTS.weights.semibold },

  // Category grid
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, justifyContent: 'center', marginTop: SPACING.md },
  catCard: { width: '45%', backgroundColor: COLORS.bg2, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md, alignItems: 'center', gap: SPACING.sm },
  catIcon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: FONTS.weights.semibold, textAlign: 'center' },

  // Quick prompts
  quickLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, letterSpacing: 1, fontWeight: FONTS.weights.semibold, marginBottom: SPACING.sm, alignSelf: 'flex-start' },
  quickList: { width: '100%', gap: SPACING.sm },
  quickChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm, backgroundColor: COLORS.bg2, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  quickChipText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },

  // Typing
  typing: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  typingText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Image preview
  imgPreview: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.base, marginBottom: SPACING.sm, padding: SPACING.sm, backgroundColor: COLORS.bg2, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  previewImg: { width: 48, height: 48, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg3 },
  removeImg: { position: 'absolute', top: -6, left: 40 },
  imgPreviewLabel: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },

  // Input
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm, paddingBottom: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg0 },
  mediaBtn: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: FONTS.sizes.base, color: COLORS.textPrimary },
  sendBtn: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: COLORS.bg3 },
});
