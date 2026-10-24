/**
 * autocompleteService.ts
 * ───────────────────────
 * Powers the live search suggestions shown as the user types in the dashboard
 * search bar, and fetches full place details when they pick a suggestion.
 *
 * Two functions are exported:
 *
 *   getPlaceSuggestions(input)
 *     Called on every keystroke (debounced 250ms in dashboard.tsx).
 *     Returns a list of place name suggestions to show in the dropdown.
 *
 *   getPlaceDetails(placeId)
 *     Called when the user taps a suggestion.
 *     Returns the full place info including its Google "types" array,
 *     which directGooglePlacesService then uses to pick a reward category.
 *
 * API used: Google Places API v1 (new)
 *   Autocomplete: POST https://places.googleapis.com/v1/places:autocomplete
 *   Details:      GET  https://places.googleapis.com/v1/places/{placeId}
 */

import { getGooglePlacesApiKey } from "./googlePlacesConfig";

// Shape of a single autocomplete suggestion shown in the dropdown
export interface AutocompletePrediction {
  place_id: string;    // Google's ID — passed to getPlaceDetails later
  description: string; // Full text e.g. "Starbucks, Main Street, New York"
  structured_formatting: {
    main_text: string;      // Primary part e.g. "Starbucks" (shown bold)
    secondary_text: string; // Address part e.g. "Main Street, New York"
  };
}

// Optional location bias — pass user coordinates to get nearby suggestions first
type AutocompleteOpts = {
  lat?: number;
  lng?: number;
  radiusMeters?: number; // how wide a radius to bias — defaults to 25 km
};

/**
 * splitMainSecondary
 * ───────────────────
 * Google's autocomplete returns one combined text string like
 * "Starbucks, 123 Main St, New York, NY, USA".
 * We split on the first comma to get a clean display name + address.
 */
function splitMainSecondary(full: string): { main: string; secondary: string } {
  const parts = full.split(",").map((x) => x.trim()).filter(Boolean);
  const main = parts[0] ?? full;
  const secondary = parts.slice(1).join(", ");
  return { main, secondary };
}

/**
 * getPlaceSuggestions
 * ────────────────────
 * Fetches live autocomplete suggestions as the user types.
 * Called by dashboard.tsx on every keystroke (with 250ms debounce).
 *
 * @param input  - what the user has typed so far (min 2 chars)
 * @param opts   - optional { lat, lng } to bias results near the user
 * @returns      - array of up to ~6 suggestions for the dropdown
 */
export async function getPlaceSuggestions(
  input: string,
  opts?: AutocompleteOpts,
): Promise<AutocompletePrediction[]> {
  // Key check is OUTSIDE try/catch so a missing key throws visibly to the caller
  const googlePlacesKey = getGooglePlacesApiKey();
  if (!googlePlacesKey) {
    throw new Error(
      "EXPO_PUBLIC_GOOGLE_PLACES_KEY is missing. " +
      "If using EAS Build, add it via: eas env:create --name EXPO_PUBLIC_GOOGLE_PLACES_KEY --value YOUR_KEY --scope project",
    );
  }
  const trimmed = input.trim();
  if (trimmed.length < 2) return []; // don't fire API for 0-1 char inputs

  try {
    const body: any = {
      input: trimmed,
      // includedPrimaryTypes could filter to only businesses, but leaving it
      // open returns better results for partial names like "Star" → Starbucks
    };

    // If we have the user's location, bias suggestions to nearby places.
    // This means "Target" will show the nearest Target first.
    if (opts?.lat != null && opts?.lng != null) {
      body.locationBias = {
        circle: {
          center: { latitude: opts.lat, longitude: opts.lng },
          radius: opts.radiusMeters ?? 25000, // 25 km default
        },
      };
    }

    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googlePlacesKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
      },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${rawText.slice(0, 300)}`);
    }

    const data = JSON.parse(rawText);

    // Surface any error Google embeds in a 200 response
    if (data?.error) {
      const msg = data.error.message ?? JSON.stringify(data.error);
      throw new Error(`Google API error: ${msg}`);
    }

    // Google returns: { suggestions: [{ placePrediction: { placeId, text: { text } } }] }
    const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];

    if (suggestions.length === 0) {
      // Throw with the raw response so it surfaces in the UI error label
      throw new Error(`0 results. Raw: ${rawText.slice(0, 200)}`);
    }

    const out: AutocompletePrediction[] = [];

    for (const s of suggestions) {
      const p = s?.placePrediction;
      if (!p?.placeId) continue;

      // p.text can be { text: "..." } or just a string — guard both
      const full = p?.text?.text ?? p?.text ?? "";
      if (!full) continue;

      const { main, secondary } = splitMainSecondary(full);

      out.push({
        place_id: p.placeId,
        description: full,
        structured_formatting: {
          main_text: main,       // used for the bold top line in the dropdown
          secondary_text: secondary, // used for the grey address line
        },
      });
    }

    return out;
  } catch (error) {
    throw error; // re-throw so dashboard shows the real error message
  }
}

/**
 * getPlaceDetails
 * ────────────────
 * Called when the user taps a suggestion in the dropdown.
 * We need the full "types" array to categorise the place — autocomplete
 * results don't include types, so we do a second API call here.
 *
 * @param placeId - Google place ID from the autocomplete suggestion
 * @returns       - { name, types, formatted_address } or null on failure
 *
 * After getting this, dashboard.tsx passes name to
 * searchPlaceAndGetCategoryDirect() which maps types → reward category.
 */
export async function getPlaceDetails(placeId: string): Promise<{
  name: string;
  types: string[];
  formatted_address: string;
} | null> {
  try {
    const googlePlacesKey = getGooglePlacesApiKey();
    if (!googlePlacesKey) {
      return null;
    }

    const response = await fetch(
      // placeId goes directly in the URL path for the Details endpoint
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": googlePlacesKey,
          // Only fetch the three fields we need — keeps cost and payload small
          "X-Goog-FieldMask": "displayName,types,formattedAddress",
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Place details error ${response.status}: ${text}`);
    }

    const place = await response.json();

    return {
      name: place?.displayName?.text ?? "",
      types: Array.isArray(place?.types) ? place.types : [],
      formatted_address: place?.formattedAddress ?? "",
    };
  } catch {
    return null;
  }
}
