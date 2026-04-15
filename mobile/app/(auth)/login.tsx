/**
 * Sign in — email, then email OTP
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme } from '../../src/theme';
import { AppText } from '../../src/ui/AppText';
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

  const { requestLoginOtp, verifyLoginOtp } = useAuthStore();

  const { colors, fonts, resolvedScheme } = useOrbitTheme();

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
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setSending(true);
    try {
      await requestLoginOtp(email.trim());
      setStep('otp');
      setResendIn(60);
    } catch (e: unknown) {
      setErrorMessage(formatApiError(e));
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || sending) return;
    setErrorMessage('');
    setSending(true);
    try {
      await requestLoginOtp(email.trim());
      setResendIn(60);
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background.primary,
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
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.background.tertiary,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: Platform.OS === 'android' ? Spacing.sm : Spacing.md,
          alignSelf: 'flex-start',
        },
        header: {
          marginTop: Spacing.xl,
          marginBottom: Spacing.lg,
        },
        title: {
          fontSize: 32,
          fontWeight: '700',
          color: colors.text.primary,
          marginBottom: Spacing.xs,
          letterSpacing: -0.5,
          fontFamily: fonts.bold,
        },
        subtitle: {
          fontSize: FontSizes.md,
          color: colors.text.secondary,
          lineHeight: 22,
          fontFamily: fonts.regular,
        },
        emailEmphasis: {
          color: colors.text.accent,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
        devHint: {
          fontSize: FontSizes.sm,
          color: colors.secondary.default,
          marginBottom: Spacing.md,
          padding: Spacing.sm,
          backgroundColor: colors.background.card,
          borderRadius: BorderRadius.md,
          borderWidth: 1,
          borderColor: colors.border,
          fontFamily: fonts.regular,
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
          color: colors.error,
          fontSize: FontSizes.sm,
          lineHeight: 18,
          fontFamily: fonts.regular,
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
          color: colors.text.secondary,
          marginBottom: Spacing.sm,
          fontFamily: fonts.semibold,
        },
        otpInput: {
          fontSize: 32,
          letterSpacing: 8,
          color: colors.text.primary,
          backgroundColor: colors.background.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: BorderRadius.lg,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.lg,
          marginBottom: Spacing.lg,
          textAlign: 'center',
          fontFamily: fonts.bold,
        },
        resendBtn: {
          alignItems: 'center',
          paddingVertical: Spacing.md,
        },
        resendDisabled: {
          opacity: 0.5,
        },
        resendText: {
          color: colors.primary.light,
          fontSize: FontSizes.md,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
        footer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 'auto',
          paddingTop: Spacing.xl,
        },
        footerMuted: {
          color: colors.text.secondary,
          fontSize: FontSizes.md,
          fontFamily: fonts.regular,
        },
        footerLink: {
          color: colors.primary.default,
          fontSize: FontSizes.md,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
      }),
    [colors, fonts]
  );

  return (
    <View style={styles.container}>
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <TouchableOpacity onPress={goBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>

            {step === 'email' ? (
              <>
                <View style={styles.header}>
                  <AppText style={styles.title}>Welcome back</AppText>
                  <AppText style={styles.subtitle}>We’ll email you a one-time code to sign in.</AppText>
                </View>

                {errorMessage ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color={colors.error} />
                    <AppText style={styles.errorText}>{errorMessage}</AppText>
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
                  <AppText style={styles.title}>Check your email</AppText>
                  <AppText style={styles.subtitle}>
                    Enter the code we sent to{' '}
                    <AppText style={styles.emailEmphasis}>{email.trim()}</AppText>
                  </AppText>
                </View>

                {errorMessage ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color={colors.error} />
                    <AppText style={styles.errorText}>{errorMessage}</AppText>
                  </View>
                ) : null}

                <AppText style={styles.otpLabel}>Sign-in code</AppText>
                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={(t) => {
                    setOtp(t.replace(/[^\d]/g, '').slice(0, 6));
                    setErrorMessage('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  placeholder="000000"
                  placeholderTextColor={colors.text.muted}
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
                    <ActivityIndicator color={colors.primary.light} />
                  ) : (
                    <AppText style={styles.resendText}>
                      {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                    </AppText>
                  )}
                </TouchableOpacity>
              </>
            )}

            <View style={styles.footer}>
              <AppText style={styles.footerMuted}>New here? </AppText>
              <Pressable
                onPress={() => router.replace('/(auth)/register')}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              >
                <AppText style={styles.footerLink}>Create an account</AppText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
