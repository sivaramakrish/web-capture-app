import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export default function RateSection() {
  const colorScheme = useColorScheme();

  const rateApp = () => {
    // This would open the app store
    Linking.openURL('https://apps.apple.com/app/idYOUR_APP_ID?action=write-review');
  };

  return (
    <View style={{ marginBottom: 30 }}>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: 'bold',
        color: Colors[colorScheme ?? 'light'].text,
        marginBottom: 15
      }}>
        Rate Us
      </Text>
      
      <Text style={{ 
        color: Colors[colorScheme ?? 'light'].text,
        marginBottom: 15
      }}>
        Enjoying Mathos AI? Please consider rating us!
      </Text>
      
      <TouchableOpacity 
        style={{
          padding: 12,
          backgroundColor: Colors[colorScheme ?? 'light'].tint,
          borderRadius: 8,
          alignItems: 'center'
        }}
        onPress={rateApp}
      >
        <Text style={{ color: 'white', fontWeight: '600' }}>
          Rate on App Store
        </Text>
      </TouchableOpacity>
    </View>
  );
}
