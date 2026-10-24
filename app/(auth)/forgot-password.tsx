import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Mail } from "lucide-react-native";
import Colors from "@/constants/colors";
import AuthInput from "@/components/AuthInput";
import AuthButton from "@/components/AuthButton";
import { validateEmail } from "@/utils/validation";
import { supabase, getRedirectUrl } from "@/lib/supabase";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSendEmail = useCallback(async () => {
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = getRedirectUrl();

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: redirectUrl,
        },
      );

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      setEmailSent(true);
    } catch {
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  const handleResendEmail = useCallback(async () => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: getRedirectUrl(),
        },
      );

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        Alert.alert(
          "Email Sent",
          "A new reset link has been sent to your email.",
        );
      }
    } catch {
      Alert.alert("Error", "Failed to resend email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  if (emailSent) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={[styles.topSafeArea, { height: insets.top }]} />
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.cardContainer}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ArrowLeft size={24} color={Colors.darkBlue} />
              </TouchableOpacity>

              <View style={styles.successContainer}>
                <View style={styles.iconContainer}>
                  <Mail size={40} color={Colors.pureWhite} />
                </View>
                <Text style={styles.title}>Check Your Email</Text>
                <Text style={styles.subtitle}>
                  We&apos;ve sent a password reset link to
                </Text>
                <Text style={styles.emailText}>{email}</Text>
                <Text style={styles.instructionText}>
                  Click the link in your email to reset your password. If you
                  don&apos;t see it, check your spam folder.
                </Text>

                <AuthButton
                  title="Open Email App"
                  onPress={() => {
                    Alert.alert(
                      "Info",
                      "Please check your email app for the reset link.",
                    );
                  }}
                  style={styles.openEmailButton}
                />

                <TouchableOpacity
                  onPress={handleResendEmail}
                  disabled={isLoading}
                >
                  <Text style={styles.resendText}>
                    Didn&apos;t receive the email?{" "}
                    <Text style={styles.resendLink}>Resend</Text>
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.replace("/sign-in")}
                  style={styles.backToLoginButton}
                >
                  <Text style={styles.backToLoginText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
          <View style={[styles.bottomSafeArea, { height: insets.bottom }]} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={[styles.topSafeArea, { height: insets.top }]} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.cardContainer}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ArrowLeft size={24} color={Colors.darkBlue} />
              </TouchableOpacity>

              <View style={styles.headerContainer}>
                <View style={styles.iconContainerSmall}>
                  <Mail size={28} color={Colors.pureWhite} />
                </View>
                <Text style={styles.title}>Forgot Password?</Text>
                <Text style={styles.subtitle}>
                  No worries! Enter your email address and we&apos;ll send you a
                  link to reset your password.
                </Text>
              </View>

              <View style={styles.formContainer}>
                <AuthInput
                  placeholder="Email"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError(null);
                  }}
                  error={error}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  icon={Mail}
                />

                <AuthButton
                  title="Send Reset Link"
                  onPress={handleSendEmail}
                  loading={isLoading}
                  style={styles.sendButton}
                />

                <TouchableOpacity
                  onPress={() => router.replace("/sign-in")}
                  style={styles.backToLoginButton}
                >
                  <Text style={styles.backToLoginText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <View style={[styles.bottomSafeArea, { height: insets.bottom }]} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cardGray,
  },
  topSafeArea: {
    backgroundColor: Colors.cardGray,
  },
  bottomSafeArea: {
    backgroundColor: Colors.cardGray,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  cardContainer: {
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.pureWhite,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.lightBlue,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  iconContainerSmall: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.lightBlue,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.darkBlue,
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  formContainer: {
    flex: 1,
  },
  sendButton: {
    marginTop: 8,
  },
  backToLoginButton: {
    alignSelf: "center",
    marginTop: 24,
    padding: 8,
  },
  backToLoginText: {
    fontSize: 14,
    color: Colors.darkBlue,
    fontWeight: "600" as const,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    marginTop: 20,
  },
  emailText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.darkBlue,
    marginTop: 4,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
    marginBottom: 28,
  },
  openEmailButton: {
    width: "100%",
    marginBottom: 20,
  },
  resendText: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: "center",
  },
  resendLink: {
    color: Colors.lightBlue,
    fontWeight: "600" as const,
  },
});
