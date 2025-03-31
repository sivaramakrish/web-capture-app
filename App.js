import React, { useState } from 'react';
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

const SERVER_URL = 'http://192.168.1.76:5001';

const App = () => {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [recordingDuration, setRecordingDuration] = useState('30');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadUri, setDownloadUri] = useState(null);

  const isValidUrl = (url) => {
    const regex = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,6}(\/.*)?$/;
    return regex.test(url);
  };

  const handleCaptureScreenshot = async () => {
    if (!isValidUrl(websiteUrl)) {
      Alert.alert('Invalid URL', 'Please enter a valid website URL');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: websiteUrl,
          block_ads: true,
          block_cookie_banners: true,
          block_banners_by_heuristics: false,
          block_trackers: true,
          delay: 0,
          timeout: 60,
          response_type: "by_format",
          image_quality: 80
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.base64) {
        const fileName = `screenshot_${Date.now()}.jpg`;
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(filePath, data.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        setDownloadUri(filePath);
        Alert.alert('Success', 'Screenshot captured successfully! Click the share button to save.');
      } else {
        Alert.alert('Error', 'Failed to capture screenshot. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'An error occurred while capturing the screenshot. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScreenRecording = async () => {
    if (!isValidUrl(websiteUrl)) {
      Alert.alert('Invalid URL', 'Please enter a valid website URL');
      return;
    }

    if (isRecording) {
      try {
        const response = await fetch(`${SERVER_URL}/stop-recording`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
          setIsRecording(false);
          const fileName = `recording_${Date.now()}.mp4`;
          const filePath = `${FileSystem.documentDirectory}${fileName}`;
          
          await FileSystem.writeAsStringAsync(filePath, data.base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          setDownloadUri(filePath);
          Alert.alert('Success', 'Screen recording completed! Click the share button to save.');
        } else {
          Alert.alert('Error', 'Failed to stop recording');
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        Alert.alert('Error', 'Failed to stop recording. Please check your connection and try again.');
      }
    } else {
      try {
        const duration = parseInt(recordingDuration);
        if (isNaN(duration) || duration <= 0 || duration > 300) {
          Alert.alert('Invalid Duration', 'Please enter a valid duration between 1 and 300 seconds');
          return;
        }

        const response = await fetch(`${SERVER_URL}/start-recording`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: websiteUrl,
            duration: duration,
            block_ads: true,
            block_cookie_banners: true,
            block_banners_by_heuristics: false,
            block_trackers: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
          setIsRecording(true);
          Alert.alert('Recording Started', `Recording for ${duration} seconds...`);
        } else {
          Alert.alert('Error', 'Failed to start recording');
        }
      } catch (error) {
        console.error('Error starting recording:', error);
        Alert.alert('Error', 'Failed to start recording. Please check your connection and try again.');
      }
    }
  };

  const handleDownload = async () => {
    if (downloadUri) {
      try {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadUri);
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      } catch (error) {
        console.error('Error sharing:', error);
        Alert.alert('Error', 'Failed to share the file');
      }
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

            {downloadUri && (
              <TouchableOpacity 
                style={styles.downloadButton} 
                onPress={handleDownload}
              >
                <Text style={styles.buttonText}>📤 Share File</Text>
              </TouchableOpacity>
            )}
          </View>
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
});

export default App;