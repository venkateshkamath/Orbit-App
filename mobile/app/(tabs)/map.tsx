/**
 * Legacy map route — Discover is the map tab; send users to tabs root.
 */

import { Redirect } from 'expo-router';

export default function MapTabRedirect() {
  return <Redirect href="/(tabs)" />;
}
