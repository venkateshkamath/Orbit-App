import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrbitTheme } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  heightRatio?: number;
  style?: ViewStyle;
};

export function BottomSheet({ visible, onClose, children, heightRatio = 0.85, style }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, shadows } = useOrbitTheme();
  const [mounted, setMounted] = useState(visible);
  const screenHeight = Dimensions.get('window').height;
  const sheetHeight = Math.round(screenHeight * heightRatio);
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: visible ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: visible ? 0 : sheetHeight,
        damping: 22,
        stiffness: 190,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [backdrop, mounted, sheetHeight, translateY, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && gesture.dy > 0,
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldClose = gesture.vy > 0.5 || gesture.dy > sheetHeight * 0.4;
          if (shouldClose) {
            onClose();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            damping: 18,
            stiffness: 180,
            useNativeDriver: true,
          }).start();
        },
      }),
    [onClose, sheetHeight, translateY]
  );

  if (!mounted) return null;

  const sheetStyle = {
    backgroundColor: colors.background.card,
    shadowColor: shadows.lg.shadowColor,
    shadowOpacity: shadows.lg.shadowOpacity,
    shadowRadius: shadows.lg.shadowRadius,
  };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { backgroundColor: colors.overlay, opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            paddingBottom: insets.bottom,
            transform: [{ translateY }],
          },
          sheetStyle,
          style,
        ]}
      >
        <View style={styles.handleHit} {...panResponder.panHandlers}>
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />
        </View>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,13,13,0.28)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#0B5F78',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 18,
    overflow: 'hidden',
  },
  handleHit: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
});

export default BottomSheet;
