/**
 * gpsRateService.ts
 * ──────────────────
 * Logs user location events to the `gps_rate` Supabase table.
 *
 * Logged when:
 *   1. User confirms a place from the Radar modal           → place name
 *   2. User taps "None of these" in the Radar modal         → "none_of_these: Place1, Place2"
 *   3. User manually searches a place in the dashboard      → place name
 */

import { supabase } from "@/lib/supabase";


/**
 * Inserts a row into gps_rate.
 * Fire-and-forget — never throws so it never breaks the calling flow.
 *
 * @param userId - the authenticated user's ID
 * @param place  - place name, or "none_of_these: ..." when the user dismissed
 */
export async function logGpsRate(userId: string, place: string): Promise<void> {
  try {
    await supabase.from("gps_rate").insert({
      user_id: userId,
      place,
    });
  } catch {
  }
}
