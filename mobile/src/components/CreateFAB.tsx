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
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { addDays, addMonths, endOfMonth, format, getDay, isBefore, isSameDay, startOfDay, startOfMonth, subMonths } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import BottomSheet from './BottomSheet';
import { OrbitLoader } from './OrbitLoader';
import { eventsApi, type CatchupLocation, type EventCategoryOption } from '../api/events';
import { useAuthStore } from '../stores/authStore';
import { orbitKeys } from '../hooks/orbitKeys';
import { AppText } from '../ui/AppText';
import { formatApiError } from '../utils/apiErrors';

const ACCENT = '#00B4D8';
const DARK = '#0D0D0D';
const BORDER = '#E8E8E8';
const ERROR = '#EF4444';
const SUCCESS = '#22C55E';
const MUTED = '#999';
const LABEL = '#888';

type LocationMode = 'search' | 'manual';
type JoinMode = 'open' | 'approval';
type PhotoAsset = { uri: string; name: string; type: string };

type Props = {
  initialLat?: number;
  initialLng?: number;
  bottomOffset?: number;
  onCreated?: () => void;
  controlledOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideLauncher?: boolean;
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
  const today = isSameDay(date, new Date());
  const first = today ? nextValidTodaySlot() : startOfDay(date);
  const slots: Date[] = [];
  const cursor = new Date(date);
  cursor.setHours(today ? first.getHours() : 0, today ? first.getMinutes() : 0, 0, 0);
  while (isSameDay(cursor, date)) {
    slots.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + 15);
  }
  return slots;
}

function SectionLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <View style={styles.labelRow}>
      <AppText style={styles.sectionLabel}>{children}</AppText>
      {optional ? <AppText style={styles.optionalBadge}>Optional</AppText> : null}
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
}: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean | ((value: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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

  const progress = useRef(new Animated.Value(0)).current;
  const toastY = useRef(new Animated.Value(-80)).current;
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    outputRange: [ACCENT, DARK],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const slots = useMemo(() => timeSlotsFor(selectedDate), [selectedDate]);
  const maxPeople = Math.min(Math.max(Number(maxPeopleText.replace(/\D/g, '')) || 10, 2), 100);
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

  const showToast = (next: typeof toast) => {
    setToast(next);
    toastY.setValue(-80);
    Animated.sequence([
      Animated.timing(toastY, { toValue: insets.top + 10, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(toastY, { toValue: -90, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

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
    if (selectedTime && !nextSlots.some((slot) => slot.getHours() === selectedTime.getHours() && slot.getMinutes() === selectedTime.getMinutes())) {
      setSelectedTime(null);
      setTimeHint('That time has passed. Pick a new one.');
      setTimeOpen(true);
    }
  };

  const openTimePicker = () => {
    if (!timeOpen && !selectedTime && slots[0]) setSelectedTime(slots[0]);
    setTimeOpen((value) => !value);
  };

  const handleTimeChange = (event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      setTimeOpen(false);
      return;
    }
    if (!value) return;
    const candidate = new Date(selectedDate);
    candidate.setHours(value.getHours(), value.getMinutes(), 0, 0);
    const valid = slots.some((slot) => slot.getHours() === candidate.getHours() && slot.getMinutes() === candidate.getMinutes());
    if (valid) {
      setSelectedTime(candidate);
      setTimeHint('');
    } else if (slots[0]) {
      setSelectedTime(slots[0]);
      setTimeHint('Pick a future time.');
    }
    if (Platform.OS === 'android') setTimeOpen(false);
  };

  const pickPhoto = async () => {
    if (photos.length >= 5) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
      quality: 0.82,
    });
    if (result.canceled) return;
    const next = result.assets.slice(0, 5 - photos.length).map((asset, index) => {
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      return { uri: asset.uri, name: `catchup_${Date.now()}_${index}.${ext}`, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` };
    });
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

  const submit = async (confirmedCity = false) => {
    const loc = currentLocation();
    if (name.trim().length < 3) {
      showToast({ type: 'error', text: 'Add a catchup name.' });
      return;
    }
    if (!loc) {
      showToast({ type: 'error', text: 'Choose a location.' });
      return;
    }
    if (!selectedTime) {
      showToast({ type: 'error', text: 'Pick a time.' });
      setTimeOpen(true);
      return;
    }
    if (!categoryId && !customCategory.trim()) {
      showToast({ type: 'error', text: 'Pick a category.' });
      return;
    }
    if (!confirmedCity && loc.city && user?.city && loc.city.toLowerCase() !== user.city.toLowerCase()) {
      setConfirmCity(true);
      return;
    }

    setSubmitting(true);
    try {
      const dateTime = new Date(selectedDate);
      dateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      await eventsApi.createCatchup({
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
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orbitKeys.eventsFeed() }),
        queryClient.invalidateQueries({ queryKey: ['orbit', 'events'] }),
      ]);
      onCreated?.();
      closeSheet();
      showToast({ type: 'success', text: 'Your catchup is live!' });
    } catch (error) {
      console.error('[CreateFAB] create catchup failed', error);
      showToast({ type: 'error', text: formatApiError(error) });
    } finally {
      setSubmitting(false);
      setConfirmCity(false);
    }
  };

  const openPreview = () => {
    if (!hasPreviewContent) {
      showToast({ type: 'error', text: 'Add a few details before previewing.' });
      return;
    }
    setPreview(true);
  };

  const form = (
    <>
      <View style={styles.header}>
        <View>
          <AppText style={styles.title}>Create a catchup</AppText>
          <AppText style={styles.subtitle}>Get people together</AppText>
        </View>
        <TouchableOpacity style={styles.headerClose} onPress={closeSheet} hitSlop={12}>
          <Ionicons name="close" size={22} color={DARK} />
        </TouchableOpacity>
      </View>

      {preview ? (
        <View style={styles.preview}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.previewScroll}>
            <View style={styles.previewHero}>
              {photos[coverPhotoIndex] ? (
                <Image source={{ uri: photos[coverPhotoIndex].uri }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewEmptyImage}>
                  <Ionicons name="sparkles-outline" size={24} color={ACCENT} />
                </View>
              )}
              <View style={styles.previewHeroShade} />
              {selectedCategoryName ? (
                <View style={styles.previewHeroPill}>
                  <AppText style={styles.previewHeroPillText}>{selectedCategoryName}</AppText>
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

            <View style={styles.previewCard}>
              <AppText style={styles.previewTitle}>{name.trim() || 'Catchup draft'}</AppText>
              <View style={styles.previewMetaRow}>
                <Ionicons name="calendar-outline" size={16} color={ACCENT} />
                <AppText style={styles.previewMeta}>{format(selectedDate, 'EEE, MMM d')}{selectedTime ? ` at ${format(selectedTime, 'h:mm a')}` : ''}</AppText>
              </View>
              {previewLocation ? (
                <View style={styles.previewMetaRow}>
                  <Ionicons name="location-outline" size={16} color={ACCENT} />
                  <AppText style={styles.previewMeta} numberOfLines={2}>{previewLocation.name || previewLocation.address}</AppText>
                </View>
              ) : null}
              {description.trim() ? <AppText style={styles.previewDesc} numberOfLines={4}>{description.trim()}</AppText> : null}
              <View style={styles.previewFooterRow}>
                <AppText style={styles.spots}>{maxPeople - 1} spots left</AppText>
                <AppText style={styles.previewMode}>{joinMode === 'open' ? 'Open join' : 'Approval'}</AppText>
              </View>
            </View>
          </ScrollView>
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setPreview(false)}><AppText style={styles.ghostText}>Edit</AppText></TouchableOpacity>
            <TouchableOpacity style={styles.blackBtn} onPress={() => void submit()} disabled={submitting}>
              {submitting ? (
                <OrbitLoader variant="inline" size="sm" />
              ) : (
                <>
                  <AppText style={styles.blackBtnText}>Post it</AppText>
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
            style={[styles.input, name.length > 0 && name.trim().length < 3 && styles.inputError, nameFocused && styles.inputFocused]}
            placeholder="Morning run, chai break, jam session..."
            placeholderTextColor="#C0C0C0"
          />
          {nameFocused ? <AppText style={styles.counter}>{name.length}/60</AppText> : null}

          <SectionLabel>WHERE?</SectionLabel>
          <View style={styles.modeRow}>
            {(['search', 'manual'] as LocationMode[]).map((mode) => (
              <TouchableOpacity key={mode} style={[styles.modePill, locationMode === mode && styles.modePillActive]} onPress={() => setLocationMode(mode)}>
                <Ionicons name={mode === 'search' ? 'search' : 'create-outline'} size={14} color={locationMode === mode ? ACCENT : '#6B7F8B'} />
                <AppText style={[styles.modeText, locationMode === mode && styles.modeTextActive]}>{mode === 'search' ? 'Search' : 'Address'}</AppText>
              </TouchableOpacity>
            ))}
          </View>
          {locationMode === 'search' ? (
            <View style={styles.locationBox}>
              <View style={styles.inputIconRow}>
                <Ionicons name="search" size={17} color={MUTED} />
                <TextInput style={styles.iconInput} value={locationQuery} onChangeText={handleLocationChange} placeholder="Search for a place" placeholderTextColor="#C0C0C0" />
                {searchingLocation ? <OrbitLoader variant="inline" size="sm" /> : null}
                {!searchingLocation && location ? (
                  <View style={styles.selectedLocationIcon}>
                    <Ionicons name="checkmark" size={14} color={SUCCESS} />
                  </View>
                ) : null}
              </View>
              {locationQuery.trim().length >= 2 && (searchingLocation || locationResults.length > 0 || !location) ? (
                <View style={styles.dropdown}>
                  {searchingLocation ? (
                    <View style={styles.dropdownState}>
                      <OrbitLoader variant="inline" size="sm" />
                      <AppText style={styles.dropdownStateText}>Searching places...</AppText>
                    </View>
                  ) : locationResults.length ? (
                    locationResults.slice(0, 6).map((item, index) => (
                      <TouchableOpacity key={`${item.lat}-${item.lng}-${index}`} style={styles.dropdownRow} onPress={() => { setLocation(item); setLocationQuery(item.name); setLocationResults([]); }}>
                        <AppText style={styles.dropdownName}>{item.name}</AppText>
                        <AppText style={styles.dropdownAddress} numberOfLines={1}>{item.address}</AppText>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.dropdownState}>
                      <AppText style={styles.dropdownStateText}>No places found. Try a more specific search.</AppText>
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
              style={[styles.input, styles.textArea]}
              placeholder="Type the full address"
              placeholderTextColor="#C0C0C0"
              multiline
            />
          ) : null}

          <SectionLabel>WHEN?</SectionLabel>
          <View style={styles.dateRail}>
            {[0, 1].map((index) => {
              const date = startOfDay(addDays(new Date(), index));
              const selected = startOfSelected(date) === startOfSelected(selectedDate);
              return (
                <TouchableOpacity key={date.toISOString()} style={[styles.dateChip, selected && styles.dateChipActive]} onPress={() => chooseDate(date)}>
                  <AppText style={[styles.dateChipText, selected && styles.dateChipTextActive]}>{index === 0 ? 'Today' : 'Tomorrow'}</AppText>
                  <AppText style={[styles.dateChipDay, selected && styles.dateChipTextActive]}>{format(date, 'MMM d')}</AppText>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.dateChip, styles.calendarChip, calendarOpen && styles.dateChipActive]}
              onPress={() => {
                setCalendarMonth(startOfMonth(selectedDate));
                setCalendarOpen((value) => !value);
              }}
            >
              <Ionicons name="calendar-outline" size={17} color={calendarOpen ? ACCENT : '#5F7180'} />
            </TouchableOpacity>
          </View>
          {calendarOpen ? (
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity
                  style={styles.calendarNav}
                  disabled={startOfSelected(calendarMonth) <= startOfSelected(startOfMonth(new Date()))}
                  onPress={() => setCalendarMonth((month) => subMonths(month, 1))}
                >
                  <Ionicons name="chevron-back" size={18} color={startOfSelected(calendarMonth) <= startOfSelected(startOfMonth(new Date())) ? '#C7D1D8' : DARK} />
                </TouchableOpacity>
                <AppText style={styles.calendarTitle}>{format(calendarMonth, 'MMMM yyyy')}</AppText>
                <TouchableOpacity style={styles.calendarNav} onPress={() => setCalendarMonth((month) => addMonths(month, 1))}>
                  <Ionicons name="chevron-forward" size={18} color={DARK} />
                </TouchableOpacity>
              </View>
              <View style={styles.weekRow}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <AppText key={`${day}-${index}`} style={styles.weekText}>{day}</AppText>)}
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
                      style={[styles.dayCell, selected && styles.dayCellActive]}
                      onPress={() => day && chooseDate(day)}
                    >
                      {day ? <AppText style={[styles.dayText, disabled && styles.dayTextDisabled, selected && styles.dayTextActive]}>{format(day, 'd')}</AppText> : null}
                      {today && !selected ? <View style={styles.todayDot} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
          <TouchableOpacity style={styles.timePill} onPress={openTimePicker}>
            <View style={styles.timePillLeft}>
              <Ionicons name="time-outline" size={18} color={ACCENT} />
              <AppText style={styles.timePillText}>{selectedTime ? format(selectedTime, 'h:mm a') : 'Select time'}</AppText>
            </View>
            <Ionicons name={timeOpen ? 'chevron-up' : 'chevron-down'} size={16} color={MUTED} />
          </TouchableOpacity>
          {timeHint ? <AppText style={styles.hint}>{timeHint}</AppText> : null}
          {timeOpen ? (
            <View style={styles.timePickerCard}>
              {slots.length ? (
                <>
                  <DateTimePicker
                    value={selectedTime ?? slots[0]}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minuteInterval={15}
                    is24Hour={false}
                    onChange={handleTimeChange}
                    themeVariant="light"
                    textColor={DARK}
                    accentColor={ACCENT}
                    style={styles.nativeTimePicker}
                  />
                  {Platform.OS === 'ios' ? (
                    <TouchableOpacity style={styles.timeDoneBtn} onPress={() => setTimeOpen(false)}>
                      <AppText style={styles.timeDoneText}>Done</AppText>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : <AppText style={styles.hint}>Too late for today - try tomorrow?</AppText>}
            </View>
          ) : null}

          <SectionLabel>WHO'S INVITED?</SectionLabel>
          <View style={styles.cardRow}>
            {(['open', 'approval'] as JoinMode[]).map((mode) => (
              <TouchableOpacity key={mode} style={[styles.joinCard, joinMode === mode && styles.joinCardActive]} onPress={() => setJoinMode(mode)}>
                <Ionicons name={mode === 'open' ? 'earth' : 'lock-closed'} size={20} color={joinMode === mode ? ACCENT : MUTED} />
                <AppText style={styles.joinTitle}>{mode === 'open' ? 'Open' : 'Approval'}</AppText>
                <AppText style={styles.joinCopy}>{mode === 'open' ? 'Anyone can join' : 'You approve each one'}</AppText>
              </TouchableOpacity>
            ))}
          </View>
          {joinMode === 'approval' ? <AppText style={styles.hint}>You'll get a notification for each request</AppText> : null}
          <View style={styles.stepperRow}>
            <AppText style={styles.stepperLabel}>Max people</AppText>
            <View style={styles.stepper}>
              <TouchableOpacity disabled={maxPeople <= 2} style={[styles.stepBtn, maxPeople <= 2 && styles.disabled]} onPress={() => setMaxPeopleText(String(maxPeople - 1))}><AppText style={styles.stepText}>-</AppText></TouchableOpacity>
              <TextInput style={styles.stepInput} keyboardType="number-pad" value={maxPeopleText} onChangeText={(text) => setMaxPeopleText(text.replace(/\D/g, ''))} onBlur={() => setMaxPeopleText(String(maxPeople))} />
              <TouchableOpacity disabled={maxPeople >= 100} style={[styles.stepBtn, maxPeople >= 100 && styles.disabled]} onPress={() => setMaxPeopleText(String(maxPeople + 1))}><AppText style={styles.stepText}>+</AppText></TouchableOpacity>
            </View>
          </View>
          <AppText style={styles.smallHint}>2-100 people</AppText>

          <SectionLabel>WHAT KIND?</SectionLabel>
          {loadingCategories ? (
            <View style={styles.skeletonRow}>{[72, 84, 64, 96].map((w) => <View key={w} style={[styles.skeleton, { width: w }]} />)}</View>
          ) : otherMode ? (
            <View>
              <TextInput style={styles.input} value={customCategory} onChangeText={setCustomCategory} placeholder="Your category" placeholderTextColor="#C0C0C0" />
              <View style={styles.otherActions}>
                <TouchableOpacity style={styles.smallCancelBtn} onPress={() => { setOtherMode(false); setCustomCategory(''); }}><AppText style={styles.cancelText}>Cancel</AppText></TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map((cat) => (
                <TouchableOpacity key={cat.id} style={[styles.categoryPill, categoryId === cat.id && styles.categoryPillActive]} onPress={() => { setCategoryId(cat.id); setCustomCategory(''); }}>
                  <AppText style={[styles.categoryText, categoryId === cat.id && styles.categoryTextActive]}>{cat.icon ? `${cat.icon} ` : ''}{cat.name}</AppText>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.categoryPill} onPress={() => setOtherMode(true)}><AppText style={styles.categoryText}>+ Other</AppText></TouchableOpacity>
            </ScrollView>
          )}

          <SectionLabel optional>TELL PEOPLE MORE</SectionLabel>
          <TextInput style={[styles.input, styles.desc]} value={description} onChangeText={(text) => setDescription(text.slice(0, 300))} placeholder="What should people know? Vibe, what to bring, any instructions..." placeholderTextColor="#C0C0C0" multiline maxLength={300} />
          <AppText style={[styles.counter, description.length >= 280 && { color: ERROR }]}>{description.length}/300</AppText>

          <SectionLabel optional>ADD PHOTOS</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRail}>
            {photos.map((photo, index) => (
              <View key={photo.uri} style={styles.photoWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                <TouchableOpacity style={styles.removePhoto} onPress={() => setPhotos((current) => current.filter((_, i) => i !== index))}><Ionicons name="close" size={12} color={DARK} /></TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 ? (
              <TouchableOpacity style={styles.addPhoto} onPress={pickPhoto}>
                <Ionicons name="add" size={22} color={MUTED} />
                <AppText style={styles.addText}>Add</AppText>
              </TouchableOpacity>
            ) : <AppText style={styles.photoCount}>5/5</AppText>}
          </ScrollView>
          {photos.length > 1 ? (
            <View style={styles.coverRow}>
              <AppText style={styles.coverLabel}>Cover photo:</AppText>
              {photos.map((photo, index) => (
                <TouchableOpacity key={photo.uri} onPress={() => setCoverPhotoIndex(index)}>
                  <Image source={{ uri: photo.uri }} style={[styles.coverThumb, coverPhotoIndex === index && styles.coverThumbActive]} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={styles.endActions}>
            <TouchableOpacity style={styles.reviewBtn} onPress={openPreview}>
              <Ionicons name="eye-outline" size={18} color={ACCENT} />
              <AppText style={styles.reviewText}>Preview</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.catchupBtn} onPress={() => void submit()} disabled={submitting}>
              {submitting ? (
                <OrbitLoader variant="inline" size="sm" />
              ) : (
                <>
                  <AppText style={styles.catchupText}>Post it</AppText>
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
      {toast ? (
        <Animated.View style={[styles.toast, { borderLeftColor: toast.type === 'success' ? ACCENT : ERROR, transform: [{ translateY: toastY }] }]}>
          <AppText style={styles.toastText}>{toast.text}</AppText>
        </Animated.View>
      ) : null}

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
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <AppText style={styles.confirmTitle}>Different city?</AppText>
            <AppText style={styles.confirmBody}>This catchup is in {currentLocation()?.city || 'another city'} but you're based in {user?.city || 'your city'}. Continue?</AppText>
            <TouchableOpacity style={styles.confirmPrimary} onPress={() => void submit(true)}>
              <AppText style={styles.confirmPrimaryText}>Yes, post it</AppText>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmCity(false)}><AppText style={styles.confirmSecondary}>Go back</AppText></TouchableOpacity>
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
  timePickerCard: { marginTop: 8, borderRadius: 18, borderWidth: 1, borderColor: '#DDEAF0', backgroundColor: '#FFFFFF', overflow: 'hidden', alignItems: 'center', paddingBottom: 10 },
  nativeTimePicker: { width: '100%', height: Platform.OS === 'ios' ? 164 : 56 },
  timeDoneBtn: { minWidth: 96, height: 38, borderRadius: 19, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  timeDoneText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  timeList: { maxHeight: 200, marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: BORDER },
  timeRow: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  timeRowText: { fontSize: 15, color: DARK },
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
  photoRail: { gap: 10, alignItems: 'center' },
  photoWrap: { width: 80, height: 80 },
  photo: { width: 80, height: 80, borderRadius: 12 },
  removePhoto: { position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 5 },
  addPhoto: { width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#D0D0D0', alignItems: 'center', justifyContent: 'center' },
  addText: { color: MUTED, fontSize: 12, marginTop: 2 },
  photoCount: { color: MUTED, fontSize: 12, fontWeight: '700' },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  coverLabel: { color: DARK, fontSize: 13, fontWeight: '600', marginRight: 4 },
  coverThumb: { width: 40, height: 40, borderRadius: 8 },
  coverThumbActive: { borderWidth: 2, borderColor: ACCENT },
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
  toast: { position: 'absolute', left: 24, right: 24, top: 0, zIndex: 200, minHeight: 52, borderRadius: 12, backgroundColor: '#FFFFFF', borderLeftWidth: 4, justifyContent: 'center', paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 10 },
  toastText: { color: DARK, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 320, borderRadius: 20, backgroundColor: '#fff', padding: 24 },
  confirmTitle: { fontSize: 18, color: DARK, fontWeight: '800' },
  confirmBody: { fontSize: 14, color: '#666', lineHeight: 20, marginTop: 10 },
  confirmPrimary: { height: 48, borderRadius: 24, backgroundColor: ACCENT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  confirmPrimaryText: { color: '#fff', fontWeight: '800' },
  confirmSecondary: { color: MUTED, textAlign: 'center', fontWeight: '700', marginTop: 14 },
});

export default CreateFAB;
