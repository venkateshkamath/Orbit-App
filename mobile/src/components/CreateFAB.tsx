import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { addDays, addMonths, endOfMonth, format, getDay, isBefore, isSameDay, startOfDay, startOfMonth, subMonths } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import BottomSheet from './BottomSheet';
import { OrbitLoader } from './OrbitLoader';
import { eventsApi, type CatchupLocation, type EventCategoryOption } from '../api/events';
import { API_BASE_URL } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { orbitKeys } from '../hooks/orbitKeys';
import { AppText } from '../ui/AppText';
import { formatApiError } from '../utils/apiErrors';
import { useToast } from '../context/ToastContext';
import { useOrbitTheme } from '../theme';
import type { OrbitEvent } from '../types';

const ACCENT = '#00B4D8';
const DARK = '#0D0D0D';
const BORDER = '#E8E8E8';
const ERROR = '#EF4444';
const SUCCESS = '#22C55E';
const MUTED = '#999';
const LABEL = '#888';

type LocationMode = 'search' | 'manual';
type JoinMode = 'open' | 'approval';
type PhotoAsset = {
  uri: string;
  name: string;
  type: string;
  remote?: boolean;
  sourceUrl?: string;
  publicId?: string | null;
};

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

function mediaUrl(url?: string | null): string | null {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (/^(https?:|file:|content:|data:)/i.test(value)) return value;
  const normalized = value.replace(/^\/+/, '');
  const mediaPath = normalized.startsWith('media/') ? normalized : `media/${normalized}`;
  return `${API_ORIGIN}/${mediaPath}`;
}

function normalizeImageAsset(asset: ImagePicker.ImagePickerAsset, index: number): PhotoAsset {
  const supportedMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
  const mimeType = asset.mimeType && supportedMimeTypes.has(asset.mimeType) ? asset.mimeType : 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return {
    uri: asset.uri,
    name: `catchup_${Date.now()}_${index}.${extension}`,
    type: mimeType,
  };
}

type Props = {
  initialLat?: number;
  initialLng?: number;
  bottomOffset?: number;
  onCreated?: () => void;
  controlledOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideLauncher?: boolean;
  editingEvent?: OrbitEvent | null;
};

function startOfSelected(date: Date) {
  return startOfDay(date).getTime();
}

function nextValidTodaySlot(now = new Date()) {
  const min = new Date(now.getTime() + 10 * 60 * 1000);
  min.setSeconds(0, 0);
  const rounded = new Date(min);
  const remainder = rounded.getMinutes() % 15;
  if (remainder !== 0) rounded.setMinutes(rounded.getMinutes() + (15 - remainder));
  return rounded;
}

function timeSlotsFor(date: Date) {
  const day = startOfDay(date);
  if (isBefore(day, startOfDay(new Date()))) return [];
  const today = isSameDay(day, new Date());
  const first = today ? nextValidTodaySlot() : day;
  if (today && !isSameDay(first, day)) return [];
  const slots: Date[] = [];
  const cursor = new Date(day);
  cursor.setHours(today ? first.getHours() : 0, today ? first.getMinutes() : 0, 0, 0);
  while (isSameDay(cursor, day)) {
    slots.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + 15);
  }
  return slots;
}

function sameSlotTime(left: Date, right: Date) {
  return left.getHours() === right.getHours() && left.getMinutes() === right.getMinutes();
}

function SectionLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  const { colors } = useOrbitTheme();
  return (
    <View style={styles.labelRow}>
      <AppText style={[styles.sectionLabel, { color: colors.text.tertiary }]}>{children}</AppText>
      {optional ? (
        <AppText
          style={[
            styles.optionalBadge,
            {
              color: colors.text.tertiary,
              backgroundColor: colors.background.secondary,
            },
          ]}
        >
          Optional
        </AppText>
      ) : null}
    </View>
  );
}

export function CreateFAB({
  initialLat,
  initialLng,
  bottomOffset = 96,
  onCreated,
  controlledOpen,
  onOpenChange,
  hideLauncher = false,
  editingEvent = null,
}: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { colors, resolvedScheme } = useOrbitTheme();
  const user = useAuthStore((s) => s.user);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean | ((value: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };
  const [preview, setPreview] = useState(false);
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [confirmCity, setConfirmCity] = useState(false);

  const [name, setName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [locationMode, setLocationMode] = useState<LocationMode>('search');
  const [locationQuery, setLocationQuery] = useState('');
  const [location, setLocation] = useState<CatchupLocation | null>(null);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationResults, setLocationResults] = useState<CatchupLocation[]>([]);
  const [manualAddress, setManualAddress] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeHint, setTimeHint] = useState('');
  const [joinMode, setJoinMode] = useState<JoinMode>('open');
  const [maxPeopleText, setMaxPeopleText] = useState('10');
  const [categories, setCategories] = useState<EventCategoryOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [otherMode, setOtherMode] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [coverPhotoIndex, setCoverPhotoIndex] = useState(0);
  const isEditing = Boolean(editingEvent);

  const progress = useRef(new Animated.Value(0)).current;
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDark = resolvedScheme === 'dark';
  const theme = useMemo(
    () =>
      StyleSheet.create({
        title: { color: colors.text.primary },
        secondaryText: { color: colors.text.secondary },
        tertiaryText: { color: colors.text.tertiary },
        mutedText: { color: colors.text.muted },
        input: {
          color: colors.text.primary,
          backgroundColor: colors.background.card,
          borderColor: colors.borderLight,
        },
        inputFocused: {
          borderColor: colors.primary.default,
        },
        iconField: {
          backgroundColor: colors.background.card,
          borderColor: colors.borderLight,
        },
        panel: {
          backgroundColor: colors.background.card,
          borderColor: colors.borderLight,
        },
        subtlePanel: {
          backgroundColor: colors.background.secondary,
          borderColor: colors.border,
        },
        activeSoft: {
          backgroundColor: colors.primary.default + (isDark ? '24' : '18'),
          borderColor: colors.primary.default,
        },
        chip: {
          backgroundColor: colors.background.secondary,
          borderColor: colors.borderLight,
        },
        lightButton: {
          backgroundColor: colors.background.card,
          borderColor: colors.borderLight,
        },
        previewPill: {
          backgroundColor: isDark ? 'rgba(11,17,26,0.88)' : 'rgba(255,255,255,0.92)',
        },
        overlay: {
          backgroundColor: isDark ? 'rgba(5,8,13,0.72)' : 'rgba(0,0,0,0.3)',
        },
      }),
    [colors, isDark]
  );
  const placeholderColor = colors.text.muted;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: open ? 1 : 0,
      damping: 12,
      stiffness: 180,
      useNativeDriver: false,
    }).start();
  }, [open, progress]);

  useEffect(() => {
    if (!open || categories.length) return;
    setLoadingCategories(true);
    eventsApi.getCategories()
      .then((items) => {
        setCategories(items);
        setCategoryId((prev) => prev ?? items[0]?.id ?? null);
      })
      .catch(() => setCategories([
        { id: 'social', name: 'Social' },
        { id: 'sports', name: 'Sports' },
        { id: 'food', name: 'Food' },
        { id: 'music', name: 'Music' },
      ]))
      .finally(() => setLoadingCategories(false));
  }, [categories.length, open]);

  useEffect(() => {
    if (photos.length <= 1) setCoverPhotoIndex(0);
    else if (coverPhotoIndex > photos.length - 1) setCoverPhotoIndex(photos.length - 1);
  }, [coverPhotoIndex, photos.length]);

  const fabBg = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.primary.default, isDark ? colors.background.elevated : DARK],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const slots = useMemo(() => timeSlotsFor(selectedDate), [selectedDate]);
  const maxPeople = Math.min(Math.max(Number(maxPeopleText.replace(/\D/g, '')) || 10, 2), 100);
  const previewSpotsLeft = Math.max(maxPeople - (editingEvent?.attendee_count ?? 1), 0);
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const blanks = Array.from({ length: getDay(monthStart) }, () => null);
    const days: (Date | null)[] = [...blanks];
    const cursor = new Date(monthStart);
    while (cursor <= monthEnd) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [calendarMonth]);


  const reset = () => {
    setPreview(false);
    setName('');
    setLocationQuery('');
    setLocation(null);
    setLocationResults([]);
    setManualAddress('');
    setSelectedDate(startOfDay(new Date()));
    setSelectedTime(null);
    setJoinMode('open');
    setMaxPeopleText('10');
    setCategoryId(categories[0]?.id ?? null);
    setOtherMode(false);
    setCustomCategory('');
    setDescription('');
    setPhotos([]);
    setCoverPhotoIndex(0);
    setTimeHint('');
  };

  useEffect(() => {
    if (!open || !editingEvent) return;

    const start = new Date(editingEvent.start_at);
    const eventLocation: CatchupLocation = {
      name: editingEvent.location_name || editingEvent.address || editingEvent.city || '',
      address: editingEvent.address || editingEvent.location_name || '',
      city: editingEvent.city || '',
      lat: editingEvent.latitude,
      lng: editingEvent.longitude,
      source: editingEvent.location_source === 'search' || editingEvent.location_source === 'gmaps' ? editingEvent.location_source : 'manual',
    };
    const eventPhotos = editingEvent.photos?.length
      ? editingEvent.photos
      : editingEvent.image_url
        ? [{ url: editingEvent.image_url, public_id: null }]
        : [];

    setPreview(false);
    setName(editingEvent.title || '');
    setLocationMode('search');
    setLocation(eventLocation);
    setLocationQuery(eventLocation.name || eventLocation.address);
    setLocationResults([]);
    setManualAddress(eventLocation.address);
    setSelectedDate(startOfDay(start));
    setCalendarMonth(startOfMonth(start));
    setSelectedTime(start);
    setJoinMode(editingEvent.join_mode ?? 'open');
    setMaxPeopleText(String(editingEvent.max_people ?? 10));
    setCategoryId(editingEvent.custom_category ? null : (editingEvent.category_id || editingEvent.category || null));
    setOtherMode(Boolean(editingEvent.custom_category));
    setCustomCategory(editingEvent.custom_category || '');
    setDescription(editingEvent.description || '');
    setPhotos(eventPhotos.map((photo, index) => ({
      uri: mediaUrl(photo.url) ?? photo.url,
      name: `existing_${index}.jpg`,
      type: 'image/jpeg',
      remote: true,
      sourceUrl: photo.url,
      publicId: photo.public_id ?? null,
    })));
    setCoverPhotoIndex(Math.min(editingEvent.cover_photo_index ?? 0, Math.max(eventPhotos.length - 1, 0)));
    setTimeHint('');
  }, [editingEvent, open]);

  const handleToggle = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setOpen((value) => {
      if (value) reset();
      return !value;
    });
  };

  const closeSheet = () => {
    setOpen(false);
    reset();
  };

  const handleLocationChange = (text: string) => {
    setLocationQuery(text);
    setLocation(null);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (text.trim().length < 2) {
      setLocationResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearchingLocation(true);
      setLocationResults([]);
      try {
        const results = await eventsApi.searchLocation(text.trim());
        setLocationResults(results.map((item) => ({
          name: item.name || item.display_name.split(',')[0],
          address: item.address || item.display_name,
          city: item.city || '',
          lat: item.lat,
          lng: item.lng,
          source: 'search',
        })));
      } catch {
        setLocationResults([]);
      } finally {
        setSearchingLocation(false);
      }
    }, 300);
  };

  const chooseDate = (date: Date) => {
    setSelectedDate(startOfDay(date));
    setCalendarOpen(false);
    const nextSlots = timeSlotsFor(date);
    if (nextSlots.length === 0) {
      const tomorrow = startOfDay(addDays(new Date(), 1));
      setSelectedDate(tomorrow);
      setSelectedTime(null);
      setTimeHint('Too late for today - try tomorrow?');
      setTimeOpen(true);
      return;
    }
    if (selectedTime && !nextSlots.some((slot) => sameSlotTime(slot, selectedTime))) {
      setSelectedTime(null);
      setTimeHint('That time has passed. Pick a new one.');
      setTimeOpen(true);
    }
  };

  const openTimePicker = () => {
    if (!timeOpen && !selectedTime && slots[0]) setSelectedTime(slots[0]);
    setTimeOpen((value) => !value);
  };

  const chooseTimeSlot = (slot: Date) => {
    setSelectedTime(slot);
    setTimeHint('');
    setTimeOpen(false);
    void Haptics.selectionAsync().catch(() => {});
  };

  const pickPhoto = async () => {
    if (photos.length >= 5) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      quality: 0.82,
    });
    if (result.canceled) return;
    const next = result.assets.slice(0, 5 - photos.length).map(normalizeImageAsset);
    setPhotos((current) => [...current, ...next].slice(0, 5));
  };

  const currentLocation = () => {
    if (location) return location;
    if (locationMode === 'manual' && manualAddress.trim().length >= 5 && initialLat != null && initialLng != null) {
      return {
        name: manualAddress.trim().split('\n')[0],
        address: manualAddress.trim(),
        city: user?.city || '',
        lat: initialLat,
        lng: initialLng,
        source: 'manual' as const,
      };
    }
    return null;
  };

  const selectedCategoryName = customCategory.trim() || categories.find((c) => c.id === categoryId)?.name || '';
  const previewLocation = currentLocation();
  const hasPreviewContent = Boolean(
    name.trim()
    || previewLocation
    || selectedTime
    || description.trim()
    || customCategory.trim()
    || photos.length
  );

  const selectedDateTime = () => {
    if (!selectedTime) return null;
    const dateTime = new Date(selectedDate);
    dateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    return dateTime;
  };

  const isValidFutureSlot = (dateTime: Date) => (
    dateTime.getTime() > Date.now()
    && timeSlotsFor(selectedDate).some((slot) => sameSlotTime(slot, dateTime))
  );

  const showStaleTimeError = () => {
    toast.error('Pick a future time.');
    setTimeHint('That time has passed. Pick a new one.');
    setTimeOpen(true);
  };

  const submit = async (confirmedCity = false) => {
    const loc = currentLocation();
    if (name.trim().length < 3) {
      toast.error('Add a catchup name.');
      return;
    }
    if (!loc) {
      toast.error('Choose a location.');
      return;
    }
    if (!selectedTime) {
      toast.error('Pick a time.');
      setTimeOpen(true);
      return;
    }
    const dateTime = selectedDateTime();
    if (!dateTime || !isValidFutureSlot(dateTime)) {
      showStaleTimeError();
      return;
    }
    if (!categoryId && !customCategory.trim()) {
      toast.error('Pick a category.');
      return;
    }
    if (!confirmedCity && loc.city && user?.city && loc.city.toLowerCase() !== user.city.toLowerCase()) {
      setConfirmCity(true);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        location: loc,
        dateTime: dateTime.toISOString(),
        joinMode,
        maxPeople,
        categoryId: customCategory.trim() ? null : categoryId,
        customCategory: customCategory.trim() || null,
        description: description.trim() || null,
        photos,
        coverPhotoIndex,
      };

      if (editingEvent) {
        const newPhotos = photos.filter((photo) => !photo.remote);
        const existingPhotos = photos
          .filter((photo) => photo.remote)
          .map((photo) => ({
            url: photo.sourceUrl ?? photo.uri,
            public_id: photo.publicId ?? null,
          }));
        await eventsApi.updateCatchup(editingEvent.id, {
          ...payload,
          photos: newPhotos.length ? newPhotos : undefined,
          existingPhotos,
          coverPhotoIndex,
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orbitKeys.eventsFeed() }),
          queryClient.invalidateQueries({ queryKey: orbitKeys.event(editingEvent.id) }),
          queryClient.invalidateQueries({ queryKey: ['orbit', 'events'] }),
        ]);
      } else {
        await eventsApi.createCatchup(payload);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orbitKeys.eventsFeed() }),
          queryClient.invalidateQueries({ queryKey: ['orbit', 'events'] }),
        ]);
      }
      onCreated?.();
      closeSheet();
      toast.success(editingEvent ? 'Catchup updated.' : 'Your catchup is live!');
    } catch (error) {
      console.error(`[CreateFAB] ${editingEvent ? 'update' : 'create'} catchup failed`, error);
      toast.error(formatApiError(error));
    } finally {
      setSubmitting(false);
      setConfirmCity(false);
    }
  };

  const openPreview = () => {
    if (!hasPreviewContent) {
      toast.error('Add a few details before previewing.');
      return;
    }
    const dateTime = selectedDateTime();
    if (dateTime && !isValidFutureSlot(dateTime)) {
      showStaleTimeError();
      return;
    }
    setPreview(true);
  };

  const removePhotoAt = (index: number) => {
    setPhotos((current) => {
      const next = current.filter((_, i) => i !== index);
      let nextCoverIndex = coverPhotoIndex;
      if (index === coverPhotoIndex) nextCoverIndex = Math.min(index, next.length - 1);
      else if (index < coverPhotoIndex) nextCoverIndex = coverPhotoIndex - 1;
      setCoverPhotoIndex(Math.max(nextCoverIndex, 0));
      return next;
    });
  };

  const form = (
    <>
      <View style={styles.header}>
        <View>
          <AppText style={[styles.title, theme.title]}>{isEditing ? 'Edit catchup' : 'Create a catchup'}</AppText>
          <AppText style={[styles.subtitle, theme.tertiaryText]}>{isEditing ? 'Tune the details' : 'Get people together'}</AppText>
        </View>
        <TouchableOpacity style={[styles.headerClose, theme.subtlePanel]} onPress={closeSheet} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {preview ? (
        <View style={styles.preview}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.previewScroll}>
            <View style={[styles.previewHero, theme.subtlePanel]}>
              {photos[coverPhotoIndex] ? (
                <Image source={{ uri: photos[coverPhotoIndex].uri }} style={styles.previewImage} />
              ) : (
                <View style={[styles.previewEmptyImage, theme.subtlePanel]}>
                  <Ionicons name="sparkles-outline" size={24} color={colors.primary.default} />
                </View>
              )}
              <View style={styles.previewHeroShade} />
              {selectedCategoryName ? (
                <View style={[styles.previewHeroPill, theme.previewPill]}>
                  <AppText style={[styles.previewHeroPillText, { color: colors.primary.default }]}>{selectedCategoryName}</AppText>
                </View>
              ) : null}
            </View>

            {photos.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewPhotoRail}>
                {photos.map((photo, index) => (
                  <TouchableOpacity key={photo.uri} style={styles.previewPhotoWrap} onPress={() => setCoverPhotoIndex(index)}>
                    <Image source={{ uri: photo.uri }} style={[styles.previewThumb, coverPhotoIndex === index && styles.previewThumbActive]} />
                    {coverPhotoIndex === index ? <AppText style={styles.previewCoverText}>Cover</AppText> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            <View style={[styles.previewCard, theme.panel]}>
              <AppText style={[styles.previewTitle, theme.title]}>{name.trim() || 'Catchup draft'}</AppText>
              <View style={styles.previewMetaRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary.default} />
                <AppText style={[styles.previewMeta, theme.secondaryText]}>{format(selectedDate, 'EEE, MMM d')}{selectedTime ? ` at ${format(selectedTime, 'h:mm a')}` : ''}</AppText>
              </View>
              {previewLocation ? (
                <View style={styles.previewMetaRow}>
                  <Ionicons name="location-outline" size={16} color={colors.primary.default} />
                  <AppText style={[styles.previewMeta, theme.secondaryText]} numberOfLines={2}>{previewLocation.name || previewLocation.address}</AppText>
                </View>
              ) : null}
              {description.trim() ? <AppText style={[styles.previewDesc, theme.tertiaryText]} numberOfLines={4}>{description.trim()}</AppText> : null}
              <View style={styles.previewFooterRow}>
                <AppText style={[styles.spots, { color: colors.primary.default }]}>{previewSpotsLeft} spots left</AppText>
                <AppText style={[styles.previewMode, theme.subtlePanel, theme.secondaryText]}>{joinMode === 'open' ? 'Open join' : 'Approval'}</AppText>
              </View>
            </View>
          </ScrollView>
          <View style={styles.previewActions}>
            <TouchableOpacity style={[styles.ghostBtn, theme.lightButton]} onPress={() => setPreview(false)}><AppText style={[styles.ghostText, { color: colors.primary.default }]}>Edit</AppText></TouchableOpacity>
            <TouchableOpacity style={[styles.blackBtn, { backgroundColor: colors.primary.default }]} onPress={() => void submit()} disabled={submitting}>
              {submitting ? (
                <AppText style={styles.blackBtnText}>{isEditing ? 'Saving...' : 'Posting...'}</AppText>
              ) : (
                <>
                  <AppText style={styles.blackBtnText}>{isEditing ? 'Save' : 'Post it'}</AppText>
                  <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <SectionLabel>WHAT'S THE PLAN?</SectionLabel>
          <TextInput
            value={name}
            onChangeText={(text) => setName(text.slice(0, 60))}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            style={[styles.input, theme.input, name.length > 0 && name.trim().length < 3 && styles.inputError, nameFocused && theme.inputFocused]}
            placeholder="Morning run, chai break, jam session..."
            placeholderTextColor={placeholderColor}
          />
          {nameFocused ? <AppText style={[styles.counter, theme.mutedText]}>{name.length}/60</AppText> : null}

          <SectionLabel>WHERE?</SectionLabel>
          <View style={[styles.modeRow, theme.subtlePanel]}>
            {(['search', 'manual'] as LocationMode[]).map((mode) => (
              <TouchableOpacity key={mode} style={[styles.modePill, locationMode === mode && theme.lightButton]} onPress={() => setLocationMode(mode)}>
                <Ionicons name={mode === 'search' ? 'search' : 'create-outline'} size={14} color={locationMode === mode ? colors.primary.default : colors.text.tertiary} />
                <AppText style={[styles.modeText, { color: colors.text.tertiary }, locationMode === mode && { color: colors.primary.default }]}>{mode === 'search' ? 'Search' : 'Address'}</AppText>
              </TouchableOpacity>
            ))}
          </View>
          {locationMode === 'search' ? (
            <View style={styles.locationBox}>
              <View style={[styles.inputIconRow, theme.iconField]}>
                <Ionicons name="search" size={17} color={colors.text.tertiary} />
                <TextInput style={[styles.iconInput, { color: colors.text.primary }]} value={locationQuery} onChangeText={handleLocationChange} placeholder="Search for a place" placeholderTextColor={placeholderColor} />
                {searchingLocation ? <OrbitLoader variant="inline" size="sm" /> : null}
                {!searchingLocation && location ? (
                  <View style={[styles.selectedLocationIcon, { backgroundColor: colors.background.card }]}>
                    <Ionicons name="checkmark" size={14} color={colors.success} />
                  </View>
                ) : null}
              </View>
              {locationQuery.trim().length >= 2 && (searchingLocation || locationResults.length > 0 || !location) ? (
                <View style={[styles.dropdown, theme.panel]}>
                  {searchingLocation ? (
                    <View style={styles.dropdownState}>
                      <OrbitLoader variant="inline" size="sm" />
                      <AppText style={[styles.dropdownStateText, theme.tertiaryText]}>Searching places...</AppText>
                    </View>
                  ) : locationResults.length ? (
                    locationResults.slice(0, 6).map((item, index) => (
                      <TouchableOpacity key={`${item.lat}-${item.lng}-${index}`} style={[styles.dropdownRow, { borderBottomColor: colors.border }]} onPress={() => { setLocation(item); setLocationQuery(item.name); setLocationResults([]); }}>
                        <AppText style={[styles.dropdownName, theme.title]}>{item.name}</AppText>
                        <AppText style={[styles.dropdownAddress, theme.tertiaryText]} numberOfLines={1}>{item.address}</AppText>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.dropdownState}>
                      <AppText style={[styles.dropdownStateText, theme.tertiaryText]}>No places found. Try a more specific search.</AppText>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
          {locationMode === 'manual' ? (
            <TextInput
              value={manualAddress}
              onChangeText={setManualAddress}
              style={[styles.input, theme.input, styles.textArea]}
              placeholder="Type the full address"
              placeholderTextColor={placeholderColor}
              multiline
            />
          ) : null}

          <SectionLabel>WHEN?</SectionLabel>
          <View style={styles.dateRail}>
            {[0, 1].map((index) => {
              const date = startOfDay(addDays(new Date(), index));
              const selected = startOfSelected(date) === startOfSelected(selectedDate);
              return (
                <TouchableOpacity key={date.toISOString()} style={[styles.dateChip, theme.chip, selected && theme.activeSoft]} onPress={() => chooseDate(date)}>
                  <AppText style={[styles.dateChipText, theme.secondaryText, selected && { color: colors.primary.default }]}>{index === 0 ? 'Today' : 'Tomorrow'}</AppText>
                  <AppText style={[styles.dateChipDay, theme.tertiaryText, selected && { color: colors.primary.default }]}>{format(date, 'MMM d')}</AppText>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.dateChip, styles.calendarChip, theme.chip, calendarOpen && theme.activeSoft]}
              onPress={() => {
                setCalendarMonth(startOfMonth(selectedDate));
                setCalendarOpen((value) => !value);
              }}
            >
              <Ionicons name="calendar-outline" size={17} color={calendarOpen ? colors.primary.default : colors.text.tertiary} />
            </TouchableOpacity>
          </View>
          {calendarOpen ? (
            <View style={[styles.calendarCard, theme.panel]}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity
                  style={[styles.calendarNav, theme.subtlePanel]}
                  disabled={startOfSelected(calendarMonth) <= startOfSelected(startOfMonth(new Date()))}
                  onPress={() => setCalendarMonth((month) => subMonths(month, 1))}
                >
                  <Ionicons name="chevron-back" size={18} color={startOfSelected(calendarMonth) <= startOfSelected(startOfMonth(new Date())) ? colors.text.muted : colors.text.primary} />
                </TouchableOpacity>
                <AppText style={[styles.calendarTitle, theme.title]}>{format(calendarMonth, 'MMMM yyyy')}</AppText>
                <TouchableOpacity style={[styles.calendarNav, theme.subtlePanel]} onPress={() => setCalendarMonth((month) => addMonths(month, 1))}>
                  <Ionicons name="chevron-forward" size={18} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.weekRow}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <AppText key={`${day}-${index}`} style={[styles.weekText, theme.tertiaryText]}>{day}</AppText>)}
              </View>
              <View style={styles.calendarGrid}>
                {calendarDays.map((day, index) => {
                  const disabled = !day || isBefore(day, startOfDay(new Date()));
                  const selected = !!day && startOfSelected(day) === startOfSelected(selectedDate);
                  const today = !!day && isSameDay(day, new Date());
                  return (
                    <TouchableOpacity
                      key={day?.toISOString() || `blank-${index}`}
                      disabled={disabled}
                      style={[styles.dayCell, selected && { backgroundColor: colors.primary.default }]}
                      onPress={() => day && chooseDate(day)}
                    >
                      {day ? <AppText style={[styles.dayText, theme.title, disabled && { color: colors.text.muted }, selected && styles.dayTextActive]}>{format(day, 'd')}</AppText> : null}
                      {today && !selected ? <View style={[styles.todayDot, { backgroundColor: colors.primary.default }]} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
          <TouchableOpacity style={[styles.timePill, theme.iconField]} onPress={openTimePicker}>
            <View style={styles.timePillLeft}>
              <Ionicons name="time-outline" size={18} color={colors.primary.default} />
              <AppText style={[styles.timePillText, theme.title]}>{selectedTime ? format(selectedTime, 'h:mm a') : 'Select time'}</AppText>
            </View>
            <Ionicons name={timeOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text.tertiary} />
          </TouchableOpacity>
          {timeHint ? <AppText style={[styles.hint, theme.tertiaryText]}>{timeHint}</AppText> : null}
          {timeOpen ? (
            <View style={[styles.timePickerCard, theme.panel]}>
              {slots.length ? (
                <>
                  <View style={styles.timePickerHeader}>
                    <AppText style={[styles.timePickerTitle, theme.title]}>Available times</AppText>
                    <AppText style={[styles.timePickerMeta, theme.tertiaryText]}>{isSameDay(selectedDate, new Date()) ? 'Future only' : format(selectedDate, 'MMM d')}</AppText>
                  </View>
                  <ScrollView
                    style={styles.timeSlotScroll}
                    contentContainerStyle={styles.timeSlotGrid}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {slots.map((slot) => {
                      const selected = selectedTime ? sameSlotTime(selectedTime, slot) : false;
                      return (
                        <TouchableOpacity
                          key={slot.toISOString()}
                          activeOpacity={0.86}
                          style={[styles.timeSlot, theme.chip, selected && { borderColor: colors.primary.default, backgroundColor: colors.primary.default }]}
                          onPress={() => chooseTimeSlot(slot)}
                        >
                          <AppText style={[styles.timeSlotText, theme.secondaryText, selected && styles.timeSlotTextActive]}>{format(slot, 'h:mm a')}</AppText>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              ) : (
                <View style={styles.timeEmptyState}>
                  <Ionicons name="moon-outline" size={18} color={colors.text.tertiary} />
                  <AppText style={[styles.timeEmptyText, theme.tertiaryText]}>Too late for today - try tomorrow?</AppText>
                </View>
              )}
            </View>
          ) : null}

          <SectionLabel>WHO'S INVITED?</SectionLabel>
          <View style={styles.cardRow}>
            {(['open', 'approval'] as JoinMode[]).map((mode) => (
              <TouchableOpacity key={mode} style={[styles.joinCard, theme.chip, joinMode === mode && theme.activeSoft]} onPress={() => setJoinMode(mode)}>
                <Ionicons name={mode === 'open' ? 'earth' : 'lock-closed'} size={20} color={joinMode === mode ? colors.primary.default : colors.text.tertiary} />
                <AppText style={[styles.joinTitle, theme.title]}>{mode === 'open' ? 'Open' : 'Approval'}</AppText>
                <AppText style={[styles.joinCopy, theme.tertiaryText]}>{mode === 'open' ? 'Anyone can join' : 'You approve each one'}</AppText>
              </TouchableOpacity>
            ))}
          </View>
          {joinMode === 'approval' ? <AppText style={[styles.hint, theme.tertiaryText]}>You'll get a notification for each request</AppText> : null}
          <View style={styles.stepperRow}>
            <AppText style={[styles.stepperLabel, theme.title]}>Max people</AppText>
            <View style={[styles.stepper, theme.iconField]}>
              <TouchableOpacity disabled={maxPeople <= 2} style={[styles.stepBtn, maxPeople <= 2 && styles.disabled]} onPress={() => setMaxPeopleText(String(maxPeople - 1))}><AppText style={[styles.stepText, { color: colors.primary.default }]}>-</AppText></TouchableOpacity>
              <TextInput style={[styles.stepInput, { color: colors.text.primary }]} keyboardType="number-pad" value={maxPeopleText} onChangeText={(text) => setMaxPeopleText(text.replace(/\D/g, ''))} onBlur={() => setMaxPeopleText(String(maxPeople))} />
              <TouchableOpacity disabled={maxPeople >= 100} style={[styles.stepBtn, maxPeople >= 100 && styles.disabled]} onPress={() => setMaxPeopleText(String(maxPeople + 1))}><AppText style={[styles.stepText, { color: colors.primary.default }]}>+</AppText></TouchableOpacity>
            </View>
          </View>
          <AppText style={[styles.smallHint, theme.mutedText]}>2-100 people</AppText>

          <SectionLabel>WHAT KIND?</SectionLabel>
          {loadingCategories ? (
            <View style={styles.skeletonRow}>{[72, 84, 64, 96].map((w) => <View key={w} style={[styles.skeleton, { width: w, backgroundColor: colors.background.secondary }]} />)}</View>
          ) : otherMode ? (
            <View>
              <TextInput style={[styles.input, theme.input]} value={customCategory} onChangeText={setCustomCategory} placeholder="Your category" placeholderTextColor={placeholderColor} />
              <View style={styles.otherActions}>
                <TouchableOpacity style={[styles.smallCancelBtn, theme.subtlePanel]} onPress={() => { setOtherMode(false); setCustomCategory(''); }}><AppText style={[styles.cancelText, theme.tertiaryText]}>Cancel</AppText></TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map((cat) => (
                <TouchableOpacity key={cat.id} style={[styles.categoryPill, theme.chip, categoryId === cat.id && theme.activeSoft]} onPress={() => { setCategoryId(cat.id); setCustomCategory(''); }}>
                  <AppText style={[styles.categoryText, theme.secondaryText, categoryId === cat.id && { color: colors.primary.default }]}>{cat.icon ? `${cat.icon} ` : ''}{cat.name}</AppText>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.categoryPill, theme.chip]} onPress={() => setOtherMode(true)}><AppText style={[styles.categoryText, theme.secondaryText]}>+ Other</AppText></TouchableOpacity>
            </ScrollView>
          )}

          <SectionLabel optional>TELL PEOPLE MORE</SectionLabel>
          <TextInput style={[styles.input, theme.input, styles.desc]} value={description} onChangeText={(text) => setDescription(text.slice(0, 300))} placeholder="What should people know? Vibe, what to bring, any instructions..." placeholderTextColor={placeholderColor} multiline maxLength={300} />
          <AppText style={[styles.counter, theme.mutedText, description.length >= 280 && { color: ERROR }]}>{description.length}/300</AppText>

          <SectionLabel optional>ADD PHOTOS</SectionLabel>
          <View style={styles.photoSectionHeader}>
            <AppText style={[styles.photoSectionTitle, theme.title]}>Photos</AppText>
            <AppText style={[styles.photoSectionCount, theme.tertiaryText]}>{photos.length}/5</AppText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRail}>
            {photos.map((photo, index) => (
              <TouchableOpacity
                key={`${photo.uri}-${index}`}
                style={[styles.photoWrap, theme.subtlePanel, coverPhotoIndex === index && styles.photoWrapActive]}
                onPress={() => setCoverPhotoIndex(index)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                {coverPhotoIndex === index ? (
                  <View style={styles.photoCoverBadge}>
                    <AppText style={styles.photoCoverBadgeText}>Cover</AppText>
                  </View>
                ) : null}
                <TouchableOpacity style={styles.removePhoto} onPress={() => removePhotoAt(index)} hitSlop={6}>
                  <Ionicons name="close" size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            {photos.length < 5 ? (
              <TouchableOpacity style={[styles.addPhoto, theme.subtlePanel]} onPress={pickPhoto}>
                <Ionicons name="add" size={24} color={colors.text.tertiary} />
                <AppText style={[styles.addText, theme.tertiaryText]}>Add</AppText>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <View style={styles.endActions}>
            <TouchableOpacity style={[styles.reviewBtn, theme.lightButton]} onPress={openPreview}>
              <Ionicons name="eye-outline" size={18} color={colors.primary.default} />
              <AppText style={[styles.reviewText, { color: colors.primary.default }]}>Preview</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.catchupBtn, { backgroundColor: colors.primary.default }]} onPress={() => void submit()} disabled={submitting}>
              {submitting ? (
                <AppText style={styles.catchupText}>{isEditing ? 'Saving...' : 'Posting...'}</AppText>
              ) : (
                <>
                  <AppText style={styles.catchupText}>{isEditing ? 'Save' : 'Post it'}</AppText>
                  <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </>
  );

  return (
    <>

      {!hideLauncher ? (
        <Animated.View style={[styles.fab, { bottom: bottomOffset + insets.bottom, backgroundColor: fabBg }]}>
          <Pressable style={styles.fabPress} onPress={handleToggle}>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Ionicons name="add" size={30} color="#FFFFFF" />
            </Animated.View>
          </Pressable>
        </Animated.View>
      ) : null}

      <BottomSheet visible={open} onClose={closeSheet}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {form}
        </KeyboardAvoidingView>
      </BottomSheet>

      <Modal visible={confirmCity} transparent animationType="fade" onRequestClose={() => setConfirmCity(false)}>
        <View style={[styles.modalOverlay, theme.overlay]}>
          <View style={[styles.confirmCard, theme.panel]}>
            <AppText style={[styles.confirmTitle, theme.title]}>Different city?</AppText>
            <AppText style={[styles.confirmBody, theme.secondaryText]}>This catchup is in {currentLocation()?.city || 'another city'} but you're based in {user?.city || 'your city'}. Continue?</AppText>
            <TouchableOpacity style={[styles.confirmPrimary, { backgroundColor: colors.primary.default }]} onPress={() => void submit(true)}>
              <AppText style={styles.confirmPrimaryText}>{isEditing ? 'Yes, save it' : 'Yes, post it'}</AppText>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmCity(false)}><AppText style={[styles.confirmSecondary, theme.tertiaryText]}>Go back</AppText></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 80,
  },
  fabPress: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F4FAFD', borderWidth: 1, borderColor: '#DCEBF2', alignItems: 'center', justifyContent: 'center', shadowColor: '#0B5F78', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  title: { fontSize: 22, fontWeight: '700', color: DARK },
  subtitle: { fontSize: 14, color: MUTED, marginTop: 2 },
  content: { paddingHorizontal: 24, paddingBottom: 108 },
  labelRow: { marginTop: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: LABEL, letterSpacing: 1 },
  optionalBadge: { fontSize: 10, color: '#BBB', backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  input: { minHeight: 48, borderWidth: 2, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 14, color: DARK, fontSize: 16, backgroundColor: '#FFFFFF' },
  inputFocused: { borderColor: ACCENT },
  inputError: { borderColor: ERROR },
  textArea: { minHeight: 72, maxHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  desc: { minHeight: 88, maxHeight: 200, paddingTop: 12, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', color: '#BBB', fontSize: 11, marginTop: 5 },
  modeRow: { flexDirection: 'row', gap: 4, marginBottom: 12, padding: 4, borderRadius: 24, borderWidth: 1, borderColor: '#D9E6EC', backgroundColor: '#F5FAFC' },
  modePill: { flex: 1, minHeight: 38, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  modePillActive: { backgroundColor: '#FFFFFF', shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 2 },
  modeText: { fontSize: 12, color: '#5F7180', fontWeight: '700', textAlign: 'center' },
  modeTextActive: { color: ACCENT },
  locationBox: { position: 'relative' },
  inputIconRow: { minHeight: 48, borderWidth: 2, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff' },
  iconInput: { flex: 1, color: DARK, fontSize: 15, padding: 0 },
  selectedLocationIcon: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: SUCCESS, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  dropdown: { marginTop: 6, maxHeight: 220, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAF2F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5, overflow: 'hidden' },
  dropdownRow: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  dropdownName: { fontSize: 14, color: DARK, fontWeight: '500' },
  dropdownAddress: { fontSize: 12, color: MUTED, marginTop: 2 },
  dropdownState: { minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  dropdownStateText: { color: MUTED, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  errorText: { color: ERROR, fontSize: 12, marginTop: 6 },
  successCard: { marginTop: 8, borderLeftWidth: 3, borderLeftColor: SUCCESS, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10 },
  successText: { color: '#15803D', fontSize: 13, fontWeight: '600' },
  dateRail: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dateChip: { flex: 1, minHeight: 58, borderWidth: 1.5, borderColor: '#D9E6EC', borderRadius: 16, padding: 10, backgroundColor: '#F7FBFD', justifyContent: 'center' },
  calendarChip: { flex: 0, width: 58, alignItems: 'center', justifyContent: 'center' },
  dateChipActive: { backgroundColor: '#DDF6FC', borderColor: ACCENT },
  dateChipText: { color: '#445866', fontSize: 13, fontWeight: '800' },
  dateChipDay: { color: '#7A8D98', fontSize: 12, marginTop: 2, fontWeight: '600' },
  dateChipTextActive: { color: ACCENT },
  calendarCard: { marginTop: 4, marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E2EEF3', backgroundColor: '#FFFFFF', padding: 12 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calendarTitle: { color: DARK, fontSize: 14, fontWeight: '800' },
  calendarNav: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5FAFC' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekText: { flex: 1, textAlign: 'center', color: '#94A3B8', fontSize: 11, fontWeight: '800' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  dayCellActive: { backgroundColor: ACCENT },
  dayText: { color: DARK, fontSize: 13, fontWeight: '700' },
  dayTextDisabled: { color: '#C7D1D8' },
  dayTextActive: { color: '#FFFFFF' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: ACCENT, marginTop: 2 },
  timePill: { height: 48, borderWidth: 2, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF' },
  timePillLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timePillText: { color: DARK, fontSize: 15, fontWeight: '600' },
  timePickerCard: { marginTop: 8, borderRadius: 18, borderWidth: 1, borderColor: '#DDEAF0', backgroundColor: '#FFFFFF', padding: 12 },
  timePickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  timePickerTitle: { color: DARK, fontSize: 13, fontWeight: '800' },
  timePickerMeta: { color: MUTED, fontSize: 11, fontWeight: '700' },
  timeSlotScroll: { maxHeight: 216 },
  timeSlotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 2 },
  timeSlot: { width: '31.5%', minHeight: 40, borderRadius: 13, borderWidth: 1, borderColor: '#E6EEF2', backgroundColor: '#F7FBFD', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  timeSlotActive: { borderColor: DARK, backgroundColor: DARK },
  timeSlotText: { color: '#53636D', fontSize: 13, fontWeight: '700' },
  timeSlotTextActive: { color: '#FFFFFF' },
  timeEmptyState: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  timeEmptyText: { color: MUTED, fontSize: 12, fontStyle: 'italic' },
  hint: { fontSize: 12, color: MUTED, fontStyle: 'italic', marginTop: 8 },
  cardRow: { flexDirection: 'row', gap: 12 },
  joinCard: { flex: 1, minHeight: 88, borderRadius: 14, padding: 14, borderWidth: 2, borderColor: BORDER },
  joinCardActive: { borderColor: ACCENT, backgroundColor: '#F0FAFB' },
  joinTitle: { color: DARK, fontSize: 14, fontWeight: '700', marginTop: 6 },
  joinCopy: { color: MUTED, fontSize: 11, marginTop: 2 },
  stepperRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperLabel: { color: DARK, fontSize: 14, fontWeight: '600' },
  stepper: { height: 48, borderWidth: 2, borderColor: BORDER, borderRadius: 14, flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: ACCENT, fontSize: 22, fontWeight: '700' },
  stepInput: { width: 60, textAlign: 'center', fontSize: 20, fontWeight: '700', color: DARK, padding: 0 },
  disabled: { opacity: 0.3 },
  smallHint: { fontSize: 11, color: '#BBB', alignSelf: 'flex-end', marginTop: 4 },
  skeletonRow: { flexDirection: 'row', gap: 10 },
  skeleton: { height: 34, borderRadius: 17, backgroundColor: '#EEF2F4' },
  categoryPill: { borderRadius: 24, paddingVertical: 9, paddingHorizontal: 18, borderWidth: 1.5, borderColor: '#D9E6EC', backgroundColor: '#F7FBFD', marginRight: 8 },
  categoryPillActive: { borderColor: ACCENT, backgroundColor: '#DDF6FC' },
  categoryText: { color: '#5F7180', fontSize: 13, fontWeight: '700' },
  categoryTextActive: { color: ACCENT },
  otherActions: { flexDirection: 'row', gap: 18, marginTop: 8, justifyContent: 'flex-end' },
  linkText: { color: ACCENT, fontWeight: '700' },
  smallCancelBtn: { alignSelf: 'flex-end', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F5F7F8' },
  cancelText: { color: MUTED, fontWeight: '700', fontSize: 12 },
  photoSectionHeader: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoSectionTitle: { color: DARK, fontSize: 13, fontWeight: '800' },
  photoSectionCount: { color: MUTED, fontSize: 12, fontWeight: '700' },
  photoRail: { gap: 12, alignItems: 'center', paddingRight: 2 },
  photoWrap: { width: 132, height: 150, borderRadius: 18, overflow: 'hidden', backgroundColor: '#EAF8FC', borderWidth: 1, borderColor: '#E3EEF3' },
  photoWrapActive: { borderWidth: 2, borderColor: ACCENT },
  photo: { width: '100%', height: '100%' },
  photoCoverBadge: { position: 'absolute', left: 10, bottom: 10, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(0,0,0,0.62)' },
  photoCoverBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  removePhoto: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5, zIndex: 5 },
  addPhoto: { width: 132, height: 150, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#D0D0D0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA' },
  addText: { color: MUTED, fontSize: 12, marginTop: 2 },
  endActions: { marginTop: 26, marginBottom: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reviewBtn: { flex: 1, height: 52, borderRadius: 26, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reviewText: { color: ACCENT, fontSize: 15, fontWeight: '800' },
  catchupBtn: { flex: 1, height: 52, borderRadius: 26, backgroundColor: ACCENT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 14, elevation: 8 },
  catchupText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  preview: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
  previewScroll: { paddingBottom: 18 },
  previewHero: { height: 190, borderRadius: 20, overflow: 'hidden', backgroundColor: '#EAF8FC', marginBottom: 12 },
  previewImage: { width: '100%', height: '100%' },
  previewEmptyImage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF8FC' },
  previewHeroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.08)' },
  previewHeroPill: { position: 'absolute', left: 14, bottom: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 12, paddingVertical: 6 },
  previewHeroPillText: { color: ACCENT, fontSize: 12, fontWeight: '800' },
  previewPhotoRail: { gap: 8, paddingVertical: 4, marginBottom: 10 },
  previewPhotoWrap: { alignItems: 'center', minWidth: 54 },
  previewThumb: { width: 50, height: 50, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  previewThumbActive: { borderColor: ACCENT },
  previewCoverText: { color: ACCENT, fontSize: 10, fontWeight: '800', marginTop: 3 },
  previewCard: { borderRadius: 18, borderWidth: 1, borderColor: '#E3EEF3', backgroundColor: '#FFFFFF', padding: 16 },
  previewTitle: { fontSize: 22, color: DARK, fontWeight: '900' },
  previewMetaRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12 },
  previewMeta: { flex: 1, fontSize: 14, color: '#53636D', lineHeight: 19, fontWeight: '600' },
  previewDesc: { color: LABEL, fontSize: 13, marginTop: 14, lineHeight: 19 },
  previewFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  spots: { color: ACCENT, fontSize: 13, fontWeight: '900' },
  previewMode: { color: '#6B7F8B', fontSize: 12, fontWeight: '800', backgroundColor: '#F3F8FA', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  previewActions: { flexDirection: 'row', gap: 12 },
  ghostBtn: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  ghostText: { color: ACCENT, fontWeight: '800' },
  blackBtn: { flex: 1, height: 48, borderRadius: 24, backgroundColor: ACCENT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  blackBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 320, borderRadius: 20, backgroundColor: '#fff', padding: 24 },
  confirmTitle: { fontSize: 18, color: DARK, fontWeight: '800' },
  confirmBody: { fontSize: 14, color: '#666', lineHeight: 20, marginTop: 10 },
  confirmPrimary: { height: 48, borderRadius: 24, backgroundColor: ACCENT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  confirmPrimaryText: { color: '#fff', fontWeight: '800' },
  confirmSecondary: { color: MUTED, textAlign: 'center', fontWeight: '700', marginTop: 14 },
});

export default CreateFAB;
