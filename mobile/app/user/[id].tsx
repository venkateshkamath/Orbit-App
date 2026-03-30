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
  const { colors } = useOrbitTheme();
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
        topBar: {
          paddingHorizontal: Spacing.sm,
          paddingBottom: Spacing.sm,
          paddingTop: Platform.OS === 'android' ? Spacing.sm : 0,
        },
        iconBtn: {
          alignSelf: 'flex-start',
          padding: Spacing.xs,
        },
        scrollContent: {
          paddingHorizontal: Spacing.xl,
          paddingBottom: Spacing.xxl,
          alignItems: 'center',
        },
        username: {
          marginTop: Spacing.lg,
          fontSize: FontSizes.xxl,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
        },
        distance: {
          marginTop: Spacing.xs,
          fontSize: FontSizes.sm,
          color: colors.text.secondary,
        },
        bio: {
          marginTop: Spacing.md,
          fontSize: FontSizes.md,
          color: colors.text.secondary,
          textAlign: 'center',
          lineHeight: 22,
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
    [colors]
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
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === 'android' ? 16 : 4) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Avatar uri={user.avatar} name={user.username} size={96} showOnline isOnline={user.is_online} />
        <AppText style={styles.username}>{user.username}</AppText>
        <AppText style={styles.distance}>{formatDistanceMeters(distance_m)}</AppText>
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
