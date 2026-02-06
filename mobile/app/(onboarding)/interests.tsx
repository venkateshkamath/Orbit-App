/**
 * Interests Selection Screen - Onboarding
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { InterestTag, GradientButton } from '../../src/components';
import { useAuthStore } from '../../src/stores';
import { authApi } from '../../src/api';
import { Interest } from '../../src/types';

export default function InterestsScreen() {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { updateProfile, setOnboardingComplete } = useAuthStore();

  useEffect(() => {
    loadInterests();
  }, []);

  const loadInterests = async () => {
    try {
      const data = await authApi.getInterests();
      setInterests(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load interests');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (selectedIds.length < 3) {
      Alert.alert('Select More', 'Please select at least 3 interests');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ interest_ids: selectedIds });
      setOnboardingComplete(true);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  // Group interests by category (with null check)
  const groupedInterests = (interests || []).reduce((groups, interest) => {
    const category = interest.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(interest);
    return groups;
  }, {} as Record<string, Interest[]>);

  const categoryLabels: Record<string, string> = {
    tech: '💻 Technology',
    arts: '🎨 Arts & Entertainment',
    sports: '🏃 Sports & Fitness',
    lifestyle: '✨ Lifestyle',
    social: '🤝 Social',
    mind: '🧠 Mind & Learning',
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary.default} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.background.primary, Colors.background.secondary]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>What are you into?</Text>
          <Text style={styles.subtitle}>
            Select at least 3 interests to help us find your people
          </Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={[Colors.primary.start, Colors.primary.end]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressFill,
                  { width: `${Math.min((selectedIds.length / 3) * 100, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {selectedIds.length} selected
              {selectedIds.length < 3 && ` (${3 - selectedIds.length} more needed)`}
            </Text>
          </View>
        </View>

        {/* Interests */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {Object.entries(groupedInterests).map(([category, categoryInterests]) => (
            <View key={category} style={styles.categoryContainer}>
              <Text style={styles.categoryTitle}>
                {categoryLabels[category] || category}
              </Text>
              <View style={styles.interestsGrid}>
                {categoryInterests.map((interest) => (
                  <InterestTag
                    key={interest.id}
                    interest={interest}
                    selected={selectedIds.includes(interest.id)}
                    onPress={() => toggleInterest(interest.id)}
                    size="md"
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.footer}>
          <GradientButton
            title={selectedIds.length < 3 ? `Select ${3 - selectedIds.length} more` : 'Continue'}
            onPress={handleContinue}
            loading={saving}
            disabled={selectedIds.length < 3}
            size="lg"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  progressContainer: {
    marginTop: Spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  progressText: {
    fontSize: FontSizes.sm,
    color: Colors.text.tertiary,
    marginTop: Spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  categoryContainer: {
    marginBottom: Spacing.lg,
  },
  categoryTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background.primary,
  },
});
