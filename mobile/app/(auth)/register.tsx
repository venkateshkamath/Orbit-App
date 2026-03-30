/**
 * Sign up — name, email, date of birth, then email OTP
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { BackHandler } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parse, isValid } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme } from '../../src/theme';
import { AppText } from '../../src/ui/AppText';
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

  const { colors, fonts, resolvedScheme } = useOrbitTheme();

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
  dobBlock: {
    marginBottom: Spacing.md,
  },
  dobLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: colors.text.secondary,
    marginBottom: Spacing.xs,
    fontFamily: fonts.semibold,
  },
  dobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 50,
  },
  dobIcon: {
    marginRight: Spacing.sm,
  },
  dobValue: {
    flex: 1,
    fontSize: FontSizes.md,
    color: colors.text.primary,
    fontWeight: FontWeights.medium,
    fontFamily: fonts.medium,
  },
  dobWebInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: colors.text.primary,
    paddingVertical: 0,
    fontFamily: fonts.regular,
  },
  dobHint: {
    fontSize: FontSizes.xs,
    color: colors.text.muted,
    marginTop: Spacing.xs,
    fontFamily: fonts.regular,
  },
  iosModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  iosModalCard: {
    backgroundColor: colors.background.elevated,
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
    borderBottomColor: colors.border,
  },
  iosModalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: colors.text.primary,
    fontFamily: fonts.semibold,
  },
  iosModalDone: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: colors.primary.default,
    fontFamily: fonts.bold,
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
  const renderDobField = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.dobBlock}>
          <AppText style={styles.dobLabel}>Date of birth</AppText>
          <View style={styles.dobRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} style={styles.dobIcon} />
            <TextInput
              style={styles.dobWebInput}
              value={dobText}
              onChangeText={(t) => {
                setDobText(t);
                setErrorMessage('');
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.text.muted}
              autoCapitalize="none"
            />
          </View>
          <AppText style={styles.dobHint}>Use format YYYY-MM-DD</AppText>
        </View>
      );
    }

    return (
      <View style={styles.dobBlock}>
        <AppText style={styles.dobLabel}>Date of birth</AppText>
        <TouchableOpacity
          style={styles.dobRow}
          onPress={openNativeDatePicker}
          activeOpacity={0.75}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} style={styles.dobIcon} />
          <AppText style={styles.dobValue}>{format(dobDate, 'MMMM d, yyyy')}</AppText>
          <Ionicons name="chevron-down" size={20} color={colors.text.tertiary} />
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
                <AppText style={styles.iosModalTitle}>Date of birth</AppText>
                <TouchableOpacity onPress={() => setIosPickerOpen(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <AppText style={styles.iosModalDone}>Done</AppText>
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

            {step === 'details' ? (
              <>
                <View style={styles.header}>
                  <AppText style={styles.title}>Create account</AppText>
                  <AppText style={styles.subtitle}>We’ll email you a code to verify it’s you.</AppText>
                </View>

                {errorMessage ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color={colors.error} />
                    <AppText style={styles.errorText}>{errorMessage}</AppText>
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
                  <AppText style={styles.title}>Check your email</AppText>
                  <AppText style={styles.subtitle}>
                    Enter the 6-digit code we sent to{' '}
                    <AppText style={styles.emailEmphasis}>{email.trim()}</AppText>
                  </AppText>
                </View>

                {devHint ? <AppText style={styles.devHint}>{devHint}</AppText> : null}

                {errorMessage ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color={colors.error} />
                    <AppText style={styles.errorText}>{errorMessage}</AppText>
                  </View>
                ) : null}

                <AppText style={styles.otpLabel}>Verification code</AppText>
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
                  placeholderTextColor={colors.text.muted}
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
              <AppText style={styles.footerMuted}>Already have an account? </AppText>
              <Pressable
                onPress={() => router.replace('/(auth)/login')}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              >
                <AppText style={styles.footerLink}>Sign in</AppText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
