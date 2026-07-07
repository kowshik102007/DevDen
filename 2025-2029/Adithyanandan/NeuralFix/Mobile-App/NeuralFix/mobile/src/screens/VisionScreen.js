import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, Image,
    StyleSheet, Alert, ActivityIndicator, TextInput,
    KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SPACING, RADIUS } from '../utils/theme';
import { ENDPOINTS } from '../utils/config';

// ── LED dot
function LEDDot({ color }) {
    const map = { green: '#22C55E', red: '#EF4444', amber: '#F59E0B', off: '#334155', blinking: '#818CF8' };
    const c = map[color] ?? '#334155';
    return <View style={[styles.ledDot, { backgroundColor: c, shadowColor: c }]} />;
}

// ── Confidence bar
function ConfBar({ value }) {
    const pct = Math.round((value ?? 0) * 100);
    const color = pct > 70 ? '#22C55E' : pct > 40 ? '#F59E0B' : '#EF4444';
    return (
        <View style={styles.confWrap}>
            <Text style={styles.confLabel}>Confidence <Text style={{ color }}>{pct}%</Text></Text>
            <View style={styles.confTrack}>
                <View style={[styles.confFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
}

// ── Results card
function ResultCard({ data }) {
    if (!data) return null;
    return (
        <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
                <View>
                    <Text style={styles.resultTag}>ANALYSIS COMPLETE</Text>
                    <Text style={styles.resultTitle}>Equipment Diagnostics</Text>
                </View>
                <ConfBar value={data.confidence} />
            </View>

            {data.error && (
                <View style={styles.warnBanner}>
                    <Ionicons name="warning-outline" size={14} color={COLORS.warning} />
                    <Text style={styles.warnText}>Raw output shown — JSON parse failed</Text>
                </View>
            )}

            {/* Device + Brand */}
            <View style={styles.row2}>
                <View style={styles.infoCard}>
                    <Text style={styles.infoIcon}>🖥️</Text>
                    <Text style={styles.infoLabel}>DEVICE TYPE</Text>
                    <Text style={styles.infoValue}>{data.device_type ?? '—'}</Text>
                </View>
                <View style={styles.infoCard}>
                    <Text style={styles.infoIcon}>🏷️</Text>
                    <Text style={styles.infoLabel}>BRAND / MODEL</Text>
                    <Text style={styles.infoValue}>{data.brand_model ?? 'Unknown'}</Text>
                </View>
            </View>

            {/* Overall assessment */}
            {data.overall_assessment && (
                <View style={styles.assessCard}>
                    <Text style={styles.sectionLabel}>🔍 OVERALL ASSESSMENT</Text>
                    <Text style={styles.assessText}>{data.overall_assessment}</Text>
                </View>
            )}

            {/* LED states */}
            {data.led_states?.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>LED STATES</Text>
                    {data.led_states.map((led, i) => (
                        <View key={i} style={styles.ledRow}>
                            <LEDDot color={led.color} />
                            <Text style={styles.ledLabel}>{led.label}</Text>
                            <Text style={styles.ledColor}>{led.color}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Unplugged ports */}
            {data.unplugged_ports?.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>UNPLUGGED PORTS</Text>
                    <View style={styles.tagRow}>
                        {data.unplugged_ports.map((p, i) => (
                            <View key={i} style={styles.tagRed}><Text style={styles.tagText}>{p}</Text></View>
                        ))}
                    </View>
                </View>
            )}

            {/* Visible damage */}
            {data.visible_damage && (
                <View style={styles.damageCard}>
                    <Text style={styles.sectionLabel}>⚠️ VISIBLE DAMAGE</Text>
                    <Text style={styles.assessText}>{data.visible_damage}</Text>
                </View>
            )}

            {/* Fix summary */}
            {data.detailed_fix_summary && (
                <View style={styles.fixCard}>
                    <Text style={styles.sectionLabel}>🛠️ HOW TO FIX THIS</Text>
                    <Text style={styles.fixText}>{data.detailed_fix_summary}</Text>
                </View>
            )}
        </View>
    );
}

// ── Main Screen
export default function VisionScreen() {
    const [imageUri, setImageUri] = useState(null);
    const [analysing, setAnalysing] = useState(false);
    const [result, setResult] = useState(null);
    const [stage, setStage] = useState('');
    const [chatMessages, setChatMessages] = useState([
        { role: 'assistant', content: '👋 Hi! Upload a photo of your router, switch, or modem and I\'ll analyse it and help you fix any issues. You can also ask me general networking questions!' }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const flatRef = useRef(null);

    useEffect(() => {
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }, [chatMessages]);

    // Update greeting when result arrives
    useEffect(() => {
        if (result && !result.error && chatMessages.length === 1) {
            setChatMessages([{ role: 'assistant', content: 'Equipment analysed! Ask me anything about the hardware, LED states, or how to fix the issues found.' }]);
        }
    }, [result]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access.'); return; }
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
        if (!r.canceled) { setImageUri(r.assets[0].uri); setResult(null); }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Allow camera access.'); return; }
        const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
        if (!r.canceled) { setImageUri(r.assets[0].uri); setResult(null); }
    };

    const showImageOptions = () => Alert.alert('Add Equipment Photo', 'Choose how to provide the image', [
        { text: '📷 Take Photo', onPress: takePhoto },
        { text: '🖼️ Choose from Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
    ]);

    const analyse = async () => {
        if (!imageUri) return;
        setAnalysing(true);
        setResult(null);

        const stages = [
            '🦙 Scanning with LLaVA...',
            '📡 Detecting LEDs & ports...',
            '⚡ Generating fix guide...',
            '✅ Wrapping up...',
        ];
        let si = 0;
        setStage(stages[0]);
        const timer = setInterval(() => { si = (si + 1) % stages.length; setStage(stages[si]); }, 2200);

        try {
            const form = new FormData();
            form.append('file', { uri: imageUri, name: 'equipment.jpg', type: 'image/jpeg' });
            const res = await fetch(ENDPOINTS.visionAnalyse, { method: 'POST', body: form });
            clearInterval(timer);
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const json = await res.json();
            setResult(json);
        } catch (e) {
            clearInterval(timer);
            Alert.alert('Analysis Failed', e.message);
        } finally {
            setAnalysing(false);
            setStage('');
        }
    };

    const sendChat = async () => {
        const text = chatInput.trim();
        if (!text || chatLoading) return;
        const userMsg = { role: 'user', content: text };
        const next = [...chatMessages, userMsg];
        setChatMessages(next);
        setChatInput('');
        setChatLoading(true);
        try {
            const res = await fetch(ENDPOINTS.visionChat, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: next.map(m => ({ role: m.role, content: m.content })),
                    vision_context: result ?? {}
                })
            });
            if (!res.ok) throw new Error('API error');
            const data = await res.json();
            setChatMessages([...next, { role: 'assistant', content: data.reply }]);
        } catch {
            setChatMessages([...next, { role: 'assistant', content: '⚠️ Something went wrong. Check the server is running.' }]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logo}>
                    <Ionicons name="scan-outline" size={18} color={COLORS.accent} />
                </View>
                <View>
                    <Text style={styles.headerTitle}>Vision Agent</Text>
                    <Text style={styles.headerSub}>AI Equipment Diagnostics</Text>
                </View>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                    {/* Upload Zone */}
                    <TouchableOpacity style={[styles.uploadZone, imageUri && styles.uploadZoneActive]} onPress={showImageOptions} activeOpacity={0.8}>
                        {imageUri ? (
                            <View style={styles.previewWrap}>
                                <Image source={{ uri: imageUri }} style={styles.previewImg} />
                                <TouchableOpacity style={styles.changeBtn} onPress={showImageOptions}>
                                    <Ionicons name="refresh-outline" size={14} color={COLORS.accent} />
                                    <Text style={styles.changeBtnText}>Change</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.uploadPlaceholder}>
                                <View style={styles.uploadIcon}>
                                    <Ionicons name="camera-outline" size={32} color={COLORS.accent} />
                                </View>
                                <Text style={styles.uploadTitle}>Drop your equipment photo</Text>
                                <Text style={styles.uploadSub}>Tap to take or pick a photo{'\n'}Routers · Switches · Modems</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Analyse Button */}
                    <TouchableOpacity
                        style={[styles.analyseBtn, (!imageUri || analysing) && styles.analyseBtnOff]}
                        onPress={analyse}
                        disabled={!imageUri || analysing}
                    >
                        {analysing ? (
                            <View style={styles.btnRow}>
                                <ActivityIndicator size="small" color={COLORS.textInverse} />
                                <Text style={styles.analyseBtnText}>{stage}</Text>
                            </View>
                        ) : (
                            <View style={styles.btnRow}>
                                <Ionicons name="search-outline" size={18} color={imageUri ? COLORS.textInverse : COLORS.textMuted} />
                                <Text style={[styles.analyseBtnText, !imageUri && { color: COLORS.textMuted }]}>Analyse Equipment</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Results */}
                    <ResultCard data={result} />

                    {/* Chatbot */}
                    <View style={styles.chatCard}>
                        <View style={styles.chatHeader}>
                            <View style={styles.chatAvatar}>
                                <Ionicons name="hardware-chip-outline" size={16} color={COLORS.accent} />
                            </View>
                            <View>
                                <Text style={styles.chatTitle}>Technical Assistant</Text>
                                <Text style={styles.chatSub}>Powered by Llama 3.1 · Groq</Text>
                            </View>
                            <View style={styles.onlineDot} />
                        </View>

                        <FlatList
                            ref={flatRef}
                            data={chatMessages}
                            keyExtractor={(_, i) => String(i)}
                            scrollEnabled={false}
                            renderItem={({ item }) => (
                                <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
                                    <Text style={[styles.bubbleText, item.role === 'user' && styles.bubbleTextUser]}>
                                        {item.content}
                                    </Text>
                                </View>
                            )}
                            ListFooterComponent={chatLoading ? (
                                <View style={[styles.bubble, styles.bubbleAI]}>
                                    <ActivityIndicator size="small" color={COLORS.accent} />
                                </View>
                            ) : null}
                        />

                        <View style={styles.chatInputRow}>
                            <TextInput
                                style={styles.chatInput}
                                placeholder="Ask about your equipment..."
                                placeholderTextColor={COLORS.textMuted}
                                value={chatInput}
                                onChangeText={setChatInput}
                                multiline
                                editable={!chatLoading}
                                onSubmitEditing={sendChat}
                            />
                            <TouchableOpacity
                                style={[styles.chatSendBtn, (!chatInput.trim() || chatLoading) && styles.chatSendBtnOff]}
                                onPress={sendChat}
                                disabled={!chatInput.trim() || chatLoading}
                            >
                                <Ionicons name="arrow-up" size={16} color={COLORS.textInverse} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ height: 32 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg0 },
    header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    logo: { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: COLORS.accentMid, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
    headerSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },

    scroll: { padding: SPACING.base, gap: SPACING.base },

    // Upload
    uploadZone: { borderWidth: 1.5, borderColor: COLORS.accentMid, borderStyle: 'dashed', borderRadius: RADIUS.lg, backgroundColor: COLORS.accentDim, minHeight: 160, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    uploadZoneActive: { borderStyle: 'solid', borderColor: COLORS.accent },
    uploadPlaceholder: { alignItems: 'center', padding: SPACING.lg, gap: SPACING.sm },
    uploadIcon: { width: 64, height: 64, borderRadius: RADIUS.xl, backgroundColor: COLORS.bg3, alignItems: 'center', justifyContent: 'center' },
    uploadTitle: { fontSize: FONTS.sizes.base, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
    uploadSub: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
    previewWrap: { width: '100%', position: 'relative' },
    previewImg: { width: '100%', height: 200, resizeMode: 'cover' },
    changeBtn: { position: 'absolute', top: SPACING.sm, right: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, backgroundColor: COLORS.bg1 + 'DD', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.accentMid },
    changeBtnText: { fontSize: FONTS.sizes.xs, color: COLORS.accent, fontWeight: FONTS.weights.semibold },

    // Button
    analyseBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
    analyseBtnOff: { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.border },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    analyseBtnText: { fontSize: FONTS.sizes.base, fontWeight: FONTS.weights.bold, color: COLORS.textInverse },

    // Result card
    resultCard: { backgroundColor: COLORS.bg1, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.base, gap: SPACING.base },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    resultTag: { fontSize: FONTS.sizes.xs, color: COLORS.accent, fontWeight: FONTS.weights.semibold, letterSpacing: 1 },
    resultTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
    warnBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.warning + '22', borderRadius: RADIUS.sm, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.warning + '55' },
    warnText: { fontSize: FONTS.sizes.xs, color: COLORS.warning },
    row2: { flexDirection: 'row', gap: SPACING.sm },
    infoCard: { flex: 1, backgroundColor: COLORS.bg2, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: 2 },
    infoIcon: { fontSize: 20 },
    infoLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, letterSpacing: 0.5 },
    infoValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, textTransform: 'capitalize' },
    assessCard: { backgroundColor: COLORS.bg2, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.xs },
    assessText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20 },
    section: { gap: SPACING.sm },
    sectionLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: FONTS.weights.semibold, letterSpacing: 0.8 },
    ledRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 4 },
    ledDot: { width: 12, height: 12, borderRadius: 6, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
    ledLabel: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
    ledColor: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textTransform: 'capitalize' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
    tagRed: { backgroundColor: '#EF444422', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: '#EF4444aa', paddingHorizontal: SPACING.sm, paddingVertical: 3 },
    tagText: { fontSize: FONTS.sizes.xs, color: '#EF4444', fontWeight: FONTS.weights.semibold },
    damageCard: { backgroundColor: '#EF444411', borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#EF444455', padding: SPACING.md, gap: SPACING.xs },
    fixCard: { backgroundColor: COLORS.bg2, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.accentMid, padding: SPACING.md, gap: SPACING.xs },
    fixText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 22 },
    confWrap: { alignItems: 'flex-end', gap: 4, minWidth: 100 },
    confLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
    confTrack: { width: 100, height: 4, backgroundColor: COLORS.bg3, borderRadius: 2, overflow: 'hidden' },
    confFill: { height: '100%', borderRadius: 2 },

    // Chat card
    chatCard: { backgroundColor: COLORS.bg1, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
    chatHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.base, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    chatAvatar: { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: COLORS.accentMid, alignItems: 'center', justifyContent: 'center' },
    chatTitle: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
    chatSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.online, marginLeft: 'auto' },
    bubble: { maxWidth: '85%', borderRadius: RADIUS.lg, padding: SPACING.sm, marginHorizontal: SPACING.base, marginVertical: 3 },
    bubbleAI: { backgroundColor: COLORS.bg2, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
    bubbleUser: { backgroundColor: COLORS.accent, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
    bubbleText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20 },
    bubbleTextUser: { color: COLORS.textInverse },
    chatInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, padding: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
    chatInput: { flex: 1, minHeight: 36, maxHeight: 100, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 8, fontSize: FONTS.sizes.sm, color: COLORS.textPrimary },
    chatSendBtn: { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
    chatSendBtnOff: { backgroundColor: COLORS.bg3 },
});
