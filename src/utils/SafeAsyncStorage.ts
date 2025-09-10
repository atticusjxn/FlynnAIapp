import AsyncStorage from '@react-native-async-storage/async-storage';

// Wrapper for AsyncStorage with error handling
export const SafeAsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      console.log(`[AsyncStorage] Getting item: ${key}`);
      const value = await AsyncStorage.getItem(key);
      console.log(`[AsyncStorage] Got ${key}:`, value ? 'value exists' : 'null');
      return value;
    } catch (error) {
      console.error(`[AsyncStorage] Error getting ${key}:`, error);
      return null;
    }
  },
  
  async setItem(key: string, value: string): Promise<void> {
    try {
      console.log(`[AsyncStorage] Setting item: ${key}`);
      await AsyncStorage.setItem(key, value);
      console.log(`[AsyncStorage] Successfully set ${key}`);
    } catch (error) {
      console.error(`[AsyncStorage] Error setting ${key}:`, error);
    }
  },
  
  async removeItem(key: string): Promise<void> {
    try {
      console.log(`[AsyncStorage] Removing item: ${key}`);
      await AsyncStorage.removeItem(key);
      console.log(`[AsyncStorage] Successfully removed ${key}`);
    } catch (error) {
      console.error(`[AsyncStorage] Error removing ${key}:`, error);
    }
  },
  
  async clear(): Promise<void> {
    try {
      console.log('[AsyncStorage] Clearing all items');
      await AsyncStorage.clear();
      console.log('[AsyncStorage] Successfully cleared all items');
    } catch (error) {
      console.error('[AsyncStorage] Error clearing:', error);
    }
  }
};