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
  Image,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mail, KeyRound } from "lucide-react-native";
import Colors from "@/constants/colors";
import AuthInput from "@/components/AuthInput";
import AuthButton from "@/components/AuthButton";
import { validateEmail } from "@/utils/validation";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle, signInWithApple } from "@/lib/oauth";
import { createUserRecord } from "@/services/cardSupabase/cardServices";

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const googleIcon = require("../../assets/images/googleicon.png");
  const appleIcon = require("../../assets/images/appleicon.png");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string | null;
    password?: string | null;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = useCallback(() => {
    const emailError = validateEmail(email);
    const passwordError = password ? null : "Password is required";

    setErrors({ email: emailError, password: passwordError });

    return !emailError && !passwordError;
  }, [email, password]);

  const handleSignIn = useCallback(async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrors({
            email: null,
            password: "Invalid email or password. Please try again.",
          });
        } else if (error.message.includes("Email not confirmed")) {
          Alert.alert(
            "Email Not Verified",
            "Please check your email and click the verification link before signing in.",
            [
              { text: "OK" },
              {
                text: "Resend Email",
                onPress: async () => {
                  const { error: resendError } = await supabase.auth.resend({
                    type: "signup",
                    email: email.trim().toLowerCase(),
                  });
                  if (resendError) {
                    Alert.alert("Error", resendError.message);
                  } else {
                    Alert.alert(
                      "Email Sent",
                      "A new verification email has been sent.",
                    );
                  }
                },
              },
            ],
          );
        } else {
          Alert.alert("Sign In Error", error.message);
        }
        return;
      }

      // Create user record in users table
      if (data.user) {
        try {
          await createUserRecord(data.user.id, data.user.email || "");
        } catch {
          // Continue even if user record creation fails
        }
      }

      router.replace("/dashboard");
    } catch {
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [email, password, validateForm, router]);

  const handleForgotPassword = useCallback(() => {
    router.push("/forgot-password");
  }, [router]);

  const handleGoogleSignIn = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await signInWithGoogle();
      if (data.user) {
        try {
          await createUserRecord(data.user.id, data.user.email || "");
        } catch {
        }
      }
      router.replace("/dashboard");
    } catch (err: any) {
      if (err?.code !== "SIGN_IN_CANCELLED") {
        Alert.alert("Sign In Error", err.message || "Google sign in failed.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleAppleSignIn = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await signInWithApple();
      if (data.user) {
        try {
          await createUserRecord(data.user.id, data.user.email || "");
        } catch {
        }
      }
      router.replace("/dashboard");
    } catch (err: any) {
      if (err?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Sign In Error", err.message || "Apple sign in failed.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

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
              <Text style={styles.title}>Welcome Back</Text>

              <View style={styles.formContainer}>
                <AuthInput
                  placeholder="Email"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email)
                      setErrors((prev) => ({ ...prev, email: null }));
                  }}
                  error={errors.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  icon={Mail}
                />

                <AuthInput
                  placeholder="Password"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password)
                      setErrors((prev) => ({ ...prev, password: null }));
                  }}
                  error={errors.password}
                  isPassword
                  autoCapitalize="none"
                  autoComplete="password"
                  icon={KeyRound}
                />

                <TouchableOpacity
                  onPress={handleForgotPassword}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                <AuthButton
                  title="Sign in"
                  onPress={handleSignIn}
                  loading={isLoading}
                  style={styles.signInButton}
                />

                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  onPress={handleGoogleSignIn}
                  activeOpacity={0.8}
                  style={styles.socialBtn}
                >
                  <Image
                    source={googleIcon}
                    style={styles.socialIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.socialText}>Continue with Google</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleAppleSignIn}
                  activeOpacity={0.8}
                  style={styles.socialBtn}
                >
                  <Image
                    source={appleIcon}
                    style={styles.socialIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.socialText}>Continue with Apple</Text>
                </TouchableOpacity>

                <View style={styles.signUpContainer}>
                  <Text style={styles.signUpText}>
                    Don&apos;t have an account?{" "}
                  </Text>
                  <TouchableOpacity onPress={() => router.replace("/sign-up")}>
                    <Text style={styles.signUpLink}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
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
    paddingTop: 40,
    paddingBottom: 32,
  },
  cardContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.darkBlue,
    textAlign: "center",
    marginBottom: 28,
  },
  formContainer: {
    flex: 1,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 20,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 14,
    color: Colors.lightBlue,
    fontWeight: "600" as const,
  },
  signInButton: {
    marginTop: 4,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.pureWhite,
  },
  dividerText: {
    fontSize: 14,
    color: Colors.textGray,
    fontStyle: "italic",
    marginHorizontal: 16,
  },
  socialButton: {
    marginBottom: 12,
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  signUpText: {
    fontSize: 14,
    color: Colors.textGray,
  },
  signUpLink: {
    fontSize: 14,
    color: Colors.darkBlue,
    fontWeight: "600" as const,
  },
  socialBtn: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 20,
    minHeight: 56,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  socialIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },

  socialText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.textDark,
  },
});
