import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography, borderRadius } from '../../theme';
import { FlynnInput } from '../ui/FlynnInput';
import { FlynnButton } from '../ui/FlynnButton';
import { Client, ContactPreference } from '../../types/client';
import { businessTypes } from '../../context/OnboardingContext';

interface ClientFormModalProps {
  visible: boolean;
  onDismiss: () => void;
  initialClient: Client | null;
  onSubmit: (payload: { client: Partial<Client> & { name: string; id?: string } }) => void | Promise<void>;
  onDelete?: (client: Client) => void;
}

const contactOptions: ContactPreference[] = ['phone', 'text', 'email'];

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  visible,
  onDismiss,
  initialClient,
  onSubmit,
  onDelete,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [businessType, setBusinessType] = useState<string>('');
  const [preferredContact, setPreferredContact] = useState<ContactPreference>('phone');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (initialClient) {
      setName(initialClient.name || '');
      setPhone(initialClient.phone ?? '');
      setEmail(initialClient.email ?? '');
      setAddress(initialClient.address ?? '');
      setNotes(initialClient.notes ?? '');
      setBusinessType(initialClient.businessType ?? '');
      setPreferredContact(initialClient.preferredContactMethod ?? 'phone');
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
      setBusinessType('');
      setPreferredContact('phone');
    }
  }, [initialClient, visible]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Client name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        client: {
          id: initialClient?.id,
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          businessType: businessType || undefined,
          preferredContactMethod: preferredContact,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!initialClient || !onDelete) return;

    onDelete(initialClient);
  };

  return (
    <Modal
      presentationStyle="pageSheet"
      visible={visible}
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{initialClient ? 'Edit Client' : 'Add Client'}</Text>
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.gray600} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <FlynnInput
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Client name"
            required
            autoCapitalize="words"
          />

          <FlynnInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. +1 (555) 123-4567"
            keyboardType="phone-pad"
            autoCapitalize="none"
          />

          <FlynnInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="client@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FlynnInput
            label="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="Street, city, state"
          />

          <FlynnInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Preferences, reminders, context"
            multiline
            numberOfLines={4}
            inputStyle={{ minHeight: 120, textAlignVertical: 'top' }}
          />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Business Type</Text>
            <View style={styles.businessChips}>
              {businessTypes.map((type) => {
                const isActive = businessType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => setBusinessType(type.id)}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.chip, !businessType && styles.chipActive]}
                onPress={() => setBusinessType('')}
              >
                <Text style={[styles.chipText, !businessType && styles.chipTextActive]}>Unspecified</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Preferred Contact</Text>
            <View style={styles.contactChips}>
              {contactOptions.map((option) => {
                const isActive = preferredContact === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => setPreferredContact(option)}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {initialClient && onDelete ? (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Ionicons name="trash" size={18} color={colors.error} />
              <Text style={styles.deleteText}>Delete client</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.footerButtons}>
            <FlynnButton
              title="Cancel"
              variant="secondary"
              onPress={onDismiss}
              style={styles.footerButton}
            />
            <FlynnButton
              title={initialClient ? 'Save changes' : 'Add client'}
              variant="primary"
              onPress={handleSubmit}
              disabled={isSubmitting}
              loading={isSubmitting}
              style={styles.footerButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    closeButton: {
      padding: spacing.xs,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionLabel: {
      ...typography.bodyMedium,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    businessChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    contactChips: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.white,
      fontWeight: '600',
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing.md,
      backgroundColor: colors.surface,
    },
    footerButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    footerButton: {
      flex: 1,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    deleteText: {
      ...typography.bodySmall,
      color: colors.error,
      fontWeight: '600',
    },
  });
