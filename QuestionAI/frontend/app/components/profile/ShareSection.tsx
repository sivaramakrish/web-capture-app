import { View, Text, TouchableOpacity, Share } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export default function ShareSection() {
  const colorScheme = useColorScheme();

  const onShare = async () => {
    try {
      await Share.share({
        message: 'Check out Mathos AI - Your intelligent math assistant!',
        url: 'https://mathos.ai',
        title: 'Mathos AI'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <View style={{ marginBottom: 30 }}>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: 'bold',
        color: Colors[colorScheme ?? 'light'].text,
        marginBottom: 15
      }}>
        Share the App
      </Text>
      
      <TouchableOpacity 
        style={{
          padding: 12,
          backgroundColor: Colors[colorScheme ?? 'light'].tint,
          borderRadius: 8,
          alignItems: 'center'
        }}
        onPress={onShare}
      >
        <Text style={{ color: 'white', fontWeight: '600' }}>
          Share with Friends
        </Text>
      </TouchableOpacity>
    </View>
  );
}
