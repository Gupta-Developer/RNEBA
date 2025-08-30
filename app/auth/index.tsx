import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, useColorScheme, Alert, SafeAreaView, Platform, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useAuth, signInWithEmailOtp, signInWithPassword, signUpWithPassword, signUpWithEmailLink } from '@/hooks/useAuth';

export default function AuthScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, loading, signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSendOtp = async () => {
    try {
      setSubmitting(true);
      await signInWithEmailOtp(email, 'earnbyapps://auth');
      Alert.alert('Check your email', 'We sent you a magic link to sign in.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const onSignInPassword = async () => {
    try {
      setSubmitting(true);
      await signInWithPassword(email, password);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onSignUpPassword = async () => {
    try {
      setSubmitting(true);
      await signUpWithPassword(email, password, 'earnbyapps://auth');
      Alert.alert('Verify your email', 'We sent you a confirmation link. After verifying, return to the app.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onSignUpLink = async () => {
    try {
      setSubmitting(true);
      await signUpWithEmailLink(email, 'earnbyapps://auth');
      Alert.alert('Check your email', 'We sent you a sign-up link to create your account.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send sign-up link');
    } finally {
      setSubmitting(false);
    }
  };

  // Immediately redirect to profile; keep as a safe fallback
  useEffect(() => {
    router.replace('/(tabs)/profile');
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: '#0B0F14' }]}> 
      <View style={[styles.container, isDark && { backgroundColor: '#0B0F14' }]}> 
        <Text style={[styles.title, isDark && { color: '#E5E7EB' }]}>Authentication</Text>

        {user ? (
          <View style={{ gap: 8 }}>
            <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>Signed in as</Text>
            <Text style={[styles.value, isDark && { color: '#E5E7EB' }]}>{user.email}</Text>
            <TouchableOpacity disabled={submitting} onPress={signOut} style={[styles.btn, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.btnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />

            <TextInput
              autoCapitalize="none"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Password (optional)"
              placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />

            <TouchableOpacity disabled={submitting} onPress={onSendOtp} style={[styles.btn, { backgroundColor: '#2563EB' }]}>
              <Text style={styles.btnText}>Send Magic Link (Sign In)</Text>
            </TouchableOpacity>

            <TouchableOpacity disabled={submitting} onPress={onSignInPassword} style={[styles.btn, { backgroundColor: '#10B981' }]}>
              <Text style={styles.btnText}>Sign In with Password</Text>
            </TouchableOpacity>

            <View style={{ height: 8 }} />
            <Text style={[styles.label, isDark && { color: '#9CA3AF' }]}>New user?</Text>

            <TouchableOpacity disabled={submitting} onPress={onSignUpPassword} style={[styles.btn, { backgroundColor: '#4F46E5' }]}>
              <Text style={styles.btnText}>Create Account (Password)</Text>
            </TouchableOpacity>

            <TouchableOpacity disabled={submitting} onPress={onSignUpLink} style={[styles.btn, { backgroundColor: '#F59E0B' }]}>
              <Text style={styles.btnText}>Sign Up via Email Link</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    paddingTop: Platform.select({
      ios: 0,
      android: StatusBar.currentHeight ?? 0,
      web: 'env(safe-area-inset-top)' as any,
      default: 0,
    }) as any,
    backgroundColor: '#FFF',
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
  },
  label: { fontWeight: '800', color: '#374151' },
  value: { fontWeight: '900', fontSize: 16, color: '#111827' },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
  },
  inputLight: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  inputDark: { backgroundColor: '#111827', borderColor: '#374151', color: '#E5E7EB' },
  btn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#FFFFFF', fontWeight: '900' },
});
