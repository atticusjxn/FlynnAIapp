import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { Client } from '../../data/mockClients';

interface ClientCardProps {
  client: Client;
  onPress: (client: Client) => void;
  onSendText: (client: Client) => void;
  onSendEmail: (client: Client) => void;
}

const formatLastJobDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays} days ago`;
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  if (diffDays <= 365) return `${Math.ceil(diffDays / 30)} months ago`;
  return `${Math.ceil(diffDays / 365)} years ago`;
};

const getBusinessTypeColor = (businessType: string) => {
  switch (businessType) {
    case 'home_property':
      return colors.primary;
    case 'personal_beauty':
      return colors.success;
    case 'automotive':
      return colors.warning;
    case 'business_professional':
      return colors.error;
    case 'moving_delivery':
      return colors.gray600;
    default:
      return colors.gray500;
  }
};

const getBusinessTypeIcon = (businessType: string) => {
  switch (businessType) {
    case 'home_property':
      return 'home-outline';
    case 'personal_beauty':
      return 'cut-outline';
    case 'automotive':
      return 'car-outline';
    case 'business_professional':
      return 'briefcase-outline';
    case 'moving_delivery':
      return 'cube-outline';
    default:
      return 'person-outline';
  }
};

export const ClientCard: React.FC<ClientCardProps> = ({
  client,
  onPress,
  onSendText,
  onSendEmail,
}) => {
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

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => onPress(client)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.clientInfo}>
          <View style={styles.nameRow}>
            <View style={[
              styles.businessIcon,
              { backgroundColor: getBusinessTypeColor(client.businessType) + '20' }
            ]}>
              <Ionicons 
                name={getBusinessTypeIcon(client.businessType) as any} 
                size={16} 
                color={getBusinessTypeColor(client.businessType)} 
              />
            </View>
            <Text style={styles.clientName}>{client.name}</Text>
          </View>
          <Text style={styles.contactInfo}>{client.phone}</Text>
          {client.email && (
            <Text style={styles.contactInfo}>{client.email}</Text>
          )}
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{client.totalJobs}</Text>
            <Text style={styles.statLabel}>Jobs</Text>
          </View>
        </View>
      </View>

      <View style={styles.lastJobSection}>
        <View style={styles.lastJobInfo}>
          <Text style={styles.lastJobLabel}>Last Job</Text>
          <Text style={styles.lastJobType}>{client.lastJobType}</Text>
          <Text style={styles.lastJobDate}>{formatLastJobDate(client.lastJobDate)}</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.callButton]}
          onPress={handleCall}
        >
          <Ionicons name="call" size={18} color={colors.white} />
          <Text style={[styles.actionText, styles.callText]}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.textButton]}
          onPress={() => onSendText(client)}
        >
          <Ionicons name="chatbubble" size={18} color={colors.white} />
          <Text style={[styles.actionText, styles.textText]}>Text</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.actionButton, 
            client.email ? styles.emailButton : styles.emailButtonDisabled
          ]}
          onPress={handleEmail}
          disabled={!client.email}
        >
          <Ionicons 
            name="mail" 
            size={18} 
            color={client.email ? colors.primary : colors.gray400} 
          />
          <Text style={[
            styles.actionText, 
            client.email ? styles.emailText : styles.emailTextDisabled
          ]}>
            Email
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  
  clientInfo: {
    flex: 1,
  },
  
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  
  businessIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  
  clientName: {
    ...typography.h4,
    color: colors.textPrimary,
    flex: 1,
  },
  
  contactInfo: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xxxs,
  },
  
  statsContainer: {
    alignItems: 'center',
  },
  
  stat: {
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
  },
  
  lastJobSection: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    marginBottom: spacing.md,
  },
  
  lastJobInfo: {
    flex: 1,
  },
  
  lastJobLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xxxs,
  },
  
  lastJobType: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xxxs,
  },
  
  lastJobDate: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  
  callButton: {
    backgroundColor: colors.success,
  },
  
  textButton: {
    backgroundColor: colors.primary,
  },
  
  emailButton: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  
  emailButtonDisabled: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  
  actionText: {
    ...typography.caption,
    fontWeight: '600',
  },
  
  callText: {
    color: colors.white,
  },
  
  textText: {
    color: colors.white,
  },
  
  emailText: {
    color: colors.primary,
  },
  
  emailTextDisabled: {
    color: colors.gray400,
  },
});