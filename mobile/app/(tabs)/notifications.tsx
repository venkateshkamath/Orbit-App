import React, { useCallback } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOrbitTheme } from '../../src/theme';
import { AppText } from '../../src/ui/AppText';
import {
  useNotificationsQuery,
  useMarkNotificationReadMutation,
} from '../../src/hooks/useOrbitApi';
import type { AppNotification } from '../../src/types';

const CYAN = '#00B4D8';
const BLACK = '#0A0A0A';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function notifIcon(type: AppNotification['type']): React.ComponentProps<typeof Ionicons>['name'] {
  switch (type) {
    case 'orbit_join': return 'people';
    case 'message':    return 'chatbubble';
    case 'match':      return 'star';
    default:           return 'notifications';
  }
}

function NotifRow({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: (n: AppNotification) => void;
}) {
  const { fonts } = useOrbitTheme();
  const unread = item.read_at === null;
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        s.row,
        unread && s.rowUnread,
        pressed && s.rowPressed,
      ]}
    >
      <View style={s.iconWrap}>
        <Ionicons
          name={notifIcon(item.type)}
          size={18}
          color={unread ? CYAN : 'rgba(255,255,255,0.35)'}
        />
        {unread && <View style={s.unreadDot} />}
      </View>
      <View style={s.textWrap}>
        <AppText
          style={[
            s.title,
            {
              fontFamily: fonts.medium,
              color: unread ? '#F0F0F0' : 'rgba(255,255,255,0.55)',
            },
          ]}
        >
          {item.title}
        </AppText>
        <AppText style={[s.body, { fontFamily: fonts.regular }]}>
          {item.body}
        </AppText>
        <AppText style={[s.time, { fontFamily: fonts.regular }]}>
          {timeAgo(item.created_at)}
        </AppText>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { fonts } = useOrbitTheme();
  const { data, isLoading, refetch } = useNotificationsQuery();
  const markRead = useMarkNotificationReadMutation();

  const notifications = data?.results ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const handlePress = useCallback(
    (n: AppNotification) => {
      if (n.read_at === null) markRead.mutate(n.id);
    },
    [markRead],
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <AppText style={[s.headerTitle, { fontFamily: fonts.bold }]}>
          Notifications
        </AppText>
        {unreadCount > 0 && (
          <View style={s.badge}>
            <AppText style={[s.badgeText, { fontFamily: fonts.semibold }]}>
              {unreadCount}
            </AppText>
          </View>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotifRow item={item} onPress={handlePress} />
        )}
        contentContainerStyle={[
          s.list,
          { paddingBottom: 100 + insets.bottom },
          notifications.length === 0 && s.emptyFlex,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={CYAN}
            colors={[CYAN]}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={s.empty}>
              <Ionicons
                name="notifications-off-outline"
                size={52}
                color="rgba(255,255,255,0.12)"
              />
              <AppText style={[s.emptyTitle, { fontFamily: fonts.medium }]}>
                All caught up
              </AppText>
              <AppText style={[s.emptySub, { fontFamily: fonts.regular }]}>
                Notifications will appear here
              </AppText>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BLACK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: { fontSize: 22, color: '#F0F0F0', letterSpacing: -0.3 },
  badge: {
    backgroundColor: CYAN,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 12, color: '#000' },
  list:        {},
  emptyFlex:   { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowUnread:   { backgroundColor: 'rgba(0,180,216,0.05)' },
  rowPressed:  { backgroundColor: 'rgba(255,255,255,0.04)' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CYAN,
    borderWidth: 1.5,
    borderColor: BLACK,
  },
  textWrap:    { flex: 1, gap: 3 },
  title:       { fontSize: 14, lineHeight: 19 },
  body:        { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
  time:        { fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 2 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 80,
  },
  emptyTitle:  { fontSize: 17, color: 'rgba(255,255,255,0.38)' },
  emptySub:    { fontSize: 13, color: 'rgba(255,255,255,0.2)' },
});
