import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useRef, useState } from "react";
let Radar: any = null;
try {
  Radar = require("react-native-radar").default;
} catch {
  // Radar not available in Expo Go
}
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { Alert, AppState, Platform } from "react-native";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import MerchantSelectionModal from "@/components/MerchantSelectionModal";
import { RadarResultProvider, useRadarResult } from "@/contexts/RadarResultContext";
import { logGpsRate } from "@/services/gpsRate/gpsRateService";
import { getCurrentLocationAndPlaces, searchPlacesAt, RadarPlace } from "@/services/radar/radarPlacesService";
import { getCategoryByRadarPlace } from "@/services/radar/radarCategoryService";
import { chooseBestCard } from "@/services/RoutingEngine/routingService";
import { getCategoryDisplayName } from "@/constants/categoryNames";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function useProtectedRoute() {
  const { isAuthenticated, isInitialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;

    const inProtectedGroup = segments[0] === "(app)";

    if (isAuthenticated && !inProtectedGroup) {
      const currentRoute = segments.join("/");
      if (!currentRoute.includes("reset-password")) {
        router.replace("/(app)/dashboard");
      }
    } else if (!isAuthenticated && inProtectedGroup) {
      router.replace("/");
    }
  }, [isAuthenticated, isInitialized, segments, router]);
}

function useDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const setSessionWithRetry = async (
        access_token: string,
        refresh_token: string,
        maxAttempts: number = 3,
      ) => {
        let lastError: any;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (!error) return { data };
            lastError = error;
            if (!error.message.includes("Network request failed")) break;
          } catch (err: any) {
            lastError = err;
            if (!err?.message?.includes?.("Network request failed")) break;
          }
          await new Promise((r) => setTimeout(r, 800));
        }
        throw lastError;
      };

      if (url.includes("reset-password") || url.includes("type=recovery")) {
        if (Platform.OS !== "web") {
          const hashIndex = url.indexOf("#");
          if (hashIndex !== -1) {
            const params = new URLSearchParams(url.substring(hashIndex + 1));
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");
            const type = params.get("type");
            if (accessToken && refreshToken && type === "recovery") {
              try {
                await setSessionWithRetry(accessToken, refreshToken);
              } catch {}
            }
          }
          router.replace("/reset-password");
        }
        return;
      }

      if (url.includes("type=signup") || url.includes("type=email")) {
        if (Platform.OS !== "web") {
          const hashIndex = url.indexOf("#");
          if (hashIndex !== -1) {
            const hashParams = new URLSearchParams(
              url.substring(hashIndex + 1),
            );
            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");

            if (accessToken && refreshToken) {
              try {
                const { data } = await setSessionWithRetry(
                  accessToken,
                  refreshToken,
                );
                void data;
                router.replace("/(app)/dashboard");
                return;
              } catch {
                return;
              }
            }
            router.replace("/sign-in");
            return;
          }
        }
      }
    };

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [router]);
}

function RootLayoutNav() {
  useProtectedRoute();
  useDeepLinkHandler();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)/index" />
      <Stack.Screen name="(auth)/sign-in" />
      <Stack.Screen name="(auth)/sign-up" />
      <Stack.Screen name="(auth)/forgot-password" />
      <Stack.Screen name="(auth)/reset-password" />
      <Stack.Screen name="(auth)/verification" />
      <Stack.Screen name="(app)/dashboard" />
      <Stack.Screen name="(app)/add-cards" />
      <Stack.Screen name="(app)/bank-cards" />
      <Stack.Screen name="(app)/card-details" />
      <Stack.Screen name="(app)/feedback" />
    </Stack>
  );
}

function AppContent() {
  const { isInitialized, user } = useAuth();
  const { setRadarResult } = useRadarResult();
  const [nearbyPlaces, setNearbyPlaces] = useState<RadarPlace[]>([]);
  const [showPlaceSelection, setShowPlaceSelection] = useState(false);
  const radarReady = useRef(false);

  // Stable ref so background callbacks always see the latest user without
  // needing to re-register the Radar listeners on every auth change.
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Stores the places list + pre-computed results from the background so the
  // foreground can show the modal and results instantly.
  const prefetchRef = useRef<{
    places: RadarPlace[];
    results: Map<string, any>;
    timestamp: number;
  } | null>(null);

  // Prevents concurrent background pre-fetches from racing each other.
  const isPrefetchingRef = useRef(false);

  // Always points to the latest refreshNearbyPlaces so effects with stable []
  // deps never hold a stale closure.
  const refreshNearbyPlacesRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  /**
   * Classify a chosen place and find the best card.
   */
  const handlePlaceSelected = useCallback(async (place: RadarPlace) => {
    setShowPlaceSelection(false);
    setNearbyPlaces([]);

    if (!user) return;

    logGpsRate(user.id, place.name);

    const prefetched = prefetchRef.current?.results.get(place._id);
    if (prefetched) {
      setRadarResult(prefetched);
      prefetchRef.current = null;
      return;
    }

    try {
      const ruleKey = await getCategoryByRadarPlace(place._id, place.name, place.categories);
      const recommendation = await chooseBestCard(user.id, ruleKey, 100);

      if (recommendation.bestCards.length === 0) {
        Alert.alert(
          "No Card Found",
          `Detected: ${place.name} (${getCategoryDisplayName(ruleKey)})\n\nNo matching card found. Make sure you have cards added and they have reward rules for this category.`,
        );
        return;
      }

      setRadarResult({
        merchantName: place.name,
        bestCardKeys: recommendation.bestCards.map((c) => c.card_key),
        bestCardName: recommendation.bestCards.map((c) => c.card_name).join(" & "),
        estimatedRewards: recommendation.estimatedRewards,
        isSignupBonus: recommendation.isSignupBonus ?? false,
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      Alert.alert("Routing Error", `Could not find best card for "${place.name}".\n\nError: ${msg}`);
    }
  }, [user]);

  /**
   * Fetch nearby places and show the selection modal.
   */
  const refreshNearbyPlaces = useCallback(async () => {
    try {
      const { places } = await getCurrentLocationAndPlaces();
      if (places.length === 0) return;
      setNearbyPlaces(places);
      setShowPlaceSelection(true);
    } catch {}
  }, [handlePlaceSelected]);

  useEffect(() => {
    refreshNearbyPlacesRef.current = refreshNearbyPlaces;
  }, [refreshNearbyPlaces]);

  // Effect 1: Initialize the Radar SDK and register event listeners.
  useEffect(() => {
    if (!Radar) {
      radarReady.current = true;
      return;
    }

    Radar.initialize(process.env.EXPO_PUBLIC_RADAR_KEY!);

    Radar.onLocationUpdated(({ location, user: radarUser }: { location: any; user: any }) => {
      void radarUser;
      const currentUser = userRef.current;
      if (!currentUser || isPrefetchingRef.current) return;

      isPrefetchingRef.current = true;
      searchPlacesAt(location.latitude, location.longitude)
        .then(async (places) => {
          if (places.length === 0) return;

          const results = new Map<string, any>();

          await Promise.all(places.map(async (place) => {
            try {
              const ruleKey = await getCategoryByRadarPlace(place._id, place.name, place.categories);
              const recommendation = await chooseBestCard(currentUser.id, ruleKey, 100);
              if (recommendation.bestCards.length > 0 && ruleKey !== "everything") {
                results.set(place._id, {
                  merchantName: place.name,
                  bestCardKeys: recommendation.bestCards.map((c) => c.card_key),
                  bestCardName: recommendation.bestCards.map((c) => c.card_name).join(" & "),
                  estimatedRewards: recommendation.estimatedRewards,
                  isSignupBonus: recommendation.isSignupBonus ?? false,
                });
              }
            } catch {}
          }));

          prefetchRef.current = { places, results, timestamp: Date.now() };
        })
        .catch(() => {})
        .finally(() => { isPrefetchingRef.current = false; });
    });

    Radar.onError((_status: any) => {});

    radarReady.current = true;

    return () => {
      Radar.onLocationUpdated(null);
      Radar.onError(null);
    };
  }, []);

  // Effect 2: Gate location permissions and tracking on authentication.
  useEffect(() => {
    if (!Radar || !isInitialized) return;

    if (user) {
      const startTracking = async () => {
        try {
          await Radar.requestPermissions(false);
        } catch {}

        if (Platform.OS === "ios") {
          try {
            await Radar.requestPermissions(true);
          } catch {}
        }

        Radar.startTrackingResponsive();
        await refreshNearbyPlacesRef.current();
      };

      startTracking().catch(() => {});
    } else {
      try { Radar.stopTracking(); } catch {}
      setShowPlaceSelection(false);
      setNearbyPlaces([]);
      prefetchRef.current = null;
    }
  }, [user?.id, isInitialized]);

  // Foreground handler: refresh nearby places every time app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && radarReady.current && userRef.current) {
        const PREFETCH_MAX_AGE_MS = 5 * 60 * 1000;
        const prefetch = prefetchRef.current;
        const isFresh = prefetch && (Date.now() - prefetch.timestamp) < PREFETCH_MAX_AGE_MS;

        if (isFresh && prefetch.places.length > 0) {
          setNearbyPlaces(prefetch.places);
          setShowPlaceSelection(true);
          return;
        }

        prefetchRef.current = null;
        refreshNearbyPlacesRef.current();
      }
    });

    return () => subscription.remove();
  }, []);

  // Deep link handler
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (url.includes("select-merchant")) {
        refreshNearbyPlacesRef.current();
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <>
      <RootLayoutNav />

      {showPlaceSelection && nearbyPlaces.length > 0 && (
        <MerchantSelectionModal
          visible
          places={nearbyPlaces}
          onSelect={handlePlaceSelected}
          onDismiss={() => {
            if (user && nearbyPlaces.length > 0) {
              const placeList = nearbyPlaces.map((p) => p.name).join(", ");
              logGpsRate(user.id, `none_of_these: ${placeList}`);
            }
            setShowPlaceSelection(false);
            setNearbyPlaces([]);
            prefetchRef.current = null;
          }}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <AuthProvider>
          <RadarResultProvider>
            <AppContent />
          </RadarResultProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
