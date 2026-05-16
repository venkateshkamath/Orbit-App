/**
 * Other user's public profile — distance, Join orbit / Accept / Message
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme } from '../../src/theme';
import { AppText } from '../../src/ui/AppText';
import { Avatar, GradientButton, InterestTag, MatchModal } from '../../src/components';
import {
  usePublicProfileQuery,
  useLikeUserMutation,
  useStartConversationMutation,
} from '../../src/hooks/useOrbitApi';
import { PublicUser } from '../../src/types';

function formatDistanceMeters(m: number | null) {
  if (m == null) return 'Distance unknown';
  if (m === 0) return 'You';
  if (m < 1000) return `${Math.round(m)} m away`;
  return `${(m / 1000).toFixed(1)} km away`;
}

export default function UserProfileScreen() {
  const { colors, fonts } = useOrbitTheme();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === 'string' ? rawId : rawId?.[0];
  const insets = useSafeAreaInsets();
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<PublicUser | null>(null);

  const { data, isPending, error, refetch } = usePublicProfileQuery(id);
  const likeMut = useLikeUserMutation();
  const startConversationMut = useStartConversationMutation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.background.primary,
        },
        /* ── hero ── */
        heroWrap: {
          overflow: 'hidden',
          paddingBottom: Spacing.xl,
        },
        heroBg: {
          ...StyleSheet.absoluteFillObject,
        },
        topBar: {
          paddingHorizontal: Spacing.sm,
          paddingBottom: Spacing.sm,
          paddingTop: Platform.OS === 'android' ? Spacing.sm : 0,
        },
        iconBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background.elevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
        },
        avatarWrap: {
          alignSelf: 'center',
          marginTop: Spacing.md,
        },
        avatarRing: {
          padding: 3,
          borderRadius: 999,
        },
        username: {
          marginTop: Spacing.md,
          fontSize: 28,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
          textAlign: 'center',
          letterSpacing: 0,
          fontFamily: fonts.bold,
          paddingHorizontal: Spacing.lg,
        },
        distanceBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'center',
          marginTop: Spacing.sm,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 4,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.primary.default + '18',
          borderWidth: 1,
          borderColor: colors.primary.default + '44',
          gap: 4,
        },
        distanceText: {
          fontSize: FontSizes.xs,
          fontWeight: FontWeights.semibold,
          color: colors.text.primary,
          fontFamily: fonts.semibold,
        },
        /* ── body ── */
        scrollContent: {
          paddingHorizontal: Spacing.xl,
          paddingBottom: Spacing.xxl,
          alignItems: 'center',
        },
        bio: {
          marginTop: Spacing.lg,
          fontSize: FontSizes.md,
          color: colors.text.secondary,
          textAlign: 'center',
          lineHeight: 22,
          fontFamily: fonts.regular,
        },
        interests: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: Spacing.sm,
          marginTop: Spacing.lg,
        },
        cta: {
          marginTop: Spacing.xl,
          alignSelf: 'stretch',
          width: '100%',
        },
        secondaryBtn: {
          marginTop: Spacing.md,
          alignSelf: 'stretch',
          paddingVertical: 14,
          alignItems: 'center',
          borderRadius: BorderRadius.full,
          borderWidth: 1.5,
          borderColor: colors.primary.default,
        },
        secondaryBtnText: {
          color: colors.primary.dark,
          fontSize: FontSizes.md,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
        centered: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background.primary,
          padding: Spacing.lg,
        },
        muted: {
          color: colors.text.tertiary,
          fontSize: FontSizes.md,
        },
        backLink: {
          marginTop: Spacing.md,
        },
        backLinkText: {
          color: colors.primary.default,
          fontSize: FontSizes.md,
        },
      }),
    [colors, fonts]
  );

  useEffect(() => {
    if (data?.is_self) {
      router.replace('/(tabs)/profile');
    }
  }, [data?.is_self]);

  const onJoinOrAccept = async () => {
    if (!id) return;
    try {
      const result = await likeMut.mutateAsync(id);
      await refetch();
      if (result.is_match && result.match?.matched_user) {
        setMatchedUser(result.match.matched_user);
        setShowMatchModal(true);
      }
    } catch {
      Alert.alert('Error', 'Could not update orbit request.');
    }
  };

  const onMessage = async () => {
    if (!id) return;
    try {
      const conversation = await startConversationMut.mutateAsync({ userId: id });
      router.push(`/chat/${conversation.id}`);
    } catch {
      Alert.alert('Error', 'You can message after you are both in each other’s orbit.');
    }
  };

  const onMatchModalMessage = async () => {
    if (!matchedUser) return;
    try {
      const conversation = await startConversationMut.mutateAsync({
        userId: matchedUser.id,
      });
      setShowMatchModal(false);
      router.push(`/chat/${conversation.id}`);
    } catch {
      Alert.alert('Error', 'Failed to open chat.');
    }
  };

  if (!id) {
    return (
      <View style={styles.centered}>
        <AppText style={styles.muted}>Invalid profile.</AppText>
      </View>
    );
  }

  if (isPending) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary.default} size="large" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <AppText style={styles.muted}>Could not load this profile.</AppText>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <AppText style={styles.backLinkText}>Go back</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  if (data.is_self) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary.default} />
      </View>
    );
  }

  const { user, distance_m, orbit } = data;

  let primaryLabel = 'Join orbit';
  let primaryDisabled = false;
  if (orbit.matched) {
    primaryLabel = 'Message';
  } else if (orbit.they_sent_join && !orbit.you_sent_join) {
    primaryLabel = 'Accept';
  } else if (orbit.you_sent_join && !orbit.they_sent_join) {
    primaryLabel = 'Request sent';
    primaryDisabled = true;
  }

  const onPrimary = () => {
    if (orbit.matched) {
      onMessage();
    } else if (!primaryDisabled) {
      onJoinOrAccept();
    }
  };

  return (
    <View style={styles.root}>
      {/* Hero area */}
      <View style={styles.heroWrap}>
        <LinearGradient
          colors={[colors.primary.dark + '55', colors.background.secondary + 'CC', colors.background.primary]}
          locations={[0, 0.6, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroBg}
        />
        <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === 'android' ? 16 : 4) }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={[colors.primary.default, colors.primary.dark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <Avatar uri={user.avatar} name={user.username} size={96} showOnline isOnline={user.is_online} />
          </LinearGradient>
        </View>

        <AppText style={styles.username}>{user.username}</AppText>

        <View style={styles.distanceBadge}>
          <Ionicons name="location-outline" size={12} color={colors.primary.default} />
          <AppText style={styles.distanceText}>{formatDistanceMeters(distance_m)}</AppText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {user.bio ? <AppText style={styles.bio}>{user.bio}</AppText> : null}

        {user.interests.length > 0 && (
          <View style={styles.interests}>
            {user.interests.map((interest) => (
              <InterestTag key={interest.id} interest={interest} selected size="sm" />
            ))}
          </View>
        )}

        <GradientButton
          title={primaryLabel}
          onPress={onPrimary}
          style={styles.cta}
          loading={likeMut.isPending || startConversationMut.isPending}
          disabled={primaryDisabled}
        />

        {orbit.matched && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={onMessage} disabled={startConversationMut.isPending}>
            <AppText style={styles.secondaryBtnText}>View conversation</AppText>
          </TouchableOpacity>
        )}
      </ScrollView>

      <MatchModal
        visible={showMatchModal}
        user={matchedUser}
        onClose={() => setShowMatchModal(false)}
        onMessage={onMatchModalMessage}
      />
    </View>
  );
}
