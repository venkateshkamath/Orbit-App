/**
 * Dynamic Expo config (merges env + app.json).
 *
 * - GOOGLE_MAPS_API_KEY: see .env.example
 * - Optional: EAS_PROJECT_ID in `.env` only if you later create an Expo account and want
 *   Expo’s hosted push service. Not required to run or develop the app.
 */
module.exports = ({ config }) => {
  let result = { ...config };

  const fromEnvEas = process.env.EAS_PROJECT_ID?.trim();
  const fromJsonEas = config?.extra?.eas?.projectId?.trim();
  const validEas = (id) =>
    id &&
    id.length > 0 &&
    id !== 'your-project-id' &&
    !/^your-/i.test(id);

  const easProjectId = validEas(fromEnvEas) ? fromEnvEas : validEas(fromJsonEas) ? fromJsonEas : null;

  if (easProjectId) {
    result = {
      ...result,
      extra: {
        ...(result.extra || {}),
        eas: {
          ...(result.extra?.eas || {}),
          projectId: easProjectId,
        },
      },
    };
  }

  const fromEnv = process.env.GOOGLE_MAPS_API_KEY;
  const fromAndroid = result?.android?.config?.googleMaps?.apiKey;
  const fromIos = result?.ios?.config?.googleMapsApiKey;
  const mapsKey = [fromEnv, fromAndroid, fromIos].find((k) => k && String(k).trim() !== '');

  if (mapsKey) {
    result = {
      ...result,
      android: {
        ...result.android,
        config: {
          ...(result.android?.config || {}),
          googleMaps: {
            ...(result.android?.config?.googleMaps || {}),
            apiKey: mapsKey,
          },
        },
      },
      ios: {
        ...result.ios,
        config: {
          ...(result.ios?.config || {}),
          googleMapsApiKey: mapsKey,
        },
      },
    };
  }

  return result;
};
