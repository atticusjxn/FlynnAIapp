import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { FlynnButton } from '../ui/FlynnButton';
import { Client } from '../../data/mockClients';

interface ClientDetailsModalProps {
  client: Client | null;
  visible: boolean;
  onClose: () => void;
  onScheduleJob: (client: Client) => void;
  onEditClient: (client: Client) => void;
  onSendText: (client: Client) => void;
  onSendEmail: (client: Client) => void;
}

const formatJobDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatCommunicationDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { 
    month: 'short',
    day: 'numeric'
  });
};

const getCommunicationIcon = (type: string) => {
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

const getCommunicationColor = (type: string) => {
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
  const [activeTab, setActiveTab] = useState<'jobs' | 'communication'>('jobs');

  if (!client) return null;

  const handleCall = () => {
    const phoneUrl = `tel:${client.phone}`;
    Linking.openURL(phoneUrl).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  };

  const handleEmail = () => {
    if (client.email) {
      onSendEmail(client);
    } else {
      Alert.alert('No Email', 'This client does not have an email address on file.');
    }
  };

  const totalRevenue = client.jobHistory.reduce((sum, job) => 
    sum + (job.amount || 0), 0
  );

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
            <Ionicons name="close" size={24} color={colors.gray600} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Client Information */}
          <View style={styles.section}>
            <View style={styles.clientHeader}>
              <View style={styles.clientMainInfo}>
                <Text style={styles.clientName}>{client.name}</Text>
                <Text style={styles.clientAddress}>{client.address}</Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => onEditClient(client)}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Contact Information */}
            <View style={styles.contactSection}>
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={20} color={colors.primary} />
                <TouchableOpacity onPress={handleCall} style={styles.contactInfo}>
                  <Text style={[styles.contactText, styles.phoneLink]}>{client.phone}</Text>
                  <Text style={styles.contactLabel}>
                    Preferred: {client.preferredContactMethod}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {client.email && (
                <View style={styles.contactRow}>
                  <Ionicons name="mail-outline" size={20} color={colors.primary} />
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactText}>{client.email}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Statistics */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{client.totalJobs}</Text>
                <Text style={styles.statLabel}>Total Jobs</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>${totalRevenue.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Revenue</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>
                  {Math.round((new Date().getTime() - new Date(client.createdAt).getTime()) / (1000 * 60 * 60 * 24))}d
                </Text>
                <Text style={styles.statLabel}>Client Since</Text>
              </View>
            </View>
          </View>

          {/* Notes */}
          {client.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notesText}>{client.notes}</Text>
            </View>
          )}

          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'jobs' && styles.activeTab]}
              onPress={() => setActiveTab('jobs')}
            >
              <Text style={[styles.tabText, activeTab === 'jobs' && styles.activeTabText]}>
                Job History
              </Text>
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

          {/* Job History */}
          {activeTab === 'jobs' && (
            <View style={styles.section}>
              {client.jobHistory.map((job) => (
                <View key={job.id} style={styles.jobItem}>
                  <View style={styles.jobHeader}>
                    <View style={styles.jobMainInfo}>
                      <Text style={styles.jobService}>{job.serviceType}</Text>
                      <Text style={styles.jobDescription}>{job.description}</Text>
                    </View>
                    <View style={styles.jobMeta}>
                      <Text style={styles.jobDate}>{formatJobDate(job.date)}</Text>
                      {job.amount && (
                        <Text style={styles.jobAmount}>${job.amount}</Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
              
              {client.jobHistory.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="briefcase-outline" size={48} color={colors.gray400} />
                  <Text style={styles.emptyTitle}>No Jobs Yet</Text>
                  <Text style={styles.emptyDescription}>
                    This client hasn't had any jobs completed yet.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Communication Log */}
          {activeTab === 'communication' && (
            <View style={styles.section}>
              {client.communicationLog.map((comm) => (
                <View key={comm.id} style={styles.commItem}>
                  <View style={[
                    styles.commIcon,
                    { backgroundColor: getCommunicationColor(comm.type) + '20' }
                  ]}>
                    <Ionicons 
                      name={getCommunicationIcon(comm.type) as any} 
                      size={16} 
                      color={getCommunicationColor(comm.type)} 
                    />
                  </View>
                  <View style={styles.commContent}>
                    <View style={styles.commHeader}>
                      <Text style={styles.commType}>
                        {comm.type.charAt(0).toUpperCase() + comm.type.slice(1)} • 
                        {comm.direction === 'outgoing' ? ' Sent' : ' Received'}
                      </Text>
                      <Text style={styles.commDate}>
                        {formatCommunicationDate(comm.date)}
                      </Text>
                    </View>
                    {comm.content && (
                      <Text style={styles.commText}>{comm.content}</Text>
                    )}
                  </View>
                </View>
              ))}
              
              {client.communicationLog.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={48} color={colors.gray400} />
                  <Text style={styles.emptyTitle}>No Communication</Text>
                  <Text style={styles.emptyDescription}>
                    No communication history with this client yet.
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {/* Primary Actions */}
          <FlynnButton
            title="Schedule New Job"
            onPress={() => onScheduleJob(client)}
            variant="primary"
            size="large"
            icon={<Ionicons name="calendar-outline" size={20} color={colors.white} />}
            style={styles.scheduleButton}
          />

          {/* Communication Actions */}
          <View style={styles.communicationActions}>
            <TouchableOpacity style={styles.commActionButton} onPress={handleCall}>
              <Ionicons name="call" size={20} color={colors.success} />
              <Text style={[styles.commActionText, { color: colors.success }]}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.commActionButton} 
              onPress={() => onSendText(client)}
            >
              <Ionicons name="chatbubble" size={20} color={colors.primary} />
              <Text style={[styles.commActionText, { color: colors.primary }]}>Text</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.commActionButton} 
              onPress={handleEmail}
              disabled={!client.email}
            >
              <Ionicons 
                name="mail" 
                size={20} 
                color={client.email ? colors.warning : colors.gray400} 
              />
              <Text style={[
                styles.commActionText, 
                { color: client.email ? colors.warning : colors.gray400 }
              ]}>
                Email
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
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
    backgroundColor: colors.white,
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
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray100,
  },
  
  contactSection: {
    marginBottom: spacing.md,
  },
  
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  
  contactInfo: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  
  contactText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  
  phoneLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  
  contactLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xxxs,
  },
  
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  
  statBox: {
    alignItems: 'center',
  },
  
  statNumber: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  
  statLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xxxs,
  },
  
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  
  notesText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.lg,
    padding: spacing.xxxs,
  },
  
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  
  activeTab: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  
  tabText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  
  jobItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  
  jobMainInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  
  jobService: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xxxs,
  },
  
  jobDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  
  jobMeta: {
    alignItems: 'flex-end',
  },
  
  jobDate: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xxxs,
  },
  
  jobAmount: {
    ...typography.bodyMedium,
    color: colors.success,
    fontWeight: '600',
  },
  
  commItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  
  commIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
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
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  
  commDate: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  
  commText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  
  emptyTitle: {
    ...typography.h4,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  
  emptyDescription: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  
  actionContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  
  scheduleButton: {
    marginBottom: spacing.md,
  },
  
  communicationActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  
  commActionButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray50,
    minWidth: 80,
  },
  
  commActionText: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
});