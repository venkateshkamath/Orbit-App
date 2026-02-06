"""
User Models for MindLink
Custom user with profile, interests, and location tracking
"""

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid


class Interest(models.Model):
    """Predefined interests users can select"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    emoji = models.CharField(max_length=10, default='✨')
    category = models.CharField(max_length=50, default='general')
    color = models.CharField(max_length=7, default='#6366F1')  # Hex color
    
    class Meta:
        ordering = ['category', 'name']
    
    def __str__(self):
        return f"{self.emoji} {self.name}"


class User(AbstractUser):
    """Extended user model with profile and location"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    
    # Profile
    bio = models.TextField(max_length=500, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    
    # Interests
    interests = models.ManyToManyField(Interest, blank=True, related_name='users')
    
    # Location (updated in real-time)
    latitude = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)]
    )
    longitude = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)]
    )
    location_updated_at = models.DateTimeField(null=True, blank=True)
    
    # Privacy & Settings
    is_discoverable = models.BooleanField(default=True)
    discovery_radius = models.IntegerField(default=10)  # meters
    show_online_status = models.BooleanField(default=True)
    
    # Status
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True)
    
    # Verification
    is_verified = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.email
    
    @property
    def has_location(self):
        return self.latitude is not None and self.longitude is not None
    
    def get_interests_display(self):
        return [{'id': str(i.id), 'name': i.name, 'emoji': i.emoji, 'color': i.color} 
                for i in self.interests.all()]


class UserBlock(models.Model):
    """Track blocked users"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocking')
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocked_by')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['blocker', 'blocked']


class UserReport(models.Model):
    """User reports for safety"""
    REPORT_REASONS = [
        ('spam', 'Spam'),
        ('harassment', 'Harassment'),
        ('inappropriate', 'Inappropriate Content'),
        ('fake', 'Fake Profile'),
        ('other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_made')
    reported = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_received')
    reason = models.CharField(max_length=20, choices=REPORT_REASONS)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_resolved = models.BooleanField(default=False)
