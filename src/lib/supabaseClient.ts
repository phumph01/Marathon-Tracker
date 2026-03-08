import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const OWNER_UID = import.meta.env.VITE_OWNER_UID as string | undefined;
const DEFAULT_OWNER_UID = "23aa1744-ae41-41c9-b62a-757ea2f48931";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getOwnerUid(): string | null {
  const configuredUid = OWNER_UID?.trim();
  if (configuredUid && configuredUid.length > 0) {
    return configuredUid;
  }
  return DEFAULT_OWNER_UID;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (client) {
    return client;
  }
  client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return client;
}
