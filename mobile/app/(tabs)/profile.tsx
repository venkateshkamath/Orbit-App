/**
 * Profile Tab - User profile and settings
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius, Shadows } from '../../constants/Colors';
import { Avatar, GlassCard, InterestTag, GradientButton } from '../../src/components';
import { useAuthStore, useDiscoveryStore } from '../../src/stores';

export default function ProfileScreen() {
  const { user, logout, updateProfile } = useAuthStore();
  const { matches } = useDiscoveryStore();
  const router = useRouter();
  const [isDiscoverable, setIsDiscoverable] = useState(user?.is_discoverable ?? true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(user?.show_online_status ?? true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

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
          destructive && { backgroundColor: Colors.error + '20' },
        ]}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={destructive ? Colors.error : Colors.primary.default}
        />
      </View>
      <View style={styles.settingContent}>
        <Text
          style={[
            styles.settingTitle,
            destructive && { color: Colors.error },
          ]}
        >
          {title}
        </Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && (
        <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
      ))}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.background.primary, Colors.background.secondary]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <TouchableOpacity style={styles.editButton}>
              <Ionicons name="create-outline" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Profile Card */}
          <GlassCard style={styles.profileCard}>
            <TouchableOpacity 
              style={styles.avatarContainer} 
              onPress={handleAvatarPress}
              disabled={isUploadingAvatar}
            >
              <Avatar
                uri={user?.avatar}
                name={user?.username || 'U'}
                size={100}
              />
              {isUploadingAvatar && (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="large" color={Colors.primary.default} />
                </View>
              )}
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={16} color={Colors.text.primary} />
              </View>
            </TouchableOpacity>

            <Text style={styles.username}>{user?.username}</Text>
            <Text style={styles.email}>{user?.email}</Text>

            {user?.bio && <Text style={styles.bio}>{user.bio}</Text>}

            {/* Stats */}
            <View style={styles.stats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{matches.length}</Text>
                <Text style={styles.statLabel}>Matches</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{user?.interests?.length || 0}</Text>
                <Text style={styles.statLabel}>Interests</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{user?.discovery_radius || 10}m</Text>
                <Text style={styles.statLabel}>Radius</Text>
              </View>
            </View>
          </GlassCard>

          {/* Interests */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Interests</Text>
              <TouchableOpacity>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
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
          </View>

          {/* Discovery Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Discovery</Text>
            <GlassCard padding={0}>
              <SettingItem
                icon="eye"
                title="Discoverable"
                subtitle="Others can find you nearby"
                rightElement={
                  <Switch
                    value={isDiscoverable}
                    onValueChange={handleToggleDiscoverable}
                    trackColor={{ false: Colors.border, true: Colors.primary.default }}
                    thumbColor={Colors.text.primary}
                  />
                }
              />
              <View style={styles.separator} />
              <SettingItem
                icon="radio"
                title="Discovery Radius"
                subtitle={`${user?.discovery_radius || 10} meters`}
                onPress={() => {}}
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
                    trackColor={{ false: Colors.border, true: Colors.primary.default }}
                    thumbColor={Colors.text.primary}
                  />
                }
              />
            </GlassCard>
          </View>

          {/* Account Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <GlassCard padding={0}>
              <SettingItem
                icon="shield-checkmark"
                title="Privacy"
                onPress={() => {}}
              />
              <View style={styles.separator} />
              <SettingItem
                icon="notifications"
                title="Notifications"
                onPress={() => {}}
              />
              <View style={styles.separator} />
              <SettingItem
                icon="help-circle"
                title="Help & Support"
                onPress={() => {}}
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
            <Text style={styles.appVersion}>MindLink v1.0.0</Text>
            <Text style={styles.copyright}>Made with ❤️ for connections</Text>
          </View>
        </ScrollView>
      </SafeAreaView>

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
                <LinearGradient
                  colors={[Colors.primary.start, Colors.primary.end]}
                  style={styles.modalIconGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="image-outline" size={48} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <Text style={styles.modalTitle}>Profile Photo</Text>
              <Text style={styles.modalMessage}>
                Choose an action for your profile photo
              </Text>
              <View style={styles.avatarOptionsButtons}>
                <TouchableOpacity
                  style={styles.avatarOptionButton}
                  onPress={handleChangeAvatar}
                  disabled={isRequestingPermission}
                >
                  <LinearGradient
                    colors={[Colors.primary.start, Colors.primary.end]}
                    style={styles.avatarOptionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {isRequestingPermission ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
                    )}
                    <Text style={styles.avatarOptionText}>
                      {isRequestingPermission ? 'Opening...' : 'Change Photo'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                {user?.avatar && (
                  <TouchableOpacity
                    style={styles.avatarOptionButton}
                    onPress={handleRemoveAvatar}
                  >
                    <View style={styles.removeOptionButton}>
                      <Ionicons name="trash-outline" size={20} color={Colors.error} />
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
                <LinearGradient
                  colors={[Colors.primary.start, Colors.primary.end]}
                  style={styles.modalIconGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isLoggingOut ? (
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="log-out-outline" size={48} color="#FFFFFF" />
                  )}
                </LinearGradient>
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
                  >
                    <LinearGradient
                      colors={[Colors.primary.start, Colors.primary.end]}
                      style={styles.logoutButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.logoutButtonText}>Log Out</Text>
                    </LinearGradient>
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

const styles = StyleSheet.create({
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background.card,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  email: {
    fontSize: FontSizes.sm,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
  },
  bio: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  statNumber: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  editLink: {
    fontSize: FontSizes.sm,
    color: Colors.primary.default,
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
    backgroundColor: Colors.primary.default + '20',
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
    color: Colors.text.primary,
  },
  settingSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 68,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  appVersion: {
    fontSize: FontSizes.sm,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
  },
  copyright: {
    fontSize: FontSizes.xs,
    color: Colors.text.muted,
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
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  modalIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  modalMessage: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
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
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
  logoutButton: {
    overflow: 'hidden',
  },
  logoutButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  logoutButtonText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingContainer: {
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  loadingText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginTop: Spacing.md,
  },
  avatarOptionsButtons: {
    width: '100%',
    gap: Spacing.sm,
  },
  avatarOptionButton: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  avatarOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  avatarOptionText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: '#FFFFFF',
  },
  removeOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background.tertiary,
    gap: Spacing.sm,
  },
  removeOptionText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.error,
  },
  cancelOptionButton: {
    backgroundColor: Colors.background.tertiary,
  },
  cancelOptionText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
});
