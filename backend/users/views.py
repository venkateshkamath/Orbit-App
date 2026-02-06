"""
User Views for MindLink
Authentication and user management
"""

from rest_framework import status, generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from .serializers import (
    RegisterSerializer, LoginSerializer, UserProfileSerializer,
    LocationUpdateSerializer, ChangePasswordSerializer, InterestSerializer
)
from .models import Interest

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """Register a new user"""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserProfileSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """Login with email and password"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = authenticate(
            request,
            username=serializer.validated_data['email'],
            password=serializer.validated_data['password']
        )
        
        if not user:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Update online status
        user.is_online = True
        user.save(update_fields=['is_online'])
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserProfileSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        })


class LogoutView(APIView):
    """Logout user and blacklist token"""
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            # Update offline status
            request.user.is_online = False
            request.user.last_seen = timezone.now()
            request.user.save(update_fields=['is_online', 'last_seen'])
            
            return Response({'message': 'Successfully logged out'})
        except Exception:
            return Response({'message': 'Logged out'})


class ProfileView(generics.RetrieveUpdateAPIView):
    """Get and update current user's profile"""
    serializer_class = UserProfileSerializer
    
    def get_object(self):
        return self.request.user


class UpdateLocationView(APIView):
    """Update user's current location"""
    
    def post(self, request):
        serializer = LocationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        user.latitude = serializer.validated_data['latitude']
        user.longitude = serializer.validated_data['longitude']
        user.location_updated_at = timezone.now()
        user.save(update_fields=['latitude', 'longitude', 'location_updated_at'])
        
        return Response({
            'message': 'Location updated',
            'latitude': user.latitude,
            'longitude': user.longitude,
            'updated_at': user.location_updated_at
        })


class ChangePasswordView(APIView):
    """Change password"""
    
    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        
        return Response({'message': 'Password changed successfully'})


class InterestListView(generics.ListAPIView):
    """List all available interests"""
    queryset = Interest.objects.all()
    serializer_class = InterestSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None  # Return all interests without pagination


class RemoveAvatarView(APIView):
    """Remove user's avatar"""
    
    def delete(self, request):
        user = request.user
        if user.avatar:
            user.avatar.delete(save=False)
        user.avatar = None
        user.save(update_fields=['avatar'])
        
        return Response(UserProfileSerializer(user).data)


class UserDetailView(generics.RetrieveAPIView):
    """Get another user's public profile"""
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer
    lookup_field = 'id'
