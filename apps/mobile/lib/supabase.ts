import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMobileSupabaseClient } from "@proven-power/supabase-client";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY — copy .env.example to .env and fill them in."
  );
}

export const supabase = createMobileSupabaseClient(url, publishableKey, AsyncStorage);
