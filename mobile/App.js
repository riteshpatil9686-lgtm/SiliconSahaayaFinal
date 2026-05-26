import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Image, ScrollView, Alert, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';

// Set up Notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

// Theme Colors
const theme = {
  forest: '#1a4731',
  forestDark: '#0d2418',
  saffron: '#ff6b00',
  white: '#ffffff',
  gray: '#f5f5f5',
};

// --- SCREENS ---

const LoginScreen = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (phone.length !== 10) return Alert.alert('Error', 'Enter a valid 10-digit number');
    setLoading(true);
    try {
      // Simulate API call for now (can hook up to real API)
      await new Promise(res => setTimeout(res, 1000));
      setOtpSent(true);
      Alert.alert('Success', 'OTP sent to your phone. (Use 123456 for demo)');
    } catch (e) {
      Alert.alert('Error', 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 4) return Alert.alert('Error', 'Enter valid OTP');
    setLoading(true);
    try {
      await new Promise(res => setTimeout(res, 1000));
      // Simulate setting user token, move to Home
      navigation.replace('Home');
    } catch (e) {
      Alert.alert('Error', 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Silicon<Text style={{color: theme.saffron}}>Sahaaya</Text></Text>
        <Text style={styles.headerSub}>Civic Grievance Platform</Text>
      </View>

      <View style={styles.card}>
        {!otpSent ? (
          <>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="phone-pad" 
                maxLength={10} 
                value={phone} 
                onChangeText={setPhone} 
                placeholder="Enter mobile number" 
              />
            </View>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSendOTP} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Sending...' : 'Send OTP'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter OTP</Text>
            <TextInput 
              style={[styles.input, { textAlign: 'center', letterSpacing: 10, fontSize: 20 }]} 
              keyboardType="number-pad" 
              maxLength={6} 
              value={otp} 
              onChangeText={setOtp} 
              placeholder="------" 
            />
            <TouchableOpacity style={styles.btnPrimary} onPress={handleVerifyOTP} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Verify & Login'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const HomeScreen = ({ navigation }) => {
  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSub}>Welcome to SiliconSahaaya</Text>
      </View>

      <View style={{ padding: 20 }}>
        <TouchableOpacity style={styles.heroCard} onPress={() => navigation.navigate('Report')}>
          <Text style={styles.heroTitle}>Report an Issue</Text>
          <Text style={styles.heroSub}>See a pothole, garbage, or broken streetlight? Report it instantly.</Text>
          <View style={styles.heroBtn}>
            <Text style={styles.heroBtnText}>Submit Complaint →</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityCard}>
          <Text style={{ color: theme.forest, fontWeight: 'bold' }}>No recent complaints.</Text>
          <Text style={{ color: '#666', marginTop: 5 }}>Your submitted complaints will appear here.</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const ReportScreen = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const submitComplaint = async () => {
    if (!title || !description || !image || !location) {
      Alert.alert('Error', 'Please fill all details, take a photo, and wait for GPS.');
      return;
    }
    setSubmitting(true);
    try {
      // Simulate submission
      await new Promise(res => setTimeout(res, 2000));
      
      // Send local push notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Complaint Submitted! ✅",
          body: `Your complaint "${title}" has been received and sent for AI analysis.`,
        },
        trigger: null,
      });

      Alert.alert('Success', 'Complaint submitted successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={{ padding: 20 }}>
        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="E.g., Large pothole" />

        <Text style={styles.label}>Description</Text>
        <TextInput 
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
          value={description} 
          onChangeText={setDescription} 
          multiline 
          placeholder="Describe the issue..." 
        />

        <Text style={styles.label}>Location</Text>
        <View style={[styles.input, { justifyContent: 'center', backgroundColor: '#e9f5ef' }]}>
          <Text style={{ color: theme.forest }}>
            {location ? `GPS Acquired: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Fetching GPS location...'}
          </Text>
        </View>

        <Text style={styles.label}>Photo</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
          ) : (
            <Text style={{ color: theme.saffron, fontWeight: 'bold' }}>+ Take a Photo</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btnPrimary, { marginTop: 30 }]} onPress={submitComplaint} disabled={submitting}>
          <Text style={styles.btnText}>{submitting ? 'Submitting...' : 'Submit Complaint'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: theme.forestDark },
          headerTintColor: theme.saffron,
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Report" component={ReportScreen} options={{ title: 'Report Issue' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.gray,
  },
  header: {
    backgroundColor: theme.forestDark,
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.white,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginTop: 5,
  },
  card: {
    backgroundColor: theme.white,
    margin: 20,
    padding: 25,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginTop: -20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.forest,
    marginBottom: 8,
    marginTop: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  prefix: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    color: '#666',
    borderRightWidth: 1,
    borderColor: '#ddd',
    fontWeight: 'bold',
  },
  input: {
    flex: 1,
    padding: 12,
    backgroundColor: theme.white,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 16,
  },
  btnPrimary: {
    backgroundColor: theme.saffron,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  btnText: {
    color: theme.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  heroCard: {
    backgroundColor: theme.forest,
    padding: 20,
    borderRadius: 15,
    marginBottom: 25,
  },
  heroTitle: {
    color: theme.white,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 15,
    lineHeight: 20,
  },
  heroBtn: {
    backgroundColor: theme.saffron,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: theme.white,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.forest,
    marginBottom: 10,
  },
  activityCard: {
    backgroundColor: theme.white,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  imagePicker: {
    height: 150,
    backgroundColor: '#fff',
    borderColor: theme.saffron,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  }
});
