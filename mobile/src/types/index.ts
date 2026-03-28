/**
 * TypeScript types for ORBIT
 */

export interface Interest {
  id: string;
  name: string;
  emoji: string;
  category: string;
  color: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  bio: string;
  avatar: string | null;
  date_of_birth: string | null;
  interests: Interest[];
  latitude: number | null;
  longitude: number | null;
  is_discoverable: boolean;
  discovery_radius: number;
  show_online_status: boolean;
  is_online: boolean;
  last_seen: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface PublicUser {
  id: string;
  username: string;
  bio: string;
  avatar: string | null;
  interests: Interest[];
  is_online: boolean;
  last_seen: string | null;
  is_verified: boolean;
}

/** distance is meters from the viewer (server haversine). */
export interface NearbyUser extends PublicUser {
  distance: number;
  match_percentage: number;
  common_interests: string[];
  match_score: number;
}

export interface Message {
  id: string;
  conversation: string;
  sender: PublicUser;
  message_type: 'text' | 'image' | 'location' | 'emoji';
  content: string;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  is_read: boolean;
  read_at: string | null;
  reactions: { emoji: string; user_id: string }[];
  created_at: string;
}

export interface Conversation {
  id: string;
  participants: PublicUser[];
  other_participant: PublicUser | null;
  last_message: Message | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  matched_user: PublicUser;
  created_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface NearbyResponse {
  count: number;
  radius: number;
  users: NearbyUser[];
}

export interface LikeResponse {
  message: string;
  is_match: boolean;
  match: Match | null;
}

export interface OrbitState {
  you_sent_join: boolean;
  they_sent_join: boolean;
  matched: boolean;
  match_id: string | null;
}

export interface PublicProfileResponse {
  user: PublicUser;
  distance_m: number | null;
  is_self: boolean;
  orbit: OrbitState;
}

export interface LikeReceivedItem {
  id: string;
  from_user: PublicUser;
  created_at: string;
}

export interface AppNotification {
  id: string;
  type: 'orbit_join' | 'message' | 'match';
  title: string;
  body: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  author: {
    id: string;
    username: string;
    avatar: string | null;
  };
  caption: string;
  image: string | null;
  image_url: string | null;
  interests: Interest[];
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  recent_comments: Comment[];
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  author: {
    id: string;
    username: string;
    avatar: string | null;
  };
  text: string;
  parent: string | null;
  reply_count: number;
  created_at: string;
}

