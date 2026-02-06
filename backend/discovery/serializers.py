"""
Discovery Serializers for MindLink
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Like, Match
from users.serializers import UserPublicSerializer

User = get_user_model()


class NearbyUserSerializer(serializers.ModelSerializer):
    """Serializer for nearby users with match info"""
    interests = serializers.SerializerMethodField()
    distance = serializers.SerializerMethodField()
    match_percentage = serializers.SerializerMethodField()
    common_interests = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'bio', 'avatar', 'interests',
            'distance', 'match_percentage', 'common_interests',
            'is_online', 'is_verified'
        ]
    
    def get_interests(self, obj):
        return obj.get_interests_display()
    
    def get_distance(self, obj):
        # Distance is calculated in the view and attached to the object
        return getattr(obj, 'distance', None)
    
    def get_match_percentage(self, obj):
        return getattr(obj, 'match_percentage', 0)
    
    def get_common_interests(self, obj):
        request = self.context.get('request')
        if request and request.user:
            user_interests = set(request.user.interests.values_list('id', flat=True))
            other_interests = set(obj.interests.values_list('id', flat=True))
            common = user_interests & other_interests
            return list(map(str, common))
        return []


class LikeSerializer(serializers.ModelSerializer):
    to_user_detail = UserPublicSerializer(source='to_user', read_only=True)
    
    class Meta:
        model = Like
        fields = ['id', 'to_user', 'to_user_detail', 'created_at']
        extra_kwargs = {'to_user': {'write_only': True}}


class MatchSerializer(serializers.ModelSerializer):
    matched_user = serializers.SerializerMethodField()
    
    class Meta:
        model = Match
        fields = ['id', 'matched_user', 'created_at']
    
    def get_matched_user(self, obj):
        request = self.context.get('request')
        if request and request.user:
            other = obj.user2 if obj.user1 == request.user else obj.user1
            return UserPublicSerializer(other).data
        return None
