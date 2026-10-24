import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  FlatList,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { MoreHorizontal, LogOut, CreditCard, Search, X } from "lucide-react-native";

import Colors from "@/constants/colors";
import { getCategoryDisplayName } from "@/constants/categoryNames";
import WallzyLogo from "@/components/WallzyLogo";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserCards } from "@/services/cardSupabase/cardServices";
import { chooseBestCard, getAvailableCategories } from "@/services/RoutingEngine/routingService";
import { searchPlaceAndGetCategoryDirect } from "@/services/GooglePlaces/directGooglePlacesService";
import { getPlaceSuggestions, AutocompletePrediction } from "@/services/GooglePlaces/autocompleteService";
import { getCategoryByPlaceId } from "@/services/GooglePlaces/geminiCategoryService";
import { useRadarResult } from "@/contexts/RadarResultContext";
import type { Card } from "@/types/database";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut, user } = useAuth();

  const [userCards, setUserCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showMenu, setShowMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);

  const [locationQuery, setLocationQuery] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [bestCardName, setBestCardName] = useState<string | null>(null);
  const [bestCardKeys, setBestCardKeys] = useState<string[]>([]);
  const [estimatedRewards, setEstimatedRewards] = useState(0);
  const [isSignupBonusResult, setIsSignupBonusResult] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSuggestQueryRef = useRef<string>("");

  const { radarResult, setRadarResult } = useRadarResult();

  // When Radar detects a nearby place, sync it into the inline banner + BEST badge
  useEffect(() => {
    if (!radarResult) return;
    setSearchResult(radarResult.merchantName);
    setBestCardKeys(radarResult.bestCardKeys);
    setBestCardName(radarResult.bestCardName);
    setEstimatedRewards(radarResult.estimatedRewards);
    setIsSignupBonusResult(radarResult.isSignupBonus);
    setLocationQuery("");
  }, [radarResult]);

  useEffect(() => {
    loadUserCards();
    loadCategories();

    return () => {
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadUserCards();
    }, [user]),
  );

  const sortedCards = useMemo(() => {
    if (bestCardKeys.length === 0) return userCards;
    const bestCards = userCards.filter((c) => bestCardKeys.includes(c.card_key));
    const otherCards = userCards.filter((c) => !bestCardKeys.includes(c.card_key));
    return [...bestCards, ...otherCards];
  }, [userCards, bestCardKeys]);

  const loadUserCards = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const cards = await fetchUserCards(user.id);
      setUserCards(cards);
    } catch {}
    finally {
      setIsLoading(false);
    }
  };

  const loadCategories = () => {
    setAvailableCategories(getAvailableCategories());
  };

  const handleMenuOption = (option: string) => {
    setShowMenu(false);
    if (option === "add-cards") router.push("/(app)/add-cards");
    else if (option === "feedback") router.push("/(app)/feedback");
  };

  const handleLogout = () => setShowLogoutConfirm(true);

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    try {
      await signOut();
    } catch {}
  };

  /**
   * Runs the actual "best card for place/category" logic.
   */
  const handleLocationSearch = async (queryOverride?: string) => {
    const q = (queryOverride ?? locationQuery).trim();
    if (!q || !user) return;

    if (suggestions.length > 0 && !queryOverride) {
      await handleSuggestionSelect(suggestions[0]);
      return;
    }

    try {
      setIsSearching(true);
      setShowSuggestions(false);
      setSuggestions([]);

      const { place, category, error } = await searchPlaceAndGetCategoryDirect(q);

      if (error) {
        const result = await chooseBestCard(user.id, q.toLowerCase(), 100);
        if (result.bestCards.length > 0) {
          setSearchResult(q);
          setBestCardKeys(result.bestCards.map((c) => c.card_key));
          setBestCardName(result.bestCards.map((c) => c.card_name).join(" & "));
          setEstimatedRewards(result.estimatedRewards);
          setIsSignupBonusResult(result.isSignupBonus ?? false);
        } else {
          setSearchResult(null);
          setBestCardKeys([]);
          setBestCardName(null);
          setEstimatedRewards(0);
          setIsSignupBonusResult(false);
        }
      } else if (place && category) {
        const result = await chooseBestCard(user.id, category.trim(), 100);
        if (result.bestCards.length > 0) {
          setSearchResult(place.name);
          setBestCardKeys(result.bestCards.map((c) => c.card_key));
          setBestCardName(result.bestCards.map((c) => c.card_name).join(" & "));
          setEstimatedRewards(result.estimatedRewards);
          setIsSignupBonusResult(result.isSignupBonus ?? false);
        } else {
          setSearchResult(null);
          setBestCardKeys([]);
          setBestCardName(null);
          setEstimatedRewards(0);
          setIsSignupBonusResult(false);
        }
      } else {
        setSearchResult(null);
        setBestCardKeys([]);
        setBestCardName(null);
        setEstimatedRewards(0);
        setIsSignupBonusResult(false);
      }

      setShowLocationSearch(false);
    } catch {}
    finally {
      setIsSearching(false);
    }
  };

  /**
   * Debounced autocomplete
   */
  const handleTextChange = (text: string) => {
    setLocationQuery(text);

    const q = text.trim();
    if (q.length < 2) {
      lastSuggestQueryRef.current = q;
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);

    suggestTimerRef.current = setTimeout(async () => {
      try {
        setIsSuggesting(true);
        lastSuggestQueryRef.current = q;

        const res = await getPlaceSuggestions(q);

        if (lastSuggestQueryRef.current !== q) return;

        setSuggestions(res);
        setShowSuggestions(res.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSuggesting(false);
      }
    }, 250);
  };

  const handleSuggestionSelect = async (s: AutocompletePrediction) => {
    try {
      setShowSuggestions(false);
      setSuggestions([]);

      const name = s.structured_formatting.main_text;
      setLocationQuery(name);
      setIsSearching(true);

      const category = await getCategoryByPlaceId(s.place_id);

      const result = await chooseBestCard(user!.id, category, 100);
      if (result.bestCards.length > 0) {
        setSearchResult(name);
        setBestCardKeys(result.bestCards.map((c) => c.card_key));
        setBestCardName(result.bestCards.map((c) => c.card_name).join(" & "));
        setEstimatedRewards(result.estimatedRewards);
        setIsSignupBonusResult(result.isSignupBonus ?? false);
      } else {
        setSearchResult(null);
        setBestCardKeys([]);
        setBestCardName(null);
        setEstimatedRewards(0);
        setIsSignupBonusResult(false);
      }
    } catch {}
    finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchResult(null);
    setBestCardKeys([]);
    setBestCardName(null);
    setEstimatedRewards(0);
    setIsSignupBonusResult(false);
    setLocationQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setRadarResult(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.headerButton}>
          <MoreHorizontal size={24} color={Colors.darkBlue} />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <WallzyLogo size="small" showTagline={false} />
        </View>

        <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
          <LogOut size={24} color={Colors.darkBlue} />
        </TouchableOpacity>
      </View>

      {/* Main */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>My Cards</Text>

        {/* Search + Dropdown */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchContainer}>
            <Search size={20} color={Colors.textGray} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a place (e.g., McDonald's, Walmart)"
              placeholderTextColor={Colors.textGray}
              value={locationQuery}
              onChangeText={handleTextChange}
              onSubmitEditing={() => handleLocationSearch()}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 120);
              }}
            />
          </View>

          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.dropdown}>
              {suggestions.slice(0, 6).map((s, idx) => (
                <TouchableOpacity
                  key={s.place_id}
                  style={[styles.dropdownItem, idx === Math.min(suggestions.length, 6) - 1 && styles.dropdownItemLast]}
                  onPress={() => handleSuggestionSelect(s)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dropdownMain}>{s.structured_formatting.main_text}</Text>
                  {!!s.structured_formatting.secondary_text && (
                    <Text style={styles.dropdownSecondary}>{s.structured_formatting.secondary_text}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {isSuggesting && (
          <View style={styles.suggestingRow}>
            <ActivityIndicator size="small" color={Colors.textGray} />
            <Text style={styles.suggestingText}>Finding places…</Text>
          </View>
        )}

        {/* Result banner */}
        {searchResult && bestCardKeys.length > 0 && bestCardName && (
          <View style={styles.searchResultBanner}>
            <Text style={styles.searchResultText}>
              {(() => {
                const isCategory =
                  searchResult.includes("_") ||
                  availableCategories.includes(searchResult) ||
                  availableCategories.includes(searchResult.toLowerCase());
                const label = isCategory ? getCategoryDisplayName(searchResult) : searchResult;
                return `Best card for "${label}": ${bestCardName}`;
              })()}
            </Text>

            <Text style={styles.searchResultReward}>
              {isSignupBonusResult
                ? `Sign-up bonus active — effective return: $${estimatedRewards.toFixed(2)} on $100`
                : `Estimated reward: $${estimatedRewards.toFixed(2)} on $100`}
            </Text>

            <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
              <X size={16} color={Colors.textGray} />
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.cardCount}>
          {userCards.length} {userCards.length === 1 ? "card" : "cards"}
        </Text>

        {/* Cards */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.darkBlue} />
          </View>
        ) : userCards.length === 0 ? (
          <View style={styles.emptyState}>
            <CreditCard size={48} color={Colors.textGray} />
            <Text style={styles.emptyStateText}>No cards added yet</Text>
            <TouchableOpacity style={styles.emptyStateButton} onPress={() => router.push("/(app)/add-cards")}>
              <Text style={styles.emptyStateButtonText}>Add your first card</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardsList}>
            {sortedCards.map((card) => {
              const isBest = bestCardKeys.includes(card.card_key);
              return (
                <TouchableOpacity
                  key={card.card_key}
                  style={[styles.cardItem, isBest && styles.bestCardHighlight]}
                  onPress={() => router.push(`/(app)/card-details?cardKey=${card.card_key}`)}
                  activeOpacity={0.8}
                >
                  {isBest && (
                    <View style={styles.bestCardBadge}>
                      <Text style={styles.bestCardBadgeText}>BEST</Text>
                    </View>
                  )}

                  {card.card_photo ? (
                    <Image source={{ uri: card.card_photo }} style={styles.cardImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.cardImagePlaceholder}>
                      <CreditCard size={64} color={Colors.darkBlue} />
                      <Text style={styles.cardPlaceholderText}>{card.card_name}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Menu modal */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuContainer, { top: insets.top + 50 }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuOption("add-cards")}>
              <Text style={styles.menuItemText}>Add cards</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuOption("feedback")}>
              <Text style={styles.menuItemText}>Report problem / Send Feedback</Text>
            </TouchableOpacity>

            <View style={styles.menuItemWithToggle}>
              <View>
                <Text style={styles.menuItemText}>Notifications</Text>
                <Text style={styles.menuItemSubtext}>Will be available soon</Text>
              </View>
              <Switch
                value={false}
                onValueChange={() => {}}
                disabled
                trackColor={{ false: Colors.border, true: Colors.darkBlue }}
                thumbColor={Colors.pureWhite}
              />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Logout confirm modal */}
      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmText}>Are you sure you want to log out?</Text>
            <TouchableOpacity style={styles.confirmYesButton} onPress={confirmLogout}>
              <Text style={styles.confirmYesText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmNoButton} onPress={() => setShowLogoutConfirm(false)}>
              <Text style={styles.confirmNoText}>No</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Category list modal */}
      <Modal
        visible={showLocationSearch}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationSearch(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.locationModal, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.locationHeader}>
              <Text style={styles.locationTitle}>Search Category</Text>
              <TouchableOpacity onPress={() => setShowLocationSearch(false)}>
                <X size={24} color={Colors.textDark} />
              </TouchableOpacity>
            </View>

            <View style={styles.categoryListContainer}>
              <FlatList
                data={availableCategories}
                keyExtractor={(item) => item}
                showsVerticalScrollIndicator
                renderItem={({ item }) => {
                  const label = getCategoryDisplayName(item);
                  return (
                    <TouchableOpacity
                      style={[styles.categoryItem, locationQuery === item && styles.categoryItemSelected]}
                      onPress={() => setLocationQuery(item)}
                    >
                      <Text style={[styles.categoryItemText, locationQuery === item && styles.categoryItemTextSelected]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            <TouchableOpacity
              style={[styles.locationSearchButton, isSearching && styles.locationSearchButtonDisabled]}
              onPress={() => handleLocationSearch()}
              disabled={isSearching}
            >
              {isSearching ? <ActivityIndicator color={Colors.pureWhite} /> : <Text style={styles.locationSearchButtonText}>Search</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8EBE4" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  logoContainer: { flex: 1, alignItems: "center" },

  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.darkBlue,
    marginBottom: 12,
  },

  searchWrapper: {
    position: "relative",
    zIndex: 9999,
    elevation: 9999,
    marginBottom: 12,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.pureWhite,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, color: Colors.textDark },

  dropdown: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    maxHeight: 260,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemLast: { borderBottomWidth: 0 },
  dropdownMain: { fontSize: 16, color: Colors.textDark, fontWeight: "500" as const },
  dropdownSecondary: { fontSize: 12, color: Colors.textGray, marginTop: 2 },

  suggestingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingHorizontal: 6 },
  suggestingText: { fontSize: 12, color: Colors.textGray },

  searchResultBanner: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
  },
  searchResultText: { fontSize: 14, fontWeight: "600" as const, color: Colors.darkBlue, marginBottom: 4 },
  searchResultReward: { fontSize: 12, color: Colors.textGray },
  clearSearchButton: { position: "absolute", top: 12, right: 12 },

  cardCount: { fontSize: 12, color: Colors.darkBlue, marginBottom: 12 },

  loadingContainer: { paddingVertical: 60, alignItems: "center", justifyContent: "center" },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyStateText: { fontSize: 16, color: Colors.textGray, marginTop: 16, marginBottom: 20 },
  emptyStateButton: { backgroundColor: Colors.darkBlue, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25 },
  emptyStateButtonText: { fontSize: 14, fontWeight: "600" as const, color: Colors.pureWhite },

  cardsList: { gap: 20, alignItems: "center" },
  cardItem: { alignItems: "center", position: "relative" },
  bestCardHighlight: {
    backgroundColor: "#FFF9E6",
    borderRadius: 20,
    padding: 8,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  bestCardBadge: {
    position: "absolute",
    top: 0,
    right: 8,
    backgroundColor: "#FFD700",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  bestCardBadgeText: { fontSize: 10, fontWeight: "700" as const, color: Colors.darkBlue, letterSpacing: 0.5 },
  cardImage: { width: 300, height: 190, borderRadius: 16, backgroundColor: Colors.cardGray },
  cardImagePlaceholder: {
    width: 300,
    height: 190,
    borderRadius: 16,
    backgroundColor: Colors.cardGray,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  cardPlaceholderText: { fontSize: 12, color: Colors.darkBlue, textAlign: "center", marginTop: 8 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },

  menuContainer: {
    position: "absolute",
    left: 16,
    backgroundColor: Colors.pureWhite,
    borderRadius: 8,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 220,
  },
  menuItem: { paddingVertical: 12, paddingHorizontal: 16 },
  menuItemText: { fontSize: 14, color: Colors.textDark },
  menuItemSubtext: { fontSize: 11, color: Colors.textGray, marginTop: 2 },
  menuItemWithToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 16 },

  confirmModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.pureWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  confirmText: { fontSize: 14, color: Colors.textGray, textAlign: "center", marginBottom: 16 },
  confirmYesButton: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  confirmYesText: { fontSize: 16, color: Colors.error, textAlign: "center" },
  confirmNoButton: { paddingVertical: 14 },
  confirmNoText: { fontSize: 16, color: Colors.textDark, textAlign: "center" },

  locationModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.pureWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  locationHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  locationTitle: { fontSize: 18, fontWeight: "600" as const, color: Colors.darkBlue },

  categoryListContainer: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 250,
  },
  categoryItem: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  categoryItemSelected: { backgroundColor: Colors.lightBlue || "#E8F0FE" },
  categoryItemText: { fontSize: 16, color: Colors.textDark },
  categoryItemTextSelected: { color: Colors.darkBlue, fontWeight: "600" as const },

  locationSearchButton: { backgroundColor: Colors.darkBlue, paddingVertical: 14, borderRadius: 25, alignItems: "center" },
  locationSearchButtonDisabled: { backgroundColor: Colors.border },
  locationSearchButtonText: { fontSize: 16, fontWeight: "600" as const, color: Colors.pureWhite },
});
