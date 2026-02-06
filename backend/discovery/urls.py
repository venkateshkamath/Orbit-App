"""
Discovery URLs for MindLink
"""

from django.urls import path
from .views import (
    NearbyUsersView, LikeUserView, PassUserView,
    MatchListView, LikesReceivedView, UnmatchView
)

urlpatterns = [
    path('nearby/', NearbyUsersView.as_view(), name='nearby_users'),
    path('like/<uuid:user_id>/', LikeUserView.as_view(), name='like_user'),
    path('pass/<uuid:user_id>/', PassUserView.as_view(), name='pass_user'),
    path('matches/', MatchListView.as_view(), name='matches'),
    path('matches/<uuid:match_id>/', UnmatchView.as_view(), name='unmatch'),
    path('likes-received/', LikesReceivedView.as_view(), name='likes_received'),
]
