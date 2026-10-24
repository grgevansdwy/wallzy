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
import { Mail, KeyRound, ShieldCheck } from "lucide-react-native";
import Colors from "@/constants/colors";
import AuthInput from "@/components/AuthInput";
import AuthButton from "@/components/AuthButton";
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
} from "@/utils/validation";
import { supabase, getSignInRedirectUrl } from "@/lib/supabase";
import { signInWithGoogle, signInWithApple } from "@/lib/oauth";
import { createUserRecord } from "@/services/cardSupabase/cardServices";

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const googleIcon = require("../../assets/images/googleicon.png");
  const appleIcon = require("../../assets/images/appleicon.png");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string | null;
    password?: string | null;
    confirmPassword?: string | null;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateForm = useCallback(() => {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmError = validateConfirmPassword(password, confirmPassword);

    setErrors({
      email: emailError,
      password: passwordError,
      confirmPassword: confirmError,
    });

    return !emailError && !passwordError && !confirmError;
  }, [email, password, confirmPassword]);

  const handleSignUp = useCallback(async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const redirectUrl = getSignInRedirectUrl();

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          setErrors({
            email: "This email is already registered. Please sign in.",
          });
        } else {
          Alert.alert("Sign Up Error", error.message);
        }
        return;
      }

      // Create user record in users table
      if (data.user) {
        try {
          await createUserRecord(data.user.id, email.trim().toLowerCase());
        } catch {
          // Continue even if user record creation fails
        }
      }

      if (data.user && !data.session) {
        setEmailSent(true);
      } else if (data.session) {
        router.replace("/dashboard");
      }
    } catch {
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [email, password, validateForm, router]);

  const handleResendEmail = useCallback(async () => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
      });

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        Alert.alert("Email Sent", "A new confirmation email has been sent.");
      }
    } catch {
      Alert.alert("Error", "Failed to resend email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  const handleGoogleSignUp = useCallback(async () => {
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
        Alert.alert("Sign Up Error", err.message || "Google sign up failed.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleAppleSignUp = useCallback(async () => {
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
        Alert.alert("Sign Up Error", err.message || "Apple sign up failed.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

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
              <View style={styles.successContainer}>
                <View style={styles.iconContainer}>
                  <Mail size={40} color={Colors.pureWhite} />
                </View>
                <Text style={styles.title}>Check Your Email</Text>
                <Text style={styles.subtitle}>
                  We&apos;ve sent a confirmation link to
                </Text>
                <Text style={styles.emailText}>{email}</Text>
                <Text style={styles.instructionText}>
                  Click the link in your email to verify your account. If you
                  don&apos;t see it, check your spam folder.
                </Text>

                <AuthButton
                  title="Open Email App"
                  onPress={() => {
                    Alert.alert(
                      "Info",
                      "Please check your email app for the confirmation link.",
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
              <Text style={styles.title}>Create Your Account</Text>

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
                  icon={KeyRound}
                />

                <AuthInput
                  placeholder="Confirm Password"
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
                  title="Sign up"
                  onPress={handleSignUp}
                  loading={isLoading}
                  style={styles.signUpButton}
                />

                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  onPress={handleGoogleSignUp}
                  activeOpacity={0.8}
                  style={styles.socialBtn}
                >
                  <Image
                    source={googleIcon}
                    style={styles.socialIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.socialText}>Sign up with Google</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleAppleSignUp}
                  activeOpacity={0.8}
                  style={styles.socialBtn}
                >
                  <Image
                    source={appleIcon}
                    style={styles.socialIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.socialText}>Sign up with Apple</Text>
                </TouchableOpacity>

                <View style={styles.signInContainer}>
                  <Text style={styles.signInText}>
                    Already have an account?{" "}
                  </Text>
                  <TouchableOpacity onPress={() => router.replace("/sign-in")}>
                    <Text style={styles.signInLink}>Sign In</Text>
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
  passwordHint: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: -4,
    marginBottom: 20,
    marginLeft: 4,
  },
  signUpButton: {
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
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  signInText: {
    fontSize: 14,
    color: Colors.textGray,
  },
  signInLink: {
    fontSize: 14,
    color: Colors.darkBlue,
    fontWeight: "600" as const,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    marginTop: 40,
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
  subtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: "center",
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
