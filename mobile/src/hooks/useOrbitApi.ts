import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { chatApi } from '../api/chat';
import { discoveryApi } from '../api/discovery';
import { postApi } from '../api/posts';
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

export function useLikeUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => discoveryApi.likeUser(userId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['orbit', 'discover'] });
      qc.invalidateQueries({ queryKey: orbitKeys.matches() });
    },
  });
}

export function usePassUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => discoveryApi.passUser(userId),
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
    staleTime: 20 * 1000,
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
  });
}

export function useSendMessageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      chatApi.sendMessage(conversationId, content),
    onSuccess: (_, { conversationId }) => {
      qc.invalidateQueries({ queryKey: orbitKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
    },
  });
}

export function useMarkReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.markAsRead(conversationId),
    onSuccess: (_, conversationId) => {
      qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
      qc.invalidateQueries({ queryKey: orbitKeys.conversation(conversationId) });
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
