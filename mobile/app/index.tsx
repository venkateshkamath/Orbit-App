/**
 * MindLink - Welcome Screen
 * Clean, modern landing page
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../constants/Colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WelcomeScreen() {
  const logoScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const featuresOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    // Animate entrance
    logoScale.value = withDelay(200, withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.5)) }));
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    subtitleOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    featuresOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));
    buttonsOpacity.value = withDelay(1000, withTiming(1, { duration: 400 }));
    
    // Pulse animation for logo
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value * pulseScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: (1 - titleOpacity.value) * 20 }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: (1 - subtitleOpacity.value) * 20 }],
  }));

  const featuresStyle = useAnimatedStyle(() => ({
    opacity: featuresOpacity.value,
    transform: [{ translateY: (1 - featuresOpacity.value) * 20 }],
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: (1 - buttonsOpacity.value) * 20 }],
  }));

  const features = [
    { icon: 'location-outline', text: 'Find people nearby' },
    { icon: 'heart-outline', text: 'Match by interests' },
    { icon: 'chatbubbles-outline', text: 'Connect instantly' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Subtle Background Gradient */}
      <LinearGradient
        colors={['#F0FDF4', '#DCFCE7', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Logo */}
          <Animated.View style={[styles.logoContainer, logoStyle]}>
            <LinearGradient
              colors={[Colors.primary.start, Colors.primary.end]}
              style={styles.logoGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="people" size={48} color="white" />
            </LinearGradient>
          </Animated.View>

          {/* Title */}
          <Animated.Text style={[styles.title, titleStyle]}>
            MindLink
          </Animated.Text>

          {/* Subtitle */}
          <Animated.Text style={[styles.subtitle, subtitleStyle]}>
            Connect with like-minded people around you
          </Animated.Text>

          {/* Features */}
          <Animated.View style={[styles.features, featuresStyle]}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <Ionicons
                    name={feature.icon as any}
                    size={20}
                    color={Colors.primary.default}
                  />
                </View>
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* Buttons - Compact at bottom */}
        <Animated.View style={[styles.buttons, buttonsStyle]}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[Colors.primary.start, Colors.primary.end]}
              style={styles.primaryButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </Animated.View>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logoContainer: {
    marginBottom: Spacing.xl,
  },
  logoGradient: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary.default,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: FontSizes.lg,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  features: {
    width: '100%',
    maxWidth: 300,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary.default + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    fontWeight: FontWeights.medium,
  },
  buttons: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primaryButton: {
    flex: 1,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    shadowColor: Colors.primary.default,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.text.primary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
});
