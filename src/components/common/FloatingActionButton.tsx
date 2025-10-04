import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlynnIcon } from '../ui/FlynnIcon';
import { useTheme } from '../../context/ThemeContext';
import { shadows } from '../../theme';

interface FloatingActionButtonProps {
  onQuickAddJob: () => void;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onQuickAddJob,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.fabContainer}>
      <TouchableOpacity
        style={styles.fab}
        onPress={onQuickAddJob}
        activeOpacity={0.8}
      >
        <FlynnIcon name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
    elevation: 8,
  },
});
