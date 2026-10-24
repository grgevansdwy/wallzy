/**
 * googlePlacesConfig.ts
 * ─────────────────────
 * Single source of truth for reading the Google Places API key.
 *
 * Why a separate file?
 *   React Native doesn't expose process.env the same way Node.js does.
 *   Expo bakes EXPO_PUBLIC_* variables into the JS bundle at build time,
 *   but reading them can sometimes fail depending on the environment
 *   (Expo Go, development build, production build). The fallback chain
 *   below makes sure we catch it in every case.
 *
 * Where to set the key:
 *   In your .env file at the project root:
 *     EXPO_PUBLIC_GOOGLE_PLACES_KEY=AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 *   Then restart the bundler with: npx expo start --clear
 */

export const getGooglePlacesApiKey = (): string | null => {
  try {
    // Attempt 1: Standard process.env — works in Expo dev builds & production
    if (process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY) {
      return process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
    }

    // Attempt 2: global object — fallback for some React Native environments
    if ((global as any).EXPO_PUBLIC_GOOGLE_PLACES_KEY) {
      return (global as any).EXPO_PUBLIC_GOOGLE_PLACES_KEY;
    }

    // Attempt 3: globalThis — another fallback (modern JS standard)
    if ((globalThis as any).EXPO_PUBLIC_GOOGLE_PLACES_KEY) {
      return (globalThis as any).EXPO_PUBLIC_GOOGLE_PLACES_KEY;
    }

    return null;
  } catch {
    return null;
  }
};
