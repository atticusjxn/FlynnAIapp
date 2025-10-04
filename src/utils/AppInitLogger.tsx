import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const AppInitLogger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    console.log('===== FlynnAI App Initialization =====');
    console.log('App starting at:', new Date().toISOString());
    console.log('Environment:', __DEV__ ? 'Development' : 'Production');
    const rnVersionParts = Platform.constants?.reactNativeVersion;
    const rnVersion = rnVersionParts
      ? [rnVersionParts.major, rnVersionParts.minor, rnVersionParts.patch]
          .filter((part) => part !== undefined)
          .join('.')
      : String(Platform.Version);
    console.log('React Native version:', rnVersion);
    console.log('Expo SDK version:', Constants.expoVersion ?? 'unknown');
    
    // Log any initial errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      console.log('[CRITICAL ERROR]', ...args);
      originalConsoleError.apply(console, args);
    };
    
    // Log navigation state changes for debugging
    console.log('App initialization complete');
    console.log('=====================================');
    
    return () => {
      console.error = originalConsoleError;
    };
  }, []);
  
  return <>{children}</>;
};
