"""
WebSocket consumers for real-time chat
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Conversation, Message

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time chat"""
    
    async def connect(self):
        self.user = self.scope.get('user')
        
        if not self.user or self.user.is_anonymous:
            await self.close()
            return
        
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'
        
        # Verify user is participant
        is_participant = await self.check_participant()
        if not is_participant:
            await self.close()
            return
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Update online status
        await self.update_online_status(True)
    
    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
        
        # Update offline status
        if hasattr(self, 'user') and self.user and not self.user.is_anonymous:
            await self.update_online_status(False)
    
    async def receive(self, text_data):
        """Receive message from WebSocket"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'message')
            
            if message_type == 'message':
                await self.handle_message(data)
            elif message_type == 'typing':
                await self.handle_typing(data)
            elif message_type == 'read':
                await self.handle_read(data)
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
    
    async def handle_message(self, data):
        """Handle incoming chat message"""
        content = data.get('content', '')
        message_type = data.get('message_type', 'text')
        
        if not content:
            return
        
        # Save message to database
        message = await self.save_message(content, message_type)
        
        # Broadcast to room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': {
                    'id': str(message.id),
                    'sender_id': str(self.user.id),
                    'sender_username': self.user.username,
                    'sender_avatar': self.user.avatar.url if self.user.avatar else None,
                    'content': content,
                    'message_type': message_type,
                    'created_at': message.created_at.isoformat(),
                }
            }
        )
    
    async def handle_typing(self, data):
        """Handle typing indicator"""
        is_typing = data.get('is_typing', False)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_indicator',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'is_typing': is_typing
            }
        )
    
    async def handle_read(self, data):
        """Handle read receipts"""
        message_ids = data.get('message_ids', [])
        await self.mark_messages_read(message_ids)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'read_receipt',
                'user_id': str(self.user.id),
                'message_ids': message_ids
            }
        )
    
    async def chat_message(self, event):
        """Send message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message']
        }))
    
    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket"""
        if str(self.user.id) != event['user_id']:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing']
            }))
    
    async def read_receipt(self, event):
        """Send read receipt to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'read',
            'user_id': event['user_id'],
            'message_ids': event['message_ids']
        }))
    
    @database_sync_to_async
    def check_participant(self):
        return Conversation.objects.filter(
            id=self.conversation_id,
            participants=self.user
        ).exists()
    
    @database_sync_to_async
    def save_message(self, content, message_type='text'):
        conversation = Conversation.objects.get(id=self.conversation_id)
        message = Message.objects.create(
            conversation=conversation,
            sender=self.user,
            content=content,
            message_type=message_type
        )
        conversation.save()  # Update timestamp
        return message
    
    @database_sync_to_async
    def mark_messages_read(self, message_ids):
        from django.utils import timezone
        Message.objects.filter(
            id__in=message_ids,
            conversation_id=self.conversation_id
        ).exclude(
            sender=self.user
        ).update(
            is_read=True,
            read_at=timezone.now()
        )
    
    @database_sync_to_async
    def update_online_status(self, is_online):
        from django.utils import timezone
        self.user.is_online = is_online
        if not is_online:
            self.user.last_seen = timezone.now()
        self.user.save(update_fields=['is_online', 'last_seen'] if not is_online else ['is_online'])


class NotificationConsumer(AsyncWebsocketConsumer):
    """WebSocket for user notifications"""
    
    async def connect(self):
        self.user = self.scope.get('user')
        
        if not self.user or self.user.is_anonymous:
            await self.close()
            return
        
        self.user_group = f'user_{self.user.id}'
        
        await self.channel_layer.group_add(
            self.user_group,
            self.channel_name
        )
        
        await self.accept()
    
    async def disconnect(self, close_code):
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(
                self.user_group,
                self.channel_name
            )
    
    async def new_message_notification(self, event):
        """Notify user of new message"""
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'conversation_id': event['conversation_id'],
            'sender': event['sender'],
            'preview': event['preview']
        }))
    
    async def nearby_user_notification(self, event):
        """Notify user of nearby match"""
        await self.send(text_data=json.dumps({
            'type': 'nearby_user',
            'user': event['user'],
            'match_percentage': event['match_percentage']
        }))
