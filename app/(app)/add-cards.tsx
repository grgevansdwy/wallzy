import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  MoreHorizontal,
  Search,
  Building2,
  CreditCard,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import {
  POPULAR_BANKS,
  fetchAllCards,
  submitCardRequest,
} from "@/services/cardSupabase/cardServices";
import { Card } from "@/types/database";

export default function AddCardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestCardName, setRequestCardName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAllCards();
      setCards(data);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBanks = useMemo(() => {
    if (!searchQuery.trim()) return POPULAR_BANKS;
    return POPULAR_BANKS.filter((bank) =>
      bank.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery]);

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards;
    return cards.filter(
      (card) =>
        card.card_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.issuing_bank.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery, cards]);

  const handleBankPress = (bankName: string) => {
    router.push(`/(app)/bank-cards?bankName=${encodeURIComponent(bankName)}`);
  };

  const handleCardPress = (cardKey: string) => {
    router.push(`/(app)/card-details?cardKey=${encodeURIComponent(cardKey)}`);
  };

  const handleSubmitRequest = async () => {
    const trimmed = requestCardName.trim();
    if (trimmed.length < 3) {
      Alert.alert("Too short", "Please enter at least 3 characters.");
      return;
    }
    try {
      setIsSubmitting(true);
      await submitCardRequest(trimmed);
      setShowRequestModal(false);
      setRequestCardName("");
      Alert.alert("Request sent!", "Thanks! We'll look into adding this card.");
    } catch {
      Alert.alert("Error", "Could not send your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMenuOption = (option: string) => {
    setShowMenu(false);
    if (option === "feedback") {
      router.push("/(app)/feedback");
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header (Back arrow, Add my cards, three dots menu) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={28} color={Colors.darkBlue} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add my cards</Text>
        <TouchableOpacity
          onPress={() => setShowMenu(true)}
          style={styles.headerButton}
        >
          <MoreHorizontal size={24} color={Colors.darkBlue} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color={Colors.textGray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by bank or card name"
          placeholderTextColor={Colors.textGray}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Request card link — always visible below search */}
      <TouchableOpacity
        style={styles.requestLink}
        onPress={() => setShowRequestModal(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.requestLinkText}>
          Don&apos;t have the card you&apos;re looking for?
        </Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionTitle}>Popular banks</Text>
        <View style={styles.banksGrid}>
          {filteredBanks.map((bank) => (
            <TouchableOpacity
              key={bank.id}
              style={styles.bankCard}
              onPress={() => handleBankPress(bank.name)}
              activeOpacity={0.7}
            >
              <View style={styles.bankIconContainer}>
                <Building2 size={28} color={Colors.darkBlue} />
              </View>
              <Text style={styles.bankName} numberOfLines={2}>
                {bank.shortName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>All cards</Text>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.darkBlue} />
          </View>
        ) : (
          <View style={styles.cardsList}>
            {filteredCards.map((card) => (
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
        )}

      </ScrollView>

      {/* Request card modal */}
      <Modal
        visible={showRequestModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalOverlay}>
          <View style={styles.requestModal}>
            <Text style={styles.requestModalTitle}>Request a Card</Text>
            <Text style={styles.requestModalSubtitle}>
              Let us know which card you&apos;d like added. Your request is anonymous — we&apos;ll add it as soon as possible.
            </Text>
            <TextInput
              style={styles.requestInput}
              placeholder="Card name (e.g. Chase Freedom Unlimited)"
              placeholderTextColor={Colors.textGray}
              value={requestCardName}
              onChangeText={setRequestCardName}
              maxLength={100}
              autoFocus
            />
            {requestCardName.trim().length > 0 && requestCardName.trim().length < 3 && (
              <Text style={styles.requestInputError}>
                Please enter at least 3 characters.
              </Text>
            )}
            <TouchableOpacity
              style={[
                styles.requestSubmitButton,
                (requestCardName.trim().length < 3 || isSubmitting) && styles.requestSubmitButtonDisabled,
              ]}
              onPress={handleSubmitRequest}
              disabled={requestCardName.trim().length < 3 || isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.pureWhite} />
              ) : (
                <Text style={styles.requestSubmitText}>Send Request</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.requestCancelButton}
              onPress={() => { setShowRequestModal(false); setRequestCardName(""); }}
            >
              <Text style={styles.requestCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Three dots menu (report feedback) */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowMenu(false)}
        >
          <View style={[styles.menuContainer, { top: insets.top + 50 }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuOption("feedback")}
            >
              <Text style={styles.menuItemText}>
                Report problem/ Send feedback
              </Text>
            </TouchableOpacity>
          </View>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.darkBlue,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.pureWhite,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textDark,
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
    marginTop: 24,
    marginBottom: 12,
  },
  banksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  bankCard: {
    width: "31%",
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: "1.16%",
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bankIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0F4F8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  bankName: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: Colors.textDark,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
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
  cardBankText: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
  cardItemName: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.textDark,
    marginLeft: 12,
    flex: 1,
  },
  requestLink: {
    alignItems: "flex-start",
    paddingVertical: 6,
    marginTop: 2,
    paddingHorizontal: 16,
  },
  requestLinkText: {
    fontSize: 12,
    color: Colors.darkBlue,
    textDecorationLine: "underline",
  },
  requestModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.pureWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 36,
  },
  requestModalTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.darkBlue,
    marginBottom: 8,
  },
  requestModalSubtitle: {
    fontSize: 13,
    color: Colors.textGray,
    marginBottom: 20,
    lineHeight: 18,
  },
  requestInput: {
    backgroundColor: "#F5F7F5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textDark,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
  },
  requestInputError: {
    fontSize: 12,
    color: "#cc0000",
    marginBottom: 10,
    marginLeft: 4,
  },
  requestSubmitButton: {
    backgroundColor: Colors.darkBlue,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 16,
  },
  requestSubmitButtonDisabled: {
    backgroundColor: Colors.border,
  },
  requestSubmitText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.pureWhite,
  },
  requestCancelButton: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  requestCancelText: {
    fontSize: 16,
    color: Colors.textGray,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  menuContainer: {
    position: "absolute",
    right: 16,
    backgroundColor: Colors.pureWhite,
    borderRadius: 8,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 200,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 14,
    color: Colors.textDark,
  },
});
