/**
 * Google Maps custom styling — neutral slate (not brand purple) so the basemap stays readable
 * and doesn’t fight the UI accents. Light/dark tuned to Orbit background tokens.
 */

import type { MapStyleElement } from 'react-native-maps';

export const googleMapStyleLight: MapStyleElement[] = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#E2E6EE' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ECEFF4' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#F4F6FA' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#64748B' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#B8C9E8' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#EEF1F6' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#D8E8DD' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

/** Cool grays only — avoids the old indigo-violet “Orbit Navy” map tint. */
export const googleMapStyleDark: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#12151C' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#12151C' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#181C24' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#94A3B8' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#252B36' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#343B48' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#2F3642' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8E98A8' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D1218' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#141920' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#152018' }] },
];
