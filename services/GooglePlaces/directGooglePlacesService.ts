/**
 * directGooglePlacesService.ts
 * ─────────────────────────────
 * Searches Google Places by text query and returns the top matching place
 * along with its reward category (determined by Gemini via geminiCategoryService).
 *
 * This is used when the user types a search query and presses Enter/Search
 * without selecting an autocomplete suggestion. In that case we don't have
 * a place_id yet, so we do a text search first to get one.
 *
 * For autocomplete selections, dashboard.tsx calls getCategoryByPlaceId
 * directly since it already has the place_id from the suggestion.
 *
 * API used: Google Places API v1 (new)
 *   Endpoint: POST https://places.googleapis.com/v1/places:searchText
 */

import { getGooglePlacesApiKey } from "./googlePlacesConfig";
import { getCategoryByPlaceId } from "./geminiCategoryService";

// Shape of a single place result from the Google API (after normalising)
export interface PlaceResult {
  place_id: string;           // Google's unique ID for this place
  name: string;               // Display name e.g. "Starbucks"
  types: string[];            // Google type tags e.g. ["cafe", "food", "store"]
  formatted_address?: string | null;
}

/**
 * searchPlacesDirect
 * ───────────────────
 * Raw Google Places text search.
 * Sends a query, gets back up to 5 matching places with their names,
 * Google types, and addresses.
 */
export async function searchPlacesDirect(query: string): Promise<PlaceResult[]> {
  const googlePlacesKey = getGooglePlacesApiKey();

  if (!googlePlacesKey) {
    return [];
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googlePlacesKey,
      // Only request the fields we need — reduces billing and payload size
      "X-Goog-FieldMask": "places.id,places.displayName,places.types,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 5,
    }),
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Google Places API error: ${response.status} ${response.statusText} - ${rawText}`,
    );
  }

  const data = JSON.parse(rawText);

  // Normalise Google's response shape into our PlaceResult interface
  return (
    data.places?.map((p: any) => ({
      place_id: p.id,
      name: p.displayName?.text ?? "",
      types: p.types ?? [],
      formatted_address: p.formattedAddress ?? null,
    })) ?? []
  );
}

/**
 * searchPlaceAndGetCategoryDirect
 * ──────────────────────────────────
 * Main entry point for keyboard/text searches (no autocomplete suggestion).
 * Searches Google for the query, picks the top result, then uses
 * getCategoryByPlaceId (Gemini + Supabase cache) to determine the category.
 *
 * Returns:
 *   { place, category }                              — happy path
 *   { place: null, category: null, error: "..." }   — nothing found / API error
 */
export async function searchPlaceAndGetCategoryDirect(
  query: string,
): Promise<{
  place: PlaceResult | null;
  category: string | null;
  error?: string;
}> {
  try {
    const places = await searchPlacesDirect(query);

    if (!places.length) {
      return { place: null, category: null, error: "No places found for this search" };
    }

    // Google returns results ranked by relevance — top result is best match
    const bestPlace = places[0];

    // Use Gemini (with Supabase cache) to classify this place
    const category = await getCategoryByPlaceId(bestPlace.place_id);

    return { place: bestPlace, category };
  } catch (error) {
    return {
      place: null,
      category: null,
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}
