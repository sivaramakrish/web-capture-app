import { View, Text, Switch } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useState } from 'react';

export default function SettingsSection() {
  const colorScheme = useColorScheme();
  const [darkMode, setDarkMode] = useState(colorScheme === 'dark');
  const [notifications, setNotifications] = useState(true);

  const SettingItem = ({ label, value, onValueChange }: {
    label: string;
    value: boolean;
    onValueChange: (val: boolean) => void;
  }) => (
    <View style={{ 
      flexDirection: 'row', 
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12
    }}>
      <Text style={{ color: Colors[colorScheme ?? 'light'].text }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={Colors[colorScheme ?? 'light'].tint}
        trackColor={{ 
          true: Colors[colorScheme ?? 'light'].tint,
          false: Colors[colorScheme ?? 'light'].tabIconDefault
        }}
      />
    </View>
  );

  return (
    <View style={{ marginBottom: 30 }}>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: 'bold',
        color: Colors[colorScheme ?? 'light'].text,
        marginBottom: 15
      }}>
        App Settings
      </Text>
      
      <SettingItem 
        label="Dark Mode" 
        value={darkMode} 
        onValueChange={setDarkMode} 
      />
      <SettingItem 
        label="Notifications" 
        value={notifications} 
        onValueChange={setNotifications} 
      />
    </View>
  );
}
