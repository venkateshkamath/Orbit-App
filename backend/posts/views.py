"""
Posts views and API endpoints
"""

from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Count
from .models import Post, PostLike, Comment
from .serializers import PostSerializer, CreatePostSerializer, CommentSerializer


class FeedView(generics.ListAPIView):
    """
    Get the feed of posts
    - Shows posts from all users, ordered by recency
    - Can filter by interest
    """
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Disable pagination to return all posts
    
    def get_queryset(self):
        queryset = Post.objects.annotate(
            like_count=Count('likes', distinct=True),
            comment_count=Count('comments', distinct=True)
        ).select_related('author').prefetch_related('interests', 'likes', 'comments').order_by('-created_at')
        
        # Optional: Filter by interest
        interest_id = self.request.query_params.get('interest')
        if interest_id:
            queryset = queryset.filter(interests__id=interest_id)
        
        return queryset


class UserPostsView(generics.ListAPIView):
    """Get posts by a specific user"""
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user_id = self.kwargs.get('user_id')
        return Post.objects.filter(author_id=user_id).annotate(
            like_count=Count('likes', distinct=True),
            comment_count=Count('comments', distinct=True)
        )


class MyPostsView(generics.ListAPIView):
    """Get current user's posts"""
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Post.objects.filter(author=self.request.user).annotate(
            like_count=Count('likes', distinct=True),
            comment_count=Count('comments', distinct=True)
        )


class CreatePostView(generics.CreateAPIView):
    """Create a new post"""
    serializer_class = CreatePostSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = serializer.save(author=request.user)
        
        # Refresh from DB with annotations
        post = Post.objects.annotate(
            like_count=Count('likes', distinct=True),
            comment_count=Count('comments', distinct=True)
        ).get(pk=post.pk)
        
        # Return full post data
        output_serializer = PostSerializer(post, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


class PostDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a post"""
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Post.objects.annotate(
            like_count=Count('likes', distinct=True),
            comment_count=Count('comments', distinct=True)
        )
    
    def perform_update(self, serializer):
        # Only author can update
        if self.get_object().author != self.request.user:
            raise permissions.PermissionDenied("You can only edit your own posts")
        serializer.save()
    
    def perform_destroy(self, instance):
        # Only author can delete
        if instance.author != self.request.user:
            raise permissions.PermissionDenied("You can only delete your own posts")
        instance.delete()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def like_post(request, pk):
    """Like or unlike a post"""
    try:
        post = Post.objects.get(pk=pk)
    except Post.DoesNotExist:
        return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
    
    like, created = PostLike.objects.get_or_create(user=request.user, post=post)
    
    if not created:
        # Already liked, so unlike
        like.delete()
        return Response({
            'liked': False,
            'like_count': post.likes.count()
        })
    
    return Response({
        'liked': True,
        'like_count': post.likes.count()
    })


class PostCommentsView(generics.ListCreateAPIView):
    """Get or add comments to a post"""
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        post_id = self.kwargs.get('pk')
        return Comment.objects.filter(post_id=post_id, parent__isnull=True)
    
    def perform_create(self, serializer):
        post_id = self.kwargs.get('pk')
        post = Post.objects.get(pk=post_id)
        serializer.save(author=self.request.user, post=post)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_comment(request, pk):
    """Delete a comment"""
    try:
        comment = Comment.objects.get(pk=pk)
    except Comment.DoesNotExist:
        return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if comment.author != request.user:
        return Response({'error': 'You can only delete your own comments'}, status=status.HTTP_403_FORBIDDEN)
    
    comment.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
