import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";

let GoogleSignin: any = null;
try {
  GoogleSignin =
    require("@react-native-google-signin/google-signin").GoogleSignin;
  GoogleSignin.configure({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
} catch {
}

function generateRawNonce(length = 32): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashNonce(rawNonce: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );
}

export async function signInWithGoogle() {
  if (!GoogleSignin) {
    throw new Error(
      "Google Sign-In requires a development build. It is not available in Expo Go.",
    );
  }
  await GoogleSignin.hasPlayServices();

  const response = await GoogleSignin.signIn();

  if (response.type === "cancelled") {
    throw Object.assign(new Error("Sign in cancelled"), {
      code: "SIGN_IN_CANCELLED",
    });
  }

  // Try idToken from signIn response first, fall back to getTokens()
  let idToken = response.data?.idToken;
  if (!idToken) {
    const tokens = await GoogleSignin.getTokens();
    idToken = tokens.idToken;
  }

  if (!idToken) {
    throw new Error("No ID token returned from Google");
  }

  // "Skip Nonce Check" is enabled in Supabase Dashboard for Google.
  // The free version of @react-native-google-signin does not support
  // passing a custom nonce on iOS.
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });

  if (error) throw error;
  return data;
}

export async function signInWithApple() {
  if (Platform.OS !== "ios") {
    throw new Error("Apple Sign In is only available on iOS");
  }

  const rawNonce = generateRawNonce();
  const hashedNonce = await hashNonce(rawNonce);

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error("No identity token returned from Apple");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });

  if (error) throw error;
  return data;
}
