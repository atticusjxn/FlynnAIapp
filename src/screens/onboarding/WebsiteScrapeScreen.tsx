import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors, spacing, typography, shadows, borderRadius } from '../../theme';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { FlynnKeyboardAvoidingView } from '../../components/ui/FlynnKeyboardAvoidingView';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || 'https://flynnai-telephony.fly.dev';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 1;

interface Props {
  onNext: () => void;
  onBack: () => void;
}

interface ScrapeResult {
  businessName: string;
  services: string[];
  cached: boolean;
}

export const WebsiteScrapeScreen: React.FC<Props> = ({ onNext, onBack }) => {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(20)).current;

  const showResultCard = () => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(cardTranslateY, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  const handleScrape = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert('Enter a URL', 'Please enter your business website URL.');
      return;
    }
    setLoading(true);
    try {
      const accessToken = session?.access_token;
      const response = await fetch(`${API_BASE_URL}/api/scrape-website`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ url: trimmed, applyConfig: true }),
      });
      if (!response.ok) throw new Error('Scrape failed');
      const data = await response.json();
      const businessName =
        data.config?.businessProfile?.public_name ||
        data.scrapedData?.metadata?.siteName ||
        'Your Business';
      const services: string[] = Array.isArray(data.scrapedData?.services)
        ? data.scrapedData.services
        : [];
      setResult({ businessName, services, cached: !!data.cached });
      showResultCard();
    } catch {
      // On error, auto-advance
      onNext();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlynnKeyboardAvoidingView>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Progress */}
          <View style={styles.progressRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[styles.progressCapsule, i < CURRENT_STEP && styles.progressCapsuleFilled]}
              />
            ))}
          </View>

          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>Tell Flynn about your business</Text>
          <Text style={styles.subtitle}>
            We'll pull your services from your website so your receptionist sounds like you.
          </Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Website URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://yourbusiness.com"
              placeholderTextColor={colors.textPlaceholder}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleScrape}
              editable={!loading && !result}
            />
          </View>

          {!result && (
            <>
              <View style={{ marginBottom: spacing.sm }}>
                <FlynnButton
                  title={loading ? 'Scanning website…' : 'Continue'}
                  onPress={handleScrape}
                  variant="primary"
                  size="large"
                  fullWidth
                  disabled={loading}
                />
                {loading && (
                  <ActivityIndicator
                    color={colors.primary}
                    style={{ marginTop: spacing.sm }}
                  />
                )}
              </View>

              <TouchableOpacity onPress={onNext} style={styles.skipBtn}>
                <Text style={styles.skipText}>I don't have a website</Text>
              </TouchableOpacity>
            </>
          )}

          {result && (
            <Animated.View
              style={[
                styles.resultCard,
                { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] },
              ]}
            >
              <View style={styles.resultHeader}>
                <Text style={styles.resultBizName}>{result.businessName}</Text>
                {result.cached && (
                  <View style={styles.cachedBadge}>
                    <Text style={styles.cachedBadgeText}>cached</Text>
                  </View>
                )}
              </View>

              {result.services.length > 0 && (
                <View style={styles.chipsRow}>
                  {result.services.slice(0, 8).map((s, i) => (
                    <View key={i} style={styles.chip}>
                      <Text style={styles.chipText}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.resultActions}>
                <FlynnButton
                  title="Looks right — continue"
                  onPress={onNext}
                  variant="primary"
                  size="medium"
                  fullWidth
                />
                <TouchableOpacity
                  onPress={() => {
                    setResult(null);
                    cardOpacity.setValue(0);
                    cardTranslateY.setValue(20);
                  }}
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </FlynnKeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  progressRow: { flexDirection: 'row', gap: spacing.xxs, marginBottom: spacing.lg },
  progressCapsule: {
    flex: 1,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray200,
  },
  progressCapsuleFilled: { backgroundColor: colors.primary },
  backBtn: { minHeight: 44, justifyContent: 'center', marginBottom: spacing.md },
  backText: { ...typography.bodyMedium, color: colors.textSecondary },
  heading: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xxs },
  inputWrapper: { marginBottom: spacing.lg },
  input: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    minHeight: 44,
  },
  skipBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  skipText: { ...typography.bodyMedium, color: colors.primary },
  resultCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.md,
    marginTop: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  resultBizName: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  cachedBadge: {
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  cachedBadgeText: { ...typography.caption, color: colors.textSecondary },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  chipText: { ...typography.caption, color: colors.primary },
  resultActions: { gap: spacing.sm },
  editBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { ...typography.bodyMedium, color: colors.textSecondary },
});
