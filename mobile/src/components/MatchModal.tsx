/**
 * MatchModal - Celebration modal for matches
 */

import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSizes, FontWeights, Spacing } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';
import { PublicUser } from '../types';
import Avatar from './Avatar';
import GradientButton from './GradientButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MatchModalProps {
  visible: boolean;
  user: PublicUser | null;
  onClose: () => void;
  onMessage: () => void;
}

export const MatchModal: React.FC<MatchModalProps> = ({
  visible,
  user,
  onClose,
  onMessage,
}) => {
  const { colors } = useOrbitTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          alignItems: 'center',
        },
        container: {
          width: SCREEN_WIDTH - Spacing.xl * 2,
          borderRadius: BorderRadius.xl,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        sheet: {
          padding: Spacing.xl,
          alignItems: 'center',
          backgroundColor: colors.background.card,
        },
        closeButton: {
          position: 'absolute',
          top: Spacing.md,
          right: Spacing.md,
          padding: Spacing.xs,
        },
        heartsContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: Spacing.xl,
          marginBottom: Spacing.lg,
        },
        heartIcon: {
          marginHorizontal: -Spacing.md,
          zIndex: 1,
        },
        heartCircle: {
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary.default,
        },
        title: {
          fontSize: FontSizes.xxl,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
          marginBottom: Spacing.sm,
          textAlign: 'center',
        },
        subtitle: {
          fontSize: FontSizes.md,
          color: colors.text.secondary,
          textAlign: 'center',
          marginBottom: Spacing.xl,
        },
        actions: {
          width: '100%',
        },
        messageButton: {
          marginBottom: Spacing.md,
        },
        keepBrowsingButton: {
          padding: Spacing.md,
          alignItems: 'center',
        },
        keepBrowsingText: {
          color: colors.text.secondary,
          fontSize: FontSizes.md,
        },
      }),
    [colors]
  );

  if (!user) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>

            <View style={styles.heartsContainer}>
              <View>
                <Avatar uri={null} name="You" size={80} />
              </View>

              <View style={styles.heartIcon}>
                <View style={styles.heartCircle}>
                  <Ionicons name="heart" size={28} color="#FAFAFA" />
                </View>
              </View>

              <View>
                <Avatar uri={user.avatar} name={user.username} size={80} />
              </View>
            </View>

            <AppText style={styles.title}>New match</AppText>
            <AppText style={styles.subtitle}>
              You and {user.username} are now connected.
            </AppText>

            <View style={styles.actions}>
              <GradientButton
                title="Send a message"
                onPress={onMessage}
                size="lg"
                style={styles.messageButton}
              />
              <TouchableOpacity onPress={onClose} style={styles.keepBrowsingButton}>
                <AppText style={styles.keepBrowsingText}>Keep browsing</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default MatchModal;
