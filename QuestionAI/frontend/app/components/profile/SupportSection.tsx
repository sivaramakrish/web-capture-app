import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export default function SupportSection() {
  const colorScheme = useColorScheme();

  const supportOptions = [
    { title: 'Buy Me a Coffee', url: 'https://buymeacoffee.com' },
    { title: 'GitHub Sponsors', url: 'https://github.com/sponsors' },
    { title: 'Patreon', url: 'https://patreon.com' }
  ];

  return (
    <View style={{ marginBottom: 30 }}>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: 'bold',
        color: Colors[colorScheme ?? 'light'].text,
        marginBottom: 15
      }}>
        Support Our Work
      </Text>
      
      <Text style={{ 
        color: Colors[colorScheme ?? 'light'].text,
        marginBottom: 15
      }}>
        Help us continue developing Mathos AI
      </Text>
      
      <View style={{ gap: 10 }}>
        {supportOptions.map((option, index) => (
          <TouchableOpacity 
            key={index}
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: Colors[colorScheme ?? 'light'].tint,
              borderRadius: 8,
              alignItems: 'center'
            }}
            onPress={() => Linking.openURL(option.url)}
          >
            <Text style={{ 
              color: Colors[colorScheme ?? 'light'].tint,
              fontWeight: '600' 
            }}>
              {option.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
