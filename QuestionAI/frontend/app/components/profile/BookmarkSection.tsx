import { View, Text } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export default function BookmarkSection() {
  const colorScheme = useColorScheme();

  return (
    <View style={{ marginBottom: 30 }}>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: 'bold',
        color: Colors[colorScheme ?? 'light'].text,
        marginBottom: 15
      }}>
        Saved Bookmarks
      </Text>
      
      <Text style={{ color: Colors[colorScheme ?? 'light'].tabIconDefault }}>
        Your saved bookmarks will appear here
      </Text>
    </View>
  );
}
