"""
Chat Views for MindLink
REST API for chat functionality
"""

from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from .models import Conversation, Message
from .serializers import (
    ConversationSerializer, MessageSerializer,
    CreateMessageSerializer, StartConversationSerializer
)

User = get_user_model()


class ConversationListView(generics.ListAPIView):
    """List all conversations for current user"""
    serializer_class = ConversationSerializer
    
    def get_queryset(self):
        return Conversation.objects.filter(
            participants=self.request.user
        ).prefetch_related('participants', 'messages')


class ConversationDetailView(generics.RetrieveAPIView):
    """Get a specific conversation"""
    serializer_class = ConversationSerializer
    lookup_field = 'id'
    
    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user)


class StartConversationView(APIView):
    """Start a new conversation with a user"""
    
    def post(self, request):
        serializer = StartConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user_id = serializer.validated_data['user_id']
        message_content = serializer.validated_data.get('message', '')
        
        try:
            other_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if conversation already exists
        existing = Conversation.objects.filter(
            participants=request.user
        ).filter(
            participants=other_user
        ).first()
        
        if existing:
            # Optionally send a message
            if message_content:
                Message.objects.create(
                    conversation=existing,
                    sender=request.user,
                    content=message_content
                )
                existing.save()  # Update timestamp
            
            return Response(
                ConversationSerializer(existing, context={'request': request}).data
            )
        
        # Create new conversation
        conversation = Conversation.objects.create()
        conversation.participants.add(request.user, other_user)
        
        # Send initial message if provided
        if message_content:
            Message.objects.create(
                conversation=conversation,
                sender=request.user,
                content=message_content
            )
        
        return Response(
            ConversationSerializer(conversation, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


class MessageListView(generics.ListAPIView):
    """List messages in a conversation"""
    serializer_class = MessageSerializer
    
    def get_queryset(self):
        conversation_id = self.kwargs.get('conversation_id')
        return Message.objects.filter(
            conversation_id=conversation_id,
            conversation__participants=self.request.user,
            is_deleted=False
        ).select_related('sender')


class SendMessageView(APIView):
    """Send a message in a conversation"""
    
    def post(self, request, conversation_id):
        try:
            conversation = Conversation.objects.get(
                id=conversation_id,
                participants=request.user
            )
        except Conversation.DoesNotExist:
            return Response(
                {'error': 'Conversation not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = CreateMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            **serializer.validated_data
        )
        
        # Update conversation timestamp
        conversation.save()
        
        return Response(
            MessageSerializer(message).data,
            status=status.HTTP_201_CREATED
        )


class MarkMessagesReadView(APIView):
    """Mark all messages in a conversation as read"""
    
    def post(self, request, conversation_id):
        updated = Message.objects.filter(
            conversation_id=conversation_id,
            is_read=False
        ).exclude(
            sender=request.user
        ).update(
            is_read=True,
            read_at=timezone.now()
        )
        
        return Response({'marked_read': updated})


class DeleteMessageView(APIView):
    """Soft delete a message"""
    
    def delete(self, request, message_id):
        try:
            message = Message.objects.get(
                id=message_id,
                sender=request.user
            )
            message.is_deleted = True
            message.save()
            return Response({'message': 'Deleted'})
        except Message.DoesNotExist:
            return Response(
                {'error': 'Message not found'},
                status=status.HTTP_404_NOT_FOUND
            )
