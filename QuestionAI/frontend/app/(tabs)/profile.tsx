import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Colors } from '@/constants/Colors';

import {
  AuthSection,
  HistorySection,
  BookmarkSection,
  SettingsSection,
  SubscriptionSection,
  FeedbackSection,
  ShareSection,
  RateSection,
  SupportSection
} from '@/app/components/profile';

type ColorScheme = 'light' | 'dark';

export default function ProfileScreen() {
  const { colorScheme } = useColorScheme();
  const currentScheme: ColorScheme = colorScheme === 'light' || colorScheme === 'dark' ? colorScheme : 'light';
  
  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <Text style={{ 
        fontSize: 24, 
        fontWeight: 'bold',
        color: Colors[currentScheme].text,
        marginBottom: 30
      }}>
        Mathos AI
      </Text>
      
      <Text style={{ 
        fontStyle: 'italic',
        marginBottom: 30,
        color: Colors[currentScheme].text
      }}>
        Mathos AI
      </Text>
      
      <AuthSection />
      <HistorySection />
      <BookmarkSection />
      <SettingsSection />
      <SubscriptionSection />
      <FeedbackSection />
      <ShareSection />
      <RateSection />
      <SupportSection />
    </ScrollView>
  );
}
