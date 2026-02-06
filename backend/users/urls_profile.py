"""
Profile URLs for MindLink
"""

from django.urls import path
from .views import ProfileView, UpdateLocationView, UserDetailView, RemoveAvatarView

urlpatterns = [
    path('me/', ProfileView.as_view(), name='profile'),
    path('me/location/', UpdateLocationView.as_view(), name='update_location'),
    path('me/avatar/', RemoveAvatarView.as_view(), name='remove_avatar'),
    path('<uuid:id>/', UserDetailView.as_view(), name='user_detail'),
]
