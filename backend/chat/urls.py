"""
Chat URLs for MindLink
"""

from django.urls import path
from .views import (
    ConversationListView, ConversationDetailView, StartConversationView,
    MessageListView, SendMessageView, MarkMessagesReadView, DeleteMessageView
)

urlpatterns = [
    path('conversations/', ConversationListView.as_view(), name='conversations'),
    path('conversations/<uuid:id>/', ConversationDetailView.as_view(), name='conversation_detail'),
    path('conversations/start/', StartConversationView.as_view(), name='start_conversation'),
    path('conversations/<uuid:conversation_id>/messages/', MessageListView.as_view(), name='messages'),
    path('conversations/<uuid:conversation_id>/messages/send/', SendMessageView.as_view(), name='send_message'),
    path('conversations/<uuid:conversation_id>/messages/read/', MarkMessagesReadView.as_view(), name='mark_read'),
    path('messages/<uuid:message_id>/delete/', DeleteMessageView.as_view(), name='delete_message'),
]
