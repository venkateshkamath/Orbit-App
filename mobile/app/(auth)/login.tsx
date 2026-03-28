/**
 * Sign in — email, then email OTP
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { Input, GradientButton } from '../../src/components';
import { useAuthStore } from '../../src/stores';
import { leaveAuthScreen } from '../../src/utils/authNavigation';
import { formatApiError } from '../../src/utils/apiErrors';

type Step = 'email' | 'otp';

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [devHint, setDevHint] = useState<string | null>(null);

  const { requestLoginOtp, verifyLoginOtp } = useAuthStore();

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const goBack = useCallback(() => {
    if (step === 'otp') {
      setStep('email');
      setOtp('');
      setErrorMessage('');
      setDevHint(null);
      return;
    }
    leaveAuthScreen();
  }, [step]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [goBack])
  );

  const handleSendCode = async () => {
    setErrorMessage('');
    setDevHint(null);
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setSending(true);
    try {
      const res = await requestLoginOtp(email.trim());
      setStep('otp');
      setResendIn(60);
      if (res.debug_otp) {
        setDevHint(`Dev build: code is ${res.debug_otp}`);
      }
    } catch (e: unknown) {
      setErrorMessage(formatApiError(e));
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || sending) return;
    setErrorMessage('');
    setDevHint(null);
    setSending(true);
    try {
      const res = await requestLoginOtp(email.trim());
      setResendIn(60);
      if (res.debug_otp) {
        setDevHint(`Dev build: code is ${res.debug_otp}`);
      }
    } catch (e: unknown) {
      setErrorMessage(formatApiError(e));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setErrorMessage('');
    const code = otp.replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage('Enter the 6-digit code from your email.');
      return;
    }
    setVerifying(true);
    try {
      await verifyLoginOtp(email.trim(), code);
    } catch (e: unknown) {
      setErrorMessage(formatApiError(e));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <TouchableOpacity onPress={goBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
            </TouchableOpacity>

            {step === 'email' ? (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>Welcome back</Text>
                  <Text style={styles.subtitle}>We’ll email you a one-time code to sign in.</Text>
                </View>

                {errorMessage ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color={Colors.error} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <View style={styles.form}>
                  <Input
                    label="Email"
                    icon="mail-outline"
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      setErrorMessage('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="you@example.com"
                  />

                  <GradientButton
                    title={sending ? 'Sending…' : 'Send sign-in code'}
                    onPress={handleSendCode}
                    loading={sending}
                    size="lg"
                    style={styles.primaryBtn}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>Check your email</Text>
                  <Text style={styles.subtitle}>
                    Enter the code we sent to{' '}
                    <Text style={styles.emailEmphasis}>{email.trim()}</Text>
                  </Text>
                </View>

                {devHint ? <Text style={styles.devHint}>{devHint}</Text> : null}

                {errorMessage ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color={Colors.error} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <Text style={styles.otpLabel}>Sign-in code</Text>
                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={(t) => {
                    setOtp(t.replace(/[^\d]/g, '').slice(0, 6));
                    setErrorMessage('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={Colors.text.muted}
                />

                <GradientButton
                  title={verifying ? 'Signing in…' : 'Sign in'}
                  onPress={handleVerify}
                  loading={verifying}
                  size="lg"
                  style={styles.primaryBtn}
                />

                <TouchableOpacity
                  style={[styles.resendBtn, resendIn > 0 && styles.resendDisabled]}
                  onPress={handleResend}
                  disabled={resendIn > 0 || sending}
                >
                  {sending ? (
                    <ActivityIndicator color={Colors.primary.light} />
                  ) : (
                    <Text style={styles.resendText}>
                      {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerMuted}>New here? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/register')}>
                <Text style={styles.footerLink}>Create an account</Text>
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
  emailEmphasis: {
    color: Colors.text.accent,
    fontWeight: FontWeights.semibold,
  },
  devHint: {
    fontSize: FontSizes.sm,
    color: Colors.secondary.default,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 115, 0.12)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 115, 0.35)',
  },
  errorText: {
    flex: 1,
    color: Colors.error,
    fontSize: FontSizes.sm,
    lineHeight: 18,
  },
  form: {
    marginBottom: Spacing.md,
  },
  primaryBtn: {
    marginTop: Spacing.lg,
  },
  otpLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  otpInput: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 8,
    color: Colors.text.primary,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  resendDisabled: {
    opacity: 0.5,
  },
  resendText: {
    color: Colors.primary.light,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingTop: Spacing.xl,
  },
  footerMuted: {
    color: Colors.text.secondary,
    fontSize: FontSizes.md,
  },
  footerLink: {
    color: Colors.primary.default,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
});
