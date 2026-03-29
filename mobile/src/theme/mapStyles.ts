/**
 * Google Maps custom styling aligned with Orbit Navy palette.
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
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#E4E3EC' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#EEEDF4' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#F9F8FD' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8F8BB5' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C8D6F0' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F1F0F8' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#DCE8DE' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

export const googleMapStyleDark: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#08061A' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5E5A86' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#08061A' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#110F2A' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#8F8BB5' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#18163A' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#242050' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#1E1B44' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5E5A86' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A0D28' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0E0C24' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0F1A14' }] },
];
