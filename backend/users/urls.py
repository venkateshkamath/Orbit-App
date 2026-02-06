"""
Auth URLs for MindLink
"""

from django.urls import path
from .views import (
    RegisterView, LoginView, LogoutView, 
    InterestListView, ChangePasswordView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('interests/', InterestListView.as_view(), name='interests'),
]
