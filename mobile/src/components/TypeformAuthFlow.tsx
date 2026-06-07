import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApi } from '../api/auth';
import { eventsApi } from '../api/events';
import { useAuthStore } from '../stores';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';
import type { Interest, LocationSearchResult } from '../types';
import { formatApiError } from '../utils/apiErrors';

const CYAN = '#00B4D8';
const RED = '#EF4444';
const GREEN = '#22C55E';
const BLACK = '#0D0D0D';

type Mode = 'login' | 'signup';
type Direction = 1 | -1;

// ─── helpers ──────────────────────────────────────────────────────────────────

function phoneEmail(phone: string) {
  return `${phone.replace(/\D/g, '')}@phone.joinorbit.local`;
}

function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.length < 4) return '+91 ••••••••••';
  return `+91 ${d.slice(0, 2)}XXXXX${d.slice(-2)}`;
}

function isPhoneValid(phone: string) {
  return phone.replace(/\D/g, '').length === 10;
}

function tempUsername(name: string, phone: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18) || 'orbit';
  const suffix = phone.replace(/\D/g, '').slice(-4) || String(Date.now()).slice(-4);
  return `${base}_${suffix}_${String(Date.now()).slice(-4)}`;
}

/** Returns only the city/area name — first token before the first comma. */
function extractCity(displayName: string): string {
  return displayName.split(',')[0].trim();
}

function inputBorderColor(focused: boolean, validity?: 'ok' | 'error', idle = '#E0E0E0') {
  if (validity === 'ok') return GREEN;
  if (validity === 'error') return RED;
  return focused ? CYAN : idle;
}

// ─── sub-component ────────────────────────────────────────────────────────────

function Question({ title, subtitle, fonts }: { title: string; subtitle: string; fonts: any }) {
  const { colors } = useOrbitTheme();
  return (
    <View style={s.questionBlock}>
      <AppText style={[s.heading, { color: colors.text.primary, fontFamily: fonts.bold }]}>{title}</AppText>
      <AppText style={[s.subtitle, { color: colors.text.secondary, fontFamily: fonts.regular }]}>{subtitle}</AppText>
    </View>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function TypeformAuthFlow({ mode }: { mode: Mode }) {
  const { colors, fonts, resolvedScheme } = useOrbitTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    requestLoginOtp, verifyLoginOtp,
    requestSignupOtp, verifySignupOtp,
    updateProfile, updateLocation, setOnboardingComplete,
  } = useAuthStore();

  // Login:  0=phone  1=otp
  // Signup: 0=name  1=phone(+otp sub)  2=interests  3=city  4=username  5=photo→submit
  const total = mode === 'login' ? 2 : 6;

  const [step, setStep]                   = useState(0);
  const [signupOtpPart, setSignupOtpPart] = useState(false);
  const dirRef                            = useRef<Direction>(1);

  const slideAnim    = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1 / total)).current;
  const shakeAnim    = useRef(new Animated.Value(0)).current;
  const btnOpacity   = useRef(new Animated.Value(0.35)).current;

  const photoHaloAnim  = useRef(new Animated.Value(0)).current;
  const photoArcAnim   = useRef(new Animated.Value(0)).current;
  const photoEnterAnim = useRef(new Animated.Value(1)).current;

  // form state
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [otp, setOtp]             = useState(['', '', '', '']);
  const otpRefs                   = useRef<Array<TextInput | null>>([]);
  const [loading, setLoading]     = useState(false);
  const [formError, setFormError] = useState('');
  const [errorOtp, setErrorOtp]   = useState(false);
  const [resendIn, setResendIn]   = useState(0);
  const [focused, setFocused]     = useState<string | null>(null);

  // interests
  const [interests, setInterests]               = useState<Interest[]>([]);
  const [interestsLoading, setInterestsLoading] = useState(mode === 'signup');
  const [selectedIds, setSelectedIds]           = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // city
  const [cityQuery, setCityQuery]           = useState('');
  const [cityResults, setCityResults]       = useState<LocationSearchResult[]>([]);
  const [cityLoading, setCityLoading]       = useState(false);
  const [selectedCity, setSelectedCity]     = useState<LocationSearchResult | null>(null);

  // username
  const [username, setUsername]             = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'hint'>('hint');

  // photo
  const [avatarUri, setAvatarUri] = useState('');

  // derived
  const displayStep = mode === 'signup' && step === 1 && signupOtpPart ? 1 : step;
  const progress    = (displayStep + 1) / total;
  const showBack    = step > 0 || (mode === 'signup' && step === 1 && signupOtpPart);
  const isLastStep  = (mode === 'login' && step === 1) || (mode === 'signup' && step === 5);
  const nextLabel   = isLastStep ? "Let's go" : 'Continue';
  const centerContent = mode !== 'signup' || step !== 2;
  const isDark = resolvedScheme === 'dark';
  const theme = useMemo(
    () =>
      StyleSheet.create({
        screen: { backgroundColor: colors.background.primary },
        track: { backgroundColor: colors.border },
        input: {
          color: colors.text.primary,
          backgroundColor: colors.background.card,
          borderColor: colors.borderLight,
        },
        softSurface: {
          backgroundColor: colors.background.secondary,
          borderColor: colors.borderLight,
        },
        elevatedSurface: {
          backgroundColor: colors.background.card,
          borderColor: colors.borderLight,
        },
        activeSoft: {
          backgroundColor: colors.primary.default + (isDark ? '24' : '18'),
          borderColor: colors.primary.default,
        },
        textPrimary: { color: colors.text.primary },
        textSecondary: { color: colors.text.secondary },
        textTertiary: { color: colors.text.tertiary },
        textMuted: { color: colors.text.muted },
        bottomNav: {
          backgroundColor: colors.background.primary,
          borderTopColor: colors.border,
        },
        nextCapsule: {
          backgroundColor: isDark ? colors.primary.default : BLACK,
        },
        nextCircle: {
          backgroundColor: isDark ? colors.background.card : colors.primary.default,
        },
      }),
    [colors, isDark]
  );
  const placeholderColor = colors.text.muted;
  const fieldBorder = (isFocused: boolean, validity?: 'ok' | 'error') =>
    inputBorderColor(isFocused, validity, colors.borderLight);

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, width] });

  // ─── effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 360,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress]); // eslint-disable-line

  useEffect(() => {
    slideAnim.setValue(dirRef.current * width * 0.38);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, signupOtpPart]); // eslint-disable-line

  useEffect(() => {
    Animated.timing(btnOpacity, {
      toValue: stepValid ? 1 : 0.35,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }); // runs every render

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  useEffect(() => {
    if (mode !== 'signup') return;
    let alive = true;
    setInterestsLoading(true);
    authApi.getInterests()
      .then((d) => { if (alive) setInterests(d); })
      .catch(() => { if (alive) setInterests([]); })
      .finally(() => { if (alive) setInterestsLoading(false); });
    return () => { alive = false; };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'signup' || step !== 3) { setCityResults([]); return; }
    if (cityQuery.trim().length < 2 || selectedCity?.display_name === cityQuery) return;
    const t = setTimeout(() => {
      setCityLoading(true);
      eventsApi.searchLocation(cityQuery.trim())
        .then((results) => {
          // Deduplicate by extracted city name
          const seen = new Set<string>();
          const unique = results.filter((r) => {
            const city = extractCity(r.display_name).toLowerCase();
            if (seen.has(city)) return false;
            seen.add(city);
            return true;
          });
          setCityResults(unique);
        })
        .catch(() => setCityResults([]))
        .finally(() => setCityLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [cityQuery, mode, selectedCity?.display_name, step]);

  useEffect(() => {
    if (mode !== 'signup' || step !== 4) return;
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean !== username) { setUsername(clean); return; }
    if (clean.length < 3) { setUsernameStatus('hint'); return; }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      try {
        const matches = await authApi.searchUsers(clean);
        const taken = matches.some((u) => u.username.toLowerCase() === clean);
        setUsernameStatus(taken ? 'taken' : 'ok');
      } catch {
        setUsernameStatus('ok');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [mode, step, username]);

  useEffect(() => {
    if (mode !== 'signup' || step !== 5) return;
    const halo = Animated.loop(Animated.sequence([
      Animated.timing(photoHaloAnim, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(photoHaloAnim, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const arc = Animated.loop(
      Animated.timing(photoArcAnim, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true })
    );
    halo.start(); arc.start();
    return () => { halo.stop(); arc.stop(); };
  }, [mode, step]); // eslint-disable-line

  useEffect(() => {
    if (!avatarUri) { photoEnterAnim.setValue(1); return; }
    photoEnterAnim.setValue(0.7);
    Animated.spring(photoEnterAnim, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }).start();
  }, [avatarUri]); // eslint-disable-line

  // DEV: backend hardcodes OTP to 8888
  const verifyOtpRef = useRef<((code?: string) => Promise<void>) | undefined>(undefined);
  useEffect(() => {
    const isOtpScreen = (mode === 'login' && step === 1) || (mode === 'signup' && step === 1 && signupOtpPart);
    if (!isOtpScreen) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setOtp(['8', '', '', '']), 500));
    timers.push(setTimeout(() => setOtp(['8', '8', '', '']), 600));
    timers.push(setTimeout(() => setOtp(['8', '8', '8', '']), 700));
    timers.push(setTimeout(() => {
      setOtp(['8', '8', '8', '8']);
      void verifyOtpRef.current?.('8888');
    }, 800));
    return () => timers.forEach(clearTimeout);
  }, [mode, step, signupOtpPart]);

  // ─── stepValid ────────────────────────────────────────────────────────────
  const stepValid = useMemo(() => {
    if (mode === 'login') return step === 0 ? isPhoneValid(phone) : otp.every(Boolean);
    if (step === 0) return name.trim().length >= 2;
    if (step === 1) return signupOtpPart ? otp.every(Boolean) : isPhoneValid(phone);
    if (step === 2) return selectedIds.length >= 3;
    if (step === 3) return !!selectedCity;
    if (step === 4) return usernameStatus === 'ok';
    if (step === 5) return !!avatarUri;
    return false;
  }, [avatarUri, mode, name, otp, phone, selectedCity, selectedIds.length, signupOtpPart, step, usernameStatus]);

  // ─── navigation ───────────────────────────────────────────────────────────
  function transition(next: number, d: Direction = 1) {
    dirRef.current = d;
    setFormError('');
    setStep(next);
  }

  function goBack() {
    setFormError('');
    if (mode === 'signup' && step === 1 && signupOtpPart) {
      dirRef.current = -1;
      setSignupOtpPart(false);
      setOtp(['', '', '', '']);
      return;
    }
    if (step > 0) transition(step - 1, -1);
    else router.back();
  }

  // ─── OTP ──────────────────────────────────────────────────────────────────
  async function sendOtp() {
    setLoading(true); setErrorOtp(false); setFormError('');
    try {
      const email = phoneEmail(phone);
      if (mode === 'login') {
        await requestLoginOtp(email);
        transition(1, 1);
      } else {
        await requestSignupOtp(email, tempUsername(name, phone), '2000-01-01');
        dirRef.current = 1;
        setSignupOtpPart(true);
      }
      setOtp(['', '', '', '']);
      setResendIn(30);
    } catch (e: unknown) {
      const msg = formatApiError(e);
      // Backend signals an existing account — nudge them to log in
      if (mode === 'signup' && msg.toLowerCase().includes('already exists')) {
        setFormError('An account with this number already exists. Please log in instead.');
      } else {
        setFormError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(code = otp.join('')) {
    if (code.length !== 4 || loading) return;
    setLoading(true); setErrorOtp(false); setFormError('');
    try {
      const email = phoneEmail(phone);
      if (mode === 'login') {
        await verifyLoginOtp(email, code);
        router.replace('/(tabs)/feed');
      } else {
        await verifySignupOtp(email, code);
        transition(2, 1);
      }
    } catch (e: unknown) {
      setErrorOtp(true);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -6, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6,  duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -3, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 3,  duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,  duration: 80, useNativeDriver: true }),
      ]).start();
      setOtp(['', '', '', '']);
      setTimeout(() => { setErrorOtp(false); otpRefs.current[0]?.focus(); }, 460);
      setFormError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }
  verifyOtpRef.current = verifyOtp;

  function onOtpDigit(val: string, i: number) {
    const digit = val.replace(/[^\d]/g, '').slice(-1);
    const next = [...otp]; next[i] = digit; setOtp(next);
    if (digit && i < 3) otpRefs.current[i + 1]?.focus();
    if (digit && i === 3) void verifyOtp(next.join(''));
  }

  // ─── submit ───────────────────────────────────────────────────────────────
  async function onContinue() {
    if (!stepValid || loading) return;
    if (mode === 'login') {
      if (step === 0) await sendOtp(); else await verifyOtp();
      return;
    }
    if (step === 0) transition(1, 1);
    else if (step === 1 && !signupOtpPart) await sendOtp();
    else if (step === 1 && signupOtpPart) await verifyOtp();
    else if (step === 2) transition(3, 1);
    else if (step === 3) transition(4, 1);
    else if (step === 4) transition(5, 1);
    else if (step === 5) {
      setLoading(true); setFormError('');
      try {
        await updateProfile({ username, interest_ids: selectedIds });
        if (avatarUri) await authApi.uploadAvatar(avatarUri);
        if (selectedCity) await updateLocation(selectedCity.lat, selectedCity.lng);
        setOnboardingComplete(true);
        router.replace('/(tabs)/feed');
      } catch (e: unknown) {
        setFormError(formatApiError(e));
      } finally {
        setLoading(false);
      }
    }
  }

  // ─── photo helpers ────────────────────────────────────────────────────────
  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setFormError('Photo library access is needed.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) setAvatarUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setFormError('Camera access is needed.'); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) setAvatarUri(result.assets[0].uri);
  }

  // ─── interests helpers ────────────────────────────────────────────────────
  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const categoryLabels: Record<string, string> = {
    tech: '💻  Technology',
    arts: '🎨  Arts & Entertainment',
    sports: '🏃  Sports & Fitness',
    lifestyle: '✨  Lifestyle',
    social: '🤝  Social',
    mind: '🧠  Mind & Learning',
    career: '💼  Career',
    creative: '🎭  Creative',
  };

  // ─── grouped interests ────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    return interests.reduce<Record<string, Interest[]>>((acc, it) => {
      const cat = it.category || 'General';
      (acc[cat] = acc[cat] || []).push(it);
      return acc;
    }, {});
  }, [interests]);

  // ─── step renderers ───────────────────────────────────────────────────────

  function renderPhoneStep(title: string, sub: string) {
    return (
      <>
        <Question title={title} subtitle={sub} fonts={fonts} />
        <View style={s.phoneRow}>
          <View style={[s.countryBox, theme.softSurface, { borderColor: fieldBorder(focused === 'phone') }]}>
            <AppText style={[s.countryText, theme.textPrimary, { fontFamily: fonts.semibold }]}>🇮🇳  +91</AppText>
          </View>
          <TextInput
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
            onFocus={() => setFocused('phone')}
            onBlur={() => setFocused(null)}
            placeholder="Phone number"
            placeholderTextColor={placeholderColor}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={() => { if (stepValid) void onContinue(); }}
            style={[s.input, theme.input, s.phoneInput, { borderColor: fieldBorder(focused === 'phone'), fontFamily: fonts.regular }]}
          />
        </View>
      </>
    );
  }

  function renderOtpStep(title: string, sub: string) {
    return (
      <>
        <Question title={title} subtitle={sub} fonts={fonts} />
        <Animated.View style={[s.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
          {[0, 1, 2, 3].map((i) => (
            <TextInput
              key={i}
              ref={(r) => { otpRefs.current[i] = r; }}
              value={otp[i]}
              onChangeText={(v) => onOtpDigit(v, i)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
              }}
              keyboardType="number-pad"
              maxLength={1}
              onFocus={() => setFocused(`otp-${i}`)}
              onBlur={() => setFocused(null)}
              style={[
                s.otpBox,
                {
                  fontFamily: fonts.bold,
                  color: colors.text.primary,
                  borderColor: errorOtp ? colors.error : otp[i] ? colors.primary.default : focused === `otp-${i}` ? colors.primary.default : colors.borderLight,
                  backgroundColor: otp[i] ? colors.primary.default + (isDark ? '24' : '14') : colors.background.card,
                },
              ]}
            />
          ))}
        </Animated.View>
        <Pressable
          disabled={resendIn > 0 || loading}
          onPress={sendOtp}
          style={s.resendBtn}
        >
          <AppText style={[s.resendText, { color: resendIn > 0 ? colors.text.muted : colors.primary.default, fontFamily: fonts.medium }]}>
            {resendIn > 0 ? `Resend in 0:${String(resendIn).padStart(2, '0')}` : 'Resend code'}
          </AppText>
        </Pressable>
      </>
    );
  }

  function renderInterests() {
    const needed = Math.max(0, 3 - selectedIds.length);
    const done   = selectedIds.length >= 3;
    const fill   = Math.min(selectedIds.length / 3, 1);

    return (
      <>
        <Question
          title="What are you into?"
          subtitle="Pick at least 3 — we'll find your people"
          fonts={fonts}
        />

        <View style={[s.selTrack, { backgroundColor: colors.border }]}>
          <View style={[s.selFill, { width: `${fill * 100}%`, backgroundColor: done ? colors.success : colors.primary.default }]} />
        </View>
        <AppText style={[s.selLabel, { color: done ? colors.success : colors.text.tertiary, fontFamily: fonts.medium }]}>
          {done
            ? `${selectedIds.length} selected  ✓`
            : selectedIds.length === 0
              ? 'Pick 3 or more to continue'
              : `${selectedIds.length} selected — ${needed} more needed`}
        </AppText>

        {interestsLoading ? (
          <View style={s.skeletonWrap}>
            {[0, 1, 2].map((r) => (
              <View key={r} style={{ marginBottom: 16 }}>
                <View style={[s.skeletonLine, { width: 140, marginBottom: 10, backgroundColor: colors.background.secondary }]} />
                <View style={s.skeletonRow}>
                  {[90, 110, 80].map((w, j) => <View key={j} style={[s.skeletonPill, { width: w, backgroundColor: colors.background.secondary }]} />)}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.accordionList}>
            {Object.entries(grouped).map(([cat, items]) => {
              const isOpen = expandedCategories.has(cat);
              const label  = categoryLabels[cat] || cat;
              const selCount = items.filter((it) => selectedIds.includes(it.id)).length;

              return (
                <View key={cat} style={s.accordionItem}>
                  {/* Category header capsule */}
                  <Pressable
                    onPress={() => toggleCategory(cat)}
                    style={[s.catCapsule, theme.softSurface, isOpen && theme.activeSoft]}
                  >
                    <AppText style={[s.catCapsuleText, theme.textPrimary, { fontFamily: fonts.semibold }, isOpen && { color: colors.primary.default }]}>
                      {label}
                    </AppText>
                    <View style={s.catRight}>
                      {selCount > 0 && (
                        <View style={s.catBadge}>
                          <AppText style={[s.catBadgeText, { fontFamily: fonts.bold }]}>{selCount}</AppText>
                        </View>
                      )}
                      <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={15}
                        color={isOpen ? colors.primary.default : colors.text.tertiary}
                      />
                    </View>
                  </Pressable>

                  {/* Sub-interests (visible when expanded) */}
                  {isOpen && (
                    <View style={s.subPillsWrap}>
                      {items.map((it) => {
                        const sel = selectedIds.includes(it.id);
                        return (
                          <Pressable
                            key={it.id}
                            onPress={() =>
                              setSelectedIds((p) =>
                                sel ? p.filter((id) => id !== it.id) : [...p, it.id]
                              )
                            }
                            style={[s.pill, theme.softSurface, sel && theme.activeSoft]}
                          >
                            <AppText style={[s.pillText, theme.textSecondary, sel && { color: colors.primary.default }, { fontFamily: fonts.medium }]}>
                              {it.emoji ? `${it.emoji} ` : ''}{it.name}
                            </AppText>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </>
    );
  }

  function renderCity() {
    return (
      <>
        <Question
          title="Your city?"
          subtitle="We'll use this to find people near you"
          fonts={fonts}
        />
        <View style={s.cityWrap}>
          <View style={s.cityInputRow}>
            <Ionicons name="location-outline" size={18} color={colors.text.tertiary} style={s.cityIcon} />
            <TextInput
              value={cityQuery}
              onChangeText={(t) => { setCityQuery(t); setSelectedCity(null); }}
              onFocus={() => setFocused('city')}
              onBlur={() => setFocused(null)}
              placeholder="Search your city"
              placeholderTextColor={placeholderColor}
              returnKeyType="search"
              style={[
                s.input,
                theme.input,
                s.padLeft,
                {
                  borderColor: selectedCity ? colors.success : fieldBorder(focused === 'city'),
                  fontFamily: fonts.regular,
                  paddingRight: cityLoading ? 46 : 18,
                },
              ]}
            />
            {cityLoading && (
              <ActivityIndicator size="small" color={colors.primary.default} style={s.citySpinner} />
            )}
            {selectedCity && !cityLoading && (
              <Ionicons name="checkmark-circle" size={20} color={colors.success} style={s.citySpinner} />
            )}
          </View>

          {/* Dropdown — only when no city selected and query is long enough */}
          {cityQuery.trim().length >= 2 && !selectedCity && (
            <View style={[s.cityDropdown, theme.elevatedSurface]}>
              {cityLoading ? null : cityResults.length === 0 ? (
                <AppText style={[s.cityNoResults, theme.textTertiary, { fontFamily: fonts.regular }]}>
                  No cities found
                </AppText>
              ) : (
                cityResults.map((r) => (
                  <Pressable
                    key={`${r.lat}-${r.lng}`}
                    onPress={() => {
                      const city = extractCity(r.display_name);
                      setSelectedCity(r);
                      setCityQuery(city);
                      setCityResults([]);
                    }}
                    style={({ pressed }) => [
                      s.cityRow,
                      { borderBottomColor: colors.border },
                      pressed && { backgroundColor: colors.background.secondary },
                    ]}
                  >
                    <Ionicons name="location-outline" size={14} color={colors.primary.default} style={{ marginRight: 10 }} />
                    <AppText style={[s.cityRowText, theme.textPrimary, { fontFamily: fonts.medium }]} numberOfLines={1}>
                      {extractCity(r.display_name)}
                    </AppText>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>
      </>
    );
  }

  function renderUsername() {
    const validity  = usernameStatus === 'ok' ? 'ok' : usernameStatus === 'taken' ? 'error' : undefined;
    const hintColor = usernameStatus === 'ok' ? colors.success : usernameStatus === 'taken' ? colors.error : colors.text.muted;
    const hintText  = usernameStatus === 'ok'
      ? `@${username} is yours!`
      : usernameStatus === 'taken' ? 'already taken, try another'
      : 'at least 3 characters';
    return (
      <>
        <Question title="Pick a username" subtitle="Something unique, just for you" fonts={fonts} />
        <View style={s.inputWrap}>
          <AppText style={[s.atPrefix, { color: colors.text.tertiary, fontFamily: fonts.semibold }]}>@</AppText>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            placeholderTextColor={placeholderColor}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setFocused('username')}
            onBlur={() => setFocused(null)}
            style={[s.input, theme.input, s.padLeft, s.padRight, { borderColor: fieldBorder(focused === 'username', validity), fontFamily: fonts.regular }]}
          />
          <View style={s.rightIcon}>
            {usernameStatus === 'checking' && <ActivityIndicator size="small" color={colors.primary.default} />}
            {usernameStatus === 'ok'       && <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
            {usernameStatus === 'taken'    && <Ionicons name="close-circle" size={22} color={colors.error} />}
          </View>
        </View>
        <AppText style={[s.hint, { color: hintColor, fontFamily: fonts.regular }]}>{hintText}</AppText>
      </>
    );
  }

  function renderPhoto() {
    const haloScale   = photoHaloAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
    const haloOpacity = photoHaloAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.10, 0.30, 0.10] });
    const arcRotate   = photoArcAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const initial     = name.trim().charAt(0).toUpperCase() || '?';

    return (
      <>
        <Question
          title="One quick photo"
          subtitle="A face makes it real — help people know it's you"
          fonts={fonts}
        />

        {/* Photo circle */}
        <View style={s.photoCenter}>
          <Animated.View style={[s.photoHalo, { backgroundColor: colors.primary.default + '22', opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
          <Animated.View style={[s.photoArc, { borderTopColor: colors.primary.default, borderRightColor: colors.primary.default + '44', transform: [{ rotate: arcRotate }] }]} />
          <Animated.View
            style={[
              s.photoCircle,
              {
                backgroundColor: colors.primary.default + (isDark ? '18' : '10'),
                borderColor: colors.primary.default,
                shadowColor: colors.primary.default,
              },
              { transform: [{ scale: photoEnterAnim }] },
            ]}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.photoImage} />
            ) : (
              <>
                <AppText style={[s.photoInitial, { color: colors.primary.default + '22', fontFamily: fonts.extrabold }]}>{initial}</AppText>
                <Ionicons name="person" size={40} color={colors.primary.default + '66'} style={{ zIndex: 1 }} />
              </>
            )}
          </Animated.View>
          {!!avatarUri && <View style={[s.photoGlowRing, { borderColor: colors.primary.default }]} pointerEvents="none" />}
        </View>

        {/* Camera / Gallery options */}
        <View style={[s.photoOptions, theme.elevatedSurface]}>
          <TouchableOpacity onPress={takePhoto} style={s.photoOptionBtn} activeOpacity={0.8}>
            <View style={s.photoOptionIcon}>
              <Ionicons name="camera" size={22} color={colors.primary.default} />
            </View>
            <AppText style={[s.photoOptionLabel, theme.textPrimary, { fontFamily: fonts.semibold }]}>Camera</AppText>
          </TouchableOpacity>

          <View style={[s.photoOptionDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity onPress={pickFromGallery} style={s.photoOptionBtn} activeOpacity={0.8}>
            <View style={s.photoOptionIcon}>
              <Ionicons name="images" size={22} color={colors.primary.default} />
            </View>
            <AppText style={[s.photoOptionLabel, theme.textPrimary, { fontFamily: fonts.semibold }]}>Gallery</AppText>
          </TouchableOpacity>
        </View>

        <View style={s.photoBadge}>
          <Ionicons name="shield-checkmark-outline" size={12} color={colors.text.muted} />
          <AppText style={[s.photoBadgeText, theme.textTertiary, { fontFamily: fonts.regular }]}>Only visible to people near you</AppText>
        </View>
      </>
    );
  }

  function renderStep() {
    if (mode === 'login') {
      if (step === 0) return renderPhoneStep('Welcome back', 'Enter your number to log in');
      return renderOtpStep('Enter the code', `We sent a 4-digit code to ${maskPhone(phone)}`);
    }
    if (step === 0) {
      return (
        <>
          <Question title="What should we call you?" subtitle="This is how you'll appear to others nearby" fonts={fonts} />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={placeholderColor}
            returnKeyType="done"
            onSubmitEditing={() => { if (stepValid) void onContinue(); }}
            onFocus={() => setFocused('name')}
            onBlur={() => setFocused(null)}
            style={[s.input, theme.input, { borderColor: fieldBorder(focused === 'name'), fontFamily: fonts.regular }]}
          />
          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={s.modeSwitch}
          >
            <AppText style={[s.modeSwitchText, theme.textTertiary, { fontFamily: fonts.regular }]}>
              Already have an account?{' '}
              <AppText style={[s.modeSwitchLink, { color: colors.primary.default, fontFamily: fonts.semibold }]}>
                Log in
              </AppText>
            </AppText>
          </Pressable>
        </>
      );
    }
    if (step === 1 && !signupOtpPart) return renderPhoneStep("What's your number?", "We'll send you a code to verify");
    if (step === 1 && signupOtpPart) return renderOtpStep('Verify your number', `Code sent to ${maskPhone(phone)}`);
    if (step === 2) return renderInterests();
    if (step === 3) return renderCity();
    if (step === 4) return renderUsername();
    return renderPhoto();
  }

  // ─── render ───────────────────────────────────────────────────────────────

  const fadeInterp = slideAnim.interpolate({
    inputRange: [-width * 0.38, 0, width * 0.38],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[s.screen, theme.screen]}
    >
      {/* ── progress bar ── */}
      <View style={[s.track, theme.track, { marginTop: insets.top }]}>
        <Animated.View style={[s.trackFill, { backgroundColor: colors.primary.default, width: progressWidth }]} />
      </View>

      {/* ── step content ── */}
      <Animated.View style={[s.stepWrap, { opacity: fadeInterp, transform: [{ translateX: slideAnim }] }]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            s.scrollContent,
            centerContent && s.scrollCenter,
          ]}
        >
          {renderStep()}
        </ScrollView>
      </Animated.View>

      {!!formError && (
        <View style={s.errWrap}>
          <AppText style={[s.errText, { fontFamily: fonts.medium }]}>
            {formError}
          </AppText>
          {mode === 'signup' && formError.includes('log in') && (
            <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={8}>
              <AppText style={[s.errLoginLink, { fontFamily: fonts.semibold }]}>
                Go to Log in →
              </AppText>
            </Pressable>
          )}
        </View>
      )}

      {/* ── bottom navigation ── */}
      <View style={[s.bottomNav, theme.bottomNav, { paddingBottom: Math.max(insets.bottom + 8, 28) }]}>
        <Pressable
          onPress={goBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={[s.backCapsule, theme.softSurface, !showBack && s.invisible]}
          disabled={!showBack}
        >
          <Ionicons name="arrow-back" size={16} color={colors.text.primary} />
          <AppText style={[s.backLabel, theme.textPrimary, { fontFamily: fonts.semibold }]}>Back</AppText>
        </Pressable>

        <AppText style={[s.stepDot, theme.textMuted, { fontFamily: fonts.regular }]}>
          {displayStep + 1} / {total}
        </AppText>

        <Animated.View style={{ opacity: btnOpacity }}>
          <TouchableOpacity
            activeOpacity={0.88}
            disabled={!stepValid || loading}
            onPress={onContinue}
            style={[s.nextCapsule, theme.nextCapsule]}
          >
            <AppText style={[s.nextLabel, { color: isDark ? colors.background.primary : '#FFFFFF', fontFamily: fonts.bold }]}>{nextLabel}</AppText>
            <View style={[s.nextCircle, theme.nextCircle]}>
              {loading
                ? <ActivityIndicator size="small" color={colors.text.primary} />
                : <Ionicons name="arrow-forward" size={18} color={colors.text.primary} />
              }
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

export default TypeformAuthFlow;

// ─── styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },

  track:     { height: 3, backgroundColor: '#EEEEF0', width: '100%' },
  trackFill: { height: 3, backgroundColor: CYAN, borderRadius: 2 },

  stepWrap:      { flex: 1 },
  scrollContent: { paddingHorizontal: 28, paddingTop: 32, paddingBottom: 24, flexGrow: 1 },
  scrollCenter:  { justifyContent: 'center' },

  questionBlock: { marginBottom: 32 },
  heading:       { fontSize: 28, fontWeight: '700', color: BLACK, letterSpacing: -0.5, lineHeight: 34 },
  subtitle:      { marginTop: 8, fontSize: 14, color: '#AAAAAA', lineHeight: 20 },

  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    paddingHorizontal: 18,
    fontSize: 18,
    color: BLACK,
    backgroundColor: '#FAFAFA',
  },
  padLeft:  { paddingLeft: 46 },
  padRight: { paddingRight: 46 },

  phoneRow:   { flexDirection: 'row', gap: 10 },
  countryBox: { width: 96, height: 52, borderRadius: 16, borderWidth: 2, borderColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA' },
  countryText: { color: BLACK, fontSize: 15 },
  phoneInput: { flex: 1 },

  otpRow:    { flexDirection: 'row', justifyContent: 'center', gap: 14 },
  otpBox:    { width: 60, height: 60, borderRadius: 14, borderWidth: 2, textAlign: 'center', fontSize: 24, fontWeight: '700', color: BLACK },
  resendBtn: { marginTop: 28, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  resendText: { fontSize: 14 },

  // ── interests accordion ───────────────────────────────────────────────────
  selTrack: { height: 3, borderRadius: 2, backgroundColor: '#EEEEF0', marginBottom: 8 },
  selFill:  { height: 3, borderRadius: 2 },
  selLabel: { fontSize: 13, marginBottom: 24 },

  skeletonWrap: {},
  skeletonLine: { height: 14, borderRadius: 7, backgroundColor: '#F0F0F2' },
  skeletonRow:  { flexDirection: 'row', gap: 10 },
  skeletonPill: { height: 36, borderRadius: 18, backgroundColor: '#F0F0F2' },

  accordionList: { gap: 10 },
  accordionItem: {},

  catCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E4E4E4',
    backgroundColor: '#FAFAFA',
  },
  catCapsuleOpen: {
    borderColor: CYAN,
    backgroundColor: '#EBF8FC',
  },
  catCapsuleText: {
    fontSize: 15,
    color: '#333333',
  },
  catCapsuleTextOpen: {
    color: CYAN,
  },
  catRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
  },

  subPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  pill: {
    borderRadius: 100,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#E4E4E4',
    backgroundColor: '#FAFAFA',
  },
  pillActive: {
    borderColor: CYAN,
    backgroundColor: '#EBF8FC',
  },
  pillText:       { fontSize: 14, color: '#555555' },
  pillTextActive: { color: CYAN },

  // ── city search ───────────────────────────────────────────────────────────
  cityWrap:      { gap: 0 },
  cityInputRow:  { position: 'relative' },
  cityIcon:      { position: 'absolute', left: 17, top: 17, zIndex: 1 },
  citySpinner:   { position: 'absolute', right: 16, top: 15, zIndex: 1 },
  cityDropdown: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  cityRowPressed: { backgroundColor: '#F5FDFF' },
  cityRowText:    { fontSize: 15, color: BLACK, flex: 1 },
  cityNoResults:  { padding: 18, color: '#AAAAAA', fontSize: 14, textAlign: 'center' },

  // ── input helpers ─────────────────────────────────────────────────────────
  inputWrap: { position: 'relative' },
  leftIcon:  { position: 'absolute', left: 17, top: 17, zIndex: 1 },
  rightIcon: { position: 'absolute', right: 16, top: 14, zIndex: 1 },
  atPrefix:  { position: 'absolute', left: 18, top: 14, zIndex: 1, fontSize: 18, color: '#AAAAAA' },

  hint: { marginTop: 10, fontSize: 13, lineHeight: 18 },
  modeSwitch: { alignSelf: 'center', marginTop: 24, paddingVertical: 8, paddingHorizontal: 8 },
  modeSwitchText: { fontSize: 14, textAlign: 'center' },
  modeSwitchLink: { fontWeight: '700' },

  // ── photo ─────────────────────────────────────────────────────────────────
  photoCenter: { alignSelf: 'center', width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 24 },
  photoHalo:   { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(0,180,216,0.13)' },
  photoArc: {
    position: 'absolute',
    width: 148, height: 148, borderRadius: 74,
    borderWidth: 2,
    borderTopColor: CYAN,
    borderRightColor: 'rgba(0,180,216,0.28)',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  photoCircle: {
    width: 116, height: 116, borderRadius: 58,
    backgroundColor: '#F0FBFD',
    borderWidth: 2.5, borderColor: CYAN,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: CYAN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 22 },
      android: { elevation: 8 },
    }),
  },
  photoImage:   { width: '100%', height: '100%' },
  photoInitial: { position: 'absolute', fontSize: 52, color: 'rgba(0,180,216,0.13)', fontWeight: '800' },
  photoGlowRing: { position: 'absolute', width: 116, height: 116, borderRadius: 58, borderWidth: 2.5, borderColor: CYAN },

  photoOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E4E4E4',
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
    marginBottom: 16,
  },
  photoOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  photoOptionIcon: {},
  photoOptionLabel: { fontSize: 15, color: BLACK },
  photoOptionDivider: { width: 1, height: 24, backgroundColor: '#E4E4E4' },

  photoBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  photoBadgeText: { color: '#AAAAAA', fontSize: 12 },

  errWrap:      { alignItems: 'center', paddingHorizontal: 28, marginBottom: 6, gap: 4 },
  errText:      { color: RED, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  errLoginLink: { color: CYAN, fontSize: 13, textAlign: 'center' },

  // ── bottom navigation ─────────────────────────────────────────────────────
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEEEEE',
  },
  backCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  backLabel: { color: BLACK, fontSize: 14 },
  invisible: { opacity: 0 },
  stepDot:   { color: '#CCCCCC', fontSize: 13 },

  nextCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 20,
    paddingRight: 5,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: BLACK,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18 },
      android: { elevation: 5 },
    }),
  },
  nextLabel:  { color: '#FFFFFF', fontSize: 15 },
  nextCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: CYAN,
    alignItems: 'center', justifyContent: 'center',
  },
});
