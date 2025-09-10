import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeColors {
  // Brand Colors
  primary: string;
  primaryDark: string;
  primaryLight: string;
  
  // Neutral Colors
  secondary: string;
  gray50: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray700: string;
  gray800: string;
  gray900: string;
  
  // Semantic Colors
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  
  // UI Colors
  white: string;
  black: string;
  transparent: string;
  
  // Dynamic Colors (change with theme)
  background: string;
  surface: string;
  card: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
}

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const lightColors: ThemeColors = {
  // Brand Colors
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  primaryLight: '#DBEAFE',
  
  // Neutral Colors
  secondary: '#64748B',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',
  
  // Semantic Colors
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  
  // UI Colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  
  // Dynamic Colors
  background: '#F8FAFC',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
};

const darkColors: ThemeColors = {
  // Brand Colors (same as light)
  primary: '#3B82F6',
  primaryDark: '#1E40AF',
  primaryLight: '#1E3A8A',
  
  // Neutral Colors (inverted)
  secondary: '#94A3B8',
  gray50: '#0F172A',
  gray100: '#1E293B',
  gray200: '#334155',
  gray300: '#475569',
  gray400: '#64748B',
  gray500: '#94A3B8',
  gray600: '#CBD5E1',
  gray700: '#E2E8F0',
  gray800: '#F1F5F9',
  gray900: '#F8FAFC',
  
  // Semantic Colors (adjusted for dark)
  success: '#10B981',
  successLight: '#064E3B',
  warning: '#F59E0B',
  warningLight: '#451A03',
  error: '#EF4444',
  errorLight: '#450A0A',
  
  // UI Colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  
  // Dynamic Colors
  background: '#0F172A',
  surface: '#1E293B',
  card: '#334155',
  border: '#475569',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@flynn_ai_theme';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    loadThemeFromStorage();
  }, []);

  const loadThemeFromStorage = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme !== null) {
        setIsDark(JSON.parse(savedTheme));
      }
    } catch (error) {
      console.log('Error loading theme from storage:', error);
    }
  };

  const saveThemeToStorage = async (darkMode: boolean) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(darkMode));
    } catch (error) {
      console.log('Error saving theme to storage:', error);
    }
  };

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    saveThemeToStorage(newTheme);
  };

  const colors = isDark ? darkColors : lightColors;

  const value: ThemeContextType = {
    isDark,
    colors,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Export theme hook for backward compatibility
export const useColors = () => {
  const { colors } = useTheme();
  return colors;
};