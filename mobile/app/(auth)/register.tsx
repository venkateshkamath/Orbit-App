/**
 * Sign up — name, email, date of birth, then email OTP
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
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { BackHandler } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parse, isValid } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { Input, GradientButton } from '../../src/components';
import { useAuthStore } from '../../src/stores';
import { leaveAuthScreen } from '../../src/utils/authNavigation';
import { formatApiError } from '../../src/utils/apiErrors';

type Step = 'details' | 'otp';

function defaultDobDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 25);
  d.setHours(12, 0, 0, 0);
  return d;
}

function minDobDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 120);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function RegisterScreen() {
  const [step, setStep] = useState<Step>('details');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dobDate, setDobDate] = useState(defaultDobDate);
  const [dobText, setDobText] = useState(() => format(defaultDobDate(), 'yyyy-MM-dd'));
  const [otp, setOtp] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);
  const [iosPickerOpen, setIosPickerOpen] = useState(false);

  const { requestSignupOtp, verifySignupOtp } = useAuthStore();

  const maxDob = new Date();
  const minDob = minDobDate();

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const syncDobTextFromDate = (d: Date) => {
    setDobDate(d);
    setDobText(format(d, 'yyyy-MM-dd'));
  };

  const goBack = useCallback(() => {
    if (step === 'otp') {
      setStep('details');
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

  const parseDobStrict = (): Date | null => {
    const parsed = parse(dobText.trim(), 'yyyy-MM-dd', new Date());
    if (!isValid(parsed)) return null;
    const day = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    const maxDay = new Date(maxDob.getFullYear(), maxDob.getMonth(), maxDob.getDate());
    const minDay = new Date(minDob.getFullYear(), minDob.getMonth(), minDob.getDate());
    if (day > maxDay || day < minDay) return null;
    return day;
  };

  const validateDetails = () => {
    if (fullName.trim().length < 2) {
      setErrorMessage('Please enter your name (at least 2 characters).');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }
    const dob = parseDobStrict();
    if (!dob) {
      setErrorMessage('Please choose a valid date of birth.');
      return false;
    }
    setDobDate(dob);
    setDobText(format(dob, 'yyyy-MM-dd'));
    return true;
  };

  const dobForApi = () => format(parseDobStrict() || dobDate, 'yyyy-MM-dd');

  const openNativeDatePicker = () => {
    setErrorMessage('');
    if (Platform.OS === 'android') {
      setAndroidPickerOpen(true);
    } else if (Platform.OS === 'ios') {
      setIosPickerOpen(true);
    }
  };

  const handleSendCode = async () => {
    setErrorMessage('');
    setDevHint(null);
    if (!validateDetails()) return;

    setSending(true);
    try {
      const res = await requestSignupOtp(email.trim(), fullName.trim(), dobForApi());
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
      const res = await requestSignupOtp(email.trim(), fullName.trim(), dobForApi());
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
      await verifySignupOtp(email.trim(), code);
    } catch (e: unknown) {
      setErrorMessage(formatApiError(e));
    } finally {
      setVerifying(false);
    }
  };

  const renderDobField = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.dobBlock}>
          <Text style={styles.dobLabel}>Date of birth</Text>
          <View style={styles.dobRow}>
            <Ionicons name="calendar-outline" size={20} color={Colors.text.tertiary} style={styles.dobIcon} />
            <TextInput
              style={styles.dobWebInput}
              value={dobText}
              onChangeText={(t) => {
                setDobText(t);
                setErrorMessage('');
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.text.muted}
              autoCapitalize="none"
            />
          </View>
          <Text style={styles.dobHint}>Use format YYYY-MM-DD</Text>
        </View>
      );
    }

    return (
      <View style={styles.dobBlock}>
        <Text style={styles.dobLabel}>Date of birth</Text>
        <TouchableOpacity
          style={styles.dobRow}
          onPress={openNativeDatePicker}
          activeOpacity={0.75}
        >
          <Ionicons name="calendar-outline" size={20} color={Colors.text.tertiary} style={styles.dobIcon} />
          <Text style={styles.dobValue}>{format(dobDate, 'MMMM d, yyyy')}</Text>
          <Ionicons name="chevron-down" size={20} color={Colors.text.tertiary} />
        </TouchableOpacity>

        {androidPickerOpen ? (
          <DateTimePicker
            value={dobDate}
            mode="date"
            display="default"
            maximumDate={maxDob}
            minimumDate={minDob}
            onChange={(event, date) => {
              setAndroidPickerOpen(false);
              if (event.type === 'set' && date) {
                syncDobTextFromDate(date);
              }
            }}
          />
        ) : null}

        <Modal visible={iosPickerOpen} transparent animationType="slide" onRequestClose={() => setIosPickerOpen(false)}>
          <TouchableOpacity style={styles.iosModalBackdrop} activeOpacity={1} onPress={() => setIosPickerOpen(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.iosModalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.iosModalHeader}>
                <Text style={styles.iosModalTitle}>Date of birth</Text>
                <TouchableOpacity onPress={() => setIosPickerOpen(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={styles.iosModalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dobDate}
                mode="date"
                display="spinner"
                themeVariant="dark"
                maximumDate={maxDob}
                minimumDate={minDob}
                onChange={(_, date) => {
                  if (date) syncDobTextFromDate(date);
                }}
                style={styles.iosPicker}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    );
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

            {step === 'details' ? (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>Create account</Text>
                  <Text style={styles.subtitle}>We’ll email you a code to verify it’s you.</Text>
                </View>

                {errorMessage ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color={Colors.error} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <View style={styles.form}>
                  <Input
                    label="Full name"
                    icon="person-outline"
                    value={fullName}
                    onChangeText={(t) => {
                      setFullName(t);
                      setErrorMessage('');
                    }}
                    autoCapitalize="words"
                    placeholder="Your name"
                  />
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
                  {renderDobField()}

                  <GradientButton
                    title={sending ? 'Sending…' : 'Send verification code'}
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
                    Enter the 6-digit code we sent to{' '}
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

                <Text style={styles.otpLabel}>Verification code</Text>
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
                  title={verifying ? 'Verifying…' : 'Continue'}
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
              <Text style={styles.footerMuted}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.footerLink}>Sign in</Text>
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
  dobBlock: {
    marginBottom: Spacing.md,
  },
  dobLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  dobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 52,
  },
  dobIcon: {
    marginRight: Spacing.sm,
  },
  dobValue: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text.primary,
    fontWeight: FontWeights.medium,
  },
  dobWebInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text.primary,
    paddingVertical: 0,
  },
  dobHint: {
    fontSize: FontSizes.xs,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },
  iosModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  iosModalCard: {
    backgroundColor: Colors.background.elevated,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.xl,
  },
  iosModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iosModalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
  iosModalDone: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.primary.default,
  },
  iosPicker: {
    height: 216,
    alignSelf: 'stretch',
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
