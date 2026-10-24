/**
 * radarPlacesService.ts
 * ─────────────────────
 * This file is responsible for TWO things:
 *   1. Getting the user's current GPS location using Radar's SDK
 *   2. Searching for nearby physical merchants/stores around that location
 *
 * It is called from _layout.tsx in two situations:
 *   - When the app first opens (cold start)
 *   - Every time the app comes back to the foreground (app switch)
 *
 * The result (list of nearby places) is then passed to radarCategoryService.ts
 * which figures out what reward category each place belongs to.
 */

// ── Radar SDK import ─────────────────────────────────────────────────────────
// We use a try/catch here because react-native-radar is a native module.
// Native modules don't work in Expo Go (the preview app), only in real builds.
// If the import fails, Radar stays null and all functions return empty results.
let Radar: any = null;
try {
  Radar = require("react-native-radar").default;
} catch {
  // Silently skip — the app will work without Radar, just no location detection
}

// ── Data shape ───────────────────────────────────────────────────────────────
// This is what we return for each nearby place Radar finds.
// Radar gives us more fields but we only need these three for Wallzy.
export interface RadarPlace {
  _id: string; // Radar's unique ID for this place — used as a cache key later
  name: string; // Display name e.g. "Starbucks", "Target"
  categories: string[]; // Radar's own category tags e.g. ["food-beverage", "coffee-shop"]
  distance?: number; // How many metres away from the user (optional)
}

// ── Main exported function ───────────────────────────────────────────────────
/**
 * getCurrentLocationAndPlaces
 *
 * Step 1: Ask Radar for the user's current GPS position using trackOnce().
 *         trackOnce() is a one-shot location ping — it doesn't continuously track.
 *         It resolves once with { location: { latitude, longitude } }.
 *
 * Step 2: If we got a valid location, call searchNearbyPlaces() to find stores.
 *
 * Step 3: Return both the places list AND the raw coordinates.
 *         (_layout.tsx doesn't currently use the coordinates, but they're
 *          available in case we want to show a map or distance later.)
 */
export async function getCurrentLocationAndPlaces(): Promise<{
  places: RadarPlace[];
  latitude: number | null;
  longitude: number | null;
}> {
  // If Radar didn't load (Expo Go or build error), return empty immediately
  if (!Radar) {
    return { places: [], latitude: null, longitude: null };
  }

  try {
    // trackOnce() fires a single location request.
    // It respects the user's permission level (foreground/background).
    const { location } = await Radar.trackOnce();

    // location can be null if the user denied permissions or GPS is off
    const latitude: number | null = location?.latitude ?? null;
    const longitude: number | null = location?.longitude ?? null;

    if (latitude == null || longitude == null) {
      return { places: [], latitude, longitude };
    }

    // Now use those coordinates to find nearby places
    const places = await searchNearbyPlaces(latitude, longitude);
    return { places, latitude, longitude };
  } catch {
    return { places: [], latitude: null, longitude: null };
  }
}

// ── Exported coordinate-based search ────────────────────────────────────────
/**
 * searchPlacesAt
 *
 * Same as searchNearbyPlaces but exported so background callbacks in _layout.tsx
 * can pass coordinates they already have (from onLocationUpdated) without
 * calling trackOnce() again.
 */
export async function searchPlacesAt(
  latitude: number,
  longitude: number,
): Promise<RadarPlace[]> {
  return searchNearbyPlaces(latitude, longitude);
}

// ── Internal helper ──────────────────────────────────────────────────────────
/**
 * searchNearbyPlaces
 *
 * Calls Radar's searchPlaces() API to find merchants within 200 metres.
 *
 * Why 200m? It's wide enough to catch a store you're walking toward or
 * parked near, but narrow enough to avoid showing stores a block away.
 *
 * Why list all those categories? Radar requires at least one filter
 * (chains, categories, OR groups) — you can't search for "everything".
 * By passing all broad categories, we effectively get any type of merchant.
 *
 * limit: 10 → max results returned. More than 10 would overwhelm the user
 *             with a selection modal, so we keep it tight.
 */
async function searchNearbyPlaces(
  latitude: number,
  longitude: number,
): Promise<RadarPlace[]> {
  try {
    const { places } = await Radar.searchPlaces({
      near: { latitude, longitude }, // centre point of the search
      radius: 50, // search radius in metres (50m is too small — GPS drift alone can be ±50m indoors)
      limit: 10, // max number of places to return
      categories: [
        // These are Radar's own category slugs (NOT Wallzy's reward categories).
        // radarCategoryService.ts will later translate these into Wallzy categories.
        "food-beverage", // restaurants, cafes, bars, coffee shops
        "retail", // clothing, electronics, department stores
        "grocery", // supermarkets, grocery stores
        "gas-station", // petrol/EV charging stations
        "travel-transportation", // hotels, airports, car rentals
        "healthcare", // pharmacies, clinics, hospitals
        "fitness", // gyms, yoga studios
        "entertainment", // cinemas, theatres, theme parks
        "home", // furniture, hardware, home goods
        "technology", // electronics, phone stores
        "automotive", // car dealers, auto shops
        "financial", // banks, ATMs (less useful for rewards but included)
      ],
    });

    // Normalize Radar's response into our cleaner RadarPlace shape.
    // Radar doesn't always return _id (some places use externalId instead),
    // so we fall back to a random string to avoid key collisions in React lists.
    const results: RadarPlace[] = (places ?? []).map((p: any) => ({
      _id: p._id ?? p.externalId ?? String(Math.random()),
      name: p.name ?? "Unknown",
      categories: p.categories ?? [],
      distance: p.distance, // metres from user, provided by Radar
    }));

    return results;
  } catch {
    return []; // Return empty on error so the app doesn't crash
  }
}
