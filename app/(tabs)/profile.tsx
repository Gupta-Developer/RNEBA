import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
  Image,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useAuth, signInWithPassword, signUpWithPassword, signInWithGoogle } from '@/hooks/useAuth';
import { getProfile, upsertProfile } from '@/lib/profile';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string>('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Clear fields when switching mode
  useEffect(() => {
    setAuthError('');
    setPassword('');
  }, [mode]);

  // Load profile when user logs in
  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!user) {
        setName('');
        setPhone('');
        setUpiId('');
        return;
      }
      setProfileMsg('');
      setProfileLoading(true);
      try {
        const p = await getProfile(user.id);
        if (!isMounted) return;
        const full = p?.full_name || '';
        const ph = p?.phone || '';
        const upi = p?.upi_id || '';
        setName(full);
        setPhone(ph);
        setUpiId(upi);
        // Always start in read-only mode; user must tap Edit to modify
        setIsEditing(false);
      } catch (e: any) {
        if (!isMounted) return;
        setProfileMsg(e?.message ?? 'Failed to load profile');
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [user]);

  const emailError = useMemo(() => {
    if (!email) return '';
    const ok = /.+@.+\..+/.test(email);
    return ok ? '' : 'Enter a valid email address';
  }, [email]);

  const passwordError = useMemo(() => {
    if (!password) return '';
    return password.length >= 6 ? '' : 'Password must be at least 6 characters';
  }, [password]);

  const onContinue = async () => {
    setAuthError('');
    if (emailError || passwordError || !email || !password) return;
    setSubmitting(true);
    try {
      if (mode === 'signUp') {
        await signUpWithPassword(email, password);
      } else {
        await signInWithPassword(email, password);
      }
      setEmail('');
      setPassword('');
      // Do not navigate away; user must complete profile first
    } catch (e: any) {
      setAuthError(e?.message ?? 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    setAuthError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      // Stay on Profile to complete details
    } catch (e: any) {
      setAuthError(e?.message ?? 'Failed to sign in with Google');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, isDark && { backgroundColor: '#0B0F14' }]}
    >
      <ScrollView
        contentContainerStyle={[styles.container]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header / Logo */}
        <View style={styles.logoRow}>
          <Text style={styles.logoText}>EarnByApps</Text>
          <MaterialIcons name="north-east" size={18} color="#FF7A00" style={{ marginTop: 2 }} />
        </View>
        {/* Auth Card */}
        <View style={[styles.card, isDark ? { backgroundColor: '#1E293B', shadowOpacity: 0 } : null]}>
          {user ? (
            <>
              <View style={styles.profileHeader}>
                <Text style={[styles.profileHeaderName, isDark && { color: '#E5E7EB' }]}>Welcome</Text>
                <Text style={[styles.profileHeaderEmail, isDark && { color: '#9CA3AF' }]}>
                  {user.email}
                </Text>
              </View>

              {/* Email (non-editable) */}
              <Text style={[styles.inputLabel, { marginTop: 12 }, isDark && { color: '#E5E7EB' }]}>Email Address</Text>
              <View style={[styles.inputRow, isDark ? styles.inputDark : styles.inputLight, !isEditing && styles.inputDisabled]}>
                <MaterialIcons name="email" size={18} color={isDark ? '#D1D5DB' : '#6B7280'} style={styles.inputIcon} />
                <TextInput
                  value={user.email ?? ''}
                  editable={false}
                  selectTextOnFocus={false}
                  placeholder="you@example.com"
                  placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
                  style={[styles.inputFlex, { color: isDark ? '#E5E7EB' : '#111827' }]}
                />
              </View>

              {/* Full Name */}
              <Text style={[styles.inputLabel, { marginTop: 12 }, isDark && { color: '#E5E7EB' }]}>Full Name</Text>
              <View style={[styles.inputRow, isDark ? styles.inputDark : styles.inputLight, !isEditing && styles.inputDisabled]}>
                <MaterialIcons name="person" size={18} color={isDark ? '#D1D5DB' : '#6B7280'} style={styles.inputIcon} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  editable={isEditing}
                  placeholder="Full name"
                  placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
                  style={[styles.inputFlex, { color: isDark ? '#E5E7EB' : '#111827' }]}
                />
              </View>

              {/* Phone */}
              <Text style={[styles.inputLabel, { marginTop: 12 }, isDark && { color: '#E5E7EB' }]}>Phone Number</Text>
              <View style={[styles.inputRow, isDark ? styles.inputDark : styles.inputLight, !isEditing && styles.inputDisabled]}>
                <MaterialIcons name="phone" size={18} color={isDark ? '#D1D5DB' : '#6B7280'} style={styles.inputIcon} />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  editable={isEditing}
                  placeholder="e.g., +91 9876543210"
                  keyboardType="phone-pad"
                  placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
                  style={[styles.inputFlex, { color: isDark ? '#E5E7EB' : '#111827' }]}
                />
              </View>

              {/* UPI */}
              <Text style={[styles.inputLabel, { marginTop: 12 }, isDark && { color: '#E5E7EB' }]}>UPI ID</Text>
              <View style={[styles.inputRow, isDark ? styles.inputDark : styles.inputLight, !isEditing && styles.inputDisabled]}>
                <MaterialIcons name="account-balance-wallet" size={18} color={isDark ? '#D1D5DB' : '#6B7280'} style={styles.inputIcon} />
                <TextInput
                  value={upiId}
                  onChangeText={setUpiId}
                  editable={isEditing}
                  placeholder="e.g., username@upi"
                  autoCapitalize="none"
                  placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
                  style={[styles.inputFlex, { color: isDark ? '#E5E7EB' : '#111827' }]}
                />
              </View>

              {!!profileMsg && (
                <Text style={[styles.errorText]}>{profileMsg}</Text>
              )}

              {/* Primary CTA: Save or Edit */}
              <TouchableOpacity
                onPress={async () => {
                  if (!user) return;
                  if (!isEditing) {
                    // Switch to edit mode
                    setIsEditing(true);
                    return;
                  }
                  // Save flow
                  const full = name.trim();
                  const ph = phone.trim();
                  const upi = upiId.trim();
                  const phoneOk = /^\+?\d{10,15}$/.test(ph.replace(/\s|-/g, ''));
                  const upiOk = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z.]{2,}$/.test(upi);
                  if (!full || !ph || !upi) {
                    setProfileMsg('Please fill all fields');
                    return;
                  }
                  if (!phoneOk) {
                    setProfileMsg('Enter a valid mobile number');
                    return;
                  }
                  if (!upiOk) {
                    setProfileMsg('Enter a valid UPI ID (e.g., username@upi)');
                    return;
                  }
                  setProfileMsg('');
                  setProfileLoading(true);
                  try {
                    await upsertProfile({ id: user.id, full_name: full, phone: ph, upi_id: upi });
                    // Lock fields after save
                    setIsEditing(false);
                  } catch (e: any) {
                    setProfileMsg(e?.message ?? 'Failed to save');
                  } finally {
                    setProfileLoading(false);
                  }
                }}
                style={[styles.primaryBtn, { backgroundColor: isDark ? '#4338CA' : '#2563EB', marginTop: 14 }]}
                disabled={profileLoading}
              >
                <Text style={styles.primaryBtnText}>{isEditing ? (profileLoading ? 'Saving…' : 'Save Profile') : 'Edit Profile'}</Text>
              </TouchableOpacity>

              {/* Logout button (always visible when logged in) */}
              <TouchableOpacity
                onPress={async () => {
                  await signOut();
                  router.replace('/');
                }}
                style={[styles.primaryBtn, { backgroundColor: '#EF4444', marginTop: 14 }]}
              >
                <Text style={styles.primaryBtnText}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Toggle */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 12 }}>
                <TouchableOpacity onPress={() => setMode('signIn')} style={{ padding: 8, marginRight: 8 }}>
                  <Text style={{ fontWeight: '900', color: mode === 'signIn' ? (isDark ? '#FFFFFF' : '#111827') : '#9CA3AF' }}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('signUp')} style={{ padding: 8, marginLeft: 8 }}>
                  <Text style={{ fontWeight: '900', color: mode === 'signUp' ? (isDark ? '#FFFFFF' : '#111827') : '#9CA3AF' }}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {/* Email */}
              <Text style={[styles.inputLabel, isDark && { color: '#E5E7EB' }]}>Email Address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[
                  styles.input,
                  isDark ? styles.inputDark : styles.inputLight,
                  emailError && styles.inputError,
                ]}
              />
              {!!emailError && <Text style={[styles.errorText]}>{emailError}</Text>}

              {/* Password */}
              <Text style={[styles.inputLabel, { marginTop: 12 }, isDark && { color: '#E5E7EB' }]}>Password</Text>
              <View style={[
                styles.passwordRow,
                isDark ? styles.inputDark : styles.inputLight,
                passwordError && styles.inputError,
              ]}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
                  placeholderTextColor={isDark ? '#9CA3AF' : '#9AA0A6'}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  selectionColor={isDark ? '#93C5FD' : '#2563EB'}
                />
                <TouchableOpacity onPress={() => setShowPassword((s) => !s)}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={22}
                    color={isDark ? '#D1D5DB' : '#555'}
                  />
                </TouchableOpacity>
              </View>
              {!!passwordError && <Text style={[styles.errorText]}>{passwordError}</Text>}

              {!!authError && <Text style={[styles.errorText]}>{authError}</Text>}

              <TouchableOpacity
                onPress={onContinue}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: isDark ? '#4338CA' : '#2563EB' },
                  submitting && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.primaryBtnText}>{submitting ? 'Please wait…' : mode === 'signUp' ? 'Sign Up' : 'Sign In'}</Text>
              </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={[styles.dividerText, isDark && { color: '#9CA3AF' }]}>OR</Text>
            <View style={styles.divider} />
          </View>

          {/* Google Button */}
          <TouchableOpacity style={[styles.googleBtn, isDark && { backgroundColor: '#FFFFFF' }]} activeOpacity={0.85} onPress={onGoogle}>
            <AntDesign name="google" size={18} color="#202124" style={{ marginRight: 8 }} />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>
            {/* Footer small link */}
            <Text style={[styles.footerText, isDark && { color: '#9CA3AF' }]}> 
              {mode === 'signIn' ? (
                <>Don’t have an account? <Text style={[styles.footerLink]} onPress={() => setMode('signUp')}>Switch to Sign Up</Text></>
              ) : (
                <>Already have an account? <Text style={[styles.footerLink]} onPress={() => setMode('signIn')}>Switch to Sign In</Text></>
              )}
            </Text>
            </>
          )}
        </View>

        {/* Removed extra sub-cards to restore original single-card layout */}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  container: {
    flexGrow: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 28, fontWeight: '900', color: '#2563EB' },
  profileHeaderName: { fontSize: 18, fontWeight: '900', color: '#111827' },
  profileHeaderEmail: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginTop: 2 },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#2563EB',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  greeting: { fontSize: 13, fontWeight: '700', color: '#374151' },
  userName: { fontSize: 20, fontWeight: '900', color: '#111827', marginTop: 2 },
  userEmail: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginTop: 2 },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#222',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: { marginRight: 8 },
  inputFlex: { flex: 1, paddingVertical: 2 },
  inputLight: {
    borderColor: '#E2E6EE',
    backgroundColor: '#FFFFFF',
    color: '#111827',
  },
  inputDark: {
    borderColor: '#374151',
    backgroundColor: '#1F2937',
    color: '#E5E7EB',
  },
  inputDisabled: {
    opacity: 0.8,
  },
  inputError: {
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#D14343',
    fontSize: 12,
    marginTop: 6,
  },
  passwordRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 4,
    paddingRight: 8,
  },
  primaryBtn: {
    marginTop: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E6E6E6',
  },
  dividerText: {
    marginHorizontal: 8,
    color: '#6B7280',
    fontWeight: '700',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E3E3E3',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 10,
  },
  googleBtnText: {
    color: '#202124',
    fontWeight: '800',
  },
  footerText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#6B7280',
  },
  footerLink: {
    color: '#2563EB',
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
});
