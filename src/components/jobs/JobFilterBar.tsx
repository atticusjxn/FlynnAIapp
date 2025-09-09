import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Job } from './JobCard';

export type FilterType = 'all' | 'today' | 'this-week' | 'pending' | 'complete';

interface Filter {
  id: FilterType;
  label: string;
  count: number;
}

interface JobFilterBarProps {
  jobs: Job[];
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

const isToday = (dateString: string): boolean => {
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const isThisWeek = (dateString: string): boolean => {
  const date = new Date(dateString);
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  return date >= startOfWeek && date <= endOfWeek;
};

const calculateJobCounts = (jobs: Job[]): Record<FilterType, number> => {
  return {
    all: jobs.length,
    today: jobs.filter(job => isToday(job.date)).length,
    'this-week': jobs.filter(job => isThisWeek(job.date)).length,
    pending: jobs.filter(job => job.status === 'pending').length,
    complete: jobs.filter(job => job.status === 'complete').length,
  };
};

export const JobFilterBar: React.FC<JobFilterBarProps> = ({
  jobs,
  activeFilter,
  onFilterChange,
}) => {
  const jobCounts = calculateJobCounts(jobs);
  
  const filters: Filter[] = [
    { id: 'all', label: 'All', count: jobCounts.all },
    { id: 'today', label: 'Today', count: jobCounts.today },
    { id: 'this-week', label: 'This Week', count: jobCounts['this-week'] },
    { id: 'pending', label: 'Pending', count: jobCounts.pending },
    { id: 'complete', label: 'Complete', count: jobCounts.complete },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterButton,
              activeFilter === filter.id && styles.activeFilterButton,
            ]}
            onPress={() => onFilterChange(filter.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === filter.id && styles.activeFilterText,
              ]}
            >
              {filter.label}
            </Text>
            {filter.count > 0 && (
              <View
                style={[
                  styles.countBadge,
                  activeFilter === filter.id && styles.activeCountBadge,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    activeFilter === filter.id && styles.activeCountText,
                  ]}
                >
                  {filter.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingVertical: spacing.sm,
  },
  
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  
  activeFilterButton: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  
  filterText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  
  activeFilterText: {
    color: colors.primary,
    fontWeight: '600',
  },
  
  countBadge: {
    backgroundColor: colors.gray300,
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.xxs,
  },
  
  activeCountBadge: {
    backgroundColor: colors.primary,
  },
  
  countText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
    fontSize: 11,
  },
  
  activeCountText: {
    color: colors.white,
  },
});