import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

/**
 * Get or create a persistent guest ID stored in localStorage.
 * Used to identify players across page reloads within a session.
 */
export function getGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("colosseum_guest_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("colosseum_guest_id", id);
  }
  return id;
}

/**
 * Get or set the guest display name in localStorage.
 */
export function getGuestName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("colosseum_guest_name") || "";
}

export function setGuestName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("colosseum_guest_name", name);
}
