import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  LogOut,
  Smile,
  Meh,
  Frown,
  SmilePlus,
  Annoyed,
  CheckCircle,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

type Rating = 1 | 2 | 3 | 4 | 5;

// Reversed order: unhappy on left (1), happy on right (5)
const RATING_ICONS = [
  { rating: 1 as Rating, Icon: Frown, label: "Very Unhappy" },
  { rating: 2 as Rating, Icon: Annoyed, label: "Unhappy" },
  { rating: 3 as Rating, Icon: Meh, label: "Neutral" },
  { rating: 4 as Rating, Icon: Smile, label: "Happy" },
  { rating: 5 as Rating, Icon: SmilePlus, label: "Very Happy" },
];

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut, user } = useAuth();

  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSubmit = async () => {
    if (!selectedRating) {
      Alert.alert(
        "Please select a rating",
        "Let us know how your experience was.",
      );
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to submit feedback.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("report_feedback").insert({
        user_id: user.id,
        happy_scale: selectedRating,
        feedback_message: feedback.trim() || null,
      });

      if (error) {
        throw error;
      }

      setShowSuccessModal(true);
    } catch {
      Alert.alert("Error", "Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={28} color={Colors.darkBlue} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Feedback</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
            <LogOut size={24} color={Colors.darkBlue} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.questionText}>
            How&apos;s your experience with Wallzy?
          </Text>

          <View style={styles.ratingsContainer}>
            {RATING_ICONS.map(({ rating, Icon, label }) => (
              <TouchableOpacity
                key={rating}
                style={styles.ratingButton}
                onPress={() => setSelectedRating(rating)}
                activeOpacity={0.7}
              >
                <Icon
                  size={36}
                  color={
                    selectedRating === rating ? Colors.darkBlue : Colors.border
                  }
                  strokeWidth={selectedRating === rating ? 2.5 : 1.5}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.shareText}>Share your thoughts here</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Describe the issue you encountered..."
              placeholderTextColor={Colors.textGray}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? "Sending..." : "Send"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.back();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <CheckCircle size={64} color={Colors.darkBlue} />
            </View>
            <Text style={styles.successTitle}>Thank You!</Text>
            <Text style={styles.successMessage}>
              Your feedback has been submitted successfully.
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
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
  questionText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
    marginTop: 20,
    marginBottom: 20,
  },
  ratingsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  ratingButton: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  shareText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
    marginBottom: 12,
  },
  inputContainer: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    marginBottom: 32,
  },
  textInput: {
    fontSize: 16,
    color: Colors.textDark,
    padding: 16,
    minHeight: 150,
  },
  submitButton: {
    backgroundColor: Colors.darkBlue,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    alignSelf: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.pureWhite,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  successModal: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 20,
    padding: 32,
    marginHorizontal: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.darkBlue,
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  successButton: {
    backgroundColor: Colors.darkBlue,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 25,
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.pureWhite,
  },
});
