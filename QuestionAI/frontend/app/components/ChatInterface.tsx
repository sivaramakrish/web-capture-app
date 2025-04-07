import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../../app/(tabs)/index'; // Fix API_CONFIG import

const STORAGE_KEY = '@MathosAI/chat_history';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
};

type Tone = 'friendly' | 'formal' | 'technical' | 'creative';

// Encryption utilities
const encryptData = async (data: string): Promise<string> => {
  // In production, use react-native-quick-crypto or similar
  return btoa(encodeURIComponent(data));
};

const decryptData = async (data: string): Promise<string> => {
  try {
    return decodeURIComponent(atob(data));
  } catch {
    return data; // Fallback for unencrypted data
  }
};

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedTone, setSelectedTone] = useState<Tone>('friendly');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Enhanced connection test with retry
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    
    const testConnection = async () => {
      try {
        setTypingIndicator(true);
        const response = await fetch(`${API_CONFIG.baseUrl}/api/health`);
        
        if (response.ok) {
          const data = await response.json();
          setIsConnected(true);
          retryCount = 0;
        } else {
          throw new Error(`Backend returned ${response.status}`);
        }
      } catch (error) {
        console.error(`Connection attempt ${retryCount + 1}:`, error);
        setIsConnected(false);
        
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(testConnection, 2000 * retryCount); // Exponential backoff
          Alert.alert(
            'Connection Issue', 
            `Retrying connection (${retryCount}/${maxRetries})...`
          );
        } else {
          Alert.alert(
            'Connection Failed', 
            'Unable to connect to server. Please check your internet and try again later.'
          );
        }
      } finally {
        setTypingIndicator(false);
      }
    };
    
    testConnection();
    return () => clearTimeout(testConnection);
  }, []);

  // Encrypted message storage
  useEffect(() => {
    const saveMessages = async () => {
      try {
        const encrypted = await encryptData(JSON.stringify(messages));
        await AsyncStorage.setItem(STORAGE_KEY, encrypted);
      } catch (error) {
        Alert.alert(
          'Save Error',
          'Could not save chat history. Some features may not work properly.'
        );
      }
    };
    
    saveMessages();
  }, [messages]);

  // Enhanced message loading with decryption
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const decrypted = await decryptData(saved);
          setMessages(JSON.parse(decrypted));
        }
      } catch (error) {
        Alert.alert(
          'Load Error',
          'Could not load chat history. Starting fresh conversation.'
        );
      }
    };
    
    loadMessages();
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    
    setIsConnected(false); // Show connecting state
    setIsLoading(true);
    
    const userMessage = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user' as const,
      timestamp: new Date()
    };
  
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
  
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) throw new Error('No authentication token found');
  
      const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat}`, {
        method: 'POST',
        headers: {
          ...API_CONFIG.headers,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: inputText,
          tone: selectedTone,
          history: messages.slice(-5) // Send last 5 messages for context
        }),
        signal: AbortSignal.timeout(API_CONFIG.timeout)
      });
      
      setIsConnected(true); // Hide immediately on success
      
      if (!response.ok) throw new Error('API error');
      
      const data = await response.json();
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: data.response,
        sender: 'ai' as const,
        timestamp: new Date()
      }]);
      
    } catch (error) {
      setIsConnected(false);
      setTimeout(() => setIsConnected(true), 2000); // Auto-hide after 2s on error
      Alert.alert(
        'Error',
        'Failed to send message. Please try again later.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearChatHistory = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setMessages([]);
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to clear chat history.'
      );
    }
  };

  const handleQuickAction = (action: string) => {
    setInputText(`${action}: `);
  };

  const renderTypingIndicator = () => (
    typingIndicator && (
      <View style={styles.typingContainer}>
        <ActivityIndicator size="small" color="#888" />
        <Text style={styles.typingText}>Connecting to server...</Text>
      </View>
    )
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {(!isConnected) && (
        <View style={styles.connectionAlert}>
          <Text style={styles.connectionText}>Connecting to server...</Text>
        </View>
      )}
      {renderTypingIndicator()}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MathosAI</Text>
        <TouchableOpacity 
          style={styles.clearButton}
          onPress={clearChatHistory}
          disabled={messages.length === 0}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.messageBubble, 
            item.sender === 'user' ? styles.userBubble : styles.aiBubble
          ]}>
            <Text style={item.sender === 'user' ? styles.messageText : styles.aiMessageText}>{item.text}</Text>
          </View>
        )}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        contentContainerStyle={styles.messageList}
      />
      
      <View style={styles.quickActions}>
        {['Summarize', 'Explain', 'Translate'].map((action) => (
          <TouchableOpacity 
            key={action} 
            style={styles.actionButton}
            onPress={() => handleQuickAction(action)}
          >
            <Text style={styles.actionText}>{action}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask me anything..."
          multiline
          onSubmitEditing={sendMessage}
          editable={!isLoading}
        />
        <TouchableOpacity 
          style={[styles.sendButton, isLoading && styles.disabledButton]} 
          onPress={sendMessage}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  connectionAlert: {
    padding: 12,
    backgroundColor: '#f59e0b', // Amber instead of red
    alignItems: 'center',
    position: 'absolute',
    top: Platform.OS === 'ios' ? 90 : 60,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  connectionText: {
    color: 'white',
    fontSize: 14,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  typingText: {
    marginLeft: 8,
    color: '#888',
    fontStyle: 'italic',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  clearButton: {
    padding: 8,
    backgroundColor: '#ff4444',
    borderRadius: 8,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#7c3aed',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
  },
  messageText: {
    fontSize: 16,
    color: 'white',
  },
  aiMessageText: {
    fontSize: 16,
    color: '#1f2937',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
    backgroundColor: 'white',
  },
  actionButton: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
  },
  actionText: {
    color: '#7c3aed',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    fontSize: 16,
  },
  sendButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#007AFF',
  },
  disabledButton: {
    opacity: 0.7,
    backgroundColor: '#cccccc'
  },
  sendText: {
    color: 'white',
  },
});

export default ChatInterface;
