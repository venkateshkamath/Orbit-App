import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../ui/AppText';
import { useOrbitTheme } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info';

interface ToastEntry {
  id: number;
  type: ToastType;
  text: string;
}

export interface ToastContextValue {
  /** Show a toast with explicit type */
  show: (type: ToastType, text: string) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * `useToast` — call from any component or hook to show a global toast.
 *
 * @example
 * const toast = useToast();
 * toast.success('Catchup created!');
 * toast.error('Something went wrong');
 * toast.info('Location updated');
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#00B4D8';
const ERROR  = '#EF4444';
const INFO   = '#F59E0B';
const AUTO_DISMISS_MS = 3200;

const BORDER_COLOR: Record<ToastType, string> = {
  success: ACCENT,
  error:   ERROR,
  info:    INFO,
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors, shadows } = useOrbitTheme();
  const [current, setCurrent] = useState<ToastEntry | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const idRef    = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(translateY, {
      toValue:  -100,
      duration: 200,
      easing:   Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => setCurrent(null));
  }, [translateY]);

  const show = useCallback(
    (type: ToastType, text: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      const id = ++idRef.current;
      setCurrent({ id, type, text });

      // Snap to top then animate in
      translateY.setValue(-100);
      Animated.timing(translateY, {
        toValue:  insets.top + 12,
        duration: 220,
        easing:   Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    },
    [insets.top, translateY, dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (text) => show('success', text),
      error:   (text) => show('error', text),
      info:    (text) => show('info', text),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current ? (
        <Pressable onPress={dismiss} style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.toast,
              {
                backgroundColor: colors.background.card,
                borderLeftColor: BORDER_COLOR[current.type],
                shadowColor: shadows.lg.shadowColor,
                shadowOpacity: shadows.lg.shadowOpacity,
                shadowRadius: shadows.lg.shadowRadius,
                transform: [{ translateY }],
              },
            ]}
          >
            <AppText style={[styles.toastText, { color: colors.text.primary }]}>{current.text}</AppText>
          </Animated.View>
        </Pressable>
      ) : null}
    </ToastContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toast: {
    position:        'absolute',
    left:            20,
    right:           20,
    top:             0,
    zIndex:          9999,
    minHeight:       52,
    borderRadius:    12,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    justifyContent:  'center',
    paddingHorizontal: 16,
    paddingVertical:   10,
    shadowColor:   '#000',
    shadowOpacity: 0.12,
    shadowRadius:  16,
    shadowOffset:  { width: 0, height: 4 },
    elevation:     10,
  },
  toastText: {
    fontSize:   14,
    fontWeight: '500',
    color:      '#0D0D0D',
    lineHeight: 20,
  },
});
