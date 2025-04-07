import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export default function HistorySection() {
  const colorScheme = useColorScheme();
  
  const clearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to delete all chat history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            // Implement clear logic
          }
        }
      ]
    );
  };

  return (
    <View style={{ marginBottom: 30 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
        <Text style={{ 
          fontSize: 18, 
          fontWeight: 'bold',
          color: Colors[colorScheme ?? 'light'].text
        }}>
          Chat History
        </Text>
        
        <TouchableOpacity onPress={clearHistory}>
          <Text style={{ color: Colors[colorScheme ?? 'light'].tint }}>Clear All</Text>
        </TouchableOpacity>
      </View>
      
      {/* History list will go here */}
      <Text style={{ color: Colors[colorScheme ?? 'light'].tabIconDefault }}>
        Your chat history will appear here
      </Text>
    </View>
  );
}
