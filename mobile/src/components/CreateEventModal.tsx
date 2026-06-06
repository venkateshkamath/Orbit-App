import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { useOrbitTheme } from '../theme';
import { Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/Colors';
import { AppText } from '../ui/AppText';
import { eventsApi } from '../api/events';
import type { EventCategory, LocationSearchResult } from '../types';

/* ── category config ─────────────────────────────────────────────── */

export type CategoryMeta = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  gradient: [string, string];
};

export const EVENT_CATEGORY_META: Record<EventCategory, CategoryMeta> = {
  music:     { label: 'Music',     icon: 'musical-notes', gradient: ['#9BAF63', '#6F8B49'] },
  sports:    { label: 'Sports',    icon: 'fitness',       gradient: ['#7F9A56', '#526E38'] },
  food:      { label: 'Food',      icon: 'restaurant',    gradient: ['#D8B86B', '#B88D3E'] },
  arts:      { label: 'Arts',      icon: 'color-palette', gradient: ['#B9A86F', '#8F7D4F'] },
  tech:      { label: 'Tech',      icon: 'code-slash',    gradient: ['#8FB8B2', '#6E9991'] },
  social:    { label: 'Social',    icon: 'people',        gradient: ['#D98C7F', '#B96B5C'] },
  outdoors:  { label: 'Outdoors',  icon: 'leaf',          gradient: ['#8FAA63', '#5E8050'] },
  wellness:  { label: 'Wellness',  icon: 'heart',         gradient: ['#B9C981', '#7F9A56'] },
  education: { label: 'Education', icon: 'book',          gradient: ['#A0B7A8', '#78967E'] },
  gaming:    { label: 'Gaming',    icon: 'game-controller', gradient: ['#9A916E', '#6F7B52'] },
};

const CATEGORIES = Object.keys(EVENT_CATEGORY_META) as EventCategory[];

/* ── sub-components ──────────────────────────────────────────────── */

function CategoryChip({
  cat,
  selected,
  onPress,
}: {
  cat: EventCategory;
  selected: boolean;
  onPress: () => void;
}) {
  const meta = EVENT_CATEGORY_META[cat];
  const { colors } = useOrbitTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ marginRight: 8, marginBottom: 8 }}
    >
      <View
        style={[
          chipStyles.wrap,
          selected && { borderColor: colors.primary.default + '55', backgroundColor: colors.primary.default + '20' },
        ]}
      >
        <Ionicons
          name={meta.icon}
          size={14}
          color={selected ? colors.primary.dark : colors.text.tertiary}
          style={{ marginRight: 5 }}
        />
        <AppText style={[chipStyles.label, { color: colors.text.tertiary }, selected && { color: colors.text.primary }]}>
          {meta.label}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(35,48,31,0.12)',
    overflow: 'hidden',
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#7F8468',
  },
});

/* ── main modal ──────────────────────────────────────────────────── */

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialLat?: number;
  initialLng?: number;
}

export function CreateEventModal({ visible, onClose, onCreated, initialLat, initialLng }: Props) {
  const { colors, fonts, shadows, resolvedScheme } = useOrbitTheme();
  const insets = useSafeAreaInsets();

  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory]       = useState<EventCategory>('social');
  const [startDate, setStartDate]     = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [locationQuery, setLocationQuery]   = useState('');
  const [locationResults, setLocationResults] = useState<LocationSearchResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [imageUri, setImageUri]   = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentLocationOption = useMemo<LocationSearchResult | null>(() => {
    if (initialLat == null || initialLng == null) return null;
    return {
      display_name: 'My current location',
      lat: initialLat,
      lng: initialLng,
    };
  }, [initialLat, initialLng]);

  useEffect(() => {
    if (!visible || !currentLocationOption) return;
    setSelectedLocation((prev) => prev ?? currentLocationOption);
    setLocationQuery((prev) => prev || currentLocationOption.display_name);
  }, [currentLocationOption, visible]);

  const reset = useCallback(() => {
    setTitle('');
    setDescription('');
    setCategory('social');
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    setStartDate(d);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setLocationQuery(currentLocationOption?.display_name ?? '');
    setLocationResults([]);
    setSelectedLocation(currentLocationOption);
    setImageUri(null);
    setSubmitting(false);
  }, [currentLocationOption]);

  const handleClose = () => {
    reset();
    onClose();
  };

  /* location search */
  const handleLocationChange = (text: string) => {
    setLocationQuery(text);
    setSelectedLocation(null);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (text.trim().length < 2) {
      setLocationResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearchingLocation(true);
      try {
        const results = await eventsApi.searchLocation(text.trim());
        setLocationResults(currentLocationOption ? [currentLocationOption, ...results] : results);
      } catch {
        setLocationResults([]);
      } finally {
        setSearchingLocation(false);
      }
    }, 400);
  };

  const handleSelectLocation = (result: LocationSearchResult) => {
    setSelectedLocation(result);
    setLocationQuery(result.display_name);
    setLocationResults([]);
  };

  /* date/time pickers */
  const handleDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) {
      const merged = new Date(startDate);
      merged.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setStartDate(merged);
    }
  };

  const handleTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) {
      const merged = new Date(startDate);
      merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setStartDate(merged);
    }
  };

  /* image picker */
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  /* submit */
  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing field', 'Please enter an event name.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing field', 'Please add event details.');
      return;
    }

    const lat = selectedLocation?.lat ?? initialLat;
    const lng = selectedLocation?.lng ?? initialLng;
    if (lat == null || lng == null) {
      Alert.alert('Missing location', 'Please search for and select a location.');
      return;
    }
    const locationName = selectedLocation?.display_name ?? currentLocationOption?.display_name ?? '';
    if (!locationName.trim()) {
      Alert.alert('Missing location', 'Please choose a location.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title',         title.trim());
      formData.append('description',   description.trim());
      formData.append('category',      category);
      formData.append('start_at',      startDate.toISOString());
      formData.append('latitude',      String(lat));
      formData.append('longitude',     String(lng));
      formData.append('location_name', locationName);

      if (imageUri) {
        const ext = imageUri.split('.').pop() ?? 'jpg';
        formData.append('image', {
          uri:  imageUri,
          name: `event_${Date.now()}.${ext}`,
          type: `image/${ext}`,
        } as unknown as Blob);
      }

      await eventsApi.create(formData);
      reset();
      onCreated();
    } catch (err) {
      console.error('[CreateEventModal] submit error', err);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = title.trim().length > 0 &&
    description.trim().length > 0 &&
    (selectedLocation != null || (initialLat != null && initialLng != null));

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: colors.overlay },
        sheet: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.background.primary,
          borderTopLeftRadius: BorderRadius.xxl,
          borderTopRightRadius: BorderRadius.xxl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          maxHeight: '92%',
          ...shadows.lg,
        },
        handle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.borderLight,
          alignSelf: 'center',
          marginTop: 10,
          marginBottom: 4,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        headerTitle: {
          fontSize: FontSizes.lg,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
          fontFamily: fonts.bold,
          letterSpacing: 0,
        },
        closeBtn: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.background.elevated,
          alignItems: 'center',
          justifyContent: 'center',
        },
        scroll: { paddingHorizontal: Spacing.lg },
        label: {
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.semibold,
          color: colors.text.secondary,
          fontFamily: fonts.semibold,
          marginBottom: 6,
          marginTop: Spacing.lg,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        },
        input: {
          backgroundColor: colors.background.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          borderRadius: BorderRadius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: 12,
          color: colors.text.primary,
          fontSize: FontSizes.md,
          fontFamily: fonts.regular,
        },
        textArea: {
          height: 80,
          textAlignVertical: 'top',
          paddingTop: 12,
        },
        categoriesWrap: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: 4,
        },
        dateRow: {
          flexDirection: 'row',
          gap: Spacing.sm,
        },
        pickerCard: {
          backgroundColor: colors.background.card,
          borderRadius: BorderRadius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          overflow: 'hidden',
          marginTop: Spacing.sm,
        },
        pickerSpinner: {
          height: 180,
        },
        pickerDoneBtn: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingVertical: 12,
          alignItems: 'center',
        },
        pickerDoneText: {
          color: colors.primary.default,
          fontSize: FontSizes.md,
          fontFamily: fonts.semibold,
          fontWeight: '600',
        },
        datePill: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.background.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          borderRadius: BorderRadius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: 12,
        },
        datePillText: {
          fontSize: FontSizes.md,
          color: colors.text.primary,
          fontFamily: fonts.medium,
        },
        locationWrap: { position: 'relative' },
        locationInputWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          borderRadius: BorderRadius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: 13,
          gap: 8,
        },
        locationInput: {
          flex: 1,
          color: colors.text.primary,
          fontSize: FontSizes.md,
          fontFamily: fonts.regular,
          padding: 0,
        },
        dropdownWrap: {
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 999,
          backgroundColor: colors.background.elevated,
          borderRadius: BorderRadius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          marginTop: 4,
          ...shadows.md,
        },
        dropdownItem: {
          paddingHorizontal: Spacing.md,
          paddingVertical: 11,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        dropdownText: {
          fontSize: FontSizes.sm,
          color: colors.text.primary,
          fontFamily: fonts.regular,
          lineHeight: 18,
        },
        selectedLocationRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: 6,
        },
        selectedLocationText: {
          fontSize: 12,
          color: colors.primary.default,
          fontFamily: fonts.medium,
          flex: 1,
        },
        imagePickerBtn: {
          height: 140,
          borderRadius: BorderRadius.lg,
          overflow: 'hidden',
          backgroundColor: colors.background.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 4,
        },
        imagePreview: {
          width: '100%',
          height: '100%',
        },
        imageOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.4)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        imagePlaceholderText: {
          fontSize: FontSizes.sm,
          color: colors.text.muted,
          fontFamily: fonts.medium,
          marginTop: 8,
        },
        submitBtn: {
          marginHorizontal: Spacing.lg,
          borderRadius: BorderRadius.lg,
          overflow: 'hidden',
          marginTop: Spacing.xl,
          marginBottom: Spacing.md,
        },
        submitInner: {
          paddingVertical: 16,
          alignItems: 'center',
          justifyContent: 'center',
        },
        submitText: {
          color: colors.text.primary,
          fontSize: FontSizes.md,
          fontWeight: FontWeights.bold,
          fontFamily: fonts.bold,
          letterSpacing: 0.2,
        },
        submitDisabled: { opacity: 0.4 },
      }),
    [colors, fonts, shadows]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={s.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={s.sheet}>
            <View style={s.handle} />

            {/* Header */}
            <View style={s.header}>
              <AppText style={s.headerTitle}>New Event</AppText>
              <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
                <Ionicons name="close" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={s.scroll}
              contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Title */}
              <AppText style={s.label}>Event Name</AppText>
              <TextInput
                style={s.input}
                value={title}
                onChangeText={setTitle}
                placeholder="What's happening?"
                placeholderTextColor={colors.text.muted}
                maxLength={120}
              />

              {/* Category */}
              <AppText style={s.label}>Category</AppText>
              <View style={s.categoriesWrap}>
                {CATEGORIES.map((cat) => (
                  <CategoryChip
                    key={cat}
                    cat={cat}
                    selected={category === cat}
                    onPress={() => setCategory(cat)}
                  />
                ))}
              </View>

              {/* Date & Time */}
              <AppText style={s.label}>Date & Time</AppText>
              <View style={s.dateRow}>
                <TouchableOpacity
                  style={s.datePill}
                  onPress={() => {
                    setShowTimePicker(false);
                    setShowDatePicker(true);
                  }}
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.primary.default} />
                  <AppText style={s.datePillText}>{format(startDate, 'MMM d, yyyy')}</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.datePill}
                  onPress={() => {
                    setShowDatePicker(false);
                    setShowTimePicker(true);
                  }}
                >
                  <Ionicons name="time-outline" size={16} color={colors.primary.default} />
                  <AppText style={s.datePillText}>{format(startDate, 'h:mm a')}</AppText>
                </TouchableOpacity>
              </View>

              {(showDatePicker || showTimePicker) && (
                <View style={s.pickerCard}>
                  <DateTimePicker
                    value={startDate}
                    mode={showDatePicker ? 'date' : 'time'}
                    minimumDate={showDatePicker ? new Date() : undefined}
                    display="spinner"
                    onChange={showDatePicker ? handleDateChange : handleTimeChange}
                    themeVariant={resolvedScheme}
                    textColor={colors.text.primary}
                    accentColor={colors.primary.default}
                    style={s.pickerSpinner}
                  />
                  <TouchableOpacity
                    onPress={() => { setShowDatePicker(false); setShowTimePicker(false); }}
                    style={s.pickerDoneBtn}
                  >
                    <AppText style={s.pickerDoneText}>Done</AppText>
                  </TouchableOpacity>
                </View>
              )}

              {/* Location */}
              <AppText style={s.label}>Location</AppText>
              <View style={s.locationWrap}>
                <View style={s.locationInputWrap}>
                  <Ionicons name="location-outline" size={18} color={colors.primary.default} />
                  <TextInput
                    style={s.locationInput}
                    value={locationQuery}
                    onChangeText={handleLocationChange}
                    placeholder="Search for a place…"
                    placeholderTextColor={colors.text.muted}
                    autoCorrect={false}
                  />
                  {searchingLocation && (
                    <ActivityIndicator size="small" color={colors.primary.default} />
                  )}
                  {selectedLocation && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary.default} />
                  )}
                </View>

                {locationResults.length > 0 && (
                  <View style={s.dropdownWrap}>
                    <FlatList
                      data={locationResults}
                      keyExtractor={(item, i) => `${item.lat}_${item.lng}_${i}`}
                      keyboardShouldPersistTaps="handled"
                      scrollEnabled={false}
                      renderItem={({ item, index }) => (
                        <TouchableOpacity
                          style={[
                            s.dropdownItem,
                            index === locationResults.length - 1 && { borderBottomWidth: 0 },
                          ]}
                          onPress={() => handleSelectLocation(item)}
                        >
                          <AppText style={s.dropdownText} numberOfLines={2}>
                            {item.display_name}
                          </AppText>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}
              </View>

              {selectedLocation && (
                <View style={s.selectedLocationRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary.default} />
                  <AppText style={s.selectedLocationText} numberOfLines={1}>
                    {selectedLocation.display_name}
                  </AppText>
                </View>
              )}

              {/* Image (optional) */}
              <AppText style={s.label}>Cover Image <AppText style={{ color: colors.text.muted, textTransform: 'none' }}>(optional)</AppText></AppText>
              <TouchableOpacity style={s.imagePickerBtn} onPress={handlePickImage} activeOpacity={0.85}>
                {imageUri ? (
                  <>
                    <Image source={{ uri: imageUri }} style={s.imagePreview} resizeMode="cover" />
                    <View style={s.imageOverlay}>
                      <Ionicons name="camera" size={28} color="#FFFFFF" />
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons name="image-outline" size={32} color={colors.text.muted} />
                    <AppText style={s.imagePlaceholderText}>Tap to add a cover photo</AppText>
                  </>
                )}
              </TouchableOpacity>

              {/* Description (optional) */}
              <AppText style={s.label}>Description</AppText>
              <TextInput
                style={[s.input, s.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Tell people what to expect…"
                placeholderTextColor={colors.text.muted}
                multiline
                maxLength={1000}
              />
            </ScrollView>

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, (!canSubmit || submitting) && s.submitDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[colors.primary.start, colors.primary.end]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={s.submitInner}>
                {submitting ? (
                  <ActivityIndicator color={colors.background.card} />
                ) : (
                  <AppText style={s.submitText}>Create Event</AppText>
                )}
              </View>
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
