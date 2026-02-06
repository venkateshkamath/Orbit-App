from django.contrib import admin
from .models import Post, PostLike, Comment


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['author', 'caption', 'created_at']
    list_filter = ['created_at', 'interests']
    search_fields = ['author__username', 'caption']
    filter_horizontal = ['interests']


@admin.register(PostLike)
class PostLikeAdmin(admin.ModelAdmin):
    list_display = ['user', 'post', 'created_at']
    list_filter = ['created_at']


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['author', 'post', 'text', 'created_at']
    list_filter = ['created_at']
    search_fields = ['author__username', 'text']
