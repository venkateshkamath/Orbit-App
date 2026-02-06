"""
Management command to seed default interests
"""

from django.core.management.base import BaseCommand
from users.models import Interest


INTERESTS = [
    # Technology
    {'name': 'Technology', 'emoji': '💻', 'category': 'tech', 'color': '#6366F1'},
    {'name': 'Programming', 'emoji': '👨‍💻', 'category': 'tech', 'color': '#8B5CF6'},
    {'name': 'AI & ML', 'emoji': '🤖', 'category': 'tech', 'color': '#A855F7'},
    {'name': 'Gaming', 'emoji': '🎮', 'category': 'tech', 'color': '#EC4899'},
    {'name': 'Startups', 'emoji': '🚀', 'category': 'tech', 'color': '#F43F5E'},
    {'name': 'Crypto', 'emoji': '₿', 'category': 'tech', 'color': '#F59E0B'},
    
    # Music & Arts
    {'name': 'Music', 'emoji': '🎵', 'category': 'arts', 'color': '#14B8A6'},
    {'name': 'Photography', 'emoji': '📷', 'category': 'arts', 'color': '#06B6D4'},
    {'name': 'Art & Design', 'emoji': '🎨', 'category': 'arts', 'color': '#0EA5E9'},
    {'name': 'Movies', 'emoji': '🎬', 'category': 'arts', 'color': '#3B82F6'},
    {'name': 'Writing', 'emoji': '✍️', 'category': 'arts', 'color': '#6366F1'},
    {'name': 'Dancing', 'emoji': '💃', 'category': 'arts', 'color': '#8B5CF6'},
    
    # Sports & Fitness
    {'name': 'Fitness', 'emoji': '💪', 'category': 'sports', 'color': '#22C55E'},
    {'name': 'Running', 'emoji': '🏃', 'category': 'sports', 'color': '#10B981'},
    {'name': 'Yoga', 'emoji': '🧘', 'category': 'sports', 'color': '#14B8A6'},
    {'name': 'Football', 'emoji': '⚽', 'category': 'sports', 'color': '#06B6D4'},
    {'name': 'Basketball', 'emoji': '🏀', 'category': 'sports', 'color': '#F97316'},
    {'name': 'Swimming', 'emoji': '🏊', 'category': 'sports', 'color': '#0EA5E9'},
    
    # Lifestyle
    {'name': 'Travel', 'emoji': '✈️', 'category': 'lifestyle', 'color': '#F43F5E'},
    {'name': 'Food', 'emoji': '🍕', 'category': 'lifestyle', 'color': '#EF4444'},
    {'name': 'Coffee', 'emoji': '☕', 'category': 'lifestyle', 'color': '#78350F'},
    {'name': 'Fashion', 'emoji': '👗', 'category': 'lifestyle', 'color': '#EC4899'},
    {'name': 'Pets', 'emoji': '🐾', 'category': 'lifestyle', 'color': '#F59E0B'},
    {'name': 'Nature', 'emoji': '🌿', 'category': 'lifestyle', 'color': '#22C55E'},
    
    # Social
    {'name': 'Networking', 'emoji': '🤝', 'category': 'social', 'color': '#6366F1'},
    {'name': 'Languages', 'emoji': '🌍', 'category': 'social', 'color': '#3B82F6'},
    {'name': 'Volunteering', 'emoji': '❤️', 'category': 'social', 'color': '#EF4444'},
    {'name': 'Book Club', 'emoji': '📚', 'category': 'social', 'color': '#8B5CF6'},
    
    # Mind & Learning
    {'name': 'Meditation', 'emoji': '🧠', 'category': 'mind', 'color': '#A855F7'},
    {'name': 'Philosophy', 'emoji': '💭', 'category': 'mind', 'color': '#6366F1'},
    {'name': 'Science', 'emoji': '🔬', 'category': 'mind', 'color': '#0EA5E9'},
    {'name': 'History', 'emoji': '🏛️', 'category': 'mind', 'color': '#78350F'},
]


class Command(BaseCommand):
    help = 'Seeds the database with default interests'
    
    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0
        
        for interest_data in INTERESTS:
            interest, created = Interest.objects.update_or_create(
                name=interest_data['name'],
                defaults={
                    'emoji': interest_data['emoji'],
                    'category': interest_data['category'],
                    'color': interest_data['color'],
                }
            )
            
            if created:
                created_count += 1
            else:
                updated_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully seeded {created_count} new interests, '
                f'updated {updated_count} existing interests.'
            )
        )
