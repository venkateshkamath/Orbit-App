"""
Chat Serializers for MindLink
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Conversation, Message, MessageReaction
from users.serializers import UserPublicSerializer

User = get_user_model()


class MessageSerializer(serializers.ModelSerializer):
    sender = UserPublicSerializer(read_only=True)
    reactions = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'message_type', 'content',
            'image', 'latitude', 'longitude', 'is_read', 'read_at',
            'reactions', 'created_at'
        ]
        read_only_fields = ['id', 'sender', 'is_read', 'read_at', 'created_at']
    
    def get_reactions(self, obj):
        reactions = obj.reactions.all()
        return [{'emoji': r.emoji, 'user_id': str(r.user.id)} for r in reactions]


class ConversationSerializer(serializers.ModelSerializer):
    participants = UserPublicSerializer(many=True, read_only=True)
    last_message = MessageSerializer(read_only=True)
    other_participant = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = [
            'id', 'participants', 'other_participant', 'last_message',
            'unread_count', 'created_at', 'updated_at'
        ]
    
    def get_other_participant(self, obj):
        request = self.context.get('request')
        if request and request.user:
            other = obj.get_other_participant(request.user)
            if other:
                return UserPublicSerializer(other).data
        return None
    
    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0


class CreateMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['message_type', 'content', 'image', 'latitude', 'longitude']


class StartConversationSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    message = serializers.CharField(max_length=1000, required=False)
