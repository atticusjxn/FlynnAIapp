import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { FlynnIcon } from '../ui/FlynnIcon';
import { colors, spacing, typography } from '../../theme';
import { FilterType } from './JobFilterBar';

interface EmptyStateProps {
  filter: FilterType;
  onAddJob?: () => void;
}

const getEmptyStateContent = (filter: FilterType) => {
  switch (filter) {
    case 'today':
      return {
        icon: 'calendar-outline',
        title: 'No events today',
        subtitle: 'Your schedule is clear for today',
        actionText: 'Add an event for today',
      };
    case 'this-week':
      return {
        icon: 'calendar-outline',
        title: 'No events this week',
        subtitle: 'You have a light week ahead',
        actionText: 'Schedule an event',
      };
    case 'pending':
      return {
        icon: 'time-outline',
        title: 'No pending events',
        subtitle: 'All your events are either complete or in progress',
        actionText: 'Add a new event',
      };
    case 'complete':
      return {
        icon: 'checkmark-circle-outline',
        title: 'No completed events',
        subtitle: 'Completed events will appear here',
        actionText: 'View all events',
      };
    case 'all':
    default:
      return {
        icon: 'briefcase-outline',
        title: 'No events yet',
        subtitle: 'Create an event to track upcoming work and follow-ups',
        actionText: 'Create first event',
      };
  }
};

export const EmptyState: React.FC<EmptyStateProps> = ({ filter, onAddJob }) => {
  const content = getEmptyStateContent(filter);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <FlynnIcon 
          name={content.icon as any} 
          size={64} 
          color={colors.gray400} 
        />
      </View>
      
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.subtitle}>{content.subtitle}</Text>
      
      {onAddJob && (
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={onAddJob}
          activeOpacity={0.7}
        >
          <FlynnIcon 
            name="add-circle-outline" 
            size={20} 
            color={colors.primary} 
          />
          <Text style={styles.actionText}>{content.actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  
  actionText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
});
