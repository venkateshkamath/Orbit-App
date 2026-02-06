from django.contrib import admin
from .models import Like, Match, Pass


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ['from_user', 'to_user', 'created_at']


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['user1', 'user2', 'created_at']


@admin.register(Pass)
class PassAdmin(admin.ModelAdmin):
    list_display = ['from_user', 'to_user', 'created_at']
