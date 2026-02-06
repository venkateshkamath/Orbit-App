from django.contrib import admin
from .models import Conversation, Message, MessageReaction


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ['sender', 'content', 'created_at']
    can_delete = False


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'get_participants', 'created_at', 'updated_at']
    inlines = [MessageInline]
    
    def get_participants(self, obj):
        return ", ".join([u.username for u in obj.participants.all()])
    get_participants.short_description = 'Participants'


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['sender', 'conversation', 'content', 'is_read', 'created_at']
    list_filter = ['is_read', 'message_type', 'created_at']
