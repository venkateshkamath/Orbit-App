/**
 * Profile Tab - User profile and settings
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Platform,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme } from '../../src/theme';
import { Avatar, GlassCard, InterestTag } from '../../src/components';
import { useMatchesQuery } from '../../src/hooks/useOrbitApi';
import { useAuthStore } from '../../src/stores';

function formatDiscoveryRadiusMeters(m?: number | null) {
  const r = m ?? 1000;
  if (r >= 1000) return `${r / 1000} km`;
  return `${r} m`;
}

export default function ProfileScreen() {
  const { colors, shadows, preference, setPreference } = useOrbitTheme();
  const { user, logout, updateProfile } = useAuthStore();
  const { data: matches = [] } = useMatchesQuery();
  const router = useRouter();
  const [isDiscoverable, setIsDiscoverable] = useState(user?.is_discoverable ?? true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(user?.show_online_status ?? true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleAvatarPress = () => {
    setShowAvatarOptions(true);
  };

  const handleChangeAvatar = async () => {
    try {
      setIsRequestingPermission(true);
      
      // Request permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        setIsRequestingPermission(false);
        setShowAvatarOptions(false);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      setIsRequestingPermission(false);
      setShowAvatarOptions(false);

      if (!result.canceled && result.assets[0]) {
        setIsUploadingAvatar(true);
        const uri = result.assets[0].uri;
        
        const { authApi } = await import('../../src/api');
        const updatedUser = await authApi.uploadAvatar(uri);
        
        const { setUser } = useAuthStore.getState();
        setUser(updatedUser);
        
        setIsUploadingAvatar(false);
      }
    } catch (error) {
            console.error('Avatar upload error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      setIsRequestingPermission(false);
      setShowAvatarOptions(false);
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setShowAvatarOptions(false);
    try {
      setIsUploadingAvatar(true);
      
      const { authApi } = await import('../../src/api');
      const updatedUser = await authApi.removeAvatar();
      
      const { setUser } = useAuthStore.getState();
      setUser(updatedUser);
      
      setIsUploadingAvatar(false);
    } catch (error) {
        console.error('Avatar remove error:', error);
      setIsUploadingAvatar(false);
    }
  };

  const handleToggleDiscoverable = async (value: boolean) => {
    setIsDiscoverable(value);
    try {
      await updateProfile({ is_discoverable: value });
    } catch (error) {
      setIsDiscoverable(!value);
      console.error('Failed to update settings:', error);
    }
  };

  const handleToggleOnlineStatus = async (value: boolean) => {
    setShowOnlineStatus(value);
    try {
      await updateProfile({ show_online_status: value });
    } catch (error) {
      setShowOnlineStatus(!value);
      console.error('Failed to update settings:', error);
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const openSystemSettings = () => {
    void Linking.openSettings();
  };

  const onDiscoveryRadiusPress = () => {
    Alert.alert(
      'Discovery radius',
      `You’re visible within ${formatDiscoveryRadiusMeters(user?.discovery_radius)}. Adjust discoverability and radius from Discovery settings below.`
    );
  };

  const onHelpPress = () => {
    Alert.alert('Help & support', 'Need help? Reach out through your usual support channel—we’re building more in-app help soon.');
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    // Don't close modal - keep it visible during logout
    try {
      await logout();
      
      if (Platform.OS === 'web') {
        window.location.href = '/';
      } else {
        setTimeout(() => {
          router.replace('/login');
        }, 100);
      }
    } catch (error) {
      console.error('Logout error:', error);
      if (Platform.OS === 'web') {
        window.location.href = '/';
      } else {
        router.replace('/');
      }
    }
  };

  const styles = useMemo(
      () =>
        StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    heroWrap: {
      marginHorizontal: -Spacing.lg,
      marginBottom: Spacing.lg,
      backgroundColor: colors.background.secondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    heroGradient: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.6,
    },
    heroInner: {
      paddingTop: Platform.OS === 'android' ? Spacing.lg : Spacing.lg,
      paddingBottom: Spacing.xl,
      paddingHorizontal: Spacing.lg,
      alignItems: 'center',
    },
    heroTopRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    heroIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background.tertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarRing: {
      position: 'relative',
      marginBottom: Spacing.md,
    },
    cameraIcon: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary.default,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background.primary,
      ...shadows.md,
    },
    avatarLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      borderRadius: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroName: {
      fontSize: FontSizes.display,
      fontWeight: FontWeights.extrabold,
      color: colors.text.primary,
      letterSpacing: -0.5,
      marginBottom: Spacing.xs,
      textAlign: 'center',
    },
    heroEmail: {
      fontSize: FontSizes.sm,
      color: colors.text.tertiary,
      marginBottom: Spacing.sm,
    },
    heroBio: {
      fontSize: FontSizes.md,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: Spacing.sm,
    },
    heroBioMuted: {
      fontSize: FontSizes.sm,
      color: colors.text.muted,
      textAlign: 'center',
      fontStyle: 'italic',
      paddingHorizontal: Spacing.md,
    },
    statsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.xl,
    },
    statPill: {
      flex: 1,
      backgroundColor: colors.background.tertiary,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xs,
      alignItems: 'center',
    },
    statPillValue: {
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.bold,
      color: colors.text.primary,
      marginTop: Spacing.xs,
    },
    statPillLabel: {
      fontSize: 10,
      fontWeight: FontWeights.semibold,
      color: colors.text.tertiary,
      marginTop: 2,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    section: {
      marginBottom: Spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: Spacing.md,
    },
    sectionKicker: {
      display: 'none' as const,
    },
    sectionTitleLarge: {
      fontSize: FontSizes.lg,
      fontWeight: '600' as const,
      color: colors.text.primary,
    },
    sectionTitleSpaced: {
      marginBottom: Spacing.md,
    },
    appearanceHint: {
      fontSize: FontSizes.sm,
      color: colors.text.tertiary,
      marginBottom: Spacing.md,
      lineHeight: 20,
    },
    appearanceRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    appearanceChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xs,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.background.tertiary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    appearanceChipActive: {
      borderColor: colors.primary.default,
      backgroundColor: colors.primary.default + '18',
    },
    appearanceChipText: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text.secondary,
    },
    appearanceChipTextActive: {
      color: colors.primary.default,
    },
    interestsCard: {
      marginTop: 0,
    },
    editLink: {
      fontSize: FontSizes.sm,
      color: colors.primary.default,
      fontWeight: FontWeights.medium,
    },
    interestsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
    },
    settingIcon: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.primary.default + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    settingContent: {
      flex: 1,
    },
    settingTitle: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.medium,
      color: colors.text.primary,
    },
    settingSubtitle: {
      fontSize: FontSizes.sm,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 68,
    },
    appInfo: {
      alignItems: 'center',
      marginTop: Spacing.xl,
      paddingVertical: Spacing.xl,
    },
    brandMark: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    brandMarkDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    appVersion: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.5,
    },
    copyright: {
      fontSize: FontSizes.xs,
      color: colors.text.muted,
      textAlign: 'center',
      maxWidth: 260,
      lineHeight: 18,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    modalContainer: {
      width: '100%',
      maxWidth: 400,
    },
    modalContent: {
      backgroundColor: colors.background.card,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      alignItems: 'center',
    },
    modalIconContainer: {
      marginBottom: Spacing.lg,
    },
    modalIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary.default,
    },
    modalTitle: {
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
      color: colors.text.primary,
      marginBottom: Spacing.sm,
    },
    modalMessage: {
      fontSize: FontSizes.md,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: Spacing.xl,
      lineHeight: 22,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
      width: '100%',
    },
    modalButton: {
      flex: 1,
      height: 48,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    cancelButton: {
      backgroundColor: colors.background.tertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.text.primary,
    },
    logoutButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    logoutButtonText: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: '#FFFFFF',
      zIndex: 1,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
    },
    loadingContainer: {
      backgroundColor: colors.background.card,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xxl,
      alignItems: 'center',
    },
    loadingText: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.text.primary,
      marginTop: Spacing.md,
    },
    avatarOptionsButtons: {
      width: '100%',
      gap: Spacing.sm,
    },
    avatarOptionButton: {
      width: '100%',
      borderRadius: BorderRadius.lg,
    },
    avatarOptionPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      gap: Spacing.sm,
      backgroundColor: colors.primary.default,
    },
    avatarOptionText: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.text.primary,
    },
    removeOptionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      backgroundColor: colors.background.tertiary,
      gap: Spacing.sm,
    },
    removeOptionText: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.error,
    },
    cancelOptionButton: {
      backgroundColor: colors.background.tertiary,
    },
    cancelOptionText: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.text.primary,
      textAlign: 'center',
      paddingVertical: Spacing.md,
    },
        }),
      [colors, shadows]
    );

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onPress,
    rightElement,
    destructive = false,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    destructive?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <View
        style={[
          styles.settingIcon,
          destructive && { backgroundColor: colors.error + '20' },
        ]}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={destructive ? colors.error : colors.primary.default}
        />
      </View>
      <View style={styles.settingContent}>
        <Text
          style={[
            styles.settingTitle,
            destructive && { color: colors.error },
          ]}
        >
          {title}
        </Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && (
        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
      ))}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero */}
          <View style={styles.heroWrap}>
            <View style={styles.heroInner}>
              <View style={styles.heroTopRow}>
                <TouchableOpacity
                  style={styles.heroIconBtn}
                  onPress={handleAvatarPress}
                  accessibilityLabel="Edit profile photo"
                >
                  <Ionicons name="camera" size={18} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.avatarRing}
                onPress={handleAvatarPress}
                disabled={isUploadingAvatar}
                activeOpacity={0.85}
              >
                <Avatar uri={user?.avatar} name={user?.username || 'U'} size={96} />
                {isUploadingAvatar && (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary.default} />
                  </View>
                )}
                <View style={styles.cameraIcon}>
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              <Text style={styles.heroName}>{user?.username ?? 'Explorer'}</Text>
              <Text style={styles.heroEmail}>{user?.email}</Text>
              {user?.bio ? (
                <Text style={styles.heroBio} numberOfLines={3}>
                  {user.bio}
                </Text>
              ) : (
                <Text style={styles.heroBioMuted}>Add a short bio so people know you better.</Text>
              )}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Ionicons name="heart" size={16} color={colors.secondary.default} />
              <Text style={styles.statPillValue}>{matches.length}</Text>
              <Text style={styles.statPillLabel}>Matches</Text>
            </View>
            <View style={styles.statPill}>
              <Ionicons name="planet" size={16} color={colors.primary.default} />
              <Text style={styles.statPillValue}>{user?.interests?.length ?? 0}</Text>
              <Text style={styles.statPillLabel}>Interests</Text>
            </View>
            <View style={styles.statPill}>
              <Ionicons name="navigate" size={16} color={colors.primary.light} />
              <Text style={styles.statPillValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatDiscoveryRadiusMeters(user?.discovery_radius)}
              </Text>
              <Text style={styles.statPillLabel}>Radius</Text>
            </View>
          </View>

          {/* Interests */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionKicker}>Passions</Text>
                <Text style={styles.sectionTitleLarge}>Interests</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(onboarding)/interests')} hitSlop={12}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
            <GlassCard padding={Spacing.md} style={styles.interestsCard}>
            <View style={styles.interestsContainer}>
              {user?.interests?.map((interest) => (
                <InterestTag
                  key={interest.id}
                  interest={interest}
                  selected
                  size="sm"
                />
              ))}
            </View>
            </GlassCard>
          </View>

          {/* Discovery Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>Visibility</Text>
            <Text style={[styles.sectionTitleLarge, styles.sectionTitleSpaced]}>Discovery</Text>
            <GlassCard padding={0}>
              <SettingItem
                icon="eye"
                title="Discoverable"
                subtitle="Others can find you nearby"
                rightElement={
                  <Switch
                    value={isDiscoverable}
                    onValueChange={handleToggleDiscoverable}
                    trackColor={{ false: colors.border, true: colors.primary.default }}
                    thumbColor={colors.text.primary}
                  />
                }
              />
              <View style={styles.separator} />
              <SettingItem
                icon="radio"
                title="Discovery Radius"
                subtitle={formatDiscoveryRadiusMeters(user?.discovery_radius)}
                onPress={onDiscoveryRadiusPress}
              />
              <View style={styles.separator} />
              <SettingItem
                icon="ellipse"
                title="Show Online Status"
                subtitle="Let others see when you're active"
                rightElement={
                  <Switch
                    value={showOnlineStatus}
                    onValueChange={handleToggleOnlineStatus}
                    trackColor={{ false: colors.border, true: colors.primary.default }}
                    thumbColor={colors.text.primary}
                  />
                }
              />
            </GlassCard>
          </View>

          {/* Appearance */}
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>Display</Text>
            <Text style={[styles.sectionTitleLarge, styles.sectionTitleSpaced]}>Appearance</Text>
            <Text style={styles.appearanceHint}>
              Use device setting, or keep the app light or dark.
            </Text>
            <View style={styles.appearanceRow}>
              {(['system', 'light', 'dark'] as const).map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.appearanceChip,
                    preference === key && styles.appearanceChipActive,
                  ]}
                  onPress={() => setPreference(key)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={
                      key === 'system'
                        ? 'phone-portrait-outline'
                        : key === 'light'
                          ? 'sunny-outline'
                          : 'moon-outline'
                    }
                    size={18}
                    color={preference === key ? colors.primary.default : colors.text.tertiary}
                  />
                  <Text
                    style={[
                      styles.appearanceChipText,
                      preference === key && styles.appearanceChipTextActive,
                    ]}
                  >
                    {key === 'system' ? 'System' : key === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Account Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>Security & help</Text>
            <Text style={[styles.sectionTitleLarge, styles.sectionTitleSpaced]}>Account</Text>
            <GlassCard padding={0}>
              <SettingItem
                icon="shield-checkmark"
                title="Privacy"
                subtitle="How we use your data"
                onPress={() => setShowPrivacyModal(true)}
              />
              <View style={styles.separator} />
              <SettingItem
                icon="notifications"
                title="Notifications"
                subtitle="Open system settings"
                onPress={openSystemSettings}
              />
              <View style={styles.separator} />
              <SettingItem
                icon="help-circle"
                title="Help & Support"
                onPress={onHelpPress}
              />
              <View style={styles.separator} />
              <SettingItem
                icon="log-out"
                title="Log Out"
                onPress={handleLogout}
                destructive
              />
            </GlassCard>
          </View>

          {/* App Info */}
          <View style={styles.appInfo}>
            <View style={styles.brandMark}>
              <LinearGradient
                colors={[colors.primary.default, colors.primary.dark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.brandMarkDot}
              />
              <Text style={styles.appVersion}>ORBIT v1.0.0</Text>
            </View>
            <Text style={styles.copyright}>Built for real connections nearby.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showPrivacyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}>
                <View style={[styles.modalIconCircle, { backgroundColor: colors.background.elevated }]}>
                  <Ionicons name="shield-checkmark" size={36} color={colors.primary.default} />
                </View>
              </View>
              <Text style={styles.modalTitle}>Privacy</Text>
              <Text style={styles.modalMessage}>
                ORBIT uses your location while you use the app to show nearby people. Your email is used for
                sign-in. You control discoverability and online status in Discovery settings. We don’t sell your
                data to third parties.
              </Text>
              <TouchableOpacity
                style={[styles.modalButton, styles.logoutButton, { flex: 0, width: '100%' }]}
                onPress={() => setShowPrivacyModal(false)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[colors.primary.start, colors.primary.end]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Text style={styles.logoutButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Avatar Options Modal */}
      <Modal
        visible={showAvatarOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="image-outline" size={40} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.modalTitle}>Profile Photo</Text>
              <Text style={styles.modalMessage}>
                Choose an action for your profile photo
              </Text>
              <View style={styles.avatarOptionsButtons}>
                <TouchableOpacity
                  style={[styles.avatarOptionButton, styles.avatarOptionPrimary]}
                  onPress={handleChangeAvatar}
                  disabled={isRequestingPermission}
                >
                  {isRequestingPermission ? (
                    <ActivityIndicator size="small" color={colors.text.primary} />
                  ) : (
                    <Ionicons name="camera-outline" size={20} color={colors.text.primary} />
                  )}
                  <Text style={styles.avatarOptionText}>
                    {isRequestingPermission ? 'Opening…' : 'Change photo'}
                  </Text>
                </TouchableOpacity>
                {user?.avatar && (
                  <TouchableOpacity
                    style={styles.avatarOptionButton}
                    onPress={handleRemoveAvatar}
                  >
                    <View style={styles.removeOptionButton}>
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                      <Text style={styles.removeOptionText}>Remove Photo</Text>
                    </View>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.avatarOptionButton, styles.cancelOptionButton]}
                  onPress={() => setShowAvatarOptions(false)}
                >
                  <Text style={styles.cancelOptionText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}>
                <View style={styles.modalIconCircle}>
                  {isLoggingOut ? (
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="log-out-outline" size={40} color="#FFFFFF" />
                  )}
                </View>
              </View>
              <Text style={styles.modalTitle}>
                {isLoggingOut ? 'Logging Out' : 'Log Out'}
              </Text>
              <Text style={styles.modalMessage}>
                {isLoggingOut 
                  ? 'Please wait...' 
                  : 'Are you sure you want to log out?'}
              </Text>
              {!isLoggingOut && (
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowLogoutModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.logoutButton]}
                    onPress={confirmLogout}
                    activeOpacity={0.9}
                  >
                    <LinearGradient
                      colors={[colors.primary.start, colors.primary.end]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Text style={styles.logoutButtonText}>Log out</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

