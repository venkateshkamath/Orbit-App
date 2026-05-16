/**
 * Interests Selection Screen - Onboarding
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme } from '../../src/theme';
import { router } from 'expo-router';
import { InterestTag, GradientButton } from '../../src/components';
import { useAuthStore } from '../../src/stores';
import { useInterestsQuery } from '../../src/hooks/useOrbitApi';
import { Interest } from '../../src/types';
import { AppText } from '../../src/ui/AppText';

export default function InterestsScreen() {
  const { colors, fonts } = useOrbitTheme();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { user, updateProfile, setOnboardingComplete } = useAuthStore();
  const { data: interests = [], isLoading: loading, error: interestsError } = useInterestsQuery();

  useEffect(() => {
    if (interestsError) {
      Alert.alert('Error', 'Failed to load interests');
    }
  }, [interestsError]);

  useEffect(() => {
    if (selectedIds.length > 0) return;
    const existingIds = (user?.interests ?? []).map((interest) => interest.id);
    if (existingIds.length > 0) {
      setSelectedIds(existingIds);
    }
  }, [selectedIds.length, user?.interests]);

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
      // Root layout treats this route as "main app" once onboarding is done, so it never
      // auto-navigates away — must explicitly enter tabs after first-time onboarding.
      router.replace('/(tabs)');
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Could not save your interests. Please try again.';
      Alert.alert('Error', msg);
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background.primary,
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
          fontWeight: '800',
          color: colors.text.primary,
          marginBottom: Spacing.sm,
          letterSpacing: 0,
          fontFamily: fonts.extrabold,
        },
        subtitle: {
          fontSize: FontSizes.md,
          color: colors.text.secondary,
          lineHeight: 24,
          marginBottom: Spacing.lg,
        },
        progressContainer: {
          marginTop: Spacing.sm,
        },
        progressBar: {
          height: 6,
          backgroundColor: colors.background.tertiary,
          borderRadius: BorderRadius.full,
          overflow: 'hidden',
        },
        progressFill: {
          height: '100%',
          borderRadius: BorderRadius.full,
        },
        progressText: {
          fontSize: FontSizes.sm,
          color: colors.text.tertiary,
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
          color: colors.text.primary,
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
          borderTopColor: colors.border,
          backgroundColor: colors.background.primary,
        },
      }),
    [colors, fonts]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.default} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <AppText style={styles.title}>What are you into?</AppText>
          <AppText style={styles.subtitle}>
            Select at least 3 interests to help us find your people
          </AppText>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={[colors.primary.start, colors.primary.end]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressFill,
                  { width: `${Math.min((selectedIds.length / 3) * 100, 100)}%` },
                ]}
              />
            </View>
            <AppText style={styles.progressText}>
              {selectedIds.length} selected
              {selectedIds.length < 3 && ` (${3 - selectedIds.length} more needed)`}
            </AppText>
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
              <AppText style={styles.categoryTitle}>
                {categoryLabels[category] || category}
              </AppText>
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
