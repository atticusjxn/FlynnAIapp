import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  console.log('[App] Simple test app rendering');
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Flynn AI - Test Build</Text>
      <Text style={styles.subtitle}>If you see this, the bundle is loading correctly!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    padding: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
  },
});