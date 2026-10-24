import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, CreditCard } from "lucide-react-native";
import Colors from "@/constants/colors";
import { fetchCardsByBank } from "@/services/cardSupabase/cardServices";
import type { Card } from "@/types/database";

export default function BankCardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bankName } = useLocalSearchParams<{ bankName: string }>();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCards();
  }, [bankName]);

  const loadCards = async () => {
    if (!bankName) return;
    setIsLoading(true);
    try {
      const data = await fetchCardsByBank(bankName);
      setCards(data);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardPress = (cardKey: string) => {
    router.push(`/(app)/card-details?cardKey=${cardKey}`);
  };

  if (!bankName) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <ChevronLeft size={28} color={Colors.darkBlue} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bank not found</Text>
          <View style={styles.headerButton} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* header (back arrow, bank name)) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={28} color={Colors.darkBlue} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{bankName}</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Matching cards */}
        <Text style={styles.sectionTitle}>Matching cards</Text>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.darkBlue} />
          </View>
        ) : (
          <>
            <View style={styles.cardsList}>
              {cards.map((card) => (
                <TouchableOpacity
                  key={card.card_key}
                  style={styles.cardItem}
                  onPress={() => handleCardPress(card.card_key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardItemLeft}>
                    <CreditCard size={20} color={Colors.darkBlue} />
                    <Text style={styles.cardItemName} numberOfLines={1}>
                      {card.card_name}
                    </Text>
                  </View>
                  <View style={styles.cardItemRight}>
                    {card.card_photo ? (
                      <Image
                        source={{ uri: card.card_photo }}
                        style={styles.cardThumbnail}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.cardRewardText}>
                        {(card.base_reward * 100).toFixed(1)}%
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {/* If no matching cards */}
            {cards.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No cards found for this bank
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.darkBlue,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
    marginTop: 8,
    marginBottom: 16,
  },
  cardsList: {
    gap: 12,
  },
  cardItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  cardItemRight: {
    alignItems: "flex-end",
  },
  cardRewardText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
  },
  cardThumbnail: {
    width: 50,
    height: 32,
    borderRadius: 6,
    backgroundColor: Colors.cardGray,
  },
  cardItemName: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.textDark,
    marginLeft: 12,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textGray,
  },
});
