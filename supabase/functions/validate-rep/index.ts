/**
 * Colosseum — validate-rep Edge Function
 *
 * Anti-cheat authority for rep validation.
 * Validates rep timing, sequencing, and confidence scores.
 * Calculates damage server-side and returns authoritative result.
 *
 * Deploy: supabase functions deploy validate-rep
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

// Game constants
const BASE_DAMAGE = 8;
const FATIGUE_BONUS = 0.5;
const MIN_REP_INTERVAL_MS = 400; // 0.4 seconds minimum between reps
const MIN_CONFIDENCE = 0.2;

// In-memory rep tracking per room (resets when function cold-starts)
// In production, use Supabase or Redis for persistence
const roomState: Record<
  string,
  Record<
    string,
    {
      lastRepTimestamp: number;
      lastRepNumber: number;
    }
  >
> = {};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { roomCode, playerId, repNumber, timestamp, confidenceScore } =
      await req.json();

    // Validate required fields
    if (!roomCode || !playerId || !repNumber || !timestamp) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize room state if needed
    if (!roomState[roomCode]) {
      roomState[roomCode] = {};
    }
    if (!roomState[roomCode][playerId]) {
      roomState[roomCode][playerId] = {
        lastRepTimestamp: 0,
        lastRepNumber: 0,
      };
    }

    const playerState = roomState[roomCode][playerId];

    // Validation 1: Minimum time between reps
    if (
      playerState.lastRepTimestamp > 0 &&
      timestamp - playerState.lastRepTimestamp < MIN_REP_INTERVAL_MS
    ) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Rep too fast — possible cheating detected",
          timeDelta: timestamp - playerState.lastRepTimestamp,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation 2: Sequential rep numbering
    if (repNumber !== playerState.lastRepNumber + 1) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Non-sequential rep number",
          expected: playerState.lastRepNumber + 1,
          received: repNumber,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation 3: Pose confidence threshold
    if (
      confidenceScore !== undefined &&
      confidenceScore < MIN_CONFIDENCE
    ) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Pose confidence too low",
          confidence: confidenceScore,
          threshold: MIN_CONFIDENCE,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rep is valid — calculate damage
    const damage = Math.round(BASE_DAMAGE + repNumber * FATIGUE_BONUS);

    // Update player state
    playerState.lastRepTimestamp = timestamp;
    playerState.lastRepNumber = repNumber;

    // Log the rep event to the database (optional, for auditing)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fire-and-forget insert (don't block the response)
    supabase
      .from("rep_events")
      .insert({
        player_id: playerId,
        rep_number: repNumber,
        damage_dealt: damage,
        confidence_score: confidenceScore ?? null,
      })
      .then(() => {});

    return new Response(
      JSON.stringify({
        valid: true,
        damage,
        repNumber,
        playerId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        valid: false,
        error: `Server error: ${(error as Error).message}`,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
