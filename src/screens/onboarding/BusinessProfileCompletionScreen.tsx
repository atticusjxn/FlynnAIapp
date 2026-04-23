import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { FlynnKeyboardAvoidingView } from '../../components/ui/FlynnKeyboardAvoidingView';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || 'https://flynnai-telephony.fly.dev';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 3;

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export const BusinessProfileCompletionScreen: React.FC<Props> = ({ onNext, onBack }) => {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [serviceArea, setServiceArea] = useState('');
  const [callOutFee, setCallOutFee] = useState('');
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [afterHoursRate, setAfterHoursRate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    setSaving(true);
    try {
      const accessToken = session?.access_token;
      const body: Record<string, unknown> = {};
      if (serviceArea.trim()) body.service_area = serviceArea.trim();
      if (callOutFee.trim()) body.call_out_fee = callOutFee.trim();
      body.emergency_available = emergencyAvailable;
      if (emergencyAvailable && afterHoursRate.trim()) {
        body.after_hours_rate = afterHoursRate.trim();
      }

      await fetch(`${API_BASE_URL}/api/business-profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      // Non-blocking — advance anyway
    } finally {
      setSaving(false);
      onNext();
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

          <Text style={styles.heading}>A few more details</Text>
          <Text style={styles.subtitle}>
            These help Flynn answer questions about your business.
          </Text>

          {/* Service Area */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Service area</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Inner Sydney, Eastern Suburbs"
              placeholderTextColor={colors.textPlaceholder}
              value={serviceArea}
              onChangeText={setServiceArea}
              returnKeyType="next"
            />
          </View>

          {/* Call-out fee */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Call-out fee</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. $110"
              placeholderTextColor={colors.textPlaceholder}
              value={callOutFee}
              onChangeText={setCallOutFee}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>

          {/* Emergency toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <Text style={styles.label}>Emergency / after-hours available</Text>
              <Text style={styles.helperText}>Flynn will mention this to callers</Text>
            </View>
            <Switch
              value={emergencyAvailable}
              onValueChange={setEmergencyAvailable}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          {/* After-hours rate (conditional) */}
          {emergencyAvailable && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>After-hours rate</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. $180/hr"
                placeholderTextColor={colors.textPlaceholder}
                value={afterHoursRate}
                onChangeText={setAfterHoursRate}
                returnKeyType="done"
              />
            </View>
          )}

          {/* CTAs */}
          <View style={[styles.ctaGroup, { paddingBottom: insets.bottom }]}>
            <FlynnButton
              title={saving ? 'Saving…' : 'Continue'}
              onPress={handleContinue}
              variant="primary"
              size="large"
              fullWidth
              disabled={saving}
            />
            <TouchableOpacity onPress={onNext} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
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
  fieldGroup: { marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xxs },
  helperText: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  toggleLabel: { flex: 1, marginRight: spacing.md },
  ctaGroup: { gap: spacing.sm, marginTop: spacing.md },
  skipBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { ...typography.bodyMedium, color: colors.textSecondary },
});
