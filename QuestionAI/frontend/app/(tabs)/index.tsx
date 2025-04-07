import { Image, StyleSheet, Platform, View } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import ChatInterface from '../components/ChatInterface';

const API_CONFIG = {
  baseUrl: __DEV__ 
    ? "https://dummyjson.com"  // Free test API
    : "https://api.mathosai.com",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  endpoints: {
    chat: "/posts",  // Test endpoint
    health: "/products/1"  // Test endpoint
  }
};

export { API_CONFIG };

// Example API call
const fetchResponse = async (prompt: string) => {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}/api/chat`, {
      method: 'POST',
      headers: API_CONFIG.headers,
      body: JSON.stringify({ prompt })
    });
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

export default function HomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <ChatInterface />
    </View>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});