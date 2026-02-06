/**
 * Register Screen - Clean, user-friendly design
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { Input, GradientButton } from '../../src/components';
import { useAuthStore } from '../../src/stores';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
  }>({});

  const { register } = useAuthStore();

  const validate = () => {
    const newErrors: typeof errors = {};
    
    if (!username) {
      newErrors.username = 'Please choose a username';
    } else if (username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (!email) {
      newErrors.email = 'Please enter your email address';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      newErrors.password = 'Please create a password';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    setErrorMessage('');
    if (!validate()) return;

    setLoading(true);
    try {
      await register(email, username, password);
      // Navigation happens automatically via root layout
    } catch (error: any) {
      // Provide clear, actionable error messages
      const message = error.message || '';
      
      if (message.toLowerCase().includes('email') && message.toLowerCase().includes('already')) {
        setErrorMessage('This email is already registered. Please sign in instead.');
      } else if (message.toLowerCase().includes('username') && message.toLowerCase().includes('already')) {
        setErrorMessage('This username is taken. Please choose another one.');
      } else if (message.toLowerCase().includes('network')) {
        setErrorMessage('Unable to connect. Please check your internet connection.');
      } else if (message.toLowerCase().includes('password')) {
        setErrorMessage(message);
      } else {
        setErrorMessage('Registration failed. Please check your details and try again.');
      }
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            {/* Back Button */}
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>
                Join MindLink and start connecting
              </Text>
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color={Colors.error} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Form */}
            <View style={styles.form}>
              <Input
                label="Username"
                icon="person-outline"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setErrorMessage('');
                }}
                autoCapitalize="none"
                error={errors.username}
                placeholder="Choose a username"
              />

              <Input
                label="Email"
                icon="mail-outline"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrorMessage('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
                placeholder="your.email@example.com"
              />

              <Input
                label="Password"
                icon="lock-closed-outline"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrorMessage('');
                }}
                isPassword
                error={errors.password}
                placeholder="At least 8 characters"
              />

              <GradientButton
                title="Create Account"
                onPress={handleRegister}
                loading={loading}
                size="lg"
                style={styles.registerButton}
              />

              {/* Terms */}
              <Text style={styles.terms}>
                By creating an account, you agree to our{' '}
                <Text style={styles.termsLink}>Terms</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login */}
            <View style={styles.socialButtons}>
              <TouchableOpacity style={styles.socialButton}>
                <Ionicons name="logo-google" size={22} color={Colors.text.primary} />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton}>
                <Ionicons name="logo-apple" size={22} color={Colors.text.primary} />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In Link */}
            <View style={styles.signInContainer}>
              <Text style={styles.signInText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.signInLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
  },
  header: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    color: '#991B1B',
    fontSize: FontSizes.sm,
    lineHeight: 18,
  },
  form: {
    marginBottom: Spacing.md,
  },
  registerButton: {
    marginTop: Spacing.lg,
  },
  terms: {
    fontSize: 12,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.primary.default,
    fontWeight: FontWeights.medium,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.text.tertiary,
    fontSize: FontSizes.sm,
    marginHorizontal: Spacing.md,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  socialButtonText: {
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  signInText: {
    color: Colors.text.secondary,
    fontSize: FontSizes.md,
  },
  signInLink: {
    color: Colors.primary.default,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
});
