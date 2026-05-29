import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { AppText } from '../ui/AppText';

type OrbitLoaderSize = 'sm' | 'md' | 'lg';
type OrbitLoaderVariant = 'default' | 'inline' | 'fullscreen';

type Props = {
  size?: OrbitLoaderSize;
  variant?: OrbitLoaderVariant;
  style?: ViewStyle;
};

const ACCENT = '#00B4D8';
const SIZE_MAP: Record<OrbitLoaderSize, number> = { sm: 36, md: 60, lg: 90 };
const SPEEDS = [1200, 1800, 2400];
const TRAIL_OPACITIES = [1, 0.52, 0.22];

function OrbitDot({ size, delay, duration }: { size: number; delay: number; duration: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const dot = Math.max(4, Math.round(size * 0.1));
  const radius = size * 0.4;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, progress]);

  return (
    <>
      {TRAIL_OPACITIES.map((opacity, index) => {
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [`${index * -18}deg`, `${360 + index * -18}deg`],
        });
        return (
          <Animated.View
            key={opacity}
            style={[
              styles.orbitLayer,
              {
                width: size,
                height: size,
                transform: [{ rotate }],
                opacity,
              },
            ]}
          >
            <View
              style={[
                styles.dot,
                {
                  width: dot,
                  height: dot,
                  borderRadius: dot / 2,
                  backgroundColor: ACCENT,
                  transform: [{ translateY: -radius }],
                },
              ]}
            />
          </Animated.View>
        );
      })}
    </>
  );
}

export function OrbitLoader({ size = 'md', variant = 'default', style }: Props) {
  const unit = SIZE_MAP[size];
  const fade = useRef(new Animated.Value(variant === 'fullscreen' ? 0 : 1)).current;

  useEffect(() => {
    if (variant !== 'fullscreen') return;
    Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [fade, variant]);

  const loader = useMemo(
    () => (
      <View style={[styles.loader, { width: unit, height: unit }]}>
        {SPEEDS.map((duration, index) => (
          <OrbitDot key={duration} size={unit} delay={index * 90} duration={duration} />
        ))}
        {variant !== 'inline' ? <AppText style={[styles.word, { fontSize: Math.max(8, unit / 6) }]}>orbit</AppText> : null}
      </View>
    ),
    [unit, variant]
  );

  if (variant === 'fullscreen') {
    return (
      <Animated.View style={[styles.fullscreen, { opacity: fade }, style]}>
        <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFillObject} />
        {loader}
      </Animated.View>
    );
  }

  return <View style={[variant === 'inline' ? styles.inline : styles.defaultWrap, style]}>{loader}</View>;
}

const styles = StyleSheet.create({
  defaultWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  loader: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  word: {
    color: ACCENT,
    fontWeight: '600',
    opacity: 0.5,
    letterSpacing: 0,
  },
});

export default OrbitLoader;
