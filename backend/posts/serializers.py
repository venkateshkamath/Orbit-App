"""
Posts serializers
"""

from rest_framework import serializers
from .models import Post, PostLike, Comment
from users.serializers import InterestSerializer


class CommentAuthorSerializer(serializers.Serializer):
    """Minimal author info for comments"""
    id = serializers.UUIDField()
    username = serializers.CharField()
    avatar = serializers.ImageField(source='avatar')


class CommentSerializer(serializers.ModelSerializer):
    author = CommentAuthorSerializer(read_only=True)
    reply_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = ['id', 'author', 'text', 'parent', 'reply_count', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']
    
    def get_reply_count(self, obj):
        return obj.replies.count()


class PostAuthorSerializer(serializers.Serializer):
    """Minimal author info for posts"""
    id = serializers.UUIDField()
    username = serializers.CharField()
    avatar = serializers.SerializerMethodField()
    
    def get_avatar(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class PostSerializer(serializers.ModelSerializer):
    author = PostAuthorSerializer(read_only=True)
    interests = InterestSerializer(many=True, read_only=True)
    interest_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    like_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    is_liked = serializers.SerializerMethodField()
    recent_comments = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = [
            'id', 'author', 'caption', 'image', 'image_url',
            'interests', 'interest_ids',
            'location_name', 'latitude', 'longitude',
            'like_count', 'comment_count', 'is_liked',
            'recent_comments', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']
    
    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False
    
    def get_recent_comments(self, obj):
        comments = obj.comments.filter(parent__isnull=True)[:3]
        return CommentSerializer(comments, many=True).data
    
    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None
    
    def create(self, validated_data):
        interest_ids = validated_data.pop('interest_ids', [])
        post = Post.objects.create(**validated_data)
        
        if interest_ids:
            from users.models import Interest
            interests = Interest.objects.filter(id__in=interest_ids)
            post.interests.set(interests)
        
        return post


class CreatePostSerializer(serializers.ModelSerializer):
    """Simplified serializer for creating posts"""
    interest_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list
    )
    
    class Meta:
        model = Post
        fields = ['caption', 'image', 'interest_ids', 'location_name', 'latitude', 'longitude']
    
    def create(self, validated_data):
        interest_ids = validated_data.pop('interest_ids', [])
        post = Post.objects.create(**validated_data)
        
        if interest_ids:
            from users.models import Interest
            interests = Interest.objects.filter(id__in=interest_ids)
            post.interests.set(interests)
        
        return post
