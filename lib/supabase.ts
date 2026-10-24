import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

export const getRedirectUrl = (path: string = "reset-password") => {
  if (Platform.OS === "web") {
    return `${window.location.origin}/${path}`;
  }
  // For native, use the custom scheme without leading slash
  const customScheme = "com.wallzywallet";
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = `${customScheme}://${cleanPath}`;
  return url;
};

export const getSignInRedirectUrl = () => {
  if (Platform.OS === "web") {
    return `${window.location.origin}/sign-in`;
  }
  const customScheme = "com.wallzywallet";
  const url = `${customScheme}://sign-in`;
  return url;
};
