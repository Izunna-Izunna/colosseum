/**
 * Colosseum — end-duel Edge Function
 *
 * Finalizes a duel by writing results to the database.
 * Called when either player's health reaches 0 or on disconnect forfeit.
 *
 * Deploy: supabase functions deploy end-duel
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      roomCode,
      winnerId,
      playerAReps,
      playerBReps,
      durationSeconds,
    } = await req.json();

    if (!roomCode || !winnerId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("room_code", roomCode)
      .single();

    if (roomError || !room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Don't finalize if already complete
    if (room.status === "complete") {
      return new Response(
        JSON.stringify({ error: "Duel already finalized", duelId: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update room status to complete
    await supabase
      .from("rooms")
      .update({ status: "complete" })
      .eq("id", room.id);

    // Insert duel record
    const { data: duel, error: duelError } = await supabase
      .from("duels")
      .insert({
        room_id: room.id,
        player_a_id: room.player_a_id,
        player_b_id: room.player_b_id,
        winner_id: winnerId,
        player_a_reps: playerAReps ?? 0,
        player_b_reps: playerBReps ?? 0,
        duration_seconds: durationSeconds ?? 0,
      })
      .select("id")
      .single();

    if (duelError) {
      return new Response(
        JSON.stringify({ error: `Failed to create duel record: ${duelError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PHASE 2: Update gladiator win/loss stats here

    return new Response(
      JSON.stringify({
        success: true,
        duelId: duel.id,
        winnerId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Server error: ${(error as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
