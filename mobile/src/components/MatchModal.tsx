/**
 * MatchModal - Celebration modal for matches
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSizes, FontWeights, Spacing, Shadows } from '../../constants/Colors';
import { PublicUser } from '../types';
import Avatar from './Avatar';
import GradientButton from './GradientButton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MatchModalProps {
  visible: boolean;
  user: PublicUser | null;
  onClose: () => void;
  onMessage: () => void;
}

export const MatchModal: React.FC<MatchModalProps> = ({
  visible,
  user,
  onClose,
  onMessage,
}) => {
  const scale = useSharedValue(0);
  const heartScale = useSharedValue(0);
  const avatarScale1 = useSharedValue(0);
  const avatarScale2 = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 10 });
      heartScale.value = withSequence(
        withDelay(200, withSpring(1.3, { damping: 8 })),
        withSpring(1, { damping: 10 })
      );
      avatarScale1.value = withDelay(100, withSpring(1, { damping: 12 }));
      avatarScale2.value = withDelay(150, withSpring(1, { damping: 12 }));
    } else {
      scale.value = 0;
      heartScale.value = 0;
      avatarScale1.value = 0;
      avatarScale2.value = 0;
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const avatar1Style = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale1.value }],
  }));

  const avatar2Style = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale2.value }],
  }));

  if (!user) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, containerStyle]}>
          <LinearGradient
            colors={[Colors.primary.start + '20', Colors.primary.end + '20']}
            style={styles.gradient}
          >
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>

            {/* Hearts Animation */}
            <View style={styles.heartsContainer}>
              <Animated.View style={avatar1Style}>
                <Avatar uri={null} name="You" size={80} />
              </Animated.View>
              
              <Animated.View style={[styles.heartIcon, heartStyle]}>
                <LinearGradient
                  colors={[Colors.primary.start, Colors.primary.end]}
                  style={styles.heartGradient}
                >
                  <Ionicons name="heart" size={32} color={Colors.text.primary} />
                </LinearGradient>
              </Animated.View>
              
              <Animated.View style={avatar2Style}>
                <Avatar uri={user.avatar} name={user.username} size={80} />
              </Animated.View>
            </View>

            {/* Match Text */}
            <Text style={styles.title}>It's a Match! 🎉</Text>
            <Text style={styles.subtitle}>
              You and {user.username} liked each other
            </Text>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <GradientButton
                title="Send a Message"
                onPress={onMessage}
                size="lg"
                style={styles.messageButton}
              />
              <TouchableOpacity onPress={onClose} style={styles.keepBrowsingButton}>
                <Text style={styles.keepBrowsingText}>Keep Browsing</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_WIDTH - Spacing.xl * 2,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  gradient: {
    padding: Spacing.xl,
    alignItems: 'center',
    backgroundColor: Colors.background.card,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    padding: Spacing.xs,
  },
  heartsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  heartIcon: {
    marginHorizontal: -Spacing.md,
    zIndex: 1,
  },
  heartGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow,
  },
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  actions: {
    width: '100%',
  },
  messageButton: {
    marginBottom: Spacing.md,
  },
  keepBrowsingButton: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  keepBrowsingText: {
    color: Colors.text.secondary,
    fontSize: FontSizes.md,
  },
});

export default MatchModal;
