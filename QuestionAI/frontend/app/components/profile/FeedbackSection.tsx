import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useState } from 'react';

export default function FeedbackSection() {
  const colorScheme = useColorScheme();
  const [feedback, setFeedback] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const submitFeedback = () => {
    if (feedback.trim()) {
      // TODO: Send feedback to backend
      setIsSubmitted(true);
      setFeedback('');
      setTimeout(() => setIsSubmitted(false), 3000);
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
        Send Feedback
      </Text>
      
      {isSubmitted ? (
        <Text style={{ color: Colors[colorScheme ?? 'light'].tint }}>
          Thank you for your feedback!
        </Text>
      ) : (
        <>
          <TextInput
            style={{
              minHeight: 100,
              borderWidth: 1,
              borderColor: Colors[colorScheme ?? 'light'].tabIconDefault,
              borderRadius: 8,
              padding: 12,
              marginBottom: 15,
              color: Colors[colorScheme ?? 'light'].text,
              textAlignVertical: 'top'
            }}
            multiline
            placeholder="Your feedback helps us improve"
            placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
            value={feedback}
            onChangeText={setFeedback}
          />
          
          <TouchableOpacity 
            style={{
              padding: 12,
              backgroundColor: Colors[colorScheme ?? 'light'].tint,
              borderRadius: 8,
              alignItems: 'center'
            }}
            onPress={submitFeedback}
            disabled={!feedback.trim()}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>
              Submit Feedback
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
