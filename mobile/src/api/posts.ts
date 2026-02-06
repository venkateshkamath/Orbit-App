/**
 * Posts API
 */

import api from './client';
import { Post, Comment } from '../types';

export const postApi = {
  getFeed: async (interestId?: string): Promise<Post[]> => {
    const response = await api.get('/posts/feed/', {
      params: { interest: interestId }
    });
    return response.data;
  },

  getMyPosts: async (): Promise<Post[]> => {
    const response = await api.get('/posts/my/');
    return response.data;
  },

  getUserPosts: async (userId: string): Promise<Post[]> => {
    const response = await api.get(`/posts/user/${userId}/`);
    return response.data;
  },

  createPost: async (formData: FormData): Promise<Post> => {
    const response = await api.post('/posts/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  likePost: async (postId: string): Promise<{ liked: boolean; like_count: number }> => {
    const response = await api.post(`/posts/${postId}/like/`);
    return response.data;
  },

  getComments: async (postId: string): Promise<Comment[]> => {
    const response = await api.get(`/posts/${postId}/comments/`);
    return response.data;
  },

  addComment: async (postId: string, text: string): Promise<Comment> => {
    const response = await api.post(`/posts/${postId}/comments/`, { text });
    return response.data;
  },

  deleteComment: async (commentId: string): Promise<void> => {
    await api.delete(`/posts/comments/${commentId}/`);
  },

  deletePost: async (postId: string): Promise<void> => {
    await api.delete(`/posts/${postId}/`);
  },
};

export default postApi;
