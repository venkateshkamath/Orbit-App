"""
User Serializers for MindLink
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import Interest, UserBlock

User = get_user_model()


class InterestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interest
        fields = ['id', 'name', 'emoji', 'category', 'color']


class UserPublicSerializer(serializers.ModelSerializer):
    """Public profile for discovery/chat"""
    interests = InterestSerializer(many=True, read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'bio', 'avatar', 'interests',
            'is_online', 'last_seen', 'is_verified'
        ]


class UserProfileSerializer(serializers.ModelSerializer):
    """Full profile with private fields"""
    interests = InterestSerializer(many=True, read_only=True)
    interest_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'bio', 'avatar', 'date_of_birth',
            'interests', 'interest_ids', 'latitude', 'longitude',
            'is_discoverable', 'discovery_radius', 'show_online_status',
            'is_online', 'last_seen', 'is_verified', 'created_at'
        ]
        read_only_fields = ['id', 'email', 'is_verified', 'is_online', 'last_seen', 'created_at']
    
    def update(self, instance, validated_data):
        interest_ids = validated_data.pop('interest_ids', None)
        
        if interest_ids is not None:
            interests = Interest.objects.filter(id__in=interest_ids)
            instance.interests.set(interests)
        
        return super().update(instance, validated_data)


class RegisterSerializer(serializers.ModelSerializer):
    """User registration"""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['email', 'username', 'password', 'password_confirm']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords don't match"})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    """User login"""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class LocationUpdateSerializer(serializers.Serializer):
    """Update user location"""
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)


class ChangePasswordSerializer(serializers.Serializer):
    """Change password"""
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect")
        return value


class UserBlockSerializer(serializers.ModelSerializer):
    blocked_user = UserPublicSerializer(source='blocked', read_only=True)
    
    class Meta:
        model = UserBlock
        fields = ['id', 'blocked', 'blocked_user', 'created_at']
        extra_kwargs = {'blocked': {'write_only': True}}
