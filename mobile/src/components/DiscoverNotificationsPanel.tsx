import React, { useMemo } from 'react';
import { View, Modal, Pressable, StyleSheet, FlatList, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { BorderRadius, FontSizes, FontWeights, Spacing } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';
import { useNotificationsQuery, useMarkNotificationReadMutation } from '../hooks/useOrbitApi';
import type { AppNotification } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function DiscoverNotificationsPanel({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, shadows, resolvedScheme, fonts } = useOrbitTheme();
  const { data, isLoading, isError, refetch } = useNotificationsQuery();
  const markRead = useMarkNotificationReadMutation();
  const isDark = resolvedScheme === 'dark';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
        },
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.overlay,
        },
        sheetWrap: {
          ...StyleSheet.absoluteFillObject,
          pointerEvents: 'box-none',
        },
        sheet: {
          marginTop: insets.top + 52,
          marginHorizontal: Spacing.md,
          maxHeight: '58%',
          backgroundColor: colors.background.elevated,
          borderRadius: BorderRadius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          overflow: 'hidden',
          ...shadows.lg,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.md,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        headerTitle: {
          fontSize: FontSizes.lg,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
          fontFamily: fonts.bold,
        },
        closeBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? colors.background.tertiary : colors.background.secondary,
        },
        listContent: {
          paddingVertical: 8,
          paddingBottom: insets.bottom + 12,
        },
        row: {
          flexDirection: 'row',
          paddingHorizontal: Spacing.md,
          paddingVertical: 12,
          gap: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        rowUnread: {
          backgroundColor: isDark ? colors.primary.default + '14' : colors.primary.default + '12',
        },
        iconWrap: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.background.tertiary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        rowBody: { flex: 1 },
        rowTitle: {
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.semibold,
          color: colors.text.primary,
          fontFamily: fonts.semibold,
        },
        rowMeta: {
          marginTop: 2,
          fontSize: 11,
          color: colors.text.tertiary,
          fontFamily: fonts.regular,
        },
        empty: {
          padding: Spacing.xl,
          alignItems: 'center',
        },
        emptyText: {
          color: colors.text.tertiary,
          fontSize: FontSizes.sm,
          textAlign: 'center',
          fontFamily: fonts.regular,
        },
      }),
    [colors, shadows, isDark, insets.bottom, fonts]
  );

  const results = data?.results ?? [];

  const renderItem = ({ item }: { item: AppNotification }) => {
    const unread = item.read_at == null;
    const icon =
      item.type === 'match'
        ? 'heart'
        : item.type === 'message'
          ? 'chatbubble'
          : 'sparkles';
    return (
      <Pressable
        onPress={() => {
          if (unread) markRead.mutate(item.id);
        }}
        style={[styles.row, unread && styles.rowUnread]}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.primary.default} />
        </View>
        <View style={styles.rowBody}>
          <AppText style={styles.rowTitle} numberOfLines={2}>
            {item.title}
          </AppText>
          {item.body ? (
            <AppText style={[styles.rowMeta, { marginTop: 4, color: colors.text.secondary }]} numberOfLines={2}>
              {item.body}
            </AppText>
          ) : null}
          <AppText style={styles.rowMeta}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </AppText>
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close notifications" />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheet}>
          <View style={styles.header}>
            <AppText style={styles.headerTitle}>Notifications</AppText>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text.primary} />
            </Pressable>
          </View>
          {isLoading ? (
            <View style={[styles.empty, { paddingVertical: 40 }]}>
              <ActivityIndicator color={colors.primary.default} />
            </View>
          ) : isError ? (
            <View style={styles.empty}>
              <AppText style={styles.emptyText}>Could not load notifications.</AppText>
              <Pressable onPress={() => refetch()} style={{ marginTop: 12 }}>
                <AppText style={{ color: colors.primary.default, fontWeight: '600', fontFamily: fonts.semibold }}>
                  Retry
                </AppText>
              </Pressable>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.text.tertiary} />
              <AppText style={[styles.emptyText, { marginTop: 12 }]}>You are all caught up.</AppText>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={Platform.OS !== 'web'}
            />
          )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
