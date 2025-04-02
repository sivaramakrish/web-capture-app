import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = "http://192.168.1.76:5001"; 
const REQUEST_TIMEOUT = 120000; // 120 seconds timeout
const MAX_RETRIES = 10;
const RETRY_DELAY = 3000; // 3 seconds initial delay

const fetchWithRetry = async (url, options = {}, retries = MAX_RETRIES) => {
  let lastError = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      
      const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };

      const fetchOptions = {
        ...options,
        signal: controller.signal,
        headers: {
          ...defaultHeaders,
          ...(options.headers || {})
        }
      };

      console.log('Fetching URL:', url);
      console.log('Fetch options:', JSON.stringify(fetchOptions, null, 2));
      
      const response = await fetch(url, fetchOptions);
      
      clearTimeout(timeoutId);
      
      if (!response) {
        throw new Error('No response received from server');
      }

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const responseText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${i + 1} failed:`, error);
      
      if (error.name === 'AbortError') {
        console.log('Request aborted due to timeout');
        break;
      }
      
      if (i === retries - 1) {
        console.log('All retry attempts exhausted');
        break;
      }
      
      // Exponential backoff with jitter
      const delay = RETRY_DELAY * Math.pow(2, i) + Math.random() * 2000;
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
};

const App = () => {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [recordingDuration, setRecordingDuration] = useState('5');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadUri, setDownloadUri] = useState(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [capturedFiles, setCapturedFiles] = useState([]);
  const [recordingStatus, setRecordingStatus] = useState(false);

  const isValidUrl = (url) => {
    try {
      // Add https:// if no protocol is specified
      const formattedUrl = url.startsWith('http://') || url.startsWith('https://') 
        ? url 
        : `https://${url}`;
      
      new URL(formattedUrl);
      return true;
    } catch (error) {
      return false;
    }
  };

  const formatUrl = (url) => {
    return url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : `https://${url}`;
  };

  const handleCaptureScreenshot = async () => {
    if (!isValidUrl(websiteUrl)) {
      Alert.alert('Invalid URL', 'Please enter a valid website URL');
      return;
    }

    setLoading(true);
    try {
      const formattedUrl = formatUrl(websiteUrl);
      console.log('Sending request to:', `${API_URL}/capture`);
      console.log('Request body:', JSON.stringify({ url: formattedUrl }));
      
      const response = await fetch(`${API_URL}/capture`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          url: formattedUrl
        }),
        mode: 'cors'
      });

      // Check if response exists and has headers
      if (!response) {
        throw new Error('No response received from server');
      }

      console.log('Response status:', response.status);
      
      // Safely access headers
      if (response.headers) {
        console.log('Response headers:', JSON.stringify(response.headers, null, 2));
      }
      
      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If we can't parse the error response, use the default message
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Response was not valid JSON:', responseText);
        throw new Error('Server returned invalid JSON response. Please check server configuration.');
      }

      if (!data || !data.base64) {
        throw new Error('No screenshot data received from server');
      }

      const fileName = `screenshot_${Date.now()}.jpg`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, data.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      setDownloadUri(filePath);
      setCapturedFiles(prev => [...prev, { 
        name: fileName, 
        path: filePath, 
        type: 'screenshot',
        timestamp: new Date().toLocaleString()
      }]);
      Alert.alert('Success', 'Screenshot captured successfully!');
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', error.message || 'An error occurred while capturing the screenshot. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Add a function to check recording status periodically
  const checkRecordingStatus = async () => {
    try {
      const response = await fetchWithRetry(`${API_URL}/recording-status`);
      const data = await response.json();
      setRecordingStatus(data.isRecording);
      
      if (!data.isRecording && isRecording) {
        setIsRecording(false);
        // If recording was stopped, try to get the recording
        await handleScreenRecording();
      }
    } catch (error) {
      console.error('Error checking recording status:', error);
      setRecordingStatus(false);
      setIsRecording(false);
    }
  };

  // Set up interval to check recording status
  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(checkRecordingStatus, 2000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording]);

  const handleScreenRecording = async () => {
    if (!isValidUrl(websiteUrl)) {
      Alert.alert('Invalid URL', 'Please enter a valid website URL');
      return;
    }

    if (isRecording) {
      try {
        setLoading(true);
        console.log('Stopping recording...');
        
        // First check if recording is actually in progress
        const statusResponse = await fetchWithRetry(`${API_URL}/recording-status`);
        const statusData = await statusResponse.json();
        
        if (!statusData.isRecording) {
          setIsRecording(false);
          Alert.alert('Info', 'No recording in progress');
          return;
        }

        const response = await fetchWithRetry(`${API_URL}/stop-recording`, {
          method: 'POST',
        });

        const data = await response.json();
        
        if (data.success) {
          setIsRecording(false);
          if (data.base64) {
            const fileName = `recording_${Date.now()}.mp4`;
            const filePath = `${FileSystem.documentDirectory}${fileName}`;
            
            await FileSystem.writeAsStringAsync(filePath, data.base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            setDownloadUri(filePath);
            setCapturedFiles(prev => [...prev, { 
              name: fileName, 
              path: filePath, 
              type: 'recording',
              timestamp: new Date().toLocaleString()
            }]);
            Alert.alert('Success', 'Screen recording completed!');
          } else {
            Alert.alert('Warning', 'Recording stopped but no data received');
          }
        } else {
          throw new Error(data.error || 'Failed to stop recording');
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        if (error.message === 'No recording in progress') {
          setIsRecording(false);
          Alert.alert('Info', 'No recording in progress');
        } else if (error.name === 'AbortError') {
          Alert.alert('Error', 'Request timed out. Please check your connection and try again.');
        } else {
          Alert.alert('Error', error.message || 'Failed to stop recording. Please check your connection and try again.');
        }
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const duration = parseInt(recordingDuration);
        if (isNaN(duration) || duration <= 0 || duration > 300) {
          Alert.alert('Invalid Duration', 'Please enter a valid duration between 1 and 300 seconds');
          return;
        }

        setLoading(true);
        console.log('Starting recording...');
        
        // First check if any recording is in progress
        const statusResponse = await fetchWithRetry(`${API_URL}/recording-status`);
        const statusData = await statusResponse.json();
        
        if (statusData.isRecording) {
          // If recording is in progress, try to stop it first
          try {
            await fetchWithRetry(`${API_URL}/stop-recording`, {
              method: 'POST',
            });
            // Wait for a moment after stopping
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Check status again
            const newStatusResponse = await fetchWithRetry(`${API_URL}/recording-status`);
            const newStatusData = await newStatusResponse.json();
            if (newStatusData.isRecording) {
              throw new Error('Another recording is already in progress');
            }
          } catch (error) {
            console.error('Error cleaning up previous recording:', error);
            throw new Error('Another recording is already in progress');
          }
        }

        const response = await fetchWithRetry(`${API_URL}/start-recording`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: websiteUrl,
            duration: duration
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          setIsRecording(true);
          setStartTime(Date.now());
          Alert.alert('Recording Started', `Recording for ${duration} seconds...`);
        } else {
          throw new Error(data.error || 'Failed to start recording');
        }
      } catch (error) {
        console.error('Error starting recording:', error);
        if (error.name === 'AbortError') {
          Alert.alert('Error', 'Request timed out. Please check your connection and try again.');
        } else {
          Alert.alert('Error', error.message || 'Failed to start recording. Please check your connection and try again.');
        }
        setIsRecording(false);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDownload = async (filePath) => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath);
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share the file');
    }
  };

  const handleDeleteFile = async (filePath) => {
    try {
      await FileSystem.deleteAsync(filePath);
      setCapturedFiles(prev => prev.filter(file => file.path !== filePath));
      if (downloadUri === filePath) {
        setDownloadUri(null);
      }
      Alert.alert('Success', 'File deleted successfully');
    } catch (error) {
      console.error('Error deleting file:', error);
      Alert.alert('Error', 'Failed to delete the file');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Web Capture</Text>
            <Text style={styles.subtitle}>Capture screenshots and record web pages</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Website URL</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter website URL (e.g., https://example.com)"
              placeholderTextColor="#999"
              value={websiteUrl}
              onChangeText={setWebsiteUrl}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.recordingSection}>
            <Text style={styles.label}>Recording Duration</Text>
            <Text style={styles.hintText}>Enter duration in seconds (1-300)</Text>
            <View style={styles.durationContainer}>
              <TextInput
                style={styles.durationInput}
                placeholder="e.g., 30"
                placeholderTextColor="#999"
                value={recordingDuration}
                onChangeText={(text) => {
                  const numericValue = text.replace(/[^0-9]/g, '');
                  if (numericValue === '' || parseInt(numericValue) <= 300) {
                    setRecordingDuration(numericValue);
                  }
                }}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.durationUnit}>seconds</Text>
            </View>
            <Text style={styles.durationNote}>Recommended: 30 seconds for best quality</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.captureButton, (loading || isRecording) && styles.buttonDisabled]} 
              onPress={handleCaptureScreenshot} 
              disabled={loading || isRecording}
            >
              <Text style={styles.buttonText}>
                {loading ? '📸 Capturing...' : '📸 Capture Screenshot'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.recordButton, isRecording && styles.recordingActive]} 
              onPress={handleScreenRecording}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {isRecording ? '⏹ Stop Recording' : '🎥 Start Recording'}
              </Text>
            </TouchableOpacity>
          </View>

          {capturedFiles.length > 0 && (
            <View style={styles.capturedFilesContainer}>
              <Text style={styles.capturedFilesTitle}>Captured Files</Text>
              {capturedFiles.map((file, index) => (
                <View key={index} style={styles.fileItem}>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName}>{file.name}</Text>
                    <Text style={styles.fileTimestamp}>{file.timestamp}</Text>
                  </View>
                  <View style={styles.fileActions}>
                    <TouchableOpacity 
                      style={styles.downloadButton} 
                      onPress={() => handleDownload(file.path)}
                    >
                      <Text style={styles.buttonText}>📤</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.deleteButton} 
                      onPress={() => handleDeleteFile(file.path)}
                    >
                      <Text style={styles.buttonText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  recordingSection: {
    marginBottom: 20,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 8,
  },
  durationInput: {
    flex: 1,
    padding: 15,
    color: '#fff',
    fontSize: 16,
  },
  durationUnit: {
    color: '#fff',
    opacity: 0.8,
    paddingRight: 15,
    fontSize: 16,
  },
  durationNote: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.6,
    marginBottom: 15,
    fontStyle: 'italic',
  },
  buttonContainer: {
    gap: 15,
  },
  captureButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recordButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recordingActive: {
    backgroundColor: '#2196F3',
  },
  downloadButton: {
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  capturedFilesContainer: {
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
  },
  capturedFilesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  fileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  fileTimestamp: {
    color: '#fff',
    opacity: 0.7,
    fontSize: 12,
  },
  fileActions: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteButton: {
    backgroundColor: '#ff4444',
    padding: 8,
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
 