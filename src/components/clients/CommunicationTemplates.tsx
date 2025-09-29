import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { FlynnButton } from '../ui/FlynnButton';
import { ClientDetails } from '../../types/client';

interface CommunicationTemplatesProps {
  visible: boolean;
  onClose: () => void;
  client: ClientDetails;
  type: 'text' | 'email';
  onSendTemplate: (template: string) => void;
}

const textTemplates = [
  {
    id: '1',
    title: 'Appointment Reminder',
    message: 'Hi {clientName}! This is a reminder that your appointment is scheduled for tomorrow at {time}. See you then!',
  },
  {
    id: '2',
    title: 'Job Completion',
    message: 'Hi {clientName}! Just finished your {serviceType}. Everything is working perfectly. Thank you for choosing our services!',
  },
  {
    id: '3',
    title: 'Follow-up Check',
    message: 'Hi {clientName}! Just wanted to check in and see how everything is working after your recent {serviceType}. Let us know if you need anything!',
  },
  {
    id: '4',
    title: 'Thank You',
    message: 'Thank you for choosing our services, {clientName}! We appreciate your business and look forward to working with you again.',
  },
  {
    id: '5',
    title: 'Maintenance Reminder',
    message: 'Hi {clientName}! It\'s time for your regular maintenance check. Would you like to schedule your next appointment?',
  },
];

const emailTemplates = [
  {
    id: '1',
    title: 'Service Quote',
    message: 'Dear {clientName},\n\nThank you for your interest in our services. Please find attached your detailed quote for {serviceType}.\n\nWe look forward to working with you!\n\nBest regards,\nYour Service Team',
  },
  {
    id: '2',
    title: 'Job Completion Report',
    message: 'Dear {clientName},\n\nWe have successfully completed your {serviceType}. Attached is a summary of the work performed and any recommendations for future maintenance.\n\nThank you for choosing our services!\n\nBest regards,\nYour Service Team',
  },
  {
    id: '3',
    title: 'Service Reminder',
    message: 'Dear {clientName},\n\nIt\'s time for your scheduled maintenance. Based on your service history, we recommend scheduling your next {serviceType} within the next few weeks.\n\nPlease let us know your preferred dates and times.\n\nBest regards,\nYour Service Team',
  },
  {
    id: '4',
    title: 'Welcome New Client',
    message: 'Dear {clientName},\n\nWelcome to our family of valued clients! We\'re excited to work with you and provide excellent service.\n\nIf you have any questions or concerns, please don\'t hesitate to reach out.\n\nBest regards,\nYour Service Team',
  },
];

export const CommunicationTemplates: React.FC<CommunicationTemplatesProps> = ({
  visible,
  onClose,
  client,
  type,
  onSendTemplate,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const templates = type === 'text' ? textTemplates : emailTemplates;

  const replaceVariables = (template: string) => {
    return template
      .replace(/{clientName}/g, client.name)
      .replace(/{serviceType}/g, client.lastJobType || 'your recent service')
      .replace(/{time}/g, '2:00 PM'); // Default time - could be dynamic
  };

  const handleSelectTemplate = (template: any) => {
    const personalizedMessage = replaceVariables(template.message);
    onSendTemplate(personalizedMessage);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {type === 'text' ? 'Text' : 'Email'} Templates
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.gray600} />
          </TouchableOpacity>
        </View>

        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>To: {client.name}</Text>
          <Text style={styles.clientContact}>
            {type === 'text'
              ? client.phone || 'No mobile number on file'
              : client.email || 'No email on file'}
          </Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={styles.templateCard}
              onPress={() => handleSelectTemplate(template)}
            >
              <View style={styles.templateHeader}>
                <Text style={styles.templateTitle}>{template.title}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
              </View>
              <Text style={styles.templatePreview}>
                {replaceVariables(template.message).substring(0, 120)}
                {template.message.length > 120 ? '...' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <FlynnButton
            title="Custom Message"
            onPress={() => {
              onSendTemplate('');
              onClose();
            }}
            variant="secondary"
            size="large"
            icon={<Ionicons name="create-outline" size={20} color={colors.primary} />}
          />
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
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

  clientInfo: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  clientName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },

  clientContact: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxxs,
  },

  content: {
    flex: 1,
    paddingVertical: spacing.md,
  },

  templateCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },

  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  templateTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },

  templatePreview: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  footer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
