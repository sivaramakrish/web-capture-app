import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Colors } from '@/constants/Colors';

export default function SubscriptionSection() {
  const { colorScheme } = useColorScheme();
  const [isSubscribed, setIsSubscribed] = useState(false);

  return (
    <View style={{ marginBottom: 30 }}>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: 'bold',
        color: Colors[colorScheme ?? 'light'].text,
        marginBottom: 15
      }}>
        Subscription
      </Text>
      
      <Text style={{ 
        color: Colors[colorScheme ?? 'light'].text,
        marginBottom: 15
      }}>
        {isSubscribed ? 'Premium Member' : 'Free Plan'}
      </Text>
      
      <TouchableOpacity 
        style={{
          padding: 12,
          backgroundColor: Colors[colorScheme ?? 'light'].tint,
          borderRadius: 8,
          alignItems: 'center'
        }}
        onPress={() => setIsSubscribed(!isSubscribed)}
      >
        <Text style={{ color: 'white', fontWeight: '600' }}>
          {isSubscribed ? 'Manage Subscription' : 'Upgrade to Premium'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
