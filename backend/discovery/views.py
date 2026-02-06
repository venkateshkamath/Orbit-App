"""
Discovery Views for MindLink
Proximity-based user discovery with interest matching
"""

import math
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
from .models import Like, Match, Pass
from .serializers import NearbyUserSerializer, LikeSerializer, MatchSerializer
from users.models import UserBlock

User = get_user_model()


def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the distance between two points on Earth in meters
    using the Haversine formula
    """
    R = 6371000  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def calculate_match_percentage(user1, user2):
    """Calculate interest match percentage between two users"""
    user1_interests = set(user1.interests.values_list('id', flat=True))
    user2_interests = set(user2.interests.values_list('id', flat=True))
    
    if not user1_interests or not user2_interests:
        return 0
    
    common = len(user1_interests & user2_interests)
    total = len(user1_interests | user2_interests)
    
    return round((common / total) * 100) if total > 0 else 0


class NearbyUsersView(APIView):
    """
    Get users near the current user based on location.
    Users must have updated their location within the last hour.
    """
    
    def get(self, request):
        user = request.user
        
        if not user.has_location:
            return Response(
                {'error': 'Location not set. Please update your location first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get radius from query params or user setting
        radius = int(request.query_params.get('radius', user.discovery_radius))
        max_radius = 1000  # Max 1km
        radius = min(radius, max_radius)
        
        # Get blocked users
        blocked_ids = list(UserBlock.objects.filter(
            Q(blocker=user) | Q(blocked=user)
        ).values_list('blocker_id', 'blocked_id'))
        blocked_set = set()
        for b in blocked_ids:
            blocked_set.update(b)
        blocked_set.discard(user.id)
        
        # Get users who have been passed
        passed_ids = Pass.objects.filter(from_user=user).values_list('to_user_id', flat=True)
        
        # Find potentially nearby users (rough bounding box first)
        # 1 degree of latitude ≈ 111km
        lat_delta = radius / 111000
        lon_delta = radius / (111000 * math.cos(math.radians(user.latitude)))
        
        # Only show users who updated location in last hour
        location_threshold = timezone.now() - timedelta(hours=1)
        
        potential_users = User.objects.filter(
            is_discoverable=True,
            latitude__range=(user.latitude - lat_delta, user.latitude + lat_delta),
            longitude__range=(user.longitude - lon_delta, user.longitude + lon_delta),
            location_updated_at__gte=location_threshold
        ).exclude(
            id=user.id
        ).exclude(
            id__in=blocked_set
        ).exclude(
            id__in=passed_ids
        ).prefetch_related('interests')
        
        # Calculate exact distance and filter
        nearby_users = []
        for other_user in potential_users:
            distance = haversine_distance(
                user.latitude, user.longitude,
                other_user.latitude, other_user.longitude
            )
            
            if distance <= radius:
                other_user.distance = round(distance, 1)
                other_user.match_percentage = calculate_match_percentage(user, other_user)
                nearby_users.append(other_user)
        
        # Sort by match percentage, then distance
        nearby_users.sort(key=lambda x: (-x.match_percentage, x.distance))
        
        serializer = NearbyUserSerializer(
            nearby_users,
            many=True,
            context={'request': request}
        )
        
        return Response({
            'count': len(nearby_users),
            'radius': radius,
            'users': serializer.data
        })


class LikeUserView(APIView):
    """Like a user - creates a match if mutual"""
    
    def post(self, request, user_id):
        try:
            to_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if to_user == request.user:
            return Response(
                {'error': 'Cannot like yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already liked
        like, created = Like.objects.get_or_create(
            from_user=request.user,
            to_user=to_user
        )
        
        if not created:
            return Response({'message': 'Already liked', 'is_match': False})
        
        # Check for mutual like (match)
        mutual_like = Like.objects.filter(
            from_user=to_user,
            to_user=request.user
        ).exists()
        
        is_match = False
        match_data = None
        
        if mutual_like:
            # Create match (order users by ID for consistency)
            user1, user2 = sorted([request.user, to_user], key=lambda u: str(u.id))
            match, match_created = Match.objects.get_or_create(
                user1=user1,
                user2=user2
            )
            is_match = True
            match_data = MatchSerializer(match, context={'request': request}).data
        
        return Response({
            'message': "It's a match!" if is_match else 'Like sent',
            'is_match': is_match,
            'match': match_data
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class PassUserView(APIView):
    """Pass on a user - won't show in discovery"""
    
    def post(self, request, user_id):
        try:
            to_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        Pass.objects.get_or_create(
            from_user=request.user,
            to_user=to_user
        )
        
        return Response({'message': 'Passed'})


class MatchListView(generics.ListAPIView):
    """List all matches for current user"""
    serializer_class = MatchSerializer
    
    def get_queryset(self):
        return Match.objects.filter(
            Q(user1=self.request.user) | Q(user2=self.request.user)
        )


class LikesReceivedView(generics.ListAPIView):
    """List users who liked the current user (premium feature)"""
    serializer_class = LikeSerializer
    
    def get_queryset(self):
        return Like.objects.filter(to_user=self.request.user)


class UnmatchView(APIView):
    """Remove a match"""
    
    def delete(self, request, match_id):
        try:
            match = Match.objects.get(
                Q(id=match_id) & (Q(user1=request.user) | Q(user2=request.user))
            )
            match.delete()
            return Response({'message': 'Unmatched'})
        except Match.DoesNotExist:
            return Response(
                {'error': 'Match not found'},
                status=status.HTTP_404_NOT_FOUND
            )
