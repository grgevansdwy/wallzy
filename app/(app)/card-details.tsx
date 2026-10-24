import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Pressable,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft,
  Pencil,
  Trash2,
  ShoppingCart,
  Globe,
  Fuel,
  Utensils,
  Plane,
  CreditCard,
  Check,
  X,
  Tv,
  Bus,
  Building,
  Car,
  Star,
  Film,
  Pill,
  ChevronDown,
  Home,
  Smartphone,
  Dumbbell,
  Store,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { getCategoryDisplayName } from "@/constants/categoryNames";
import { supabase } from "@/lib/supabase";
import {
  fetchCardByKey,
  addUserCard,
  removeUserCard,
  checkUserHasCard,
  saveCustomReward,
  deleteCustomReward,
  fetchCustomRewards,
  deleteAllCustomRewardsForCard,
} from "@/services/cardSupabase/cardServices";
import type { Card, RewardRule, UserCustomCard } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";

// ── Module-level helpers ──────────────────────────────────────────────────────

interface DisplayRewardItem {
  id: string;
  ruleKey: string;
  label: string;
  desc: string | null;
  rate: number | null;
  isBase?: boolean;
}

// [suffix, human-readable description]
const ISSUER_SUFFIXES: [string, string][] = [
  ["amex", "Via Amex Travel"],
  ["chase", "Via Chase Travel"],
  ["capital", "Via Capital One Travel"],
  ["capitalone", "Via Capital One Travel"],
  ["citi", "Via Citi Travel"],
  ["bofa", "Via Bank of America Travel"],
  ["usbank", "Via U.S. Bank Travel"],
];

function getCategoryLabel(key: string): string {
  // Check issuer-suffixed keys first (e.g. travel_amex → "Travel")
  const lower = key.toLowerCase();
  for (const [suffix] of ISSUER_SUFFIXES) {
    if (lower.endsWith(`_${suffix}`)) {
      const base = key.slice(0, key.length - suffix.length - 1);
      return getCategoryDisplayName(base);
    }
  }
  return getCategoryDisplayName(key);
}

function getCategoryDesc(key: string, comment?: string | null): string | null {
  const lower = key.toLowerCase();
  for (const [suffix, desc] of ISSUER_SUFFIXES) {
    if (lower.endsWith(`_${suffix}`)) return desc;
  }
  return comment ?? null;
}

const QUARTER_MONTHS: Record<string, string> = {
  "1": "Jan – Mar",
  "2": "Apr – Jun",
  "3": "Jul – Sep",
  "4": "Oct – Dec",
};

function getRotatingDesc(ruleType: string): string {
  const match = ruleType.match(/rotating_q(\d+)_(\d+)/i);
  if (match) {
    const q = match[1];
    const year = match[2];
    const months = QUARTER_MONTHS[q] ?? "";
    return `Rotating — Q${q} (${months} ${year})`;
  }
  return "Rotating";
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CardDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cardKey } = useLocalSearchParams<{ cardKey: string }>();
  const { user } = useAuth();

  const [card, setCard] = useState<Card | null>(null);
  // Raw reward_rules rows from DB (includes rule_type)
  const [rewardRules, setRewardRules] = useState<RewardRule[]>([]);
  // User's configured choices from user_custom_card
  const [userConfigRules, setUserConfigRules] = useState<UserCustomCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [userHasCard, setUserHasCard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RewardRule | null>(null);
  const [customRate, setCustomRate] = useState("");

  // Config modal states
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // top_multi (Cash+) dropdown states
  const [topCategory1, setTopCategory1] = useState<string | null>(null);
  const [topCategory2, setTopCategory2] = useState<string | null>(null);
  const [top2Category, setTop2Category] = useState<string | null>(null);
  const [showTopDropdown1, setShowTopDropdown1] = useState(false);
  const [showTopDropdown2, setShowTopDropdown2] = useState(false);
  const [showTop2Dropdown, setShowTop2Dropdown] = useState(false);

  // ── Computed sections ────────────────────────────────────────────────────

  // Normal fixed rewards (exclude "everything" — that's base reward)
  const fixedRules = useMemo(
    () =>
      rewardRules
        .filter((r) => r.rule_type === "fixed" && r.rule_key !== "everything")
        .sort((a, b) => b.reward_rate - a.reward_rate),
    [rewardRules],
  );

  // The "everything" (base) rule
  const everythingRule = useMemo(
    () => rewardRules.find((r) => r.rule_key === "everything"),
    [rewardRules],
  );

  // Rotating categories grouped by quarter (rule_type starts with "rotating")
  const rotatingGroups = useMemo(() => {
    const groups: Record<string, RewardRule[]> = {};
    rewardRules
      .filter((r) => r.rule_type?.startsWith("rotating"))
      .forEach((r) => {
        const key = r.rule_type!;
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });
    return groups;
  }, [rewardRules]);

  // DB rules by type — drive config modal
  const customRules = useMemo(
    () => rewardRules.filter((r) => r.rule_type === "custom"),
    [rewardRules],
  );
  const topRules = useMemo(
    () => rewardRules.filter((r) => r.rule_type === "top"),
    [rewardRules],
  );
  const ctaRules = useMemo(
    () => rewardRules.filter((r) => r.rule_type === "cta"),
    [rewardRules],
  );

  // Card needs user configuration if it has top/custom/cta rules
  const isConfigurableCard = useMemo(
    () => customRules.length > 0 || topRules.length > 0 || ctaRules.length > 0,
    [customRules, topRules, ctaRules],
  );

  // What kind of config modal to show
  const configType = useMemo(():
    | "cta"
    | "custom"
    | "top_single"
    | "top_multi"
    | null => {
    if (ctaRules.length > 0) return "cta";
    if (customRules.length > 0) return "custom";
    if (topRules.length > 0) {
      const rates = [...new Set(topRules.map((r) => r.reward_rate))];
      return rates.length > 1 ? "top_multi" : "top_single";
    }
    return null;
  }, [ctaRules, customRules, topRules]);

  // top rules grouped by reward_rate (for top_multi)
  const topRulesByRate = useMemo(() => {
    const map: Record<number, RewardRule[]> = {};
    topRules.forEach((r) => {
      if (!map[r.reward_rate]) map[r.reward_rate] = [];
      map[r.reward_rate].push(r);
    });
    return map;
  }, [topRules]);

  // Distinct top rates sorted descending (highest = primary bonus, lowest = secondary)
  const topRateSorted = useMemo(
    () =>
      Object.keys(topRulesByRate)
        .map(Number)
        .sort((a, b) => b - a),
    [topRulesByRate],
  );

  // Whether this card's sign-up bonus is currently active in the routing engine
  const signupBonusActive = useMemo(
    () => userConfigRules.some((r) => r.rule_key === "signup_bonus"),
    [userConfigRules],
  );

  // User's configured rotation items (exclude "everything" and internal "signup_bonus" key)
  const userConfigDisplay = useMemo(
    () => userConfigRules.filter((r) => r.rule_key !== "everything" && r.rule_key !== "signup_bonus"),
    [userConfigRules],
  );

  // Effective base reward (user override → DB default → 0)
  const effectiveBaseRate = useMemo(() => {
    const override = userConfigRules.find((r) => r.rule_key === "everything");
    if (override) return override.reward_rate;
    return everythingRule?.reward_rate ?? 0;
  }, [userConfigRules, everythingRule]);

  // Whether the card has already been configured by the user
  const isAlreadyConfigured = useMemo(() => {
    if (configType === "cta" && ctaRules.length > 0) {
      return userConfigRules.some((r) => r.rule_key === ctaRules[0].rule_key);
    }
    return userConfigDisplay.length > 0;
  }, [configType, ctaRules, userConfigRules, userConfigDisplay]);

  // Unified reward items list for display
  const allRewardItems = useMemo((): DisplayRewardItem[] => {
    const items: DisplayRewardItem[] = [];

    // 1. Fixed rules (sorted by rate desc)
    fixedRules.forEach((rule) => {
      items.push({
        id: `fixed-${rule.id}`,
        ruleKey: rule.rule_key,
        label: getCategoryLabel(rule.rule_key),
        desc: getCategoryDesc(rule.rule_key, rule.comment),
        rate: rule.reward_rate,
      });
    });

    // 2. User-configured choices (custom / top) — not CTA
    if (configType !== "cta") {
      userConfigDisplay.forEach((cfg) => {
        items.push({
          id: `config-${cfg.id}`,
          ruleKey: cfg.rule_key,
          label: getCategoryLabel(cfg.rule_key),
          desc: "can be changed monthly (custom)",
          rate: cfg.reward_rate,
        });
      });
    }

    // 3. CTA result (if configured)
    if (configType === "cta" && ctaRules.length > 0) {
      const ctaEntry = userConfigRules.find(
        (r) => r.rule_key === ctaRules[0].rule_key,
      );
      if (ctaEntry !== undefined) {
        const isYes = ctaEntry.reward_rate > 0;
        items.push({
          id: `cta-${ctaRules[0].id}`,
          ruleKey: ctaRules[0].rule_key,
          label: getCategoryLabel(ctaRules[0].rule_key),
          desc: isYes
            ? "Used as primary payment method"
            : "Not your default payment",
          rate: isYes ? ctaEntry.reward_rate : null,
        });
      }
    }

    // 4. Rotating quarterly categories
    Object.entries(rotatingGroups).forEach(([quarter, rules]) => {
      rules.forEach((rule) => {
        items.push({
          id: `rotating-${rule.id}`,
          ruleKey: rule.rule_key,
          label: getCategoryLabel(rule.rule_key),
          desc: getRotatingDesc(quarter),
          rate: rule.reward_rate,
        });
      });
    });

    // 5. Base reward — always last
    items.push({
      id: "base",
      ruleKey: "everything",
      label: "Base Reward",
      desc: null,
      rate: effectiveBaseRate,
      isBase: true,
    });

    return items;
  }, [
    fixedRules,
    configType,
    userConfigDisplay,
    ctaRules,
    userConfigRules,
    rotatingGroups,
    effectiveBaseRate,
  ]);

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadCardData();
  }, [cardKey]);

  // Auto-show config modal for configurable cards that aren't set up yet
  useEffect(() => {
    if (
      card &&
      userHasCard &&
      isConfigurableCard &&
      !isLoading &&
      !isAlreadyConfigured &&
      !showConfigModal
    ) {
      const timer = setTimeout(() => setShowConfigModal(true), 500);
      return () => clearTimeout(timer);
    }
  }, [card, userHasCard, isConfigurableCard, isLoading, isAlreadyConfigured]);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadCardData = async () => {
    if (!cardKey) return;
    setIsLoading(true);
    try {
      const cardData = await fetchCardByKey(cardKey);
      setCard(cardData);

      // Fetch raw reward_rules with rule_type
      const { data: rules } = await supabase
        .from("reward_rules")
        .select("*")
        .eq("card_key", cardKey)
        .order("reward_rate", { ascending: false });
      setRewardRules(rules || []);

      if (user) {
        const [hasCard, userConfig] = await Promise.all([
          checkUserHasCard(user.id, cardKey),
          fetchCustomRewards(user.id, cardKey),
        ]);
        setUserHasCard(hasCard);
        setUserConfigRules(userConfig);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  // ── Card add/remove ───────────────────────────────────────────────────────

  const handleAddCard = async () => {
    if (!card || !user) return;
    try {
      await addUserCard(user.id, card.card_key);
      setUserHasCard(true);
      setUserConfigRules([]);
      if (isConfigurableCard) {
        setShowConfigModal(true);
      } else {
        setShowSuccessModal(true);
      }
    } catch {
      Alert.alert("Error", "Failed to add card. Please try again.");
    }
  };

  const handleRemoveCard = () => {
    Alert.alert(
      "Remove Card",
      "Are you sure you want to remove this card from your wallet?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!card || !user) return;
            try {
              await deleteAllCustomRewardsForCard(user.id, card.card_key);
              await removeUserCard(user.id, card.card_key);
              setUserHasCard(false);
              router.back();
            } catch {
              Alert.alert("Error", "Failed to remove card. Please try again.");
            }
          },
        },
      ],
    );
  };

  // ── Edit reward rate ──────────────────────────────────────────────────────

  const handleEditCard = () => setShowEditModal(true);

  const handleEditReward = (rule: RewardRule) => {
    setShowEditModal(false);
    setTimeout(() => {
      setEditingRule(rule);
      setCustomRate(String((rule.reward_rate * 100).toFixed(1)));
    }, 300);
  };

  const handleEditBaseReward = () => {
    if (!userHasCard) return;
    setShowEditModal(false);
    setTimeout(() => {
      const base: RewardRule = everythingRule ?? {
        id: 0,
        card_key: cardKey ?? "",
        rule_key: "everything",
        reward_rate: 0,
        rule_type: "fixed",
        comment: null,
        modal_title: null,
        modal_body: null,
      };
      const override = userConfigRules.find((r) => r.rule_key === "everything");
      setEditingRule({
        ...base,
        reward_rate: override?.reward_rate ?? base.reward_rate,
      });
      setCustomRate(
        String(((override?.reward_rate ?? base.reward_rate) * 100).toFixed(1)),
      );
    }, 300);
  };

  const handleSaveCustomReward = async () => {
    if (!editingRule || !card || !user) return;
    const newRate = parseFloat(customRate) / 100;
    if (isNaN(newRate) || newRate < 0 || newRate > 1) {
      Alert.alert("Invalid Rate", "Please enter a value between 0 and 100");
      return;
    }
    try {
      await saveCustomReward(
        user.id,
        card.card_key,
        editingRule.rule_key,
        newRate,
      );
      await loadCardData();
      setEditingRule(null);
      setCustomRate("");
      Alert.alert("Success", "Reward rate updated successfully");
    } catch {
      Alert.alert("Error", "Failed to update reward rate");
    }
  };

  const handleResetReward = async () => {
    if (!editingRule || !card || !user) return;
    try {
      await deleteCustomReward(user.id, card.card_key, editingRule.rule_key);
      await loadCardData();
      setEditingRule(null);
      setCustomRate("");
      Alert.alert("Success", "Reward rate reset to default");
    } catch {
      Alert.alert("Error", "Failed to reset reward rate");
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingRule(null);
    setCustomRate("");
  };

  // ── Sign-up bonus toggle ──────────────────────────────────────────────────

  const handleSignupBonusToggle = async (value: boolean) => {
    if (!card || !user) return;

    if (value) {
      // Warn the user before activating — this overrides ALL other cards
      Alert.alert(
        "Activate Sign-Up Bonus?",
        "Please make sure you still have the sign-up bonus available and remember to turn it off once you've met the spending requirement. While active, this card will be prioritized over all your other cards for every purchase.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Activate",
            onPress: async () => {
              try {
                const bonusValue = Number(card.bonus_value) || 0;
                const bonusSpending = Number(card.bonus_spending) || 1;
                const effectiveRate =
                  bonusValue > 0 && bonusSpending > 0
                    ? bonusValue / bonusSpending
                    : 0.2;
                await saveCustomReward(user.id, card.card_key, "signup_bonus", effectiveRate);
                await loadCardData();
              } catch {
                Alert.alert("Error", "Failed to activate sign-up bonus.");
              }
            },
          },
        ],
      );
    } else {
      try {
        await deleteCustomReward(user.id, card.card_key, "signup_bonus");
        await loadCardData();
      } catch {
        Alert.alert("Error", "Failed to deactivate sign-up bonus.");
      }
    }
  };

  const handleAddMore = () => {
    setShowSuccessModal(false);
    router.back();
  };

  const handleNext = () => {
    setShowSuccessModal(false);
    router.replace("/dashboard");
  };

  // ── Config modal ──────────────────────────────────────────────────────────

  const resetConfigState = () => {
    setSelectedCategory(null);
    setShowCategoryDropdown(false);
    setTopCategory1(null);
    setTopCategory2(null);
    setTop2Category(null);
    setShowTopDropdown1(false);
    setShowTopDropdown2(false);
    setShowTop2Dropdown(false);
  };

  const handleOpenConfigModal = () => {
    resetConfigState();
    // Pre-populate with existing selections
    if (userConfigDisplay.length > 0) {
      if (configType === "custom" || configType === "top_single") {
        setSelectedCategory(userConfigDisplay[0]?.rule_key ?? null);
      } else if (configType === "top_multi" && topRateSorted.length >= 2) {
        const highRate = topRateSorted[0];
        const lowRate = topRateSorted[topRateSorted.length - 1];
        const highItems = userConfigDisplay.filter(
          (r) => r.reward_rate === highRate,
        );
        const lowItems = userConfigDisplay.filter(
          (r) => r.reward_rate === lowRate,
        );
        setTopCategory1(highItems[0]?.rule_key ?? null);
        setTopCategory2(highItems[1]?.rule_key ?? null);
        setTop2Category(lowItems[0]?.rule_key ?? null);
      }
    }
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    if (!card || !user) return;
    try {
      await deleteAllCustomRewardsForCard(user.id, card.card_key);

      if (configType === "custom" && selectedCategory) {
        const rate = customRules[0]?.reward_rate ?? 0.03;
        await saveCustomReward(user.id, card.card_key, selectedCategory, rate);
      } else if (configType === "top_single" && selectedCategory) {
        const rate = topRules[0]?.reward_rate ?? 0.05;
        await saveCustomReward(user.id, card.card_key, selectedCategory, rate);
      } else if (configType === "top_multi") {
        const highRate = topRateSorted[0];
        const lowRate = topRateSorted[topRateSorted.length - 1];
        if (topCategory1)
          await saveCustomReward(
            user.id,
            card.card_key,
            topCategory1,
            highRate,
          );
        if (topCategory2)
          await saveCustomReward(
            user.id,
            card.card_key,
            topCategory2,
            highRate,
          );
        if (top2Category)
          await saveCustomReward(user.id, card.card_key, top2Category, lowRate);
      }

      await loadCardData();
      setShowConfigModal(false);
      resetConfigState();
      Alert.alert("Success", "Your rewards have been configured!", [
        { text: "OK", onPress: () => router.replace("/dashboard") },
      ]);
    } catch {
      Alert.alert("Error", "Failed to save configuration. Please try again.");
    }
  };

  const handleYesNoResponse = async (isYes: boolean) => {
    if (!card || !user || configType !== "cta" || !ctaRules[0]) return;
    try {
      await deleteAllCustomRewardsForCard(user.id, card.card_key);
      // Save rate=0 for "No" so the modal doesn't auto-show again
      const rateToSave = isYes ? ctaRules[0].reward_rate : 0;
      await saveCustomReward(
        user.id,
        card.card_key,
        ctaRules[0].rule_key,
        rateToSave,
      );
      await loadCardData();
      setShowConfigModal(false);
      router.replace("/dashboard");
    } catch {
      Alert.alert("Error", "Failed to save configuration. Please try again.");
    }
  };

  const isSaveConfigDisabled = () => {
    if (configType === "custom" || configType === "top_single")
      return !selectedCategory;
    if (configType === "top_multi")
      return !topCategory1 || !topCategory2 || !top2Category;
    return false;
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const renderRewardIcon = (ruleKey: string) => {
    const iconMap: Record<string, any> = {
      groceries: ShoppingCart,
      grocery: ShoppingCart,
      travel: Plane,
      dining: Utensils,
      restaurant: Utensils,
      restaurants: Utensils,
      fast_food: Utensils,
      gas: Fuel,
      gas_ev: Fuel,
      ev: Fuel,
      online: Globe,
      online_retail: Globe,
      online_shopping: Globe,
      entertainment: Film,
      streaming: Tv,
      streaming_subscription: Tv,
      streaming_internet_tv: Tv,
      subscription: Tv,
      transit: Bus,
      drugstores: Pill,
      drugstore: Pill,
      drug_stores: Pill,
      pharmacy: Pill,
      flights: Plane,
      flight: Plane,
      hotel: Building,
      hotels: Building,
      car_rental: Car,
      home_improvement: Home,
      home_furnishing: Home,
      home_utilities: Home,
      fitness_clubs: Dumbbell,
      fitness_club: Dumbbell,
      department_stores: Store,
      cell_phone: Smartphone,
      electronic_stores: Store,
      electronic_store: Store,
      apple_pay: Smartphone,
      wholesale: Store,
      everything: Star,
    };
    const lower = ruleKey.toLowerCase();
    // Strip issuer suffix for icon lookup
    for (const [suffix] of ISSUER_SUFFIXES) {
      if (lower.endsWith(`_${suffix}`)) {
        const base = lower.slice(0, lower.length - suffix.length - 1);
        const Icon = iconMap[base] || CreditCard;
        return <Icon size={20} color={Colors.darkBlue} />;
      }
    }
    const Icon = iconMap[lower] || CreditCard;
    return <Icon size={20} color={Colors.darkBlue} />;
  };

  const getWelcomeBonusText = () => {
    if (!card) return "";
    if (card.bonus_value && card.bonus_spending && card.bonus_time) {
      return `Get $${card.bonus_value} cashback after spending $${card.bonus_spending} in ${card.bonus_time} months`;
    }
    return card.comment_bonus ?? "";
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <ChevronLeft size={28} color={Colors.darkBlue} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Card Details</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.darkBlue} />
        </View>
      </View>
    );
  }

  if (!card) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <ChevronLeft size={28} color={Colors.darkBlue} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Card not found</Text>
          <View style={styles.headerButton} />
        </View>
      </View>
    );
  }

  const ctaConfig = ctaRules[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={28} color={Colors.darkBlue} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Card Details</Text>
        {userHasCard ? (
          <TouchableOpacity
            onPress={handleRemoveCard}
            style={styles.headerIconButton}
          >
            <Trash2 size={20} color={Colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.cardFullName}>{card.card_name}</Text>

        <View style={styles.cardImageContainer}>
          {card.card_photo ? (
            <Image
              source={{ uri: card.card_photo }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <CreditCard size={80} color={Colors.darkBlue} />
            </View>
          )}
        </View>

        {!userHasCard && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddCard}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>Add card</Text>
          </TouchableOpacity>
        )}

        {/* ── Unified Rewards Section ── */}
        <View style={styles.rewardsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Rewards</Text>
            <View style={styles.sectionHeaderRight}>
              {userHasCard && (
                <TouchableOpacity
                  onPress={handleEditCard}
                  style={isConfigurableCard ? { marginRight: 12 } : undefined}
                >
                  <Pencil size={18} color={Colors.darkBlue} />
                </TouchableOpacity>
              )}
              {userHasCard && isConfigurableCard && (
                <TouchableOpacity
                  onPress={handleOpenConfigModal}
                  style={styles.configureButton}
                >
                  <Text style={styles.configureButtonText}>Configure</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.rewardsList}>
            {allRewardItems.map((item) => (
              <View key={item.id} style={styles.rewardItem}>
                <View style={styles.rewardLeft}>
                  {renderRewardIcon(item.ruleKey)}
                  <View style={styles.rewardTextContainer}>
                    <Text style={styles.rewardCategory}>{item.label}</Text>
                    {item.desc ? (
                      <Text style={styles.rewardComment}>{item.desc}</Text>
                    ) : null}
                  </View>
                </View>
                {item.rate !== null ? (
                  <Text style={styles.rewardPercentage}>
                    {(item.rate * 100).toFixed(1)}%
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.rewardPercentage,
                      { color: Colors.textGray },
                    ]}
                  >
                    N/A
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* ── Welcome Bonus ── */}
        {getWelcomeBonusText() ? (
          <View style={styles.welcomeBonusSection}>
            <View style={styles.welcomeBonusHeader}>
              <Text style={styles.welcomeBonusTitle}>Welcome Bonus</Text>
              <Switch
                value={signupBonusActive}
                onValueChange={handleSignupBonusToggle}
                trackColor={{ false: Colors.border, true: Colors.darkBlue }}
                thumbColor={Colors.pureWhite}
              />
            </View>
            <Text style={styles.welcomeBonusText}>{getWelcomeBonusText()}</Text>
          </View>
        ) : null}

        {/* ── Details ── */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsList}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Foreign Fee</Text>
              <Text style={styles.detailValue}>{card.foreign_fee ?? "No"}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Annual Fee</Text>
              <Text style={styles.detailValue}>${card.annual_fee}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Rewards</Text>
              <Text style={styles.detailValue}>{card.rewards_type}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Issuer</Text>
              <Text style={styles.detailValue}>{card.issuing_bank}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Network</Text>
              <Text style={styles.detailValue}>{card.network}</Text>
            </View>
          </View>
        </View>

        {/* ── Editor Comments ── */}
        {card.comment_general && (
          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>Editor comments</Text>
            <View style={styles.commentBox}>
              <Text style={styles.commentText}>{card.comment_general}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ════════ MODALS ════════ */}

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <X size={24} color={Colors.textGray} />
            </TouchableOpacity>
            <View style={styles.successIconContainer}>
              <Check size={40} color={Colors.darkBlue} />
            </View>
            <Text style={styles.successTitle}>Card added successfully!</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.addMoreButton}
                onPress={handleAddMore}
                activeOpacity={0.8}
              >
                <Text style={styles.addMoreButtonText}>Add more</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <Text style={styles.nextButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Rewards List Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={handleCloseEditModal}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseEditModal}>
          <Pressable
            style={styles.editModal}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Rewards</Text>
              <TouchableOpacity onPress={handleCloseEditModal}>
                <X size={24} color={Colors.textGray} />
              </TouchableOpacity>
            </View>
            <Text style={styles.editModalSubtitle}>
              Tap a category to customize its rate
            </Text>
            <View style={styles.editRewardsList}>
              {fixedRules.map((rule) => (
                <Pressable
                  key={rule.id}
                  style={({ pressed }) => [
                    styles.editRewardItem,
                    pressed && styles.editRewardItemPressed,
                  ]}
                  onPress={() => handleEditReward(rule)}
                >
                  <View style={styles.rewardLeft}>
                    {renderRewardIcon(rule.rule_key)}
                    <View style={styles.rewardTextContainer}>
                      <Text style={styles.rewardCategory}>
                        {getCategoryLabel(rule.rule_key)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rewardPercentage}>
                    {(rule.reward_rate * 100).toFixed(1)}%
                  </Text>
                </Pressable>
              ))}
              {/* Base reward is always editable */}
              <Pressable
                style={({ pressed }) => [
                  styles.editRewardItem,
                  pressed && styles.editRewardItemPressed,
                ]}
                onPress={handleEditBaseReward}
              >
                <View style={styles.rewardLeft}>
                  <Star size={20} color={Colors.darkBlue} />
                  <View style={styles.rewardTextContainer}>
                    <Text style={styles.rewardCategory}>Base Reward</Text>
                  </View>
                </View>
                <Text style={styles.rewardPercentage}>
                  {(effectiveBaseRate * 100).toFixed(1)}%
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Individual Reward Modal */}
      <Modal
        visible={editingRule !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingRule(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editRewardModal}>
            <Text style={styles.editRewardTitle}>
              Edit {editingRule ? getCategoryLabel(editingRule.rule_key) : ""}{" "}
              Reward
            </Text>
            <Text style={styles.editRewardSubtitle}>
              Enter new reward rate (percentage)
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.rateInput}
                value={customRate}
                onChangeText={setCustomRate}
                keyboardType="decimal-pad"
                placeholder="e.g. 5.0"
                placeholderTextColor={Colors.textGray}
              />
              <Text style={styles.percentSign}>%</Text>
            </View>
            <View style={styles.editRewardButtons}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetReward}
                activeOpacity={0.8}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveCustomReward}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Config Modal (cta / custom / top_single / top_multi) */}
      <Modal
        visible={showConfigModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (isAlreadyConfigured) {
            setShowConfigModal(false);
            resetConfigState();
          }
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (isAlreadyConfigured) {
              setShowConfigModal(false);
              resetConfigState();
            }
          }}
        >
          <Pressable
            style={styles.specialConfigModal}
            onPress={(e) => e.stopPropagation()}
          >
            {/* ── CTA: Yes / No (Apple Card, PayPal) ── */}
            {configType === "cta" && ctaConfig && (
              <>
                <View style={styles.specialConfigHeader}>
                  <Text style={styles.specialConfigTitle}>
                    {ctaConfig.modal_title ??
                      `Do you use ${getCategoryLabel(ctaConfig.rule_key)} as your default payment?`}
                  </Text>
                  {isAlreadyConfigured && (
                    <TouchableOpacity
                      onPress={() => {
                        setShowConfigModal(false);
                        resetConfigState();
                      }}
                    >
                      <X size={24} color={Colors.textGray} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.specialConfigMessage}>
                  {ctaConfig.modal_body ??
                    `If ${getCategoryLabel(ctaConfig.rule_key)} is your go-to payment method, you'll earn ${(ctaConfig.reward_rate * 100).toFixed(0)}% back on every purchase made through it.`}
                </Text>
                <View style={styles.yesNoButtons}>
                  <TouchableOpacity
                    style={styles.noButton}
                    onPress={() => handleYesNoResponse(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.noButtonText}>No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.yesButton}
                    onPress={() => handleYesNoResponse(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.yesButtonText}>Yes</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── Single dropdown: custom (BofA) or top_single (Citi) ── */}
            {(configType === "custom" || configType === "top_single") && (
              <>
                <View style={styles.specialConfigHeader}>
                  <Text style={styles.specialConfigTitle}>
                    Choose Your Bonus Category
                  </Text>
                  {isAlreadyConfigured && (
                    <TouchableOpacity
                      onPress={() => {
                        setShowConfigModal(false);
                        resetConfigState();
                      }}
                    >
                      <X size={24} color={Colors.textGray} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.specialConfigMessage}>
                  Select the category that earns{" "}
                  {(
                    ((configType === "custom"
                      ? customRules[0]?.reward_rate
                      : topRules[0]?.reward_rate) ?? 0) * 100
                  ).toFixed(0)}
                  % back
                </Text>
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() =>
                      setShowCategoryDropdown(!showCategoryDropdown)
                    }
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !selectedCategory && styles.dropdownPlaceholder,
                      ]}
                    >
                      {selectedCategory
                        ? getCategoryLabel(selectedCategory)
                        : "Select a category"}
                    </Text>
                    <ChevronDown size={20} color={Colors.textGray} />
                  </TouchableOpacity>

                  {showCategoryDropdown && (
                    <View style={styles.dropdownList}>
                      <ScrollView
                        style={styles.dropdownScroll}
                        nestedScrollEnabled
                      >
                        {(configType === "custom" ? customRules : topRules).map(
                          (rule) => (
                            <TouchableOpacity
                              key={rule.id}
                              style={[
                                styles.dropdownItem,
                                selectedCategory === rule.rule_key &&
                                  styles.dropdownItemSelected,
                              ]}
                              onPress={() => {
                                setSelectedCategory(rule.rule_key);
                                setShowCategoryDropdown(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  selectedCategory === rule.rule_key &&
                                    styles.dropdownItemTextSelected,
                                ]}
                              >
                                {getCategoryLabel(rule.rule_key)}
                              </Text>
                              {selectedCategory === rule.rule_key && (
                                <Check size={18} color={Colors.darkBlue} />
                              )}
                            </TouchableOpacity>
                          ),
                        )}
                      </ScrollView>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.saveConfigButton,
                      !selectedCategory && styles.saveConfigButtonDisabled,
                    ]}
                    onPress={handleSaveConfig}
                    disabled={!selectedCategory}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveConfigButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── Multi-rate top: two high-rate + one low-rate (Cash+) ── */}
            {configType === "top_multi" && topRateSorted.length >= 2 && (
              <>
                <View style={styles.specialConfigHeader}>
                  <Text style={styles.specialConfigTitle}>
                    Choose Your Bonus Categories
                  </Text>
                  {isAlreadyConfigured && (
                    <TouchableOpacity
                      onPress={() => {
                        setShowConfigModal(false);
                        resetConfigState();
                      }}
                    >
                      <X size={24} color={Colors.textGray} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.specialConfigMessage}>
                  Pick 2 categories for {(topRateSorted[0] * 100).toFixed(0)}%
                  and 1 for{" "}
                  {(topRateSorted[topRateSorted.length - 1] * 100).toFixed(0)}%
                  back
                </Text>
                <View style={styles.cashPlusContainer}>
                  {/* First high-rate category */}
                  <Text style={styles.dropdownLabel}>
                    First {(topRateSorted[0] * 100).toFixed(0)}% Category
                  </Text>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => {
                      setShowTopDropdown1(!showTopDropdown1);
                      setShowTopDropdown2(false);
                      setShowTop2Dropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !topCategory1 && styles.dropdownPlaceholder,
                      ]}
                    >
                      {topCategory1
                        ? getCategoryLabel(topCategory1)
                        : "Select a category"}
                    </Text>
                    <ChevronDown size={20} color={Colors.textGray} />
                  </TouchableOpacity>
                  {showTopDropdown1 && (
                    <View style={styles.dropdownList}>
                      <ScrollView
                        style={styles.dropdownScroll}
                        nestedScrollEnabled
                      >
                        {(topRulesByRate[topRateSorted[0]] ?? [])
                          .filter((r) => r.rule_key !== topCategory2)
                          .map((rule) => (
                            <TouchableOpacity
                              key={rule.id}
                              style={[
                                styles.dropdownItem,
                                topCategory1 === rule.rule_key &&
                                  styles.dropdownItemSelected,
                              ]}
                              onPress={() => {
                                setTopCategory1(rule.rule_key);
                                setShowTopDropdown1(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  topCategory1 === rule.rule_key &&
                                    styles.dropdownItemTextSelected,
                                ]}
                              >
                                {getCategoryLabel(rule.rule_key)}
                              </Text>
                              {topCategory1 === rule.rule_key && (
                                <Check size={18} color={Colors.darkBlue} />
                              )}
                            </TouchableOpacity>
                          ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Second high-rate category */}
                  <Text style={[styles.dropdownLabel, { marginTop: 16 }]}>
                    Second {(topRateSorted[0] * 100).toFixed(0)}% Category
                  </Text>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => {
                      setShowTopDropdown2(!showTopDropdown2);
                      setShowTopDropdown1(false);
                      setShowTop2Dropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !topCategory2 && styles.dropdownPlaceholder,
                      ]}
                    >
                      {topCategory2
                        ? getCategoryLabel(topCategory2)
                        : "Select a category"}
                    </Text>
                    <ChevronDown size={20} color={Colors.textGray} />
                  </TouchableOpacity>
                  {showTopDropdown2 && (
                    <View style={styles.dropdownList}>
                      <ScrollView
                        style={styles.dropdownScroll}
                        nestedScrollEnabled
                      >
                        {(topRulesByRate[topRateSorted[0]] ?? [])
                          .filter((r) => r.rule_key !== topCategory1)
                          .map((rule) => (
                            <TouchableOpacity
                              key={rule.id}
                              style={[
                                styles.dropdownItem,
                                topCategory2 === rule.rule_key &&
                                  styles.dropdownItemSelected,
                              ]}
                              onPress={() => {
                                setTopCategory2(rule.rule_key);
                                setShowTopDropdown2(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  topCategory2 === rule.rule_key &&
                                    styles.dropdownItemTextSelected,
                                ]}
                              >
                                {getCategoryLabel(rule.rule_key)}
                              </Text>
                              {topCategory2 === rule.rule_key && (
                                <Check size={18} color={Colors.darkBlue} />
                              )}
                            </TouchableOpacity>
                          ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Low-rate category */}
                  <Text style={[styles.dropdownLabel, { marginTop: 16 }]}>
                    {(topRateSorted[topRateSorted.length - 1] * 100).toFixed(0)}
                    % Category
                  </Text>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => {
                      setShowTop2Dropdown(!showTop2Dropdown);
                      setShowTopDropdown1(false);
                      setShowTopDropdown2(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !top2Category && styles.dropdownPlaceholder,
                      ]}
                    >
                      {top2Category
                        ? getCategoryLabel(top2Category)
                        : "Select a category"}
                    </Text>
                    <ChevronDown size={20} color={Colors.textGray} />
                  </TouchableOpacity>
                  {showTop2Dropdown && (
                    <View style={styles.dropdownList}>
                      <ScrollView
                        style={styles.dropdownScroll}
                        nestedScrollEnabled
                      >
                        {(
                          topRulesByRate[
                            topRateSorted[topRateSorted.length - 1]
                          ] ?? []
                        ).map((rule) => (
                          <TouchableOpacity
                            key={rule.id}
                            style={[
                              styles.dropdownItem,
                              top2Category === rule.rule_key &&
                                styles.dropdownItemSelected,
                            ]}
                            onPress={() => {
                              setTop2Category(rule.rule_key);
                              setShowTop2Dropdown(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.dropdownItemText,
                                top2Category === rule.rule_key &&
                                  styles.dropdownItemTextSelected,
                              ]}
                            >
                              {getCategoryLabel(rule.rule_key)}
                            </Text>
                            {top2Category === rule.rule_key && (
                              <Check size={18} color={Colors.darkBlue} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.saveConfigButton,
                      { marginTop: 24 },
                      isSaveConfigDisabled() && styles.saveConfigButtonDisabled,
                    ]}
                    onPress={handleSaveConfig}
                    disabled={isSaveConfigDisabled()}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveConfigButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8EBE4",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.darkBlue,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  cardFullName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
    textAlign: "center",
    marginBottom: 16,
  },
  cardImageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  cardImage: {
    width: 280,
    height: 180,
    borderRadius: 12,
    backgroundColor: Colors.cardGray,
  },
  cardImagePlaceholder: {
    width: 280,
    height: 180,
    borderRadius: 12,
    backgroundColor: Colors.cardGray,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    backgroundColor: Colors.darkBlue,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 25,
    alignSelf: "center",
    marginBottom: 24,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.pureWhite,
  },
  rewardsSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  rewardsList: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    overflow: "hidden",
  },
  rewardItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rewardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rewardTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  rewardCategory: {
    fontSize: 14,
    color: Colors.textDark,
  },
  rewardComment: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
  rewardPercentage: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
  },
  welcomeBonusSection: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  welcomeBonusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  welcomeBonusTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
  },
  welcomeBonusText: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
  },
  detailsSection: {
    marginBottom: 20,
  },
  detailsList: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textGray,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.textDark,
  },
  commentsSection: {
    marginBottom: 20,
  },
  commentBox: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  commentText: {
    fontSize: 14,
    color: Colors.textDark,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  successModal: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 16,
    padding: 24,
    width: "80%",
    alignItems: "center",
  },
  modalCloseButton: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: Colors.darkBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.textDark,
    textAlign: "center",
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  addMoreButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: Colors.darkBlue,
    alignItems: "center",
  },
  addMoreButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
  },
  nextButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: Colors.darkBlue,
    alignItems: "center",
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.pureWhite,
  },
  editModal: {
    backgroundColor: Colors.pureWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",
    maxHeight: "80%",
    position: "absolute",
    bottom: 0,
  },
  editModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.darkBlue,
  },
  editModalSubtitle: {
    fontSize: 14,
    color: Colors.textGray,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  editRewardsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  editRewardItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 12,
    minHeight: 60,
  },
  editRewardItemPressed: {
    backgroundColor: Colors.cardGray,
    opacity: 0.8,
  },
  editRewardModal: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 16,
    padding: 24,
    width: "85%",
  },
  editRewardTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
    marginBottom: 8,
  },
  editRewardSubtitle: {
    fontSize: 14,
    color: Colors.textGray,
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  rateInput: {
    flex: 1,
    fontSize: 18,
    color: Colors.textDark,
    paddingVertical: 14,
  },
  percentSign: {
    fontSize: 18,
    color: Colors.textGray,
    marginLeft: 8,
  },
  editRewardButtons: {
    flexDirection: "row",
    gap: 12,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: Colors.error,
    alignItems: "center",
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.error,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: Colors.darkBlue,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.pureWhite,
  },
  configureButton: {
    backgroundColor: Colors.darkBlue,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  configureButtonText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.pureWhite,
  },
  specialConfigModal: {
    backgroundColor: Colors.pureWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",
    maxHeight: "85%",
    position: "absolute",
    bottom: 0,
    paddingBottom: 32,
  },
  specialConfigHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  specialConfigTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.darkBlue,
  },
  specialConfigMessage: {
    fontSize: 14,
    color: Colors.textGray,
    paddingHorizontal: 20,
    paddingVertical: 16,
    lineHeight: 22,
  },
  yesNoButtons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  yesButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: Colors.darkBlue,
    alignItems: "center",
  },
  yesButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.pureWhite,
  },
  noButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: Colors.darkBlue,
    alignItems: "center",
  },
  noButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
  },
  dropdownContainer: {
    paddingHorizontal: 20,
  },
  cashPlusContainer: {
    paddingHorizontal: 20,
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownText: {
    fontSize: 16,
    color: Colors.textDark,
  },
  dropdownPlaceholder: {
    color: Colors.textGray,
  },
  dropdownList: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 200,
    overflow: "hidden",
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: Colors.cardGray,
  },
  dropdownItemText: {
    fontSize: 16,
    color: Colors.textDark,
  },
  dropdownItemTextSelected: {
    color: Colors.darkBlue,
    fontWeight: "600" as const,
  },
  saveConfigButton: {
    backgroundColor: Colors.darkBlue,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 20,
  },
  saveConfigButtonDisabled: {
    opacity: 0.5,
  },
  saveConfigButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.pureWhite,
  },
});
