"""
Posts URL configuration
"""

from django.urls import path
from . import views

urlpatterns = [
    # Feed
    path('feed/', views.FeedView.as_view(), name='feed'),
    
    # Posts CRUD
    path('', views.CreatePostView.as_view(), name='create-post'),
    path('<uuid:pk>/', views.PostDetailView.as_view(), name='post-detail'),
    path('my/', views.MyPostsView.as_view(), name='my-posts'),
    path('user/<uuid:user_id>/', views.UserPostsView.as_view(), name='user-posts'),
    
    # Interactions
    path('<uuid:pk>/like/', views.like_post, name='like-post'),
    path('<uuid:pk>/comments/', views.PostCommentsView.as_view(), name='post-comments'),
    path('comments/<uuid:pk>/', views.delete_comment, name='delete-comment'),
]
