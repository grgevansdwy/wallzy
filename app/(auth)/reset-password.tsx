import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import AuthInput from "@/components/AuthInput";
import AuthButton from "@/components/AuthButton";
import { validatePassword, validateConfirmPassword } from "@/utils/validation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    password?: string | null;
    confirmPassword?: string | null;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setIsValidSession(true);
      } else {

        if (Platform.OS === "web") {
          const hashParams = new URLSearchParams(
            window.location.hash.substring(1),
          );
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          const type = hashParams.get("type");

          if (accessToken && type === "recovery") {
            try {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || "",
              });

              if (error) {
                setIsValidSession(false);
              } else {
                setIsValidSession(true);
              }
            } catch {
              setIsValidSession(false);
            }
          } else {
            setIsValidSession(false);
          }
        } else {
          // On mobile, check if we came from a deep link
          const checkDeepLink = async () => {
            const url = await Linking.getInitialURL();

            if (url && url.includes("#")) {
              const hashParams = new URLSearchParams(url.split("#")[1]);
              const accessToken = hashParams.get("access_token");
              const refreshToken = hashParams.get("refresh_token");
              const type = hashParams.get("type");

              if (accessToken && type === "recovery" && refreshToken) {
                try {
                  const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                  });

                  if (error) {
                    setIsValidSession(false);
                  } else {
                    setIsValidSession(true);
                  }
                } catch {
                  setIsValidSession(false);
                }
              } else {
                setIsValidSession(false);
              }
            } else {
              setIsValidSession(false);
            }
          };

          checkDeepLink();
        }
      }
    };

    checkSession();
  }, []);

  const validateForm = useCallback(() => {
    const passwordError = validatePassword(password);
    const confirmError = validateConfirmPassword(password, confirmPassword);

    setErrors({
      password: passwordError,
      confirmPassword: confirmError,
    });

    return !passwordError && !confirmError;
  }, [password, confirmPassword]);

  const handleResetPassword = useCallback(async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      await supabase.auth.signOut();

      setIsSuccess(true);
    } catch {
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [password, validateForm]);

  if (isValidSession === null) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={[styles.topSafeArea, { height: insets.top }]} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.darkBlue} />
            <Text style={styles.loadingText}>Verifying reset link...</Text>
          </View>
          <View style={[styles.bottomSafeArea, { height: insets.bottom }]} />
        </View>
      </>
    );
  }

  if (isValidSession === false) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={[styles.topSafeArea, { height: insets.top }]} />
          <View style={styles.scrollContent}>
            <View style={styles.cardContainer}>
              <View style={styles.errorContainer}>
                <View style={styles.errorIconContainer}>
                  <AlertCircle size={48} color={Colors.pureWhite} />
                </View>
                <Text style={styles.title}>Invalid or Expired Link</Text>
                <Text style={styles.subtitle}>
                  This password reset link is invalid or has expired. Please
                  request a new reset link.
                </Text>

                <AuthButton
                  title="Request New Link"
                  onPress={() => router.replace("/forgot-password")}
                  style={styles.signInButton}
                />

                <TouchableOpacity
                  onPress={() => router.replace("/sign-in")}
                  style={styles.backToLoginButton}
                >
                  <Text style={styles.backToLoginText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View style={[styles.bottomSafeArea, { height: insets.bottom }]} />
        </View>
      </>
    );
  }

  if (isSuccess) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={[styles.topSafeArea, { height: insets.top }]} />
          <View style={styles.scrollContent}>
            <View style={styles.cardContainer}>
              <View style={styles.successContainer}>
                <View style={styles.successIconContainer}>
                  <CheckCircle size={48} color={Colors.pureWhite} />
                </View>
                <Text style={styles.title}>Password Reset!</Text>
                <Text style={styles.subtitle}>
                  Your password has been successfully reset. You can now sign in
                  with your new password.
                </Text>

                <AuthButton
                  title="Sign In"
                  onPress={() => router.replace("/sign-in")}
                  style={styles.signInButton}
                />
              </View>
            </View>
          </View>
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
                onPress={() => router.replace("/sign-in")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ArrowLeft size={24} color={Colors.darkBlue} />
              </TouchableOpacity>

              <View style={styles.headerContainer}>
                <View style={styles.iconContainer}>
                  <Lock size={28} color={Colors.pureWhite} />
                </View>
                <Text style={styles.title}>Reset Password</Text>
                <Text style={styles.subtitle}>
                  Create a new password for your account. Make sure it&apos;s
                  strong and secure.
                </Text>
              </View>

              <View style={styles.formContainer}>
                <AuthInput
                  placeholder="New Password"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password)
                      setErrors((prev) => ({ ...prev, password: null }));
                  }}
                  error={errors.password}
                  isPassword
                  autoCapitalize="none"
                  icon={KeyRound}
                />

                <AuthInput
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword)
                      setErrors((prev) => ({ ...prev, confirmPassword: null }));
                  }}
                  error={errors.confirmPassword}
                  isPassword
                  autoCapitalize="none"
                  icon={ShieldCheck}
                />

                <Text style={styles.passwordHint}>
                  Must be at least 8 characters, include uppercase letter,
                  lowercase letter, and number.
                </Text>

                <AuthButton
                  title="Reset Password"
                  onPress={handleResetPassword}
                  loading={isLoading}
                  style={styles.resetButton}
                />
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
  passwordHint: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: -4,
    marginBottom: 20,
    marginLeft: 4,
  },
  resetButton: {
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textGray,
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.success,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  errorIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.error,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  signInButton: {
    width: "100%",
    marginTop: 20,
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
});
