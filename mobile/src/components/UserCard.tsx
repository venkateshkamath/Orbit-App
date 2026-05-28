/**
 * UserCard - Beautiful user profile card for discovery
 */

import React, { useMemo } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSizes, FontWeights, Spacing } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';
import { NearbyUser } from '../types';
import InterestTag from './InterestTag';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;

interface UserCardProps {
  user: NearbyUser;
  onLike: () => void;
  onPass: () => void;
  onPress: () => void;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  onLike,
  onPass,
  onPress,
}) => {
  const { colors, shadows, fonts } = useOrbitTheme();
  const likeScale = useSharedValue(1);
  const passScale = useSharedValue(1);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cardContainer: {
          alignItems: 'center',
          marginBottom: Spacing.lg,
        },
        card: {
          width: CARD_WIDTH,
          backgroundColor: colors.background.card,
          borderRadius: BorderRadius.xl,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          ...shadows.lg,
        },
        imageContainer: {
          height: 340,
          position: 'relative',
        },
        image: {
          width: '100%',
          height: '100%',
          resizeMode: 'cover',
        },
        imagePlaceholder: {
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        },
        placeholderText: {
          fontSize: 96,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
          fontFamily: fonts.extrabold,
          letterSpacing: 0,
        },
        hiddenPhotoLabel: {
          marginTop: Spacing.sm,
          color: colors.text.secondary,
          fontSize: FontSizes.sm,
          fontFamily: fonts.regular,
          letterSpacing: 0.2,
        },
        imageFade: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 140,
        },
        matchBadgeWrap: {
          position: 'absolute',
          top: Spacing.md,
          right: Spacing.md,
          borderRadius: BorderRadius.md,
          overflow: 'hidden',
        },
        matchBadgeGradient: {
          paddingHorizontal: Spacing.md,
          paddingVertical: 6,
          alignItems: 'center',
        },
        matchText: {
          color: colors.text.primary,
          fontSize: FontSizes.lg,
          fontWeight: FontWeights.bold,
          fontFamily: fonts.bold,
          letterSpacing: 0,
        },
        matchLabel: {
          color: colors.text.secondary,
          fontSize: 10,
          fontFamily: fonts.regular,
          letterSpacing: 0.2,
        },
        onlineBadge: {
          position: 'absolute',
          top: Spacing.md,
          left: Spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background.elevated,
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
          borderRadius: BorderRadius.full,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
        },
        onlineDot: {
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: colors.online,
          marginRight: Spacing.xs,
        },
        onlineText: {
          color: colors.text.primary,
          fontSize: FontSizes.xs,
          fontFamily: fonts.medium,
        },
        userInfoOverlay: {
          position: 'absolute',
          bottom: Spacing.lg,
          left: Spacing.md,
          right: Spacing.md,
        },
        nameRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
        },
        username: {
          fontSize: 24,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
          fontFamily: fonts.extrabold,
          letterSpacing: 0,
          textShadowColor: 'rgba(255,255,255,0.4)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        },
        distanceRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 4,
          gap: 4,
        },
        distance: {
          color: colors.text.secondary,
          fontSize: FontSizes.sm,
          fontFamily: fonts.regular,
        },
        bioContainer: {
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.md,
          paddingBottom: 0,
        },
        bio: {
          color: colors.text.secondary,
          fontSize: FontSizes.sm,
          lineHeight: 20,
          fontFamily: fonts.regular,
        },
        interestsContainer: {
          padding: Spacing.md,
          paddingTop: Spacing.sm,
        },
        interestsLabel: {
          color: colors.text.tertiary,
          fontSize: 10,
          marginBottom: Spacing.sm,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          fontFamily: fonts.medium,
        },
        interestsList: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
        },
        moreInterests: {
          paddingVertical: Spacing.xs,
          paddingHorizontal: Spacing.sm,
          backgroundColor: colors.primary.default + '18',
          borderRadius: BorderRadius.full,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary.default + '55',
        },
        moreText: {
          color: colors.primary.default,
          fontSize: FontSizes.xs,
          fontFamily: fonts.medium,
        },
        actions: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.lg,
          paddingTop: Spacing.sm,
          gap: Spacing.xxl,
        },
        actionButton: {
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.md,
        },
        passButton: {
          backgroundColor: colors.background.elevated,
          borderWidth: 1.5,
          borderColor: colors.error + '30',
        },
        likeButtonWrap: {
          borderRadius: 32,
          overflow: 'hidden',
          ...shadows.md,
        },
        likeButtonGradient: {
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [colors, shadows, fonts]
  );

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const passAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: passScale.value }],
  }));

  const getDistanceText = (distance: number) => {
    if (distance < 1) return 'Right here!';
    if (distance < 10) return `${Math.round(distance)}m away`;
    if (distance < 1000) return `${Math.round(distance)}m away`;
    return `${(distance / 1000).toFixed(1)}km away`;
  };

  const getMatchColor = (score: number) => {
    if (score >= 80) return colors.success;
    if (score >= 50) return colors.warning;
    return colors.text.tertiary;
  };

  const matchGradientColors = useMemo((): [string, string] => {
    const s = user.match_score;
    if (s >= 80) return [colors.primary.default, colors.primary.dark];
    if (s >= 50) return [colors.primary.default, colors.primary.dark];
    return [colors.background.tertiary, colors.background.secondary];
  }, [colors, user.match_score]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.95}
      style={styles.cardContainer}
    >
      <View style={styles.card}>
        {/* Profile Image / Avatar placeholder */}
        <View style={styles.imageContainer}>
          <LinearGradient
            colors={[colors.background.elevated, colors.background.secondary]}
            style={styles.imagePlaceholder}
          >
            <AppText style={styles.placeholderText}>
              {user.username.charAt(0).toUpperCase()}
            </AppText>
            <AppText style={styles.hiddenPhotoLabel}>Photo unlocks on match</AppText>
          </LinearGradient>

          {/* Gradient fade overlay */}
          <LinearGradient
            colors={['transparent', colors.background.card + 'EE']}
            style={styles.imageFade}
          />

          {/* Match Score Badge — gradient */}
          <View style={styles.matchBadgeWrap}>
            <LinearGradient
              colors={matchGradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.matchBadgeGradient}
            >
              <AppText style={styles.matchText}>{user.match_score}</AppText>
              <AppText style={styles.matchLabel}>orbit score</AppText>
            </LinearGradient>
          </View>

          {/* Online Status */}
          {user.is_online && (
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <AppText style={styles.onlineText}>Online</AppText>
            </View>
          )}

          {/* User Info Overlay */}
          <View style={styles.userInfoOverlay}>
            <View style={styles.nameRow}>
              <AppText style={styles.username}>{user.username}</AppText>
              {user.is_verified && (
                <Ionicons name="checkmark-circle" size={18} color={colors.primary.default} />
              )}
            </View>
            <View style={styles.distanceRow}>
              <Ionicons name="location" size={13} color={colors.primary.default} />
              <AppText style={styles.distance}>{getDistanceText(user.distance)}</AppText>
            </View>
          </View>
        </View>

        {/* Bio */}
        {user.bio && (
          <View style={styles.bioContainer}>
            <AppText style={styles.bio} numberOfLines={2}>
              {user.bio}
            </AppText>
          </View>
        )}

        {/* Interests */}
        <View style={styles.interestsContainer}>
          <AppText style={styles.interestsLabel}>Common Interests</AppText>
          <View style={styles.interestsList}>
            {user.interests.slice(0, 4).map((interest) => (
              <InterestTag
                key={interest.id}
                interest={interest}
                selected={user.common_interests.includes(interest.id)}
                size="sm"
              />
            ))}
            {user.interests.length > 4 && (
              <View style={styles.moreInterests}>
                <AppText style={styles.moreText}>+{user.interests.length - 4}</AppText>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Animated.View style={passAnimatedStyle}>
            <TouchableOpacity
              onPress={onPass}
              onPressIn={() => (passScale.value = withSpring(0.9))}
              onPressOut={() => (passScale.value = withSpring(1))}
              style={[styles.actionButton, styles.passButton]}
            >
              <Ionicons name="close" size={30} color={colors.error} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[likeAnimatedStyle, styles.likeButtonWrap]}>
            <TouchableOpacity
              onPress={onLike}
              onPressIn={() => (likeScale.value = withSpring(0.9))}
              onPressOut={() => (likeScale.value = withSpring(1))}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.primary.default, colors.primary.dark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.likeButtonGradient}
              >
                <Ionicons name="heart" size={28} color={colors.text.primary} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default UserCard;
