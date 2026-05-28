import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { AppText } from '../../src/ui/AppText';
import { Avatar } from '../../src/components';
import { useEventQuery, useJoinEventMutation } from '../../src/hooks/useOrbitApi';
import { useOrbitTheme } from '../../src/theme';
import { BorderRadius, FontSizes, FontWeights, Spacing } from '../../constants/Colors';

const SWIPE_WIDTH = 300;
const KNOB = 58;

export default function EventDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { colors, fonts, shadows } = useOrbitTheme();
  const { data: event, isPending } = useEventQuery(id);
  const joinEvent = useJoinEventMutation();
  const knobX = useRef(new Animated.Value(0)).current;
  const [joined, setJoined] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background.primary },
        safe: { flex: 1 },
        top: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.lg,
          paddingTop: Platform.OS === 'android' ? Spacing.md : Spacing.sm,
          paddingBottom: Spacing.sm,
        },
        iconBtn: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background.elevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
        },
        content: {
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.xxl,
        },
        hero: {
          minHeight: 184,
          borderRadius: 22,
          overflow: 'hidden',
          padding: Spacing.lg,
          justifyContent: 'flex-end',
          ...shadows.md,
        },
        heroGlow: { ...StyleSheet.absoluteFillObject },
        category: {
          alignSelf: 'flex-start',
          paddingHorizontal: Spacing.md,
          paddingVertical: 7,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.background.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          marginBottom: 12,
        },
        categoryText: {
          color: colors.text.secondary,
          fontSize: FontSizes.sm,
          fontFamily: fonts.semibold,
          fontWeight: FontWeights.semibold,
        },
        title: {
          color: colors.text.primary,
          fontSize: 28,
          lineHeight: 34,
          fontFamily: fonts.extrabold,
          fontWeight: FontWeights.extrabold,
        },
        metaGrid: {
          marginTop: Spacing.lg,
          gap: Spacing.sm,
        },
        metaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
          padding: Spacing.md,
          borderRadius: BorderRadius.lg,
          backgroundColor: colors.background.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
        },
        metaText: {
          flex: 1,
          color: colors.text.primary,
          fontSize: FontSizes.md,
          fontFamily: fonts.medium,
        },
        sectionTitle: {
          marginTop: Spacing.xl,
          marginBottom: Spacing.sm,
          color: colors.text.primary,
          fontSize: 18,
          fontFamily: fonts.semibold,
          fontWeight: FontWeights.semibold,
        },
        body: {
          color: colors.text.secondary,
          fontSize: FontSizes.body,
          lineHeight: 24,
          fontFamily: fonts.regular,
        },
        organizer: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
          marginTop: Spacing.md,
        },
        organizerText: {
          color: colors.text.secondary,
          fontSize: FontSizes.sm,
          fontFamily: fonts.medium,
        },
        swipeWrap: {
          width: SWIPE_WIDTH,
          maxWidth: '100%',
          height: 66,
          borderRadius: 33,
          backgroundColor: colors.background.card,
          borderWidth: 1,
          borderColor: colors.borderLight,
          alignSelf: 'center',
          marginTop: Spacing.xxl,
          justifyContent: 'center',
          overflow: 'hidden',
        },
        swipeLabel: {
          textAlign: 'center',
          color: colors.text.secondary,
          fontSize: FontSizes.md,
          fontFamily: fonts.semibold,
          fontWeight: FontWeights.semibold,
        },
        knob: {
          position: 'absolute',
          left: 4,
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary.default,
        },
        centered: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [colors, fonts, shadows]
  );

  const openGroup = (conversationId?: string | null) => {
    if (conversationId) router.replace(`/chat/${conversationId}`);
  };

  const doJoin = async () => {
    if (!id || joinEvent.isPending) return;
    const res = await joinEvent.mutateAsync(id);
    setJoined(true);
    openGroup(res.conversation_id);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8,
        onPanResponderMove: (_, gesture) => {
          knobX.setValue(Math.max(0, Math.min(gesture.dx, SWIPE_WIDTH - KNOB - 8)));
        },
        onPanResponderRelease: async (_, gesture) => {
          const complete = gesture.dx > SWIPE_WIDTH * 0.48;
          Animated.spring(knobX, {
            toValue: complete ? SWIPE_WIDTH - KNOB - 8 : 0,
            useNativeDriver: true,
          }).start();
          if (complete) await doJoin();
        },
      }),
    [doJoin, knobX]
  );

  if (isPending) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.primary.default} size="large" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.root, styles.centered]}>
        <AppText style={{ color: colors.text.secondary }}>Event not found.</AppText>
      </View>
    );
  }

  const hasJoined = joined || event.has_joined;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          {hasJoined && event.conversation_id ? (
            <TouchableOpacity style={styles.iconBtn} onPress={() => openGroup(event.conversation_id)}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          ) : <View style={{ width: 42 }} />}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <LinearGradient
              colors={[colors.background.card, colors.background.secondary, colors.primary.default + '22']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGlow}
            />
            <View style={styles.category}>
              <AppText style={styles.categoryText}>{event.category}</AppText>
            </View>
            <AppText style={styles.title}>{event.title}</AppText>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary.default} />
              <AppText style={styles.metaText}>{format(new Date(event.start_at), 'EEE, MMM d · h:mm a')}</AppText>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={20} color={colors.primary.default} />
              <AppText style={styles.metaText}>{event.location_name}</AppText>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="people-outline" size={20} color={colors.primary.default} />
              <AppText style={styles.metaText}>{event.attendee_count} joined</AppText>
            </View>
          </View>

          <AppText style={styles.sectionTitle}>Details</AppText>
          <AppText style={styles.body}>{event.description}</AppText>

          {event.organizer ? (
            <>
              <AppText style={styles.sectionTitle}>Host</AppText>
              <View style={styles.organizer}>
                <Avatar uri={event.organizer.avatar} name={event.organizer.username} size={36} />
                <AppText style={styles.organizerText}>{event.organizer.username}</AppText>
              </View>
            </>
          ) : null}

          {hasJoined ? (
            <TouchableOpacity style={styles.swipeWrap} onPress={() => openGroup(event.conversation_id)}>
              <AppText style={styles.swipeLabel}>Open event group</AppText>
            </TouchableOpacity>
          ) : (
            <View style={styles.swipeWrap} {...panResponder.panHandlers}>
              <AppText style={styles.swipeLabel}>{joinEvent.isPending ? 'Joining...' : 'Swipe to join'}</AppText>
              <Animated.View style={[styles.knob, { transform: [{ translateX: knobX }] }]}>
                <Ionicons name="chevron-forward" size={24} color={colors.text.primary} />
              </Animated.View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
