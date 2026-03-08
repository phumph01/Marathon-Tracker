import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabaseClient, getOwnerUid } from "./supabaseClient";
import { sanitizePersistedAppState, type PersistedAppState } from "./storage";

const APP_STATE_TABLE = "app_state";
const APP_STATE_ROW_ID = "primary";

interface AppStateRow {
  id: string;
  owner_uid: string;
  state: PersistedAppState;
  updated_at: string;
}

export async function loadCloudState(): Promise<PersistedAppState | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.from(APP_STATE_TABLE).select("state").eq("id", APP_STATE_ROW_ID).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data?.state) {
    return null;
  }
  return sanitizePersistedAppState(data.state as Partial<PersistedAppState>);
}

export async function saveCloudState(state: PersistedAppState, ownerUid: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }
  const sanitized = sanitizePersistedAppState(state);
  if (!sanitized) {
    throw new Error("Cannot save invalid app state.");
  }
  const row: AppStateRow = {
    id: APP_STATE_ROW_ID,
    owner_uid: ownerUid,
    state: sanitized,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from(APP_STATE_TABLE).upsert(row, { onConflict: "id" });
  if (error) {
    throw error;
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export function subscribeAuthStateChanged(
  onChanged: (event: AuthChangeEvent, session: Session | null) => void
): (() => void) | null {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange(onChanged);
  return () => subscription.unsubscribe();
}

export async function signInWithEmailPassword(email: string, password: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
}

export async function signOutSession(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export function isOwnerSession(session: Session | null): boolean {
  const ownerUid = getOwnerUid();
  if (!ownerUid || !session?.user?.id) {
    return false;
  }
  return session.user.id === ownerUid;
}

export async function importLocalStateIfCloudEmpty(localState: PersistedAppState, ownerUid: string): Promise<boolean> {
  const existing = await loadCloudState();
  if (existing) {
    return false;
  }
  await saveCloudState(localState, ownerUid);
  return true;
}
