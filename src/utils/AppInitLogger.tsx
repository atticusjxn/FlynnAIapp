import React, { useEffect } from 'react';

export const AppInitLogger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    console.log('===== FlynnAI App Initialization =====');
    console.log('App starting at:', new Date().toISOString());
    console.log('Environment:', __DEV__ ? 'Development' : 'Production');
    console.log('React Native version:', require('react-native/package.json').version);
    console.log('Expo SDK version:', require('expo/package.json').version);
    
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