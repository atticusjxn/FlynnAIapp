import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { FlynnIcon } from '../ui/FlynnIcon';
import { spacing, typography, borderRadius, shadows } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { FlynnButton } from '../ui/FlynnButton';
import { ClientDetails, CommunicationEntry } from '../../types/client';
import { openPhoneDialer } from '../../utils/dialer';

interface ClientDetailsModalProps {
  client: ClientDetails | null;
  visible: boolean;
  onClose: () => void;
  onScheduleJob: (client: ClientDetails) => void;
  onEditClient: (client: ClientDetails) => void;
  onSendText: (client: ClientDetails) => void;
  onSendEmail: (client: ClientDetails) => void;
}

const formatJobDate = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatCommunicationDate = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const getCommunicationIcon = (type: CommunicationEntry['type']) => {
  switch (type) {
    case 'call':
      return 'call';
    case 'text':
      return 'chatbubble';
    case 'email':
      return 'mail';
    default:
      return 'ellipse';
  }
};

const getCommunicationColor = (type: CommunicationEntry['type'], colors: any) => {
  switch (type) {
    case 'call':
      return colors.success;
    case 'text':
      return colors.primary;
    case 'email':
      return colors.warning;
    default:
      return colors.gray500;
  }
};

export const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({
  client,
  visible,
  onClose,
  onScheduleJob,
  onEditClient,
  onSendText,
  onSendEmail,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [activeTab, setActiveTab] = useState<'jobs' | 'communication'>('jobs');

  if (!client) return null;

  const handleCall = () => {
    if (!client.phone) {
      Alert.alert('No phone number', 'Add a phone number for this client to call them.');
      return;
    }

    void openPhoneDialer(client.phone, 'client-details');
  };

  const handleEmail = () => {
    if (client.email) {
      onSendEmail(client);
    } else {
      Alert.alert('No Email', 'This client does not have an email address on file.');
    }
  };

  const totalRevenue = client.jobHistory?.reduce((sum, job) => sum + (job.amount || 0), 0) ?? 0;

  const clientSinceDays = client.createdAt
    ? Math.max(
        1,
        Math.round(
          (new Date().getTime() - new Date(client.createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.modalTitle}>Client Details</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FlynnIcon name="close" size={24} color={colors.gray600} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <View style={styles.clientHeader}>
              <View style={styles.clientMainInfo}>
                <Text style={styles.clientName}>{client.name}</Text>
                {client.address ? (
                  <Text style={styles.clientAddress}>{client.address}</Text>
                ) : null}
              </View>
              <TouchableOpacity style={styles.editButton} onPress={() => onEditClient(client)}>
                <FlynnIcon name="create-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.contactSection}>
              {client.phone ? (
                <View style={styles.contactRow}>
                  <FlynnIcon name="call-outline" size={20} color={colors.primary} />
                  <TouchableOpacity onPress={handleCall} style={styles.contactInfo}>
                    <Text style={[styles.contactText, styles.phoneLink]}>{client.phone}</Text>
                    {client.preferredContactMethod ? (
                      <Text style={styles.contactLabel}>
                        Preferred: {client.preferredContactMethod}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                </View>
              ) : null}

              {client.email ? (
                <View style={styles.contactRow}>
                  <FlynnIcon name="mail-outline" size={20} color={colors.primary} />
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactText}>{client.email}</Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>
                  {client.totalJobs ?? client.jobHistory?.length ?? 0}
                </Text>
                <Text style={styles.statLabel}>Total Jobs</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>${totalRevenue.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Revenue</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{clientSinceDays ? `${clientSinceDays}d` : '--'}</Text>
                <Text style={styles.statLabel}>Client Since</Text>
              </View>
            </View>
          </View>

          {client.notes ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notesText}>{client.notes}</Text>
            </View>
          ) : null}

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'jobs' && styles.activeTab]}
              onPress={() => setActiveTab('jobs')}
            >
              <Text style={[styles.tabText, activeTab === 'jobs' && styles.activeTabText]}>Job History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'communication' && styles.activeTab]}
              onPress={() => setActiveTab('communication')}
            >
              <Text style={[styles.tabText, activeTab === 'communication' && styles.activeTabText]}>
                Communication
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'jobs' ? (
            <View style={styles.section}>
              {client.jobHistory?.length ? (
                client.jobHistory.map((job) => (
                  <View key={job.id} style={styles.jobItem}>
                    <View style={styles.jobHeader}>
                      <View style={styles.jobMainInfo}>
                        <Text style={styles.jobService}>{job.serviceType || 'Service job'}</Text>
                        {job.description ? (
                          <Text style={styles.jobDescription}>{job.description}</Text>
                        ) : null}
                      </View>
                      <View style={styles.jobMeta}>
                        <Text style={styles.jobDate}>{formatJobDate(job.date)}</Text>
                        {job.amount !== undefined && job.amount !== null ? (
                          <Text style={styles.jobAmount}>${job.amount.toFixed(2)}</Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <FlynnIcon name="briefcase-outline" size={48} color={colors.gray400} />
                  <Text style={styles.emptyTitle}>No job history yet</Text>
                  <Text style={styles.emptyDescription}>
                    Jobs linked to this client will appear here once created.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              {client.communicationLog?.length ? (
                client.communicationLog.map((entry) => (
                  <View key={entry.id} style={styles.commItem}>
                    <View
                      style={[
                        styles.commIcon,
                        { backgroundColor: `${getCommunicationColor(entry.type, colors)}20` },
                      ]}
                    >
                      <FlynnIcon
                        name={getCommunicationIcon(entry.type) as any}
                        size={16}
                        color={getCommunicationColor(entry.type, colors)}
                      />
                    </View>
                    <View style={styles.commContent}>
                      <View style={styles.commHeader}>
                        <Text style={styles.commType}>
                          {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} •{' '}
                          {entry.direction === 'incoming' ? 'Received' : 'Sent'}
                        </Text>
                        <Text style={styles.commDate}>{formatCommunicationDate(entry.date)}</Text>
                      </View>
                      {entry.content ? <Text style={styles.commText}>{entry.content}</Text> : null}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <FlynnIcon name="chatbubbles-outline" size={48} color={colors.gray400} />
                  <Text style={styles.emptyTitle}>No communication yet</Text>
                  <Text style={styles.emptyDescription}>
                    Messages and calls linked to this client will appear here.
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.actionContainer}>
          <FlynnButton
            title="Schedule New Job"
            onPress={() => onScheduleJob(client)}
            variant="primary"
            size="large"
            icon={<FlynnIcon name="calendar-outline" size={20} color={colors.white} />}
            style={styles.scheduleButton}
          />

          <View style={styles.communicationActions}>
            <TouchableOpacity style={styles.commActionButton} onPress={handleCall}>
              <FlynnIcon name="call" size={20} color={colors.success} />
              <Text style={[styles.commActionText, { color: colors.success }]}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.commActionButton} onPress={() => onSendText(client)}>
              <FlynnIcon name="chatbubble" size={20} color={colors.primary} />
              <Text style={[styles.commActionText, { color: colors.primary }]}>Text</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.commActionButton}
              onPress={handleEmail}
              disabled={!client.email}
            >
              <FlynnIcon
                name="mail"
                size={20}
                color={client.email ? colors.warning : colors.gray400}
              />
              <Text
                style={[
                  styles.commActionText,
                  { color: client.email ? colors.warning : colors.gray400 },
                ]}
              >
                Email
              </Text>
            </TouchableOpacity>
          </View>
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
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
    paddingVertical: spacing.md,
  },
  section: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  clientMainInfo: {
    flex: 1,
  },
  clientName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  clientAddress: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  editButton: {
    padding: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    ...shadows.xs,
  },
  contactSection: {
    gap: spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contactInfo: {
    flex: 1,
  },
  contactText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  phoneLink: {
    textDecorationLine: 'underline',
  },
  contactLabel: {
    ...typography.caption,
    color: colors.gray500,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  notesText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tabText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  activeTabText: {
    color: colors.white,
    fontWeight: '600',
  },
  jobItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  jobMainInfo: {
    flex: 1,
  },
  jobService: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  jobDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  jobMeta: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  jobDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  jobAmount: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  commItem: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commContent: {
    flex: 1,
  },
  commHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  commType: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  commDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  commText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  emptyDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionContainer: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scheduleButton: {
    width: '100%',
  },
  communicationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  commActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    marginHorizontal: spacing.xs,
  },
  commActionText: {
    ...typography.bodyMedium,
  },
});
