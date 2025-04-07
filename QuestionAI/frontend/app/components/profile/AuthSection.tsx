import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { Colors } from '@/constants/Colors';

type ColorScheme = 'light' | 'dark';

export default function AuthSection() {
  const { colorScheme } = useNativeWindColorScheme();
  const currentScheme: ColorScheme = colorScheme === 'light' || colorScheme === 'dark' ? colorScheme : 'light';
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <View style={{ marginBottom: 30 }}>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: 'bold',
        color: Colors[currentScheme].text,
        marginBottom: 15
      }}>
        Account
      </Text>
      
      {isLoggedIn ? (
        <Text>Welcome back!</Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={{ 
            padding: 10,
            backgroundColor: Colors[currentScheme].tint,
            borderRadius: 8
          }}>
            <Text style={{ color: 'white' }}>Login</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={{ 
            padding: 10,
            borderWidth: 1,
            borderColor: Colors[currentScheme].tint,
            borderRadius: 8
          }}>
            <Text style={{ color: Colors[currentScheme].tint }}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
