import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { chatApi } from '../api/chat';
import { connectionsApi } from '../api/connections';
import { discoveryApi } from '../api/discovery';
import { postApi } from '../api/posts';
import { notificationsApi } from '../api/notifications';
import { eventsApi } from '../api/events';
import type { Conversation, Message, Post, PublicProfileResponse, LikeReceivedItem } from '../types';
import { useAuthStore } from '../stores';
import { locationKeyPart, orbitKeys } from './orbitKeys';

export function useFeedQuery(interestId?: string) {
  return useQuery({
    queryKey: orbitKeys.feed(interestId),
    queryFn: () => postApi.getFeed(interestId),
  });
}

export function useToggleLikeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => postApi.likePost(postId),
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: ['orbit', 'feed'] });
      const feedQueries = qc.getQueriesData<Post[]>({ queryKey: ['orbit', 'feed'] });
      const snapshots = feedQueries.map(([key, data]) => [key, data] as const);
      for (const [key] of feedQueries) {
        qc.setQueryData<Post[]>(key, (old) =>
          (old ?? []).map((p) =>
            p.id === postId
              ? { ...p, is_liked: !p.is_liked, like_count: p.like_count + (p.is_liked ? -1 : 1) }
              : p
          )
        );
      }
      return { snapshots };
    },
    onError: (_err, _postId, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, data] of ctx.snapshots) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['orbit', 'feed'] });
    },
  });
}

export function useCreatePostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => postApi.createPost(formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orbit', 'feed'] });
    },
  });
}

export function useDeletePostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => postApi.deletePost(postId),
    onMutate: async (postId: string) => {
      await qc.cancelQueries({ queryKey: ['orbit', 'feed'] });
      const previousFeed = qc.getQueryData<Post[]>(orbitKeys.feed());
      qc.setQueryData<Post[]>(orbitKeys.feed(), (old) =>
        (old ?? []).filter((p) => p.id !== postId)
      );
      return { previousFeed };
    },
    onError: (_err, _postId, ctx) => {
      if (ctx?.previousFeed !== undefined) {
        qc.setQueryData(orbitKeys.feed(), ctx.previousFeed);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['orbit', 'feed'] });
    },
  });
}

export function usePostCommentsQuery(postId: string | null, visible: boolean) {
  return useQuery({
    queryKey: postId ? orbitKeys.postComments(postId) : ['orbit', 'posts', 'none', 'comments'],
    queryFn: () => postApi.getComments(postId!),
    enabled: Boolean(visible && postId),
  });
}

export function useAddCommentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, text }: { postId: string; text: string }) =>
      postApi.addComment(postId, text),
    onSuccess: (_, { postId }) => {
      qc.invalidateQueries({ queryKey: orbitKeys.postComments(postId) });
      qc.invalidateQueries({ queryKey: ['orbit', 'feed'] });
    },
  });
}

export function useInterestsQuery() {
  return useQuery({
    queryKey: orbitKeys.interests(),
    queryFn: () => authApi.getInterests(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDiscoverNextQuery(
  radius: number,
  lat: number | null | undefined,
  lng: number | null | undefined
) {
  const { latKey, lngKey } = locationKeyPart(lat, lng);
  return useQuery({
    queryKey: orbitKeys.discoverNext(radius, latKey, lngKey),
    queryFn: () => discoveryApi.getNextUser(radius),
    enabled: lat != null && lng != null,
    staleTime: 15 * 1000,
  });
}

export function useNearbyUsersQuery(
  radius: number,
  lat: number | null | undefined,
  lng: number | null | undefined,
  enabled: boolean
) {
  const { latKey, lngKey } = locationKeyPart(lat, lng);
  return useQuery({
    queryKey: orbitKeys.discoverNearby(radius, latKey, lngKey),
    queryFn: () => discoveryApi.getNearbyUsers(radius),
    enabled: enabled && lat != null && lng != null,
    staleTime: 30 * 1000,
  });
}

export function useMatchesQuery() {
  return useQuery({
    queryKey: orbitKeys.matches(),
    queryFn: async () => {
      const res = await discoveryApi.getMatches();
      return res.results ?? [];
    },
    staleTime: 30 * 1000,
  });
}

export function usePublicProfileQuery(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? orbitKeys.publicProfile(userId) : ['orbit', 'users', 'profile', 'none'],
    queryFn: () => authApi.getPublicProfile(userId!),
    enabled: Boolean(userId),
    staleTime: 15 * 1000,
  });
}

export function useLikesReceivedQuery() {
  return useQuery({
    queryKey: orbitKeys.likesReceived(),
    queryFn: async () => {
      const res = await discoveryApi.getLikesReceived();
      return res.results ?? [];
    },
    staleTime: 20 * 1000,
  });
}

export function useNotificationsQuery() {
  return useQuery({
    queryKey: orbitKeys.notifications(),
    queryFn: () => notificationsApi.list(),
    staleTime: 20 * 1000,
  });
}

export function useMarkNotificationReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orbitKeys.notifications() });
    },
  });
}

export function useLikeUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => discoveryApi.likeUser(userId),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: orbitKeys.publicProfile(userId) });
      const prevProfile = qc.getQueryData<PublicProfileResponse>(orbitKeys.publicProfile(userId));

      if (prevProfile) {
        const { orbit } = prevProfile;
        const willMatch = orbit.they_sent_join && !orbit.you_sent_join;
        qc.setQueryData<PublicProfileResponse>(orbitKeys.publicProfile(userId), {
          ...prevProfile,
          orbit: willMatch
            ? { ...orbit, matched: true, you_sent_join: true }
            : { ...orbit, you_sent_join: true },
        });
      }

      const prevLikes = qc.getQueryData<LikeReceivedItem[]>(orbitKeys.likesReceived());
      if (prevLikes) {
        qc.setQueryData<LikeReceivedItem[]>(
          orbitKeys.likesReceived(),
          prevLikes.filter((l) => l.from_user.id !== userId)
        );
      }

      return { prevProfile, prevLikes };
    },
    onError: (_err, userId, ctx) => {
      if (ctx?.prevProfile) {
        qc.setQueryData(orbitKeys.publicProfile(userId), ctx.prevProfile);
      }
      if (ctx?.prevLikes) {
        qc.setQueryData(orbitKeys.likesReceived(), ctx.prevLikes);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['orbit', 'discover'] });
      qc.invalidateQueries({ queryKey: orbitKeys.matches() });
      qc.invalidateQueries({ queryKey: orbitKeys.likesReceived() });
      qc.invalidateQueries({ queryKey: orbitKeys.notifications() });
      qc.invalidateQueries({ queryKey: ['orbit', 'users', 'profile'] });
    },
  });
}

export function usePassUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => discoveryApi.passUser(userId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['orbit', 'discover'] });
      const discoverQueries = qc.getQueriesData<{ user: unknown }>({ queryKey: ['orbit', 'discover', 'next'] });
      const snapshots = discoverQueries.map(([key, data]) => [key, data] as const);
      for (const [key] of discoverQueries) {
        qc.setQueryData(key, (old: any) => (old ? { ...old, user: null } : old));
      }
      return { snapshots };
    },
    onError: (_err, _userId, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, data] of ctx.snapshots) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['orbit', 'discover'] });
    },
  });
}

export function useUnmatchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => discoveryApi.unmatch(matchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orbitKeys.matches() });
    },
  });
}

export function useConversationsQuery() {
  return useQuery({
    queryKey: orbitKeys.conversations(),
    queryFn: async () => {
      const res = await chatApi.getConversations();
      return res.results ?? [];
    },
    staleTime: 45 * 1000,
  });
}

export function useConversationQuery(conversationId: string | undefined) {
  return useQuery({
    queryKey: conversationId ? orbitKeys.conversation(conversationId) : ['orbit', 'chat', 'conversation', 'none'],
    queryFn: () => chatApi.getConversation(conversationId!),
    enabled: Boolean(conversationId),
    staleTime: 60 * 1000,
  });
}

export function useMessagesQuery(conversationId: string | undefined) {
  return useQuery({
    queryKey: conversationId ? orbitKeys.messages(conversationId) : ['orbit', 'chat', 'messages', 'none'],
    queryFn: async () => {
      const res = await chatApi.getMessages(conversationId!);
      return [...(res.results ?? [])].reverse();
    },
    enabled: Boolean(conversationId),
    staleTime: 10 * 1000,
    refetchInterval: conversationId ? 90_000 : false,
  });
}

type SendMsgCtx = { previous?: Message[]; tempId?: string };

export function useSendMessageMutation() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      chatApi.sendMessage(conversationId, content),
    onMutate: async ({ conversationId, content }): Promise<SendMsgCtx> => {
      if (!user) return {};
      await qc.cancelQueries({ queryKey: orbitKeys.messages(conversationId) });
      const previous = qc.getQueryData<Message[]>(orbitKeys.messages(conversationId));
      const tempId = `pending:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
      const optimistic: Message = {
        id: tempId,
        conversation: conversationId,
        sender: {
          id: user.id,
          username: user.username,
          bio: user.bio,
          avatar: user.avatar,
          interests: user.interests,
          is_online: user.is_online,
          last_seen: user.last_seen,
          is_verified: user.is_verified,
        },
        message_type: 'text',
        content,
        image: null,
        latitude: null,
        longitude: null,
        is_read: true,
        read_at: null,
        reactions: [],
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<Message[]>(orbitKeys.messages(conversationId), (old) => [
        ...(old ?? []),
        optimistic,
      ]);
      return { previous, tempId };
    },
    onError: (_err, { conversationId }, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(orbitKeys.messages(conversationId), ctx.previous);
      }
    },
    onSuccess: (serverMessage, { conversationId }, ctx) => {
      if (ctx?.tempId) {
        qc.setQueryData<Message[]>(orbitKeys.messages(conversationId), (old) =>
          (old ?? []).map((m) => (m.id === ctx.tempId ? serverMessage : m))
        );
      } else {
        qc.invalidateQueries({ queryKey: orbitKeys.messages(conversationId) });
      }

      const convList = qc.getQueryData<Conversation[]>(orbitKeys.conversations());
      const hasConv = convList?.some((c) => c.id === conversationId);
      if (hasConv && convList) {
        const next = convList.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                last_message: serverMessage,
                updated_at: serverMessage.created_at,
                unread_count: 0,
              }
            : c
        );
        next.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        qc.setQueryData(orbitKeys.conversations(), next);
      } else {
        void qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
      }
    },
  });
}

export function useMarkReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.markAsRead(conversationId),
    onMutate: async (conversationId) => {
      await qc.cancelQueries({ queryKey: orbitKeys.conversations() });
      const prevConvs = qc.getQueryData<Conversation[]>(orbitKeys.conversations());
      if (prevConvs) {
        qc.setQueryData<Conversation[]>(
          orbitKeys.conversations(),
          prevConvs.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
        );
      }
      const prevConv = qc.getQueryData<Conversation>(orbitKeys.conversation(conversationId));
      if (prevConv) {
        qc.setQueryData<Conversation>(orbitKeys.conversation(conversationId), {
          ...prevConv,
          unread_count: 0,
        });
      }
      return { prevConvs, prevConv, conversationId };
    },
    onError: (_err, conversationId, ctx) => {
      if (ctx?.prevConvs) qc.setQueryData(orbitKeys.conversations(), ctx.prevConvs);
      if (ctx?.prevConv) qc.setQueryData(orbitKeys.conversation(conversationId), ctx.prevConv);
    },
    onSettled: (_, __, conversationId) => {
      qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
      qc.invalidateQueries({ queryKey: orbitKeys.conversation(conversationId) });
    },
  });
}

export function useClearConversationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.clearConversation(conversationId),
    onSuccess: (_, conversationId) => {
      qc.setQueryData<Message[]>(orbitKeys.messages(conversationId), []);
      qc.invalidateQueries({ queryKey: orbitKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
    },
  });
}

export function useDeleteMessageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId }: { messageId: string; conversationId: string }) =>
      chatApi.deleteMessage(messageId),
    onMutate: async ({ messageId, conversationId }) => {
      await qc.cancelQueries({ queryKey: orbitKeys.messages(conversationId) });
      const previous = qc.getQueryData<Message[]>(orbitKeys.messages(conversationId));
      qc.setQueryData<Message[]>(orbitKeys.messages(conversationId), (old) =>
        (old ?? []).filter((m) => m.id !== messageId)
      );
      return { previous, conversationId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(orbitKeys.messages(ctx.conversationId), ctx.previous);
      }
    },
    onSuccess: (_data, { conversationId }) => {
      qc.invalidateQueries({ queryKey: orbitKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
    },
  });
}

export function useBlockConversationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.blockConversationUser(conversationId),
    onMutate: async (conversationId) => {
      await qc.cancelQueries({ queryKey: orbitKeys.conversation(conversationId) });
      await qc.cancelQueries({ queryKey: orbitKeys.conversations() });

      const prevConv = qc.getQueryData<Conversation>(orbitKeys.conversation(conversationId));
      if (prevConv) {
        qc.setQueryData<Conversation>(orbitKeys.conversation(conversationId), {
          ...prevConv,
          is_blocked: true,
          blocked_by_me: true,
        });
      }

      const prevConvs = qc.getQueryData<Conversation[]>(orbitKeys.conversations());
      if (prevConvs) {
        qc.setQueryData<Conversation[]>(
          orbitKeys.conversations(),
          prevConvs.map((c) =>
            c.id === conversationId ? { ...c, is_blocked: true, blocked_by_me: true } : c
          )
        );
      }

      return { prevConv, prevConvs, conversationId };
    },
    onError: (_err, conversationId, ctx) => {
      if (ctx?.prevConv) qc.setQueryData(orbitKeys.conversation(conversationId), ctx.prevConv);
      if (ctx?.prevConvs) qc.setQueryData(orbitKeys.conversations(), ctx.prevConvs);
    },
    onSettled: (_, __, conversationId) => {
      qc.invalidateQueries({ queryKey: orbitKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
      qc.invalidateQueries({ queryKey: orbitKeys.matches() });
      qc.invalidateQueries({ queryKey: orbitKeys.likesReceived() });
    },
  });
}

export function useUnblockConversationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.unblockConversationUser(conversationId),
    onMutate: async (conversationId) => {
      await qc.cancelQueries({ queryKey: orbitKeys.conversation(conversationId) });
      await qc.cancelQueries({ queryKey: orbitKeys.conversations() });

      const prevConv = qc.getQueryData<Conversation>(orbitKeys.conversation(conversationId));
      if (prevConv) {
        qc.setQueryData<Conversation>(orbitKeys.conversation(conversationId), {
          ...prevConv,
          is_blocked: prevConv.blocked_by_other,
          blocked_by_me: false,
        });
      }

      const prevConvs = qc.getQueryData<Conversation[]>(orbitKeys.conversations());
      if (prevConvs) {
        qc.setQueryData<Conversation[]>(
          orbitKeys.conversations(),
          prevConvs.map((c) =>
            c.id === conversationId
              ? { ...c, is_blocked: c.blocked_by_other, blocked_by_me: false }
              : c
          )
        );
      }

      return { prevConv, prevConvs, conversationId };
    },
    onError: (_err, conversationId, ctx) => {
      if (ctx?.prevConv) qc.setQueryData(orbitKeys.conversation(conversationId), ctx.prevConv);
      if (ctx?.prevConvs) qc.setQueryData(orbitKeys.conversations(), ctx.prevConvs);
    },
    onSettled: (_, __, conversationId) => {
      qc.invalidateQueries({ queryKey: orbitKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
      qc.invalidateQueries({ queryKey: orbitKeys.matches() });
      qc.invalidateQueries({ queryKey: orbitKeys.likesReceived() });
    },
  });
}

export function useSearchUsersQuery(q: string) {
  return useQuery({
    queryKey: orbitKeys.searchUsers(q),
    queryFn: () => authApi.searchUsers(q),
    enabled: q.trim().length >= 2,
    staleTime: 15 * 1000,
  });
}

export function useSendConnectionRequestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => connectionsApi.sendRequest(targetUserId),
    onSuccess: (_data, targetUserId) => {
      // Refresh all open search result pages so orbit state updates
      qc.invalidateQueries({ queryKey: ['orbit', 'users', 'search'] });
      qc.invalidateQueries({ queryKey: orbitKeys.publicProfile(targetUserId) });
    },
  });
}

export function useStartConversationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, message }: { userId: string; message?: string }) =>
      chatApi.startConversation(userId, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
    },
  });
}

export function useNearbyEventsQuery(
  lat: number | null | undefined,
  lng: number | null | undefined,
  radius = 5000,
  enabled = true,
) {
  const { latKey, lngKey } = locationKeyPart(lat, lng);
  return useQuery({
    queryKey: orbitKeys.nearbyEvents(latKey, lngKey, radius),
    queryFn: () => eventsApi.getNearby(lat!, lng!, radius),
    enabled: enabled && lat != null && lng != null,
    staleTime: 30 * 1000,
  });
}

export function useCreateEventMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => eventsApi.create(formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orbit', 'events'] });
    },
  });
}

export function useDeleteEventMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => eventsApi.remove(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orbit', 'events'] });
    },
  });
}
