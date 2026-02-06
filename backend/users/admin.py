from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Interest, UserBlock, UserReport


@admin.register(Interest)
class InterestAdmin(admin.ModelAdmin):
    list_display = ['name', 'emoji', 'category', 'color']
    list_filter = ['category']
    search_fields = ['name']


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['email', 'username', 'is_online', 'is_discoverable', 'is_verified', 'created_at']
    list_filter = ['is_online', 'is_discoverable', 'is_verified', 'created_at']
    search_fields = ['email', 'username']
    ordering = ['-created_at']
    
    fieldsets = UserAdmin.fieldsets + (
        ('Profile', {'fields': ('bio', 'avatar', 'date_of_birth', 'interests')}),
        ('Location', {'fields': ('latitude', 'longitude', 'location_updated_at')}),
        ('Privacy', {'fields': ('is_discoverable', 'discovery_radius', 'show_online_status')}),
        ('Status', {'fields': ('is_online', 'last_seen', 'is_verified')}),
    )


@admin.register(UserBlock)
class UserBlockAdmin(admin.ModelAdmin):
    list_display = ['blocker', 'blocked', 'created_at']


@admin.register(UserReport)
class UserReportAdmin(admin.ModelAdmin):
    list_display = ['reporter', 'reported', 'reason', 'is_resolved', 'created_at']
    list_filter = ['reason', 'is_resolved']
